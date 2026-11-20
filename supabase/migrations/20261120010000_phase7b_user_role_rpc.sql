-- Kayangan Bumi Medical — Phase 7B: Maintenance Role Promotion / Demotion RPC (User <-> Admin)
-- Safe & idempotent: run once in Supabase SQL Editor.

create or replace function public.set_user_role(
  p_user uuid,
  p_role public.app_role
)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_caller public.app_role := private.current_app_role();
  v_uid uuid := (select auth.uid());
  v_old_role public.app_role;
begin
  if v_caller <> 'maintenance' then
    raise exception 'Only Maintenance accounts may change user roles.' using errcode = '42501';
  end if;
  if p_user = v_uid then
    raise exception 'You cannot change your own role.' using errcode = '42501';
  end if;

  select role into v_old_role from public.profiles where id = p_user;
  if not found then
    raise exception 'User profile not found.' using errcode = 'P0002';
  end if;

  update public.profiles
     set role = p_role
   where id = p_user;

  -- Ensure a default admin_permissions row exists when promoting to admin
  if p_role = 'admin' then
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
      updated_by
    )
    values (p_user, true, true, false, false, false, false, false, false, v_uid)
    on conflict (profile_id) do nothing;
  end if;

  insert into public.audit_events (actor_id, action, target_type, target_id, detail)
    values (
      v_uid,
      'profile.role_changed',
      'profile',
      p_user::text,
      jsonb_build_object('from_role', v_old_role, 'to_role', p_role)
    );

  return jsonb_build_object('ok', true, 'user_id', p_user, 'role', p_role);
end;
$$;
revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
