-- =========================================================
-- Connect DG — 커스텀 인증 백엔드 (Supabase Postgres)
-- 이메일+비번(bcrypt) 로그인 · 이메일 인증코드(OTP) 가입 · 관리자 승인 · 세션 토큰
-- 민감 테이블은 RLS 잠금(anon 직접 접근 불가) → SECURITY DEFINER 함수로만 접근.
-- 발송은 Edge Function `send-code`(denomailer + 본인 SMTP)가 담당.
-- 실행: Connect DG 프로젝트(qgwmqbtkuvozszgaunlp) SQL Editor에서 전체 실행.
-- =========================================================
create extension if not exists pgcrypto;   -- crypt/gen_salt (extensions 스키마)

create table if not exists public.dg_users (
  id uuid primary key default gen_random_uuid(),
  login_id text unique not null,
  pass_hash text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  role text not null default 'user' check (role in ('user','admin')),
  display_name text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);
create table if not exists public.dg_sessions (
  token uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.dg_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);
create table if not exists public.dg_email_codes (
  id uuid primary key default gen_random_uuid(),
  login_id text not null,
  code text not null,
  purpose text not null default 'signup' check (purpose in ('signup','reset')),
  expires_at timestamptz not null default now() + interval '10 minutes',
  created_at timestamptz not null default now(),
  consumed boolean not null default false,
  attempts int not null default 0          -- 오입력 횟수 — MAX_CODE_ATTEMPTS 초과 시 코드 소각
);
alter table public.dg_email_codes add column if not exists attempts int not null default 0;  -- 기존 설치 대응
create index if not exists dg_email_codes_lookup on public.dg_email_codes(login_id, purpose, created_at desc);

alter table public.dg_users        enable row level security;  -- 정책 없음 → anon 직접 접근 불가
alter table public.dg_sessions     enable row level security;
alter table public.dg_email_codes  enable row level security;

-- 로그인: bcrypt 검증 → 승인 계정만 세션 토큰 발급
create or replace function public.dg_login(p_login text, p_password text)
returns json language plpgsql security definer set search_path=public, extensions as $fn$
declare u public.dg_users; v_token uuid;
begin
  select * into u from dg_users where login_id = lower(trim(p_login));
  if u.id is null or u.pass_hash <> crypt(p_password, u.pass_hash) then
    return json_build_object('error','아이디 또는 비밀번호가 올바르지 않습니다'); end if;
  if u.status <> 'approved' then
    return json_build_object('status', u.status, 'error',
      case u.status when 'pending' then '승인 대기중입니다. 관리자 승인 후 이용 가능합니다.' else '승인되지 않았거나 거부된 계정입니다.' end); end if;
  insert into dg_sessions(user_id) values (u.id) returning token into v_token;
  return json_build_object('ok',true,'token',v_token,'role',u.role,'login',u.login_id,'name',u.display_name);
end $fn$;

-- 세션 확인 / 로그아웃
-- status='approved' 도 함께 확인 — 승인 취소(rejected/pending)된 계정의 기존 토큰을 즉시 무력화.
-- 이 한 조건으로 클라이언트 게이트와 msds-extract(유료 분석) 경로가 함께 닫힌다.
create or replace function public.dg_me(p_token uuid)
returns json language plpgsql security definer set search_path=public, extensions as $fn$
declare u public.dg_users;
begin
  select du.* into u from dg_sessions s join dg_users du on du.id=s.user_id
   where s.token=p_token and s.expires_at>now() and du.status='approved';
  if u.id is null then return json_build_object('error','세션이 만료되었습니다'); end if;
  return json_build_object('ok',true,'role',u.role,'login',u.login_id,'name',u.display_name,'status',u.status);
end $fn$;
create or replace function public.dg_logout(p_token uuid)
returns void language plpgsql security definer set search_path=public, extensions as $fn$
begin delete from dg_sessions where token=p_token; end $fn$;

