-- Forms MESRC Phase 3: Company Services Management, Versioned Forms, Email Allowlist RLS, and Submissions.
-- Rules enforced at the database layer:
-- 1. Forms have states: draft -> published -> archived.
-- 2. Published form_versions are immutable (cannot be updated or deleted once published_at is set).
-- 3. Editing a published form creates a new draft version while keeping current_published_version intact for live users.
-- 4. Every active invited User can read/submit a published form UNLESS form_email_allowlist has rows for that form;
--    if populated, ONLY listed normalized emails (plus Admin/Maintenance) can read or submit.
-- 5. Users can read/write ONLY their own submissions; Admin and Maintenance can read all company submissions.

create type public.form_kind as enum ('general', 'appeal_enabled', 'complaint');
create type public.form_state as enum ('draft', 'published', 'archived');
create type public.submission_status as enum ('draft', 'submitted');

-- Allow Admin as well as Maintenance to manage company services (insert/update) so Admin workspace can organize forms by service
drop policy if exists services_insert on public.services;
drop policy if exists services_update on public.services;
create policy services_insert on public.services for insert to authenticated
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));
create policy services_update on public.services for update to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'))
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));

-- ---------------------------------------------------------------- tables
create table public.forms (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null default '',
  kind public.form_kind not null default 'general',
  state public.form_state not null default 'draft',
  allow_save_draft boolean not null default true,
  allow_appeal boolean not null default false,
  current_published_version integer,
  latest_version integer not null default 1,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint forms_slug_normalized check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
create unique index forms_slug_unique on public.forms (slug);
create index forms_state_idx on public.forms (state);

create table public.form_services (
  form_id uuid not null references public.forms (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  primary key (form_id, service_id)
);
create index form_services_service_idx on public.form_services (service_id);

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete cascade,
  version_number integer not null check (version_number >= 1),
  schema_json jsonb not null default '[]'::jsonb,               -- ordered array of field/layout nodes
  theme_json jsonb not null default '{}'::jsonb,                -- whitelisted brand colors, border radius, layout density
  is_published boolean not null default false,
  published_at timestamptz,
  published_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  constraint form_versions_unique unique (form_id, version_number)
);
create index form_versions_form_idx on public.form_versions (form_id, version_number desc);

create table public.form_email_allowlist (
  form_id uuid not null references public.forms (id) on delete cascade,
  email text not null,
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (form_id, email),
  constraint form_allowlist_email_normalized check (email = lower(btrim(email)))
);
create index form_email_allowlist_email_idx on public.form_email_allowlist (email);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms (id) on delete restrict,
  form_version integer not null,
  service_id uuid references public.services (id) on delete set null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status public.submission_status not null default 'draft',
  answers_json jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index submissions_user_idx on public.submissions (user_id, created_at desc) include (form_id, status);
create index submissions_form_status_idx on public.submissions (form_id, status, submitted_at desc);
create index submissions_service_idx on public.submissions (service_id);

-- Immutability trigger on form_versions: once is_published = true, block edits to schema_json/theme_json or deletion
create or replace function private.enforce_immutable_published_version()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.is_published then
    raise exception 'Published form versions are immutable and cannot be deleted.' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.is_published then
    if new.schema_json is distinct from old.schema_json
       or new.theme_json is distinct from old.theme_json
       or new.version_number is distinct from old.version_number
       or new.is_published is distinct from old.is_published then
      raise exception 'Published form versions are immutable. Create a new version to edit.' using errcode = '42501';
    end if;
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;
revoke all on function private.enforce_immutable_published_version() from public, anon, authenticated;

create trigger trg_immutable_form_version
  before update or delete on public.form_versions
  for each row execute function private.enforce_immutable_published_version();

-- ---------------------------------------------------------------- Helper: Can current user access a form?
-- Staff (admin/maintenance) can access all forms.
-- Active Users can access a form ONLY if state = 'published' AND (allowlist is empty OR user's email is in allowlist).
create or replace function private.can_user_access_form(p_form_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
      from public.profiles me
      join public.forms f on f.id = p_form_id
     where me.id = (select auth.uid())
       and me.is_active
       and (
         me.role in ('maintenance', 'admin')
         or (
           f.state = 'published'
           and (
             not exists (select 1 from public.form_email_allowlist a where a.form_id = f.id)
             or exists (select 1 from public.form_email_allowlist a where a.form_id = f.id and a.email = me.email)
           )
         )
       )
  )
$$;
revoke all on function private.can_user_access_form(uuid) from public, anon;
grant execute on function private.can_user_access_form(uuid) to authenticated;

-- ---------------------------------------------------------------- RLS Enable & Policies
alter table public.forms enable row level security;
alter table public.form_services enable row level security;
alter table public.form_versions enable row level security;
alter table public.form_email_allowlist enable row level security;
alter table public.submissions enable row level security;

revoke all on public.forms, public.form_services, public.form_versions,
  public.form_email_allowlist, public.submissions from anon, authenticated;

-- forms
grant select, insert, update on public.forms to authenticated;
create policy forms_read on public.forms for select to authenticated
  using ((select private.can_user_access_form(id)));
create policy forms_insert on public.forms for insert to authenticated
  with check ((select private.current_app_role()) in ('maintenance', 'admin') and created_by = (select auth.uid()));
create policy forms_update on public.forms for update to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'))
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));

