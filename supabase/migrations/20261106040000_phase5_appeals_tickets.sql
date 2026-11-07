-- Forms MESRC Phase 5: Appeals & Complaint Tickets with atomic Take Ticket and Request Help.
-- Rules enforced at the database layer:
-- 1. Users can create tickets for their own submissions; Admin/Maintenance can see all tickets.
-- 2. take_ticket is atomic: only one Admin can claim an open ticket (UPDATE ... WHERE status='open' AND taken_by IS NULL).
-- 3. email_outbox provides idempotent transactional email delivery with retry tracking.
-- 4. All ticket state transitions are audited.

-- ---------------------------------------------------------------- enums
create type public.ticket_status as enum ('open', 'taken', 'resolved', 'reopened', 'closed');
create type public.ticket_kind as enum ('appeal', 'complaint');

-- ---------------------------------------------------------------- tickets
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid references public.submissions (id) on delete set null,
  form_id uuid not null references public.forms (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  kind public.ticket_kind not null,
  reason text not null check (length(btrim(reason)) between 1 and 2000),
  status public.ticket_status not null default 'open',
  taken_by uuid references public.profiles (id),
  taken_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_user_idx on public.tickets (user_id);
create index tickets_status_idx on public.tickets (status);
create index tickets_form_idx on public.tickets (form_id);

-- ---------------------------------------------------------------- ticket_messages
create table public.ticket_messages (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  sender_id uuid not null references public.profiles (id),
  message text not null check (length(btrim(message)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index ticket_messages_ticket_idx on public.ticket_messages (ticket_id);

-- ---------------------------------------------------------------- ticket_decision_history
create table public.ticket_decision_history (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  from_status public.ticket_status,
  to_status public.ticket_status not null,
  note text,
  created_at timestamptz not null default now()
);
create index ticket_decision_history_ticket_idx on public.ticket_decision_history (ticket_id);

-- ---------------------------------------------------------------- email_outbox
create table public.email_outbox (
  id bigint generated always as identity primary key,
  to_email text not null check (length(btrim(to_email)) between 1 and 254),
  subject text not null check (length(btrim(subject)) between 1 and 200),
  body text not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now()
);
create index email_outbox_status_idx on public.email_outbox (status);
create index email_outbox_idempotency_idx on public.email_outbox (idempotency_key);

-- ---------------------------------------------------------------- RLS
alter table public.tickets enable row level security;
alter table public.ticket_messages enable row level security;
alter table public.ticket_decision_history enable row level security;
alter table public.email_outbox enable row level security;

-- Users can read/create their own tickets
create policy tickets_owner_select on public.tickets for select to authenticated
  using (user_id = auth.uid());
create policy tickets_owner_insert on public.tickets for insert to authenticated
  with check (user_id = auth.uid());

-- Admin and Maintenance can read/update all tickets
create policy tickets_admin_maintenance_select on public.tickets for select to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'));
create policy tickets_admin_maintenance_update on public.tickets for update to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'))
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));

-- Ticket messages: participants can read, sender/Admin/Maintenance can insert
create policy ticket_messages_participant_select on public.ticket_messages for select to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_messages.ticket_id
        and (t.user_id = auth.uid() or (select private.current_app_role()) in ('maintenance', 'admin'))
    )
  );
create policy ticket_messages_insert on public.ticket_messages for insert to authenticated
  with check (sender_id = auth.uid());

-- Decision history: read-only for participants, insert for Admin/Maintenance
create policy ticket_decision_history_select on public.ticket_decision_history for select to authenticated
  using (
    exists (
      select 1 from public.tickets t
      where t.id = ticket_decision_history.ticket_id
        and (t.user_id = auth.uid() or (select private.current_app_role()) in ('maintenance', 'admin'))
    )
  );
create policy ticket_decision_history_insert on public.ticket_decision_history for insert to authenticated
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));

-- Email outbox: Admin/Maintenance manage; no public select
create policy email_outbox_admin_maintenance_all on public.email_outbox for all to authenticated
  using ((select private.current_app_role()) in ('maintenance', 'admin'))
  with check ((select private.current_app_role()) in ('maintenance', 'admin'));

