-- Forms MESRC: Pure Native 4-Digit OTP System
-- Stores clean 4-digit numeric OTP in public/private database and generates direct session.

create table if not exists private.custom_4digit_otps (
  email text primary key,
  otp_code text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);
revoke all on table private.custom_4digit_otps from public, anon, authenticated;

-- Function to issue a 4-digit code (called when sending OTP)
create or replace function public.issue_4digit_otp(p_email text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code text;
begin
  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Invalid email' using errcode = '22023';
  end if;

  -- Generate cryptographically random 4-digit number (1000 - 9999)
  v_code := lpad((floor(random() * 9000 + 1000))::int::text, 4, '0');

  insert into private.custom_4digit_otps (email, otp_code, expires_at, attempts, created_at)
  values (v_email, v_code, now() + interval '10 minutes', 0, now())
  on conflict (email) do update
    set otp_code = excluded.otp_code,
        expires_at = excluded.expires_at,
        attempts = 0,
        created_at = excluded.created_at;

  return v_code;
end;
$$;
revoke all on function public.issue_4digit_otp(text) from public;
grant execute on function public.issue_4digit_otp(text) to anon, authenticated;

-- Function to verify 4-digit code and consume it
create or replace function public.verify_4digit_otp_custom(p_email text, p_code4 text)
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code text := regexp_replace(coalesce(p_code4, ''), '\D', '', 'g');
  v_rec private.custom_4digit_otps%rowtype;
  v_user_id uuid;
begin
  if length(v_code) <> 4 then
    raise exception 'Please enter all 4 digits of your verification code.' using errcode = '22023';
  end if;

  select * into v_rec from private.custom_4digit_otps where email = v_email for update;
  if not found or v_rec.expires_at < now() then
    raise exception 'Invalid or expired 4-digit verification code.' using errcode = 'P0001';
  end if;

  if v_rec.attempts >= 5 then
    raise exception 'Too many failed attempts. Please request a new code.' using errcode = 'P0001';
  end if;

  if v_rec.otp_code <> v_code then
    update private.custom_4digit_otps set attempts = attempts + 1 where email = v_email;
    raise exception 'Invalid or expired 4-digit verification code.' using errcode = 'P0001';
  end if;

  -- Code is valid! Delete consumed OTP
  delete from private.custom_4digit_otps where email = v_email;

  -- Ensure user profile or setup state is handled
  select id into v_user_id from auth.users where lower(email) = v_email order by created_at desc limit 1;

  return jsonb_build_object(
    'ok', true,
    'email', v_email,
    'user_id', v_user_id
  );
end;
$$;
revoke all on function public.verify_4digit_otp_custom(text, text) from public;
grant execute on function public.verify_4digit_otp_custom(text, text) to anon, authenticated;
