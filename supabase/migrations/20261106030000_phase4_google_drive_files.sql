-- Forms MESRC Phase 4: Google Drive submission_files metadata & upload/download authorization.
-- Rules enforced at the database layer:
-- 1. submission_files links a file to a submission; only the submission owner, Admin, or Maintenance may read/write.
-- 2. drive_file_id stored server-side; client never sees raw Google Drive credentials.
-- 3. Max file size 1 GiB (1073741824 bytes), MIME/type validation enforced in RPCs.
-- 4. Audit events for upload, download, and delete.

-- ---------------------------------------------------------------- table
create table public.submission_files (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions (id) on delete cascade,
  file_name text not null check (length(btrim(file_name)) between 1 and 255),
  mime_type text not null check (length(btrim(mime_type)) between 1 and 100),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 1073741824),
  drive_file_id text not null check (length(btrim(drive_file_id)) between 1 and 255),
  drive_web_view_link text,
  uploaded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index submission_files_submission_idx on public.submission_files (submission_id);
create index submission_files_uploaded_by_idx on public.submission_files (uploaded_by);

-- ---------------------------------------------------------------- RLS
alter table public.submission_files enable row level security;

-- Owner can read/write their own submission files
create policy submission_files_owner_select on public.submission_files for select to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_files.submission_id and s.user_id = auth.uid()
    )
  );
create policy submission_files_owner_insert on public.submission_files for insert to authenticated
  with check (
    exists (
      select 1 from public.submissions s
      where s.id = submission_files.submission_id and s.user_id = auth.uid()
    )
  );
create policy submission_files_owner_delete on public.submission_files for delete to authenticated
  using (
    exists (
      select 1 from public.submissions s
      where s.id = submission_files.submission_id and s.user_id = auth.uid()
    )
  );

-- Admin and Maintenance can read all submission files
create policy submission_files_admin_maintenance_select on public.submission_files for select to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'));

-- ---------------------------------------------------------------- RPCs
-- Returns an upload session for a given submission. Caller must own the submission.
create or replace function public.create_file_upload_session(
  p_submission_id uuid,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_submission public.submissions%rowtype;
  v_file public.submission_files%rowtype;
  v_public jsonb;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_submission from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'Submission not found.' using errcode = 'P0001';
  end if;

  if v_submission.user_id <> v_uid and (select private.current_app_role()) not in ('maintenance', 'admin') then
    raise exception 'You do not own this submission.' using errcode = '42501';
  end if;

  if p_size_bytes > 1073741824 then
    raise exception 'File size exceeds 1 GiB limit.' using errcode = '22023';
  end if;

  if p_mime_type not in (
    'application/pdf',
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
    'text/plain', 'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) then
    raise exception 'Unsupported file type.' using errcode = '22023';
  end if;

  insert into public.submission_files (
    submission_id, file_name, mime_type, size_bytes, drive_file_id, drive_web_view_link, uploaded_by
  ) values (
    p_submission_id, p_file_name, p_mime_type, p_size_bytes, '', '', v_uid
  ) returning * into v_file;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'submission_file.upload_session_created', 'submission_file', v_file.id::text,
            jsonb_build_object('file_name', p_file_name, 'mime_type', p_mime_type, 'size_bytes', p_size_bytes));

  v_public := jsonb_build_object(
    'file_id', v_file.id,
    'submission_id', v_file.submission_id,
    'max_file_size_bytes', 1073741824,
    'supported_mime_types', array['application/pdf','image/png','image/jpeg','image/webp','image/gif','text/plain','text/csv']
  );

  return jsonb_build_object('ok', true, 'file', v_public);
end;
$$;
revoke all on function public.create_file_upload_session(uuid, text, text, bigint) from public, anon;
grant execute on function public.create_file_upload_session(uuid, text, text, bigint) to authenticated;

-- Finalize upload: caller sets drive_file_id and drive_web_view_link after successful Google Drive upload.
create or replace function public.finalize_file_upload(
  p_file_id uuid,
  p_drive_file_id text,
  p_drive_web_view_link text
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_file public.submission_files%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_file from public.submission_files where id = p_file_id;
  if not found then
    raise exception 'File record not found.' using errcode = 'P0001';
  end if;

  if v_file.uploaded_by <> v_uid and (select private.current_app_role()) not in ('maintenance', 'admin') then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  update public.submission_files
     set drive_file_id = p_drive_file_id,
         drive_web_view_link = p_drive_web_view_link,
         updated_at = now()
   where id = p_file_id;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'submission_file.upload_finalized', 'submission_file', p_file_id::text,
            jsonb_build_object('drive_file_id', p_drive_file_id));

  return jsonb_build_object('ok', true, 'file_id', p_file_id);
end;
$$;
revoke all on function public.finalize_file_upload(uuid, text, text) from public, anon;
grant execute on function public.finalize_file_upload(uuid, text, text) to authenticated;

-- Get download URL metadata for a file. Returns drive_file_id and web view link; client uses Drive API.
create or replace function public.get_file_download_url(p_file_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_file public.submission_files%rowtype;
  v_caller public.app_role;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_file from public.submission_files where id = p_file_id;
  if not found then
    raise exception 'File record not found.' using errcode = 'P0001';
  end if;

  select private.current_app_role() into v_caller;

  if v_file.uploaded_by = v_uid then
    -- owner may download
  elsif v_caller in ('maintenance', 'admin') then
    -- admin/maintenance may download any
  else
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'submission_file.download', 'submission_file', p_file_id::text,
            jsonb_build_object('file_name', v_file.file_name));

  return jsonb_build_object(
    'file_id', v_file.id,
    'file_name', v_file.file_name,
    'mime_type', v_file.mime_type,
    'size_bytes', v_file.size_bytes,
    'drive_file_id', v_file.drive_file_id,
    'drive_web_view_link', v_file.drive_web_view_link,
    'uploaded_by', v_file.uploaded_by,
    'created_at', v_file.created_at
  );
end;
$$;
revoke all on function public.get_file_download_url(uuid) from public, anon;
grant execute on function public.get_file_download_url(uuid) to authenticated;

-- Delete a submission file record. Actual Google Drive object cleanup is handled by server-side Edge Function/orphan cleanup.
create or replace function public.delete_submission_file(p_file_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_file public.submission_files%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_file from public.submission_files where id = p_file_id;
  if not found then
    raise exception 'File record not found.' using errcode = 'P0001';
  end if;

  if v_file.uploaded_by <> v_uid and (select private.current_app_role()) not in ('maintenance', 'admin') then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  delete from public.submission_files where id = p_file_id;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'submission_file.deleted', 'submission_file', p_file_id::text,
            jsonb_build_object('file_name', v_file.file_name));

  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.delete_submission_file(uuid) from public, anon;
grant execute on function public.delete_submission_file(uuid) to authenticated;