-- form_services
grant select, insert, delete on public.form_services to authenticated;
create policy form_services_read on public.form_services for select to authenticated
  using ((select private.can_user_access_form(form_id)));
create policy form_services_write on public.form_services for all to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'))
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));

-- form_versions: Users see only published versions of forms they can access; staff see all versions.
grant select, insert, update on public.form_versions to authenticated;
create policy form_versions_read on public.form_versions for select to authenticated
  using (
    (select private.current_app_role()) in ('maintenance', 'admin')
    or (is_published and (select private.can_user_access_form(form_id)))
  );
create policy form_versions_insert on public.form_versions for insert to authenticated
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));
create policy form_versions_update on public.form_versions for update to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'))
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));

-- form_email_allowlist: only Admin and Maintenance can view or modify allowlists
grant select, insert, delete on public.form_email_allowlist to authenticated;
create policy form_allowlist_staff on public.form_email_allowlist for all to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'))
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));

-- submissions: Users read/insert/update own drafts & submit eligible forms; Admin/Maintenance read all
grant select, insert, update on public.submissions to authenticated;
create policy submissions_read_own on public.submissions for select to authenticated
  using (user_id = (select auth.uid()) and (select private.current_app_role()) is not null);
create policy submissions_read_staff on public.submissions for select to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'));
create policy submissions_insert_own on public.submissions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.can_user_access_form(form_id))
  );
create policy submissions_update_own_draft on public.submissions for update to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'draft'
    and (select private.can_user_access_form(form_id))
  )
  with check (
    user_id = (select auth.uid())
    and (select private.can_user_access_form(form_id))
  );

-- ---------------------------------------------------------------- RPCs for Form Lifecycle & Validated Submission
-- 1. Create or save a form draft (creates a new draft version if the latest version is already published)
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
    insert into public.forms (slug, title, description, kind, state, allow_save_draft, allow_appeal, latest_version, created_by)
      values (v_slug, btrim(p_title), coalesce(p_description, ''), p_kind, 'draft', p_allow_save_draft, p_allow_appeal, 1, v_uid)
      returning * into v_form;

    insert into public.form_versions (form_id, version_number, schema_json, theme_json, is_published)
      values (v_form.id, 1, p_schema_json, coalesce(p_theme_json, '{}'::jsonb), false)
      returning * into v_ver;
  else
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
      -- Published version is immutable -> create a new draft version
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

  -- Sync linked services
  delete from public.form_services where form_id = v_form.id;
  if p_service_ids is not null then
    foreach v_sid in array p_service_ids loop
      insert into public.form_services (form_id, service_id) values (v_form.id, v_sid) on conflict do nothing;
    end loop;
  end if;

  -- Sync email allowlist
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

-- 2. Publish the latest version of a form (marks version immutable and sets form state = 'published')
create or replace function public.publish_form_version(p_form_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_uid uuid := (select auth.uid());
  v_form public.forms%rowtype;
begin
  if v_caller not in ('maintenance', 'admin') then
    raise exception 'Only Admin or Maintenance may publish forms.' using errcode = '42501';
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

-- 3. Archive a form (stops new submissions while keeping history)
create or replace function public.set_form_state(p_form_id uuid, p_state public.form_state)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_uid uuid := (select auth.uid());
begin
  if v_caller not in ('maintenance', 'admin') then
    raise exception 'Only Admin or Maintenance may change form state.' using errcode = '42501';
  end if;

  update public.forms set state = p_state, updated_at = now() where id = p_form_id;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'form.state_changed', 'form', p_form_id::text, jsonb_build_object('state', p_state));

  return jsonb_build_object('ok', true, 'state', p_state);
