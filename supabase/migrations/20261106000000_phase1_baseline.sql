-- Forms MESRC Phase 1: security baseline.
-- Tables: company_settings, services, profiles, profile_services, invites, audit_events.
-- Principles: RLS on every table from creation, default deny, roles stored server-side in
-- profiles (never from user_metadata), SECURITY DEFINER helpers in a private schema with fixed search_path.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create type public.app_role as enum ('maintenance', 'admin', 'user');

-- ---------------------------------------------------------------- tables
create table public.company_settings (
  id boolean primary key default true check (id),              -- single-row table
  company_name text not null default 'Company',
  timezone text not null default 'UTC',
  bootstrap_email text,                                          -- first Maintenance account (normalized, lowercase)
  bootstrap_consumed_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint bootstrap_email_normalized check (bootstrap_email is null or bootstrap_email = lower(btrim(bootstrap_email)))
);
insert into public.company_settings default values;

create table public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index services_name_unique on public.services (lower(name));

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  phone text,
  role public.app_role not null default 'user',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint profiles_email_normalized check (email = lower(btrim(email)))
);
create unique index profiles_email_unique on public.profiles (email);

create table public.profile_services (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (profile_id, service_id)
);
create index profile_services_service_idx on public.profile_services (service_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.app_role not null,
  invited_by uuid not null references public.profiles (id),
  token_hash text not null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invites_email_normalized check (email = lower(btrim(email))),
  constraint invites_token_hash_unique unique (token_hash)
);
create index invites_email_idx on public.invites (email);
create index invites_invited_by_idx on public.invites (invited_by);
create unique index invites_one_open_per_email on public.invites (email)
  where accepted_at is null and revoked_at is null;

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  detail jsonb not null default '{}'::jsonb,                    -- never OTP, token or form answers
  created_at timestamptz not null default now()
);
create index audit_events_created_idx on public.audit_events (created_at desc);
create index audit_events_actor_idx on public.audit_events (actor_id);

-- ---------------------------------------------------------------- helpers (no recursive RLS)
create function private.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = (select auth.uid()) and p.is_active
$$;
revoke all on function private.current_app_role() from public, anon;
grant execute on function private.current_app_role() to authenticated;

-- ---------------------------------------------------------------- RLS
alter table public.company_settings enable row level security;
alter table public.services enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_services enable row level security;
alter table public.invites enable row level security;
alter table public.audit_events enable row level security;

-- Start from zero privileges for API roles, then grant narrowly.
revoke all on public.company_settings, public.services, public.profiles,
  public.profile_services, public.invites, public.audit_events from anon, authenticated;

-- company_settings: any active member reads (bootstrap fields hidden via column grants); Maintenance writes.
grant select (id, company_name, timezone, updated_at) on public.company_settings to authenticated;
grant update (company_name, timezone, updated_at) on public.company_settings to authenticated;
create policy company_settings_read on public.company_settings for select to authenticated
  using ((select private.current_app_role()) is not null);
create policy company_settings_update on public.company_settings for update to authenticated
  using ((select private.current_app_role()) = 'maintenance')
  with check ((select private.current_app_role()) = 'maintenance');

-- services
grant select on public.services to authenticated;
grant insert, update, delete on public.services to authenticated;
create policy services_read on public.services for select to authenticated
  using ((select private.current_app_role()) is not null);
create policy services_insert on public.services for insert to authenticated
  with check ((select private.current_app_role()) = 'maintenance');
create policy services_update on public.services for update to authenticated
  using ((select private.current_app_role()) = 'maintenance')
  with check ((select private.current_app_role()) = 'maintenance');
create policy services_delete on public.services for delete to authenticated
  using ((select private.current_app_role()) = 'maintenance');

-- profiles: own row, or all rows for Maintenance/Admin. Users may edit only name/phone on their own row.
grant select on public.profiles to authenticated;
grant update (display_name, phone) on public.profiles to authenticated;
create policy profiles_read_own on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy profiles_read_staff on public.profiles for select to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid()) and (select private.current_app_role()) is not null)
  with check (id = (select auth.uid()));

-- profile_services
grant select on public.profile_services to authenticated;
grant insert, delete on public.profile_services to authenticated;
create policy profile_services_read on public.profile_services for select to authenticated
  using (profile_id = (select auth.uid()) or (select private.current_app_role()) in ('maintenance', 'admin'));
