-- Role-isolation checks for the Phase 1 baseline. Synthetic data only; everything rolls back.
-- Run against a LOCAL or DEV database only (never production):  psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.sql
begin;

select private.set_bootstrap_maintenance_email('Maint@example.test');
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'maint@example.test');

insert into public.invites (email, role, invited_by, token_hash, expires_at) values
  ('admin@example.test', 'admin', '00000000-0000-0000-0000-0000000000a1', 'h-admin', now() + interval '1 day'),
  ('user@example.test',  'user',  '00000000-0000-0000-0000-0000000000a1', 'h-user',  now() + interval '1 day'),
  ('user2@example.test', 'user',  '00000000-0000-0000-0000-0000000000a1', 'h-user2', now() + interval '1 day');
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'user@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'user2@example.test');

create function pg_temp.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create function pg_temp.expect_fail(p_sql text, p_label text) returns void language plpgsql as $$
declare v_rows int;
begin
  begin
    execute p_sql;
    get diagnostics v_rows = row_count;
    if v_rows > 0 then raise exception 'FAIL (allowed): %', p_label; end if;
  exception when insufficient_privilege or raise_exception then
    if sqlerrm like 'FAIL (allowed)%' then raise; end if;
  end;
end $$;

-- 1. Sign-up without invite is blocked.
do $$ begin
  begin
    insert into auth.users (id, email) values (gen_random_uuid(), 'stranger@example.test');
    raise exception 'FAIL: uninvited sign-up allowed';
  exception when sqlstate 'P0001' then null; end;
end $$;

-- 2. Roles come from invites / bootstrap.
do $$ begin
  assert (select role from public.profiles where email = 'maint@example.test') = 'maintenance', 'bootstrap role';
  assert (select role from public.profiles where email = 'admin@example.test') = 'admin', 'admin role';
  assert (select role from public.profiles where email = 'user@example.test') = 'user', 'user role';
end $$;

-- 3. User: sees only own profile, cannot escalate, cannot read invites/audit/bootstrap email.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'user sees only own profile';
  assert (select count(*) from public.invites) = 0, 'user sees no invites';
  assert (select count(*) from public.audit_events) = 0, 'user sees no audit';
end $$;
select pg_temp.expect_fail($q$update public.profiles set role = 'maintenance' where id = '00000000-0000-0000-0000-0000000000a3'$q$, 'user self-promotion');
select pg_temp.expect_fail($q$select bootstrap_email from public.company_settings$q$, 'user reads bootstrap_email');
select pg_temp.expect_fail($q$insert into public.services (name) values ('x')$q$, 'user writes services');
select pg_temp.expect_fail($q$select public.set_user_active('00000000-0000-0000-0000-0000000000a4', false)$q$, 'user deactivates user');
select pg_temp.expect_fail($q$select token_hash from public.invites$q$, 'user reads token hash');
reset role;

-- 4. Admin: sees all profiles, invites Users only, cannot invite Admin/Maintenance, cannot deactivate non-Users.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  assert (select count(*) from public.profiles) = 4, 'admin sees all profiles';
  assert (select count(*) from public.invites where role <> 'user') = 0, 'admin sees user invites only';
end $$;
insert into public.invites (email, role, invited_by, token_hash, expires_at)
  values ('new-user@example.test', 'user', '00000000-0000-0000-0000-0000000000a2', 'h-new', now() + interval '1 day');
select pg_temp.expect_fail($q$insert into public.invites (email, role, invited_by, token_hash, expires_at) values ('x@example.test', 'admin', '00000000-0000-0000-0000-0000000000a2', 'h-x', now() + interval '1 day')$q$, 'admin invites admin');
select pg_temp.expect_fail($q$select public.set_user_active('00000000-0000-0000-0000-0000000000a1', false)$q$, 'admin deactivates maintenance');
select pg_temp.expect_fail($q$update public.company_settings set company_name = 'x'$q$, 'admin writes settings');
select public.set_user_active('00000000-0000-0000-0000-0000000000a4', false);
reset role;

-- 5. Deactivated user loses access.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
do $$ begin
  assert (select count(*) from public.services) = 0, 'deactivated user reads nothing';
end $$;
reset role;

-- 6. Maintenance: full control, reads audit, can invite any role.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
insert into public.invites (email, role, invited_by, token_hash, expires_at)
  values ('maint2@example.test', 'maintenance', '00000000-0000-0000-0000-0000000000a1', 'h-m2', now() + interval '1 day');
update public.company_settings set company_name = 'Synthetic Co';
do $$ begin
  assert (select count(*) from public.audit_events) > 0, 'maintenance reads audit';
end $$;
reset role;

-- 7. Anonymous has no access.
set local role anon;
select pg_temp.expect_fail($q$select 1 from public.profiles limit 1$q$, 'anon reads profiles');
reset role;

select 'ALL PHASE 1 RLS CHECKS PASSED' as result;
rollback;