end;
$$;
revoke all on function public.set_form_state(uuid, public.form_state) from public, anon;
grant execute on function public.set_form_state(uuid, public.form_state) to authenticated;

-- 4. Server-validated form submission (checks allowlist, published state, required nodes in schema_json)
create or replace function public.submit_form_response(
  p_form_id uuid,
  p_answers jsonb,
  p_service_id uuid default null,
  p_duration_seconds integer default 0,
  p_as_draft boolean default false,
  p_submission_id uuid default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_form public.forms%rowtype;
  v_ver public.form_versions%rowtype;
  v_node jsonb;
  v_field_id text;
  v_field_label text;
  v_field_type text;
  v_req boolean;
  v_val jsonb;
  v_sub_id uuid;
  v_status public.submission_status;
begin
  if v_uid is null or not private.can_user_access_form(p_form_id) then
    raise exception 'You do not have access to submit this form.' using errcode = '42501';
  end if;

  select * into v_form from public.forms where id = p_form_id;
  if v_form.state <> 'published' or v_form.current_published_version is null then
    raise exception 'This form is not currently accepting submissions.' using errcode = 'P0001';
  end if;

  if p_as_draft and not v_form.allow_save_draft then
    raise exception 'Saving drafts is disabled for this form.' using errcode = '42501';
  end if;

  select * into v_ver from public.form_versions
   where form_id = v_form.id and version_number = v_form.current_published_version;

  -- When final submitting (not draft), validate required fields against immutable version schema
  if not p_as_draft then
    for v_node in select * from jsonb_array_elements(v_ver.schema_json) loop
      v_field_id := v_node->>'id';
      v_field_label := coalesce(v_node->>'label', v_field_id);
      v_field_type := coalesce(v_node->>'type', 'short_text');
      v_req := coalesce((v_node->>'required')::boolean, false);

      if v_req and v_field_type not in ('heading', 'instructions', 'section', 'file_upload') then
        v_val := p_answers->v_field_id;
        if v_val is null
           or v_val = 'null'::jsonb
           or (jsonb_typeof(v_val) = 'string' and btrim(v_val #>> '{}') = '')
           or (jsonb_typeof(v_val) = 'array' and jsonb_array_length(v_val) = 0) then
          raise exception 'Required field "%" is missing.', v_field_label using errcode = '22023';
        end if;
      end if;
    end loop;
  end if;

  v_status := case when p_as_draft then 'draft'::public.submission_status else 'submitted'::public.submission_status end;

  if p_submission_id is not null then
    update public.submissions
       set form_version = v_ver.version_number,
           service_id = p_service_id,
           status = v_status,
           answers_json = coalesce(p_answers, '{}'::jsonb),
           submitted_at = case when p_as_draft then null else now() end,
           duration_seconds = greatest(coalesce(p_duration_seconds, 0), 0),
           updated_at = now()
     where id = p_submission_id and user_id = v_uid and status = 'draft'
     returning id into v_sub_id;
    if v_sub_id is null then
      raise exception 'Draft submission not found or already submitted.' using errcode = '42501';
    end if;
  else
    insert into public.submissions (
      form_id, form_version, service_id, user_id, status, answers_json,
      submitted_at, duration_seconds
    ) values (
      v_form.id, v_ver.version_number, p_service_id, v_uid, v_status, coalesce(p_answers, '{}'::jsonb),
      case when p_as_draft then null else now() end,
      greatest(coalesce(p_duration_seconds, 0), 0)
    ) returning id into v_sub_id;
  end if;

  if not p_as_draft then
    insert into public.audit_events (actor_id, action, target_type, target_id, detail)
      values (v_uid, 'submission.submitted', 'submission', v_sub_id::text,
              jsonb_build_object('form_id', v_form.id, 'version', v_ver.version_number));
  end if;

  return jsonb_build_object(
    'submission_id', v_sub_id,
    'status', v_status,
    'form_version', v_ver.version_number
  );
end;
$$;
revoke all on function public.submit_form_response(uuid, jsonb, uuid, integer, boolean, uuid) from public, anon;
grant execute on function public.submit_form_response(uuid, jsonb, uuid, integer, boolean, uuid) to authenticated;