create policy profile_services_insert on public.profile_services for insert to authenticated
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));
create policy profile_services_delete on public.profile_services for delete to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'));

-- invites: Maintenance manages every role; Admin manages User invites only. Token hash never readable.
grant select (id, email, role, invited_by, expires_at, accepted_at, revoked_at, created_at) on public.invites to authenticated;
grant insert (email, role, invited_by, token_hash, expires_at) on public.invites to authenticated;
grant update (revoked_at) on public.invites to authenticated;
create policy invites_read on public.invites for select to authenticated
  using (
    (select private.current_app_role()) = 'maintenance'
    or ((select private.current_app_role()) = 'admin' and role = 'user')
  );
create policy invites_insert on public.invites for insert to authenticated
  with check (
    invited_by = (select auth.uid())
    and (
      (select private.current_app_role()) = 'maintenance'
      or ((select private.current_app_role()) = 'admin' and role = 'user')
    )
  );
create policy invites_revoke on public.invites for update to authenticated
  using (
    (select private.current_app_role()) = 'maintenance'
    or ((select private.current_app_role()) = 'admin' and role = 'user')
  )
  with check (
    (select private.current_app_role()) = 'maintenance'
    or ((select private.current_app_role()) = 'admin' and role = 'user')
  );

-- audit_events: Maintenance reads; no client writes (written by trusted functions / Edge Functions only).
grant select on public.audit_events to authenticated;
create policy audit_events_read on public.audit_events for select to authenticated
  using ((select private.current_app_role()) = 'maintenance');

-- ---------------------------------------------------------------- invite-only profile creation
-- Runs when Auth creates a user. Blocks anyone without a valid invite or the one-time bootstrap email.
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(new.email));
  v_invite public.invites%rowtype;
  v_boot text;
begin
  select * into v_invite from public.invites
   where email = v_email and accepted_at is null and revoked_at is null and expires_at > now()
   for update;

  if found then
    insert into public.profiles (id, email, role) values (new.id, v_email, v_invite.role);
    update public.invites set accepted_at = now() where id = v_invite.id;
    insert into public.audit_events (actor_id, action, target_type, target_id, detail)
      values (new.id, 'invite.accepted', 'invite', v_invite.id::text, jsonb_build_object('role', v_invite.role));
    return new;
  end if;

  select bootstrap_email into v_boot from public.company_settings
   where id and bootstrap_consumed_at is null for update;
  if v_boot is not null and v_boot = v_email then
    insert into public.profiles (id, email, role) values (new.id, v_email, 'maintenance');
    update public.company_settings set bootstrap_consumed_at = now() where id;
    insert into public.audit_events (actor_id, action, target_type, target_id)
      values (new.id, 'bootstrap.maintenance_created', 'profile', new.id::text);
    return new;
  end if;

  raise exception 'Sign-up is by invitation only' using errcode = 'P0001';
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Bootstrap: only the database owner / service role (run once from the SQL editor) may register the
-- first Maintenance email. Not callable through the API.
create function private.set_bootstrap_maintenance_email(p_email text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.profiles where role = 'maintenance') then
    raise exception 'A Maintenance account already exists';
  end if;
  update public.company_settings
     set bootstrap_email = lower(btrim(p_email)), bootstrap_consumed_at = null, updated_at = now()
   where id;
end;
$$;
revoke all on function private.set_bootstrap_maintenance_email(text) from public, anon, authenticated;

-- Admin/Maintenance deactivate or reactivate a User (Admin: Users only; never self).
create function public.set_user_active(p_user uuid, p_active boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_target public.app_role;
begin
  if v_caller is null or v_caller = 'user' then raise exception 'Not allowed' using errcode = '42501'; end if;
  if p_user = (select auth.uid()) then raise exception 'Cannot change your own status' using errcode = '42501'; end if;
  select role into v_target from public.profiles where id = p_user;
  if v_target is null then raise exception 'User not found'; end if;
  if v_caller = 'admin' and v_target <> 'user' then raise exception 'Not allowed' using errcode = '42501'; end if;
  update public.profiles set is_active = p_active where id = p_user;
  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values ((select auth.uid()), case when p_active then 'user.activated' else 'user.deactivated' end,
            'profile', p_user::text, '{}'::jsonb);
end;
$$;
revoke all on function public.set_user_active(uuid, boolean) from public, anon;
grant execute on function public.set_user_active(uuid, boolean) to authenticated;