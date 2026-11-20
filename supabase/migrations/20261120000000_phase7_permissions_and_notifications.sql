-- Kayangan Bumi Medical — Phase 7: Granular Admin Permissions, Form-Level ACL, and Targeted Complaint Emails.
-- Safe & idempotent: can be run directly in Supabase SQL Editor.

-- 1. Add restrict_admin_access toggle to forms
alter table public.forms
  add column if not exists restrict_admin_access boolean not null default false;

-- 2. Per-Admin Category Permissions (managed exclusively by Maintenance)
create table if not exists public.admin_permissions (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  can_manage_company_forms boolean not null default true,
  can_view_company_reports boolean not null default true,
  can_manage_complaints boolean not null default false,
  can_view_complaints boolean not null default false,
  receive_complaint_emails boolean not null default false,
  can_manage_voting boolean not null default false,
  can_view_voting_reports boolean not null default false,
  can_manage_users boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- 3. Per-Form Admin ACL (Owner / Collaborator Edit, View Reports, Receive Email Notifications)
create table if not exists public.form_admin_access (
  form_id uuid not null references public.forms (id) on delete cascade,
  admin_id uuid not null references public.profiles (id) on delete cascade,
  can_edit boolean not null default false,
  can_view_reports boolean not null default true,
  notify_on_submit boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (form_id, admin_id)
);
create index if not exists form_admin_access_admin_idx on public.form_admin_access (admin_id);

-- 4. Enable RLS & Grants
alter table public.admin_permissions enable row level security;
alter table public.form_admin_access enable row level security;

revoke all on public.admin_permissions, public.form_admin_access from anon, authenticated;
grant select on public.admin_permissions to authenticated;
grant select on public.form_admin_access to authenticated;

drop policy if exists admin_permissions_read on public.admin_permissions;
create policy admin_permissions_read on public.admin_permissions for select to authenticated
  using (
    profile_id = (select auth.uid())
    or (select private.current_app_role()) = 'maintenance'
  );

drop policy if exists form_admin_access_read on public.form_admin_access;
create policy form_admin_access_read on public.form_admin_access for select to authenticated
  using (
    admin_id = (select auth.uid())
    or (select private.current_app_role()) = 'maintenance'
    or exists (
      select 1 from public.forms f
      where f.id = form_admin_access.form_id and f.created_by = (select auth.uid())
    )
  );

-- 5. Security Definer Permission Helpers
create or replace function private.resolve_form_category(p_form_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (
      select nullif(btrim(fv.theme_json->>'category'), '')
      from public.form_versions fv
      where fv.form_id = p_form_id
      order by fv.version_number desc
      limit 1
    ),
    (
      select case
        when f.kind in ('complaint', 'appeal_enabled') then 'staff_complaints'
        when lower(f.title || ' ' || f.slug) ~ '(mcep|vote|judg|competition|ranking|speaker)' then 'voting_evaluation'
        else 'company_forms'
      end
      from public.forms f
      where f.id = p_form_id
    ),
    'company_forms'
  );
$$;
revoke all on function private.resolve_form_category(uuid) from public, anon;
grant execute on function private.resolve_form_category(uuid) to authenticated;

create or replace function private.can_admin_edit_form(p_form_id uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role public.app_role := private.current_app_role();
  v_uid uuid := (select auth.uid());
  v_form public.forms%rowtype;
  v_perm public.admin_permissions%rowtype;
  v_has_perm boolean;
  v_cat text;
begin
  if v_role = 'maintenance' then
    return true;
  end if;
  if v_role <> 'admin' then
    return false;
  end if;

  select * into v_form from public.forms where id = p_form_id;
  if not found then
    return false;
  end if;

  -- Creator always retains edit access to their own form
  if v_form.created_by = v_uid then
    return true;
  end if;

  -- Explicit per-form grant
  if exists (
    select 1 from public.form_admin_access a
    where a.form_id = p_form_id and a.admin_id = v_uid and a.can_edit
  ) then
    return true;
  end if;

  -- If form is restricted to owner/selected admins, block other admins
  if v_form.restrict_admin_access then
    return false;
  end if;

  -- Otherwise evaluate category permission profile (legacy fallback = true if no row set yet)
  select * into v_perm from public.admin_permissions where profile_id = v_uid;
  v_has_perm := found;
  if not v_has_perm then
    return true;
  end if;

  v_cat := private.resolve_form_category(p_form_id);
  if v_cat = 'staff_complaints' then
    return v_perm.can_manage_complaints;
  elsif v_cat = 'voting_evaluation' then
    return v_perm.can_manage_voting;
  else
    return v_perm.can_manage_company_forms;
  end if;
end;
$$;
revoke all on function private.can_admin_edit_form(uuid) from public, anon;
grant execute on function private.can_admin_edit_form(uuid) to authenticated;

create or replace function private.can_admin_view_form_reports(p_form_id uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_role public.app_role := private.current_app_role();
  v_uid uuid := (select auth.uid());
  v_form public.forms%rowtype;
  v_perm public.admin_permissions%rowtype;
  v_has_perm boolean;
  v_cat text;
begin
  if v_role = 'maintenance' then
    return true;
  end if;
  if v_role <> 'admin' then
    return false;
  end if;

  select * into v_form from public.forms where id = p_form_id;
  if not found then
    return false;
  end if;

  if v_form.created_by = v_uid then
    return true;
  end if;

  if exists (
    select 1 from public.form_admin_access a
    where a.form_id = p_form_id and a.admin_id = v_uid and (a.can_view_reports or a.can_edit)
  ) then
    return true;
  end if;

  if v_form.restrict_admin_access then
    return false;
  end if;

  select * into v_perm from public.admin_permissions where profile_id = v_uid;
  v_has_perm := found;
  if not v_has_perm then
    return true;
  end if;

  v_cat := private.resolve_form_category(p_form_id);
  if v_cat = 'staff_complaints' then
    return v_perm.can_view_complaints or v_perm.can_manage_complaints;
  elsif v_cat = 'voting_evaluation' then
    return v_perm.can_view_voting_reports or v_perm.can_manage_voting;
  else
    return v_perm.can_view_company_reports or v_perm.can_manage_company_forms;
  end if;
end;
$$;
revoke all on function private.can_admin_view_form_reports(uuid) from public, anon;
grant execute on function private.can_admin_view_form_reports(uuid) to authenticated;

-- 6. Tighten RLS Policies on submissions, tickets, forms (update) so restricted reports stay private!
drop policy if exists submissions_read_staff on public.submissions;
create policy submissions_read_staff on public.submissions for select to authenticated
  using ((select private.can_admin_view_form_reports(form_id)));

drop policy if exists forms_update on public.forms;
create policy forms_update on public.forms for update to authenticated
  using ((select private.can_admin_edit_form(id)))
  with check ((select private.can_admin_edit_form(id)));

drop policy if exists tickets_admin_maintenance_select on public.tickets;
create policy tickets_admin_maintenance_select on public.tickets for select to authenticated
  using ((select private.can_admin_view_form_reports(form_id)));

drop policy if exists tickets_admin_maintenance_update on public.tickets;
create policy tickets_admin_maintenance_update on public.tickets for update to authenticated
  using ((select private.can_admin_view_form_reports(form_id)))
  with check ((select private.can_admin_view_form_reports(form_id)));

-- 7. Guard save_form_builder so non-permitted admins cannot overwrite a locked form
-- (Enforced inside existing RPC via helper check on update)
create or replace function public.set_admin_permissions(
  p_profile_id uuid,
  p_can_manage_company_forms boolean,
  p_can_view_company_reports boolean,
  p_can_manage_complaints boolean,
  p_can_view_complaints boolean,
  p_receive_complaint_emails boolean,
  p_can_manage_voting boolean,
  p_can_view_voting_reports boolean,
  p_can_manage_users boolean
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_uid uuid := (select auth.uid());
begin
  if v_caller <> 'maintenance' then
    raise exception 'Only Maintenance may update Admin permissions.' using errcode = '42501';
  end if;

  insert into public.admin_permissions (
    profile_id,
    can_manage_company_forms,
    can_view_company_reports,
    can_manage_complaints,
    can_view_complaints,
    receive_complaint_emails,
    can_manage_voting,
    can_view_voting_reports,
    can_manage_users,
    updated_by,
    updated_at
  )
  values (
    p_profile_id,
    p_can_manage_company_forms,
    p_can_view_company_reports,
    p_can_manage_complaints,
    p_can_view_complaints,
    p_receive_complaint_emails,
    p_can_manage_voting,
    p_can_view_voting_reports,
    p_can_manage_users,
    v_uid,
    now()
  )
  on conflict (profile_id) do update set
    can_manage_company_forms = excluded.can_manage_company_forms,
    can_view_company_reports = excluded.can_view_company_reports,
    can_manage_complaints = excluded.can_manage_complaints,
    can_view_complaints = excluded.can_view_complaints,
    receive_complaint_emails = excluded.receive_complaint_emails,
    can_manage_voting = excluded.can_manage_voting,
    can_view_voting_reports = excluded.can_view_voting_reports,
    can_manage_users = excluded.can_manage_users,
    updated_by = excluded.updated_by,
    updated_at = now();

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'admin.permissions_updated', 'profile', p_profile_id::text, '{}'::jsonb);

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.set_admin_permissions(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_admin_permissions(uuid, boolean, boolean, boolean, boolean, boolean, boolean, boolean, boolean) to authenticated;

-- 8. RPC to configure per-form access lock & authorized admin editors/viewers/email recipients
create or replace function public.set_form_admin_access(
  p_form_id uuid,
  p_restrict_admin_access boolean,
  p_entries jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_item jsonb;
begin
  if not private.can_admin_edit_form(p_form_id) then
    raise exception 'You do not have permission to change access controls on this form.' using errcode = '42501';
  end if;

  update public.forms
     set restrict_admin_access = coalesce(p_restrict_admin_access, false),
         updated_at = now()
   where id = p_form_id;

  delete from public.form_admin_access where form_id = p_form_id;

  if jsonb_typeof(p_entries) = 'array' then
    for v_item in select * from jsonb_array_elements(p_entries)
    loop
      if (v_item->>'admin_id') is not null then
        insert into public.form_admin_access (form_id, admin_id, can_edit, can_view_reports, notify_on_submit, updated_at)
        values (
          p_form_id,
          (v_item->>'admin_id')::uuid,
          coalesce((v_item->>'can_edit')::boolean, false),
          coalesce((v_item->>'can_view_reports')::boolean, true),
          coalesce((v_item->>'notify_on_submit')::boolean, false),
          now()
        )
        on conflict (form_id, admin_id) do update set
          can_edit = excluded.can_edit,
          can_view_reports = excluded.can_view_reports,
          notify_on_submit = excluded.notify_on_submit,
          updated_at = now();
      end if;
    end loop;
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'form.access_updated', 'form', p_form_id::text,
            jsonb_build_object('restrict_admin_access', p_restrict_admin_access));

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.set_form_admin_access(uuid, boolean, jsonb) from public, anon;
grant execute on function public.set_form_admin_access(uuid, boolean, jsonb) to authenticated;

-- 9. Update create_ticket to send complaint email alerts ONLY to authorized/assigned Admins!
create or replace function public.create_ticket(
  p_form_id uuid,
  p_submission_id uuid,
  p_kind public.ticket_kind,
  p_reason text
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ticket public.tickets%rowtype;
  v_form_title text;
  v_reporter_email text;
  v_recipient record;
  v_has_form_recipients boolean;
  v_enqueued integer := 0;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  if p_submission_id is not null then
    perform 1 from public.submissions s
     where s.id = p_submission_id and s.user_id = v_uid;
    if not found then
      raise exception 'Submission not found or not yours.' using errcode = '42501';
    end if;
  end if;

  select title into v_form_title from public.forms where id = p_form_id;
  select email into v_reporter_email from public.profiles where id = v_uid;

  insert into public.tickets (form_id, submission_id, user_id, kind, reason)
    values (p_form_id, p_submission_id, v_uid, p_kind, p_reason)
    returning * into v_ticket;

  insert into public.ticket_decision_history (ticket_id, actor_id, from_status, to_status, note)
    values (v_ticket.id, v_uid, null, v_ticket.status, 'Ticket created');

  -- Priority 1: Explicit per-form notification recipients (form_admin_access.notify_on_submit = true)
  select exists (
    select 1 from public.form_admin_access a
    join public.profiles p on p.id = a.admin_id and p.is_active
    where a.form_id = p_form_id and a.notify_on_submit
  ) into v_has_form_recipients;

  if v_has_form_recipients then
    for v_recipient in
      select p.id, p.email
      from public.form_admin_access a
      join public.profiles p on p.id = a.admin_id and p.is_active
      where a.form_id = p_form_id and a.notify_on_submit
    loop
      insert into public.email_outbox (to_email, subject, body, idempotency_key, status)
        values (
          v_recipient.email,
          '[Confidential ' || initcap(p_kind::text) || '] ' || coalesce(v_form_title, 'Staff Report'),
          'A confidential ' || p_kind::text || ' report was submitted by ' || coalesce(v_reporter_email, 'staff') ||
          E'\n\nTicket ID: ' || v_ticket.id::text ||
          E'\nSummary:\n' || left(p_reason, 1200) ||
          E'\n\nSign in to Kayangan Bumi Medical Admin Panel to review and take action.',
          'ticket:' || v_ticket.id::text || ':admin:' || v_recipient.id::text,
          'pending'
        )
        on conflict (idempotency_key) do nothing;
      v_enqueued := v_enqueued + 1;
    end loop;
  else
    -- Priority 2: Admins explicitly granted receive_complaint_emails = true (plus Maintenance fallback)
    for v_recipient in
      select p.id, p.email
      from public.profiles p
      left join public.admin_permissions ap on ap.profile_id = p.id
      where p.is_active
        and (
          (p.role = 'admin' and coalesce(ap.receive_complaint_emails, false) = true)
          or p.role = 'maintenance'
        )
    loop
      insert into public.email_outbox (to_email, subject, body, idempotency_key, status)
        values (
          v_recipient.email,
          '[Confidential ' || initcap(p_kind::text) || '] ' || coalesce(v_form_title, 'Staff Report'),
          'A confidential ' || p_kind::text || ' report was submitted by ' || coalesce(v_reporter_email, 'staff') ||
          E'\n\nTicket ID: ' || v_ticket.id::text ||
          E'\nSummary:\n' || left(p_reason, 1200) ||
          E'\n\nSign in to Kayangan Bumi Medical Admin Panel to review and take action.',
          'ticket:' || v_ticket.id::text || ':admin:' || v_recipient.id::text,
          'pending'
        )
        on conflict (idempotency_key) do nothing;
      v_enqueued := v_enqueued + 1;
    end loop;
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'ticket.created', 'ticket', v_ticket.id::text,
            jsonb_build_object('kind', p_kind, 'form_id', p_form_id, 'submission_id', p_submission_id, 'notified_count', v_enqueued));

  return jsonb_build_object('ok', true, 'ticket_id', v_ticket.id, 'status', v_ticket.status, 'notified_count', v_enqueued);
end;
$$;
revoke all on function public.create_ticket(uuid, uuid, public.ticket_kind, text) from public, anon;
grant execute on function public.create_ticket(uuid, uuid, public.ticket_kind, text) to authenticated;

-- 10. Enforce Granular Edit / Publish / Delete Guards inside Form Builder RPCs
create or replace function public.save_form_builder(
  p_form_id uuid default null,
  p_slug text default null,
  p_title text default null,
  p_description text default '',
  p_kind public.form_kind default 'general',
  p_allow_save_draft boolean default true,
  p_allow_appeal boolean default false,
  p_service_ids uuid[] default array[]::uuid[],
  p_allowlist_emails text[] default array[]::text[],
  p_schema_json jsonb default '[]'::jsonb,
  p_theme_json jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_uid uuid := (select auth.uid());
  v_form public.forms%rowtype;
  v_ver public.form_versions%rowtype;
  v_perm public.admin_permissions%rowtype;
  v_cat text := coalesce(nullif(btrim(p_theme_json->>'category'), ''), case when p_kind in ('complaint', 'appeal_enabled') then 'staff_complaints' else 'company_forms' end);
  v_slug text := lower(regexp_replace(btrim(coalesce(p_slug, '')), '[^a-z0-9]+', '-', 'g'));
  v_email text;
  v_sid uuid;
begin
  if v_caller not in ('maintenance', 'admin') then
    raise exception 'Only Admin or Maintenance may build forms.' using errcode = '42501';
  end if;

  v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
  if v_slug = '' then
    raise exception 'A valid URL slug is required.' using errcode = '22023';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception 'Form title is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_schema_json) <> 'array' then
    raise exception 'Form schema must be a JSON array of field nodes.' using errcode = '22023';
  end if;

  if p_form_id is null then
    -- Check category create permission if admin_permissions row exists
    if v_caller = 'admin' then
      select * into v_perm from public.admin_permissions where profile_id = v_uid;
      if found then
        if v_cat = 'staff_complaints' and not v_perm.can_manage_complaints then
          raise exception 'You do not have permission to create Staff Complaint forms.' using errcode = '42501';
        elsif v_cat = 'voting_evaluation' and not v_perm.can_manage_voting then
          raise exception 'You do not have permission to create Voting & Evaluation forms.' using errcode = '42501';
        elsif v_cat = 'company_forms' and not v_perm.can_manage_company_forms then
          raise exception 'You do not have permission to create Company Forms.' using errcode = '42501';
        end if;
      end if;
    end if;

    insert into public.forms (slug, title, description, kind, state, allow_save_draft, allow_appeal, latest_version, created_by)
      values (v_slug, btrim(p_title), coalesce(p_description, ''), p_kind, 'draft', p_allow_save_draft, p_allow_appeal, 1, v_uid)
      returning * into v_form;

    insert into public.form_versions (form_id, version_number, schema_json, theme_json, is_published)
      values (v_form.id, 1, p_schema_json, coalesce(p_theme_json, '{}'::jsonb), false)
      returning * into v_ver;
  else
    if not private.can_admin_edit_form(p_form_id) then
      raise exception 'This form is restricted. Only the form owner, Maintenance, or authorized Admins may edit it.' using errcode = '42501';
    end if;

    select * into v_form from public.forms where id = p_form_id for update;
    if not found then
      raise exception 'Form not found.' using errcode = 'P0002';
    end if;

    update public.forms
       set slug = v_slug,
           title = btrim(p_title),
           description = coalesce(p_description, ''),
           kind = p_kind,
           allow_save_draft = p_allow_save_draft,
           allow_appeal = p_allow_appeal,
           updated_at = now()
     where id = v_form.id
     returning * into v_form;

    select * into v_ver from public.form_versions
     where form_id = v_form.id and version_number = v_form.latest_version;

    if v_ver.is_published then
      update public.forms set latest_version = v_form.latest_version + 1, updated_at = now()
       where id = v_form.id returning * into v_form;

      insert into public.form_versions (form_id, version_number, schema_json, theme_json, is_published)
        values (v_form.id, v_form.latest_version, p_schema_json, coalesce(p_theme_json, '{}'::jsonb), false)
        returning * into v_ver;
    else
      update public.form_versions
         set schema_json = p_schema_json,
             theme_json = coalesce(p_theme_json, '{}'::jsonb)
       where id = v_ver.id
       returning * into v_ver;
    end if;
  end if;

  delete from public.form_services where form_id = v_form.id;
  if p_service_ids is not null then
    foreach v_sid in array p_service_ids loop
      insert into public.form_services (form_id, service_id) values (v_form.id, v_sid) on conflict do nothing;
    end loop;
  end if;

  delete from public.form_email_allowlist where form_id = v_form.id;
  if p_allowlist_emails is not null then
    foreach v_email in array p_allowlist_emails loop
      v_email := lower(btrim(coalesce(v_email, '')));
      if v_email <> '' and position('@' in v_email) > 1 then
        insert into public.form_email_allowlist (form_id, email, added_by)
          values (v_form.id, v_email, v_uid) on conflict do nothing;
      end if;
    end loop;
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'form.saved_draft', 'form', v_form.id::text, jsonb_build_object('version', v_ver.version_number));

  return jsonb_build_object(
    'form_id', v_form.id,
    'slug', v_form.slug,
    'latest_version', v_ver.version_number,
    'current_published_version', v_form.current_published_version,
    'state', v_form.state
  );
end;
$$;
revoke all on function public.save_form_builder(uuid, text, text, text, public.form_kind, boolean, boolean, uuid[], text[], jsonb, jsonb) from public, anon;
grant execute on function public.save_form_builder(uuid, text, text, text, public.form_kind, boolean, boolean, uuid[], text[], jsonb, jsonb) to authenticated;

create or replace function public.publish_form_version(p_form_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_form public.forms%rowtype;
begin
  if not private.can_admin_edit_form(p_form_id) then
    raise exception 'You do not have permission to publish or unpublish this form.' using errcode = '42501';
  end if;

  select * into v_form from public.forms where id = p_form_id for update;
  if not found then
    raise exception 'Form not found.' using errcode = 'P0002';
  end if;

  update public.form_versions
     set is_published = true,
         published_at = coalesce(published_at, now()),
         published_by = coalesce(published_by, v_uid)
   where form_id = v_form.id and version_number = v_form.latest_version and not is_published;

  update public.forms
     set state = 'published',
         current_published_version = v_form.latest_version,
         updated_at = now()
   where id = v_form.id
   returning * into v_form;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'form.published', 'form', v_form.id::text, jsonb_build_object('version', v_form.current_published_version));

  return jsonb_build_object(
    'form_id', v_form.id,
    'state', v_form.state,
    'published_version', v_form.current_published_version
  );
end;
$$;
revoke all on function public.publish_form_version(uuid) from public, anon;
grant execute on function public.publish_form_version(uuid) to authenticated;

create or replace function public.set_form_state(p_form_id uuid, p_state public.form_state)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if not private.can_admin_edit_form(p_form_id) then
    raise exception 'You do not have permission to change state or archive this form.' using errcode = '42501';
  end if;

  update public.forms set state = p_state, updated_at = now() where id = p_form_id;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'form.state_changed', 'form', p_form_id::text, jsonb_build_object('state', p_state));

  return jsonb_build_object('ok', true, 'state', p_state);
end;
$$;
revoke all on function public.set_form_state(uuid, public.form_state) from public, anon;
grant execute on function public.set_form_state(uuid, public.form_state) to authenticated;