-- ---------------------------------------------------------------- RPCs
-- Create a new ticket. User must own the submission. Inserts email outbox for all Admins.
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
  v_admin public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  -- Verify submission exists and belongs to caller (if provided)
  if p_submission_id is not null then
    perform 1 from public.submissions s
     where s.id = p_submission_id and s.user_id = v_uid;
    if not found then
      raise exception 'Submission not found or not yours.' using errcode = '42501';
    end if;
  end if;

  insert into public.tickets (form_id, submission_id, user_id, kind, reason)
    values (p_form_id, p_submission_id, v_uid, p_kind, p_reason)
    returning * into v_ticket;

  insert into public.ticket_decision_history (ticket_id, actor_id, from_status, to_status, note)
    values (v_ticket.id, v_uid, null, v_ticket.status, 'Ticket created');

  -- Enqueue email to all Admins (idempotent)
  for v_admin in
    select id, email from public.profiles where role = 'admin' and is_active
  loop
    insert into public.email_outbox (to_email, subject, body, idempotency_key, status)
      values (
        v_admin.email,
        'New ' || p_kind || ' Ticket - ' || p_form_id::text,
        'A new ' || p_kind || ' ticket has been created. Ticket ID: ' || v_ticket.id::text,
        'ticket:' || v_ticket.id::text || ':admin:' || v_admin.id::text,
        'pending'
      )
      on conflict (idempotency_key) do nothing;
  end loop;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'ticket.created', 'ticket', v_ticket.id::text,
            jsonb_build_object('kind', p_kind, 'form_id', p_form_id, 'submission_id', p_submission_id));

  return jsonb_build_object('ok', true, 'ticket_id', v_ticket.id, 'status', v_ticket.status);
end;
$$;
revoke all on function public.create_ticket(uuid, uuid, public.ticket_kind, text) from public, anon;
grant execute on function public.create_ticket(uuid, uuid, public.ticket_kind, text) to authenticated;

-- Atomically take an open ticket. Only one Admin can claim it.
create or replace function public.take_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller public.app_role;
  v_claimed_id uuid;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select private.current_app_role() into v_caller;
  if v_caller not in ('maintenance', 'admin') then
    raise exception 'Only Admin or Maintenance can take tickets.' using errcode = '42501';
  end if;

  -- Atomic claim: only succeeds if ticket is open and not taken
  update public.tickets
     set status = 'taken', taken_by = v_uid, taken_at = now(), updated_at = now()
   where id = p_ticket_id
     and status = 'open'
     and taken_by is null
  returning id into v_claimed_id;

  if v_claimed_id is null then
    raise exception 'Ticket is not open or already taken.' using errcode = 'P0001';
  end if;

  insert into public.ticket_decision_history (ticket_id, actor_id, from_status, to_status, note)
    values (p_ticket_id, v_uid, 'open', 'taken', 'Ticket taken by ' || v_uid::text);

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'ticket.taken', 'ticket', p_ticket_id::text, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'ticket_id', p_ticket_id, 'status', 'taken', 'taken_by', v_uid);
end;
$$;
revoke all on function public.take_ticket(uuid) from public, anon;
grant execute on function public.take_ticket(uuid) to authenticated;

-- Resolve a taken ticket (only the taker or Admin/Maintenance).
create or replace function public.resolve_ticket(p_ticket_id uuid, p_resolution text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller public.app_role;
  v_ticket public.tickets%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found.' using errcode = 'P0001';
  end if;

  select private.current_app_role() into v_caller;
  if v_caller not in ('maintenance', 'admin') and v_ticket.taken_by <> v_uid then
    raise exception 'Only the ticket owner or Admin/Maintenance can resolve.' using errcode = '42501';
  end if;

  update public.tickets
     set status = 'resolved', resolved_at = now(), resolution = p_resolution, updated_at = now()
   where id = p_ticket_id;

  insert into public.ticket_decision_history (ticket_id, actor_id, from_status, to_status, note)
    values (p_ticket_id, v_uid, v_ticket.status, 'resolved', p_resolution);

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'ticket.resolved', 'ticket', p_ticket_id::text, jsonb_build_object('resolution', p_resolution));

  return jsonb_build_object('ok', true, 'ticket_id', p_ticket_id, 'status', 'resolved');
end;
$$;
revoke all on function public.resolve_ticket(uuid, text) from public, anon;
grant execute on function public.resolve_ticket(uuid, text) to authenticated;

-- Reopen a resolved ticket (only the original user or Admin/Maintenance).
create or replace function public.reopen_ticket(p_ticket_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller public.app_role;
  v_ticket public.tickets%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found.' using errcode = 'P0001';
  end if;

  select private.current_app_role() into v_caller;
  if v_caller not in ('maintenance', 'admin') and v_ticket.user_id <> v_uid then
    raise exception 'Only the ticket creator or Admin/Maintenance can reopen.' using errcode = '42501';
  end if;

  update public.tickets
     set status = 'reopened', taken_by = null, taken_at = null, resolved_at = null, resolution = null, updated_at = now()
   where id = p_ticket_id
     and status = 'resolved';

  insert into public.ticket_decision_history (ticket_id, actor_id, from_status, to_status, note)
    values (p_ticket_id, v_uid, 'resolved', 'reopened', 'Ticket reopened');

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'ticket.reopened', 'ticket', p_ticket_id::text, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'ticket_id', p_ticket_id, 'status', 'reopened');
end;
$$;
revoke all on function public.reopen_ticket(uuid) from public, anon;
grant execute on function public.reopen_ticket(uuid) to authenticated;

