-- Forms MESRC Phase 2: First-Time Setup Wizard, Invite-Gated OTP Throttling, Invitations, and Maintenance Integration Settings.
-- Security rules:
-- 1. First-time wizard claims bootstrap_email ONLY when 0 maintenance profiles exist and bootstrap_consumed_at is null.
-- 2. Once the first Maintenance user verifies OTP, bootstrap_consumed_at is set and the public claim endpoint is permanently locked.
-- 3. Integration secrets (Google Drive Service Account / OAuth refresh token, SMTP credential) are stored ONLY in private.integration_secrets (never exposed to public/anon/authenticated SELECT).
-- 4. OTP eligibility check is rate-limited per email to prevent abuse.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- private tables (never exposed to PostgREST)
create table if not exists private.otp_rate_limits (
  email_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 1
);
revoke all on table private.otp_rate_limits from public, anon, authenticated;

create table if not exists private.integration_secrets (
  provider text primary key check (provider in ('google_drive', 'email_smtp')),
  config_public jsonb not null default '{}'::jsonb,             -- non-secret metadata (e.g. shared_drive_id, root_folder_id, account_email, sender_email)
  secret_ciphertext bytea,                                      -- pgp_sym_encrypt encrypted payload using internal key
  has_secret boolean not null default false,
  validation_state text not null default 'not_configured' check (validation_state in ('not_configured', 'configured', 'connection_failed')),
  last_checked_at timestamptz,
  last_error text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
revoke all on table private.integration_secrets from public, anon, authenticated;

insert into private.integration_secrets (provider) values ('google_drive'), ('email_smtp')
on conflict (provider) do nothing;

create table if not exists private.internal_keys (
  id boolean primary key default true check (id),
  key_material text not null default encode(extensions.gen_random_bytes(32), 'hex')
);
revoke all on table private.internal_keys from public, anon, authenticated;
insert into private.internal_keys default values on conflict (id) do nothing;

-- Add wizard_completed_at to company_settings so Maintenance knows if initial Drive wizard finished
alter table public.company_settings
  add column if not exists setup_wizard_completed_at timestamptz;

grant select (id, company_name, timezone, setup_wizard_completed_at, updated_at) on public.company_settings to authenticated;

-- ---------------------------------------------------------------- 1. Public Setup State Check
-- Returns ONLY boolean flags (never emails or secrets) so the client knows whether to render the First-Time Setup Wizard.
create or replace function public.get_system_setup_state()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_has_maintenance boolean;
  v_bootstrap_pending boolean;
  v_wizard_completed boolean;
begin
  select exists (select 1 from public.profiles where role = 'maintenance' and is_active)
    into v_has_maintenance;
  select (bootstrap_email is not null and bootstrap_consumed_at is null),
         (setup_wizard_completed_at is not null)
    into v_bootstrap_pending, v_wizard_completed
    from public.company_settings where id;

  return jsonb_build_object(
    'needs_first_maintenance', not coalesce(v_has_maintenance, false),
    'bootstrap_email_pending_otp', coalesce(v_bootstrap_pending, false) and not coalesce(v_has_maintenance, false),
    'setup_wizard_completed', coalesce(v_wizard_completed, false)
  );
end;
$$;
revoke all on function public.get_system_setup_state() from public;
grant execute on function public.get_system_setup_state() to anon, authenticated;

-- ---------------------------------------------------------------- 2. First-Time Setup Wizard Step 1: Claim First Maintenance Email
-- Callable ONLY when no Maintenance profile exists yet. Sets bootstrap_email so Supabase Auth OTP sign-in succeeds for that address.
create or replace function public.claim_first_maintenance_email(p_email text, p_company_name text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;

  if exists (select 1 from public.profiles where role = 'maintenance') then
    raise exception 'First-time setup is already locked because a Maintenance account exists.' using errcode = '42501';
  end if;

  if exists (select 1 from public.company_settings where id and bootstrap_consumed_at is not null) then
    raise exception 'Bootstrap setup has already been consumed.' using errcode = '42501';
  end if;

  update public.company_settings
     set bootstrap_email = v_email,
         company_name = coalesce(nullif(btrim(p_company_name), ''), company_name),
         updated_at = now()
   where id;

  insert into public.audit_events (actor_id, action, target_type, detail)
    values (null, 'wizard.bootstrap_email_claimed', 'company_settings', '{"step":"1_email"}'::jsonb);

  return jsonb_build_object('ok', true, 'email', v_email);
end;
$$;
revoke all on function public.claim_first_maintenance_email(text, text) from public;
grant execute on function public.claim_first_maintenance_email(text, text) to anon, authenticated;

-- ---------------------------------------------------------------- 3. Invite-Gated OTP Pre-Check with Rate Limiting
-- Checks whether an email is allowed to request an OTP (active profile, open valid invite, or pending bootstrap_email).
-- Enforces max 5 attempts per 10 minutes per email hash.
create or replace function public.request_otp_eligibility(p_email text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_hash text;
  v_limit private.otp_rate_limits%rowtype;
  v_allowed boolean := false;
begin
  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;

  v_hash := encode(extensions.digest(v_email, 'sha256'), 'hex');

  select * into v_limit from private.otp_rate_limits where email_hash = v_hash for update;
  if found then
    if v_limit.window_started_at < now() - interval '10 minutes' then
      update private.otp_rate_limits set window_started_at = now(), attempt_count = 1 where email_hash = v_hash;
    elsif v_limit.attempt_count >= 5 then
      raise exception 'Too many OTP requests. Please wait 10 minutes before trying again.' using errcode = 'P0001';
    else
      update private.otp_rate_limits set attempt_count = attempt_count + 1 where email_hash = v_hash;
    end if;
  else
    insert into private.otp_rate_limits (email_hash, window_started_at, attempt_count) values (v_hash, now(), 1);
  end if;

  if exists (select 1 from public.profiles where email = v_email and is_active) then
    v_allowed := true;
  elsif exists (
    select 1 from public.invites
     where email = v_email and accepted_at is null and revoked_at is null and expires_at > now()
  ) then
    v_allowed := true;
  elsif exists (
    select 1 from public.company_settings
     where id and bootstrap_email = v_email and bootstrap_consumed_at is null
  ) and not exists (select 1 from public.profiles where role = 'maintenance') then
    v_allowed := true;
  end if;

  if not v_allowed then
    insert into public.audit_events (actor_id, action, target_type, detail)
      values (null, 'auth.otp_blocked_uninvited', 'auth', jsonb_build_object('email_hash', left(v_hash, 16)));
    raise exception 'This email is not invited or active. Access is by invitation only.' using errcode = '42501';
  end if;

  insert into public.audit_events (actor_id, action, target_type, detail)
    values (null, 'auth.otp_eligible', 'auth', jsonb_build_object('email_hash', left(v_hash, 16)));

  return jsonb_build_object('eligible', true);
end;
$$;
revoke all on function public.request_otp_eligibility(text) from public;
grant execute on function public.request_otp_eligibility(text) to anon, authenticated;

-- ---------------------------------------------------------------- 4. Create & Manage Invitations (Role Matrix Enforced)
-- Returns the raw opaque invitation token once to the caller so the UI can display/copy the invite link and enqueue email.
-- Stores only SHA-256 token_hash in public.invites.
create or replace function public.create_invitation(p_email text, p_role public.app_role, p_expires_days integer default 7)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_uid uuid := (select auth.uid());
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_raw_token text;
  v_token_hash text;
  v_invite_id uuid;
  v_expires timestamptz;
begin
  if v_caller is null or v_caller = 'user' then
    raise exception 'Not authorized to create invitations.' using errcode = '42501';
  end if;
  if v_caller = 'admin' and p_role <> 'user' then
    raise exception 'Admins may invite Users only.' using errcode = '42501';
  end if;
  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;
  if p_expires_days < 1 or p_expires_days > 30 then
    raise exception 'Expiration must be between 1 and 30 days.' using errcode = '22023';
  end if;

  -- Revoke any previous open invite for the same email before issuing a fresh one
  update public.invites
     set revoked_at = now()
   where email = v_email and accepted_at is null and revoked_at is null;

  v_raw_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_expires := now() + make_interval(days => p_expires_days);

  insert into public.invites (email, role, invited_by, token_hash, expires_at)
    values (v_email, p_role, v_uid, v_token_hash, v_expires)
    returning id into v_invite_id;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'invite.created', 'invite', v_invite_id::text, jsonb_build_object('role', p_role));

  return jsonb_build_object(
    'id', v_invite_id,
    'email', v_email,
    'role', p_role,
    'expires_at', v_expires,
    'invite_token', v_raw_token
  );
end;
$$;
revoke all on function public.create_invitation(text, public.app_role, integer) from public, anon;
grant execute on function public.create_invitation(text, public.app_role, integer) to authenticated;

-- Validate an opaque invitation token (for /invite/accept screen) without authenticating the user yet.
create or replace function public.inspect_invitation_token(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_hash text := encode(extensions.digest(btrim(coalesce(p_token, '')), 'sha256'), 'hex');
  v_inv public.invites%rowtype;
begin
  select * into v_inv from public.invites
   where token_hash = v_hash and accepted_at is null and revoked_at is null and expires_at > now();
  if not found then
    raise exception 'This invitation link is invalid, expired, or has been revoked.' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'email', v_inv.email,
    'role', v_inv.role,
    'expires_at', v_inv.expires_at
  );
end;
$$;
revoke all on function public.inspect_invitation_token(text) from public;
grant execute on function public.inspect_invitation_token(text) to anon, authenticated;

-- ---------------------------------------------------------------- 5. Maintenance Integration Settings (Write-Only Secrets)
-- Only Maintenance can view status or save/rotate/clear integration settings.
create or replace function public.get_integration_settings_status()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_drive private.integration_secrets%rowtype;
  v_smtp private.integration_secrets%rowtype;
  v_comp public.company_settings%rowtype;
begin
  if v_caller <> 'maintenance' then
    raise exception 'Only Maintenance accounts may access integration settings.' using errcode = '42501';
  end if;

  select * into v_drive from private.integration_secrets where provider = 'google_drive';
  select * into v_smtp from private.integration_secrets where provider = 'email_smtp';
  select * into v_comp from public.company_settings where id;

  return jsonb_build_object(
    'company', jsonb_build_object(
      'company_name', v_comp.company_name,
      'timezone', v_comp.timezone,
      'setup_wizard_completed_at', v_comp.setup_wizard_completed_at
    ),
    'google_drive', jsonb_build_object(
      'config_public', v_drive.config_public,
      'has_secret', v_drive.has_secret,
      'validation_state', v_drive.validation_state,
      'last_checked_at', v_drive.last_checked_at,
      'last_error', v_drive.last_error,
      'updated_at', v_drive.updated_at
    ),
    'email_smtp', jsonb_build_object(
      'config_public', v_smtp.config_public,
      'has_secret', v_smtp.has_secret,
      'validation_state', v_smtp.validation_state,
      'last_checked_at', v_smtp.last_checked_at,
      'last_error', v_smtp.last_error,
      'updated_at', v_smtp.updated_at
    )
  );
end;
$$;
revoke all on function public.get_integration_settings_status() from public, anon;
grant execute on function public.get_integration_settings_status() to authenticated;

create or replace function public.save_google_drive_settings(
  p_account_email text,
  p_shared_drive_id text,
  p_root_folder_id text,
  p_root_folder_name text default 'Forms MESRC',
  p_client_id text default null,
  p_secret_json text default null,      -- write-only: service account JSON or OAuth client secret / refresh token bundle
  p_mark_wizard_complete boolean default true
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_uid uuid := (select auth.uid());
  v_key text;
  v_cipher bytea;
  v_has_secret boolean;
  v_state text;
  v_public jsonb;
begin
  if v_caller <> 'maintenance' then
    raise exception 'Only Maintenance accounts may modify Google Drive settings.' using errcode = '42501';
  end if;

  if btrim(coalesce(p_shared_drive_id, '')) = '' or btrim(coalesce(p_root_folder_id, '')) = '' then
    raise exception 'Shared Drive ID and Root Folder ID (Forms MESRC) are required.' using errcode = '22023';
  end if;

  select key_material into v_key from private.internal_keys where id;
  select secret_ciphertext, has_secret into v_cipher, v_has_secret
    from private.integration_secrets where provider = 'google_drive';

  if p_secret_json is not null and btrim(p_secret_json) <> '' then
    v_cipher := extensions.pgp_sym_encrypt(btrim(p_secret_json), v_key);
    v_has_secret := true;
  end if;

  v_state := case when v_has_secret then 'configured' else 'not_configured' end;
  v_public := jsonb_build_object(
    'account_email', lower(btrim(coalesce(p_account_email, ''))),
    'shared_drive_id', btrim(p_shared_drive_id),
    'root_folder_id', btrim(p_root_folder_id),
    'root_folder_name', coalesce(nullif(btrim(p_root_folder_name), ''), 'Forms MESRC'),
    'client_id', btrim(coalesce(p_client_id, '')),
    'max_file_size_bytes', 1073741824
  );

  update private.integration_secrets
     set config_public = v_public,
         secret_ciphertext = v_cipher,
         has_secret = v_has_secret,
         validation_state = v_state,
         last_checked_at = now(),
         last_error = null,
         updated_by = v_uid,
         updated_at = now()
   where provider = 'google_drive';

  if p_mark_wizard_complete then
    update public.company_settings
       set setup_wizard_completed_at = coalesce(setup_wizard_completed_at, now()),
           updated_at = now()
     where id;
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'settings.google_drive_saved', 'integration_secrets', 'google_drive',
            jsonb_build_object('has_secret', v_has_secret, 'validation_state', v_state));

  return jsonb_build_object('ok', true, 'validation_state', v_state, 'has_secret', v_has_secret);
end;
$$;
revoke all on function public.save_google_drive_settings(text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.save_google_drive_settings(text, text, text, text, text, text, boolean) to authenticated;

create or replace function public.clear_integration_secret(p_provider text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_uid uuid := (select auth.uid());
begin
  if v_caller <> 'maintenance' then
    raise exception 'Only Maintenance accounts may clear integration secrets.' using errcode = '42501';
  end if;
  update private.integration_secrets
     set secret_ciphertext = null,
         has_secret = false,
         validation_state = 'not_configured',
         last_checked_at = now(),
         updated_by = v_uid,
         updated_at = now()
   where provider = p_provider;

  insert into public.audit_events (actor_id, action, target_type, target_id)
    values (v_uid, 'settings.integration_secret_cleared', 'integration_secrets', p_provider);

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.clear_integration_secret(text) from public, anon;
grant execute on function public.clear_integration_secret(text) to authenticated;