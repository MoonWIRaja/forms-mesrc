-- Forms MESRC Phase 6: Strict 4-Digit OTP Verification Support
-- Bridges the 4-digit OTP code displayed in the email ({{ slice .Token 0 4 }})
-- with Supabase Auth's internal token so the user only ever sees and enters 4 digits.

create table if not exists private.otp_verify_limits (
  email_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 1
);
revoke all on table private.otp_verify_limits from public, anon, authenticated;

create or replace function public.resolve_4digit_otp(p_email text, p_code4 text)
returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_code4 text := regexp_replace(coalesce(p_code4, ''), '\D', '', 'g');
  v_email_hash text;
  v_lim private.otp_verify_limits%rowtype;
  v_user_id uuid;
  v_cand text;
begin
  if length(v_code4) <> 4 then
    raise exception 'Please enter all 4 digits of your verification code.' using errcode = '22023';
  end if;

  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;

  v_email_hash := encode(extensions.digest(v_email, 'sha256'), 'hex');

  select * into v_lim from private.otp_verify_limits where email_hash = v_email_hash for update;
  if found then
    if v_lim.window_started_at < now() - interval '10 minutes' then
      update private.otp_verify_limits set window_started_at = now(), attempt_count = 1 where email_hash = v_email_hash;
    elsif v_lim.attempt_count >= 5 then
      raise exception 'Too many failed verification attempts. Please request a new 4-digit code.' using errcode = 'P0001';
    else
      update private.otp_verify_limits set attempt_count = attempt_count + 1 where email_hash = v_email_hash;
    end if;
  else
    insert into private.otp_verify_limits (email_hash, window_started_at, attempt_count)
      values (v_email_hash, now(), 1);
  end if;

  select id into v_user_id from auth.users where lower(email) = v_email limit 1;
  if v_user_id is null then
    raise exception 'Invalid or expired 4-digit verification code.' using errcode = 'P0001';
  end if;

  -- Check if GoTrue stored a plaintext/short token or if we match via SHA-224 token_hash (0000..9999 trailing digits)
  for v_cand in
    select v_code4 || lpad(i::text, 4, '0') from generate_series(0, 9999) as i
    union all
    select v_code4 || lpad(i::text, 2, '0') from generate_series(0, 99) as i
    union all
    select v_code4
  loop
    if exists (
      select 1 from auth.one_time_tokens ott
       where ott.user_id = v_user_id
         and (
           ott.token_hash = encode(extensions.digest(v_cand, 'sha224'), 'hex')
           or ott.token_hash = encode(extensions.digest(v_cand, 'sha256'), 'hex')
           or ott.token_hash = encode(extensions.hmac(v_cand, v_email, 'sha224'), 'hex')
           or ott.token_hash = v_cand
         )
    ) or exists (
      select 1 from auth.users u
       where u.id = v_user_id
         and (
           u.confirmation_token = encode(extensions.digest(v_cand, 'sha224'), 'hex')
           or u.recovery_token = encode(extensions.digest(v_cand, 'sha224'), 'hex')
           or u.confirmation_token = v_cand
           or u.recovery_token = v_cand
         )
    ) then
      delete from private.otp_verify_limits where email_hash = v_email_hash;
      return v_cand;
    end if;
  end loop;

  raise exception 'Invalid or expired 4-digit verification code.' using errcode = 'P0001';
end;
$$;

revoke all on function public.resolve_4digit_otp(text, text) from public;
grant execute on function public.resolve_4digit_otp(text, text) to anon, authenticated;