-- 가입(인증코드 확인 후 pending 생성) / 비밀번호 재설정(인증코드 확인 후)
create or replace function public.dg_signup_verified(p_login text, p_password text, p_code text, p_name text default null)
returns json language plpgsql security definer set search_path=public, extensions as $fn$
declare v_id uuid; v_login text := lower(trim(p_login));
begin
  if v_login is null or length(v_login) < 4 then return json_build_object('error','아이디(이메일)를 확인하세요'); end if;
  if p_password is null or length(p_password) < 8 then return json_build_object('error','비밀번호는 8자 이상이어야 합니다'); end if;
  if not exists(select 1 from dg_email_codes where login_id=v_login and code=p_code and purpose='signup' and not consumed and expires_at>now()) then
    /* 오입력 누적 → 5회 초과 시 코드 소각(무차별 대입 차단). 정답 입력은 카운트되지 않음 */
    update dg_email_codes set attempts = attempts + 1
     where login_id=v_login and purpose='signup' and not consumed and expires_at>now();
    update dg_email_codes set consumed = true
     where login_id=v_login and purpose='signup' and not consumed and attempts >= 5;
    return json_build_object('error','인증코드가 올바르지 않거나 만료되었습니다'); end if;
  if exists(select 1 from dg_users where login_id=v_login) then
    return json_build_object('error','이미 가입 신청되었거나 사용 중인 아이디입니다'); end if;
  update dg_email_codes set consumed=true where login_id=v_login and purpose='signup';
  insert into dg_users(login_id, pass_hash, display_name) values (v_login, crypt(p_password, gen_salt('bf')), nullif(trim(p_name),'')) returning id into v_id;
  return json_build_object('ok', true, 'status', 'pending');
end $fn$;
create or replace function public.dg_reset_with_code(p_login text, p_code text, p_new_password text)
returns json language plpgsql security definer set search_path=public, extensions as $fn$
declare v_login text := lower(trim(p_login));
begin
  if p_new_password is null or length(p_new_password) < 8 then return json_build_object('error','비밀번호는 8자 이상이어야 합니다'); end if;
  if not exists(select 1 from dg_email_codes where login_id=v_login and code=p_code and purpose='reset' and not consumed and expires_at>now()) then
    /* 오입력 누적 → 5회 초과 시 코드 소각(무차별 대입 차단). 정답 입력은 카운트되지 않음 */
    update dg_email_codes set attempts = attempts + 1
     where login_id=v_login and purpose='reset' and not consumed and expires_at>now();
    update dg_email_codes set consumed = true
     where login_id=v_login and purpose='reset' and not consumed and attempts >= 5;
    return json_build_object('error','인증코드가 올바르지 않거나 만료되었습니다'); end if;
  if not exists(select 1 from dg_users where login_id=v_login) then return json_build_object('error','가입되지 않은 아이디입니다'); end if;
  update dg_email_codes set consumed=true where login_id=v_login and purpose='reset';
  update dg_users set pass_hash=crypt(p_new_password, gen_salt('bf')) where login_id=v_login;
  /* 비밀번호가 바뀌면 기존 세션은 모두 무효 — 탈취된 토큰이 30일간 살아남지 않도록 */
  delete from dg_sessions where user_id = (select id from dg_users where login_id = v_login);
  return json_build_object('ok', true);
end $fn$;

-- 관리자: 목록 / 상태변경(승인·거부) / 비밀번호 재설정 (토큰의 role=admin 확인)
create or replace function public.dg_admin_list(p_token uuid)
returns json language plpgsql security definer set search_path=public, extensions as $fn$
declare v_role text;
begin
  select du.role into v_role from dg_sessions s join dg_users du on du.id=s.user_id where s.token=p_token and s.expires_at>now();
  if v_role is distinct from 'admin' then return json_build_object('error','관리자 권한이 필요합니다'); end if;
  return coalesce((select json_agg(json_build_object('id',id,'login',login_id,'name',display_name,'status',status,'role',role,'created_at',created_at) order by created_at desc) from dg_users), '[]'::json);
