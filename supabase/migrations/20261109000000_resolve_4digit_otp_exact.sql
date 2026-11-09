-- Forms MESRC: Exact GoTrue 4-Digit OTP Resolver
-- Matches GoTrue's internal crypto.GenerateTokenHash(email, token):
-- sha256.Sum224([]byte(email + otp)) -> hex string

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
  v_found_token text;
begin
  if length(v_code4) <> 4 then
    raise exception 'Please enter all 4 digits of your verification code.' using errcode = '22023';
  end if;

  if v_email = '' or position('@' in v_email) < 2 then
    raise exception 'Please enter a valid email address.' using errcode = '22023';
  end if;

  v_email_hash := encode(extensions.digest(v_email, 'sha256'), 'hex');

  -- Rate limit check (max 10 attempts per 10 mins)
  select * into v_lim from private.otp_verify_limits where email_hash = v_email_hash for update;
  if found then
    if v_lim.window_started_at < now() - interval '10 minutes' then
      update private.otp_verify_limits set window_started_at = now(), attempt_count = 1 where email_hash = v_email_hash;
    elsif v_lim.attempt_count >= 10 then
      raise exception 'Too many failed verification attempts. Please request a new 4-digit code.' using errcode = 'P0001';
    else
      update private.otp_verify_limits set attempt_count = attempt_count + 1 where email_hash = v_email_hash;
    end if;
  else
    insert into private.otp_verify_limits (email_hash, window_started_at, attempt_count)
      values (v_email_hash, now(), 1);
  end if;

  -- 1. Scan 6-digit GoTrue OTPs (4 + 2 digits, 00..99)
  with candidates as (
    select (v_code4 || lpad(i::text, 2, '0')) as cand
      from generate_series(0, 99) as i
  ),
  hashed as (
    select cand,
           encode(extensions.digest(v_email || cand, 'sha224'), 'hex') as h_email,
           encode(extensions.digest(cand, 'sha224'), 'hex') as h_plain
      from candidates
  )
  select h.cand into v_found_token
    from hashed h
   where exists (
     select 1 from auth.one_time_tokens ott
      where ott.token_hash = h.h_email
         or ott.token_hash = h.h_plain
         or ott.token_hash = h.cand
   ) or exists (
     select 1 from auth.users u
      where lower(u.email) = v_email
        and (
          u.confirmation_token = h.h_email
          or u.recovery_token = h.h_email
          or u.confirmation_token = h.h_plain
          or u.recovery_token = h.h_plain
          or u.confirmation_token = h.cand
          or u.recovery_token = h.cand
        )
   )
   limit 1;

  if v_found_token is not null then
    delete from private.otp_verify_limits where email_hash = v_email_hash;
    return v_found_token;
  end if;

  -- 2. Scan 8-digit GoTrue OTPs (4 + 4 digits, 0000..9999)
  with candidates as (
    select (v_code4 || lpad(i::text, 4, '0')) as cand
      from generate_series(0, 9999) as i
  ),
  hashed as (
    select cand,
           encode(extensions.digest(v_email || cand, 'sha224'), 'hex') as h_email,
           encode(extensions.digest(cand, 'sha224'), 'hex') as h_plain
      from candidates
  )
  select h.cand into v_found_token
    from hashed h
   where exists (
     select 1 from auth.one_time_tokens ott
      where ott.token_hash = h.h_email
         or ott.token_hash = h.h_plain
         or ott.token_hash = h.cand
   ) or exists (
     select 1 from auth.users u
      where lower(u.email) = v_email
        and (
          u.confirmation_token = h.h_email
          or u.recovery_token = h.h_email
          or u.confirmation_token = h.h_plain
          or u.recovery_token = h.h_plain
          or u.confirmation_token = h.cand
          or u.recovery_token = h.cand
        )
   )
   limit 1;

  if v_found_token is not null then
    delete from private.otp_verify_limits where email_hash = v_email_hash;
    return v_found_token;
  end if;

  -- 3. Check exact 4-digit code as-is
  if exists (
    select 1 from auth.one_time_tokens ott
     where ott.token_hash = encode(extensions.digest(v_email || v_code4, 'sha224'), 'hex')
        or ott.token_hash = encode(extensions.digest(v_code4, 'sha224'), 'hex')
        or ott.token_hash = v_code4
  ) or exists (
    select 1 from auth.users u
     where lower(u.email) = v_email
       and (
         u.confirmation_token = encode(extensions.digest(v_email || v_code4, 'sha224'), 'hex')
         or u.confirmation_token = v_code4
         or u.recovery_token = v_code4
       )
  ) then
    delete from private.otp_verify_limits where email_hash = v_email_hash;
    return v_code4;
  end if;

  raise exception 'Invalid or expired 4-digit verification code.' using errcode = 'P0001';
end;
$$;

revoke all on function public.resolve_4digit_otp(text, text) from public;
grant execute on function public.resolve_4digit_otp(text, text) to anon, authenticated;
