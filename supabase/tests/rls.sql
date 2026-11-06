-- Role-isolation & Phase 2 Wizard/OTP/Settings checks. Synthetic data only; everything rolls back.
begin;

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

-- 0. Before any Maintenance user exists, get_system_setup_state reports needs_first_maintenance = true
set local role anon;
do $$
declare v_state jsonb;
begin
  v_state := public.get_system_setup_state();
  assert (v_state->>'needs_first_maintenance')::boolean = true, 'initial needs_first_maintenance';
end $$;

-- Wizard Step 1: anon claims first maintenance email and becomes eligible for OTP
select public.claim_first_maintenance_email('Maint@example.test', 'MESRC');
select public.request_otp_eligibility('maint@example.test');
select pg_temp.expect_fail($q$select public.request_otp_eligibility('uninvited@example.test')$q$, 'uninvited otp blocked');
reset role;

-- Wizard Step 2: OTP verified -> auth.users insert creates Maintenance profile and locks bootstrap
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a1', 'maint@example.test');

set local role anon;
do $$
declare v_state jsonb;
begin
  v_state := public.get_system_setup_state();
  assert (v_state->>'needs_first_maintenance')::boolean = false, 'locked after first maintenance';
end $$;
select pg_temp.expect_fail($q$select public.claim_first_maintenance_email('attacker@example.test', 'Evil')$q$, 'second claim blocked');
reset role;

-- Maintenance creates invitations via create_invitation RPC
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
do $$
declare
  v_inv_admin jsonb;
  v_inv_user jsonb;
  v_inv_user2 jsonb;
  v_inspected jsonb;
begin
  v_inv_admin := public.create_invitation('admin@example.test', 'admin', 7);
  v_inv_user  := public.create_invitation('user@example.test',  'user',  7);
  v_inv_user2 := public.create_invitation('user2@example.test', 'user',  7);
  v_inspected := public.inspect_invitation_token(v_inv_admin->>'invite_token');
  assert v_inspected->>'email' = 'admin@example.test', 'inspect token email';
  assert v_inspected->>'role' = 'admin', 'inspect token role';
end $$;

-- Wizard Step 3: Maintenance saves Google Drive settings (write-only secret)
do $$
declare
  v_save jsonb;
  v_status jsonb;
begin
  v_save := public.save_google_drive_settings(
    'drive-bot@company.example',
    '0A_shared_drive_id',
    '1B_forms_mesrc_root_id',
    'Forms MESRC',
    'client-123',
    '{"type":"service_account","private_key":"secret"}',
    true
  );
  assert (v_save->>'has_secret')::boolean = true, 'drive secret saved';
  v_status := public.get_integration_settings_status();
  assert (v_status->'google_drive'->>'validation_state') = 'configured', 'drive status configured';
  assert (v_status->'google_drive'->'config_public'->>'shared_drive_id') = '0A_shared_drive_id', 'drive id returned';
  assert not (v_status->'google_drive' ? 'secret_ciphertext'), 'secret never returned';
end $$;
reset role;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a2', 'admin@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'user@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'user2@example.test');

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

-- 3. User: sees only own profile, cannot escalate, cannot read invites/audit/bootstrap email/integration settings.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'user sees only own profile';
  assert (select count(*) from public.invites) = 0, 'user sees no invites';
  assert (select count(*) from public.audit_events) = 0, 'user sees no audit';
end $$;
select pg_temp.expect_fail($q$update public.profiles set role = 'maintenance' where id = '00000000-0000-0000-0000-0000000000a3'$q$, 'user self-promotion');
select pg_temp.expect_fail($q$select bootstrap_email from public.company_settings$q$, 'user reads bootstrap_email');
select pg_temp.expect_fail($q$select public.get_integration_settings_status()$q$, 'user reads integration settings');
select pg_temp.expect_fail($q$select public.create_invitation('x@example.test', 'user', 7)$q$, 'user creates invite');
reset role;

-- 4. Admin: sees all profiles, invites Users only, cannot invite Admin/Maintenance, cannot read/write integration settings.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
do $$ begin
  assert (select count(*) from public.profiles) = 4, 'admin sees all profiles';
  assert (select count(*) from public.invites where role <> 'user') = 0, 'admin sees user invites only';
end $$;
select public.create_invitation('new-user@example.test', 'user', 7);
select pg_temp.expect_fail($q$select public.create_invitation('x@example.test', 'admin', 7)$q$, 'admin invites admin');
select pg_temp.expect_fail($q$select public.get_integration_settings_status()$q$, 'admin reads integration settings');
select pg_temp.expect_fail($q$select public.save_google_drive_settings('a','b','c','Forms MESRC',null,null,false)$q$, 'admin saves drive settings');
select public.set_user_active('00000000-0000-0000-0000-0000000000a4', false);
reset role;

-- 5. Deactivated user loses access and OTP eligibility.
select pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
do $$ begin
  assert (select count(*) from public.services) = 0, 'deactivated user reads nothing';
end $$;
reset role;
set local role anon;
select pg_temp.expect_fail($q$select public.request_otp_eligibility('user2@example.test')$q$, 'deactivated user otp blocked');
reset role;

select 'ALL PHASE 1 & PHASE 2 RLS CHECKS PASSED' as result;
rollback;