-- Request help on a ticket (creator asks another Admin/Maintenance to assist).
create or replace function public.request_help(p_ticket_id uuid, p_helper_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_ticket public.tickets%rowtype;
  v_helper public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found.' using errcode = 'P0001';
  end if;

  if v_ticket.user_id <> v_uid and (select private.current_app_role()) not in ('maintenance', 'admin') then
    raise exception 'Only the ticket creator or Admin/Maintenance can request help.' using errcode = '42501';
  end if;

  select * into v_helper from public.profiles where id = p_helper_id;
  if not found then
    raise exception 'Helper not found.' using errcode = 'P0001';
  end if;

  if v_helper.role not in ('maintenance', 'admin') then
    raise exception 'Helper must be Admin or Maintenance.' using errcode = '42501';
  end if;

  insert into public.email_outbox (to_email, subject, body, idempotency_key, status)
    values (
      v_helper.email,
      'Help Requested on Ticket - ' || p_ticket_id::text,
      'You have been asked to help with ticket ' || p_ticket_id::text || '.',
      'ticket:help:' || p_ticket_id::text || ':helper:' || p_helper_id::text,
      'pending'
    )
    on conflict (idempotency_key) do nothing;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'ticket.help_requested', 'ticket', p_ticket_id::text,
            jsonb_build_object('helper_id', p_helper_id));

  return jsonb_build_object('ok', true, 'ticket_id', p_ticket_id, 'helper_id', p_helper_id);
end;
$$;
revoke all on function public.request_help(uuid, uuid) from public, anon;
grant execute on function public.request_help(uuid, uuid) to authenticated;

-- Accept a help request (helper joins the ticket).
create or replace function public.accept_help(p_ticket_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller public.app_role;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select private.current_app_role() into v_caller;
  if v_caller not in ('maintenance', 'admin') then
    raise exception 'Only Admin or Maintenance can accept help.' using errcode = '42501';
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'ticket.help_accepted', 'ticket', p_ticket_id::text, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'ticket_id', p_ticket_id);
end;
$$;
revoke all on function public.accept_help(uuid) from public, anon;
grant execute on function public.accept_help(uuid) to authenticated;

-- Decline a help request.
create or replace function public.decline_help(p_ticket_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller public.app_role;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select private.current_app_role() into v_caller;
  if v_caller not in ('maintenance', 'admin') then
    raise exception 'Only Admin or Maintenance can decline help.' using errcode = '42501';
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'ticket.help_declined', 'ticket', p_ticket_id::text, '{}'::jsonb);

  return jsonb_build_object('ok', true, 'ticket_id', p_ticket_id);
end;
$$;
revoke all on function public.decline_help(uuid) from public, anon;
grant execute on function public.decline_help(uuid) to authenticated;

-- Transfer a ticket to another Admin/Maintenance.
create or replace function public.transfer_ticket(p_ticket_id uuid, p_new_owner_id uuid)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_caller public.app_role;
  v_ticket public.tickets%rowtype;
begin
  if v_uid is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket not found.' using errcode = 'P0001';
  end if;

  select private.current_app_role() into v_caller;
  if v_caller not in ('maintenance', 'admin') then
    raise exception 'Only Admin or Maintenance can transfer tickets.' using errcode = '42501';
  end if;

  update public.tickets
     set taken_by = p_new_owner_id, taken_at = now(), updated_at = now()
   where id = p_ticket_id;

  insert into public.ticket_decision_history (ticket_id, actor_id, from_status, to_status, note)
    values (p_ticket_id, v_uid, v_ticket.status, v_ticket.status, 'Ticket transferred to ' || p_new_owner_id::text);

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (v_uid, 'ticket.transferred', 'ticket', p_ticket_id::text,
            jsonb_build_object('new_owner_id', p_new_owner_id));

  return jsonb_build_object('ok', true, 'ticket_id', p_ticket_id, 'new_owner_id', p_new_owner_id);
end;
$$;
revoke all on function public.transfer_ticket(uuid, uuid) from public, anon;
grant execute on function public.transfer_ticket(uuid, uuid) to authenticated;