end $fn$;
create or replace function public.dg_admin_set_status(p_token uuid, p_id uuid, p_status text)
returns json language plpgsql security definer set search_path=public, extensions as $fn$
declare v_role text;
begin
  select du.role into v_role from dg_sessions s join dg_users du on du.id=s.user_id where s.token=p_token and s.expires_at>now();
  if v_role is distinct from 'admin' then return json_build_object('error','관리자 권한이 필요합니다'); end if;
  if p_status not in ('approved','rejected','pending') then return json_build_object('error','잘못된 상태값'); end if;
  update dg_users set status=p_status, approved_at=case when p_status='approved' then now() else approved_at end where id=p_id and role<>'admin';
  /* 승인 취소(거부·보류)는 즉시 세션 회수 — 기존 토큰으로 계속 이용하는 것을 차단 */
  if p_status <> 'approved' then delete from dg_sessions where user_id=p_id; end if;
  return json_build_object('ok',true);
end $fn$;
create or replace function public.dg_admin_reset_pw(p_token uuid, p_id uuid, p_new_password text)
returns json language plpgsql security definer set search_path=public, extensions as $fn$
declare v_role text;
begin
  select du.role into v_role from dg_sessions s join dg_users du on du.id=s.user_id where s.token=p_token and s.expires_at>now();
  if v_role is distinct from 'admin' then return json_build_object('error','관리자 권한이 필요합니다'); end if;
  if p_new_password is null or length(p_new_password) < 8 then return json_build_object('error','비밀번호는 8자 이상이어야 합니다'); end if;
  update dg_users set pass_hash = crypt(p_new_password, gen_salt('bf')) where id = p_id;
  /* 임시 비밀번호 발급 = 기존 세션 무효화. 단, 관리자 자신의 현재 세션은 유지 */
  delete from dg_sessions where user_id = p_id and token <> p_token;
  return json_build_object('ok', true);
end $fn$;

-- anon(publishable 키) 실행 권한 부여
grant execute on function public.dg_login(text,text), public.dg_me(uuid), public.dg_logout(uuid),
  public.dg_signup_verified(text,text,text,text), public.dg_reset_with_code(text,text,text),
  public.dg_admin_list(uuid), public.dg_admin_set_status(uuid,uuid,text), public.dg_admin_reset_pw(uuid,uuid,text) to anon;

-- =========================================================
-- 계정 시드 — 비밀번호는 이 파일에 넣지 않는다
--
-- ⚠ 이 저장소는 공개(PUBLIC)이며 깃 이력은 영구 보존된다.
--    파일에 평문을 한 번이라도 적으면 이후 지워도 히스토리에서 계속 조회된다.
--    따라서 아래는 '추측 불가능한 임의값'으로 계정 골격만 만들고,
--    실제 비밀번호는 sql/set_passwords.sql 을 각자 값으로 채워 SQL Editor에서 실행한다.
--
-- 재실행 안전: on conflict do nothing — 이미 만들어 둔 비밀번호를 덮어쓰지 않는다.
--
-- 이메일 인증코드 발송: Edge Function send-code + SMTP(예: smtp.naver.com:465, 앱 비밀번호).
--   시크릿(대시보드 → Edge Functions → Secrets): SMTP_HOST/PORT/USER/PASS/FROM
-- =========================================================

-- 관리자
insert into public.dg_users(login_id, pass_hash, status, role, display_name)
values ('sitditrd2@naver.com', crypt(gen_random_uuid()::text, gen_salt('bf')), 'approved', 'admin', '관리자')
on conflict (login_id) do nothing;

-- 일반 사용자 (사번 형식 아이디 — 이메일이 아니어도 로그인 가능)
-- ⚠ login_id 는 반드시 소문자로 저장할 것.
--    dg_login 이 lower(trim(p_login)) 으로 조회하므로 대문자로 저장하면 절대 매칭되지 않는다.
--    사용자는 대소문자 아무렇게나 입력해도 된다(TW190708Z / tw190708z 모두 동일).
insert into public.dg_users(login_id, pass_hash, status, role, display_name)
values
  ('tw190708z', crypt(gen_random_uuid()::text, gen_salt('bf')), 'approved', 'user', 'TW190708Z'),
  ('tw200106d', crypt(gen_random_uuid()::text, gen_salt('bf')), 'approved', 'user', 'TW200106D')
on conflict (login_id) do nothing;

notify pgrst, 'reload schema';
