-- =========================================================
-- Connect DG — 원클릭 활성화 SQL (schema → seed → auth → case_sync 순서 결합)
--
-- 사용법: Supabase 대시보드 → 프로젝트 qgwmqbtkuvozszgaunlp → SQL Editor
--         → New query → 이 파일 전체 붙여넣기 → Run
--
-- ⚠ 반드시 Connect DG 프로젝트(qgwmqbtkuvozszgaunlp)에서 실행할 것.
--    AI_SCM 프로젝트(kvmyiualdodcvreoqfin)와 혼동 금지.
--
-- 전 구간 멱등(idempotent) — 여러 번 실행해도 안전합니다.
-- 실행 후 계정:
--   관리자  sitditrd2@naver.com / [REDACTED-CREDENTIAL]
--   사용자  TW190708Z / [REDACTED-CREDENTIAL],  TW200106D / [REDACTED-CREDENTIAL]
--
-- ※ 이 파일은 sql/ 하위 4개 파일을 순서대로 합친 결과입니다.
--    내용 수정은 원본(schema.sql · seed.sql · auth_setup.sql · case_sync.sql)에서 하세요.
-- =========================================================



-- ======================================================================================
-- ▼▼▼ 1 / 4 · 참조 테이블 (창고 · 차량 · 법령 · 케이스)   [원본: sql/schema.sql]
-- ======================================================================================

-- =========================================================
-- Connect DG — Supabase 스키마
-- 프로젝트 : https://qgwmqbtkuvozszgaunlp.supabase.co
-- 실행 방법 : Supabase 대시보드 → SQL Editor 에 붙여넣고 실행
-- 주의 : 웹은 publishable(anon) 키만 사용합니다. service key는 사용하지 않습니다.
-- =========================================================

-- ---------- 1. 위험물 창고 ----------
create table if not exists public.dg_warehouses (
  id                    text primary key,
  alias                 text not null,          -- 탐색 단계 노출용 가림 명칭
  name                  text not null,          -- 계약 확정 후 공개
  region                text,
  loc_type              text,                   -- 내륙 산업단지 / 항만 배후 / 공항 배후
  addr                  text,
  permit_classes        jsonb default '[]'::jsonb,   -- ["4류","Class 9", ...]
  permit_note           text,
  designated_multiple   integer,                -- 지정수량 배수
  capacity_pl           integer,
  avail_pl              integer,
  inspection_valid_until date,
  last_audit            date,
  incidents_3y          integer default 0,
  safety_managers       integer default 0,
  certs                 jsonb default '[]'::jsonb,
  port_km               numeric,
  ic_km                 numeric,
  rate_pl_day           integer,
  ops                   text,
  temp_zones            jsonb default '[]'::jsonb,
  insurance             text,
  updated_at            timestamptz default now()
);

-- ---------- 2. 위험물 운송 차량 ----------
create table if not exists public.dg_vehicles (
  id            text primary key,
  carrier       text not null,
  type          text not null,
  classes       jsonb default '[]'::jsonb,
  capacity_pl   integer,
  height_m      numeric,
  gvw_t         numeric,
  axle_t        numeric,
  driver        text,
  adr           text,
  insurance     text,
  gps           boolean default true,
  tunnel_limit  text,
  base_fare     integer,
  updated_at    timestamptz default now()
);

-- ---------- 3. 법령 · 국제기준 카탈로그 ----------
create table if not exists public.dg_regulations (
  id         text primary key,
  name       text not null,
  authority  text,
  revised    text,
  url        text,
  note       text,
  updated_at timestamptz default now()
);

-- ---------- 4. 케이스 (요청 → 입고 전 과정 스냅샷) ----------
create table if not exists public.dg_cases (
  id           bigint generated always as identity primary key,
  case_no      text not null,
  verdict      text,
  warehouse_id text,
  payload      jsonb not null,
  created_at   timestamptz default now()
);
create index if not exists dg_cases_case_no_idx on public.dg_cases (case_no);

-- =========================================================
-- RLS — 참조 데이터는 공개 읽기, 케이스는 익명 등록만 허용(읽기 차단)
-- =========================================================
alter table public.dg_warehouses  enable row level security;
alter table public.dg_vehicles    enable row level security;
alter table public.dg_regulations enable row level security;
alter table public.dg_cases       enable row level security;

drop policy if exists "public read warehouses"  on public.dg_warehouses;
drop policy if exists "public read vehicles"    on public.dg_vehicles;
drop policy if exists "public read regulations" on public.dg_regulations;
drop policy if exists "anon insert cases"       on public.dg_cases;

create policy "public read warehouses"  on public.dg_warehouses  for select using (true);
create policy "public read vehicles"    on public.dg_vehicles    for select using (true);
create policy "public read regulations" on public.dg_regulations for select using (true);

-- 데모 케이스 적재만 허용(조회는 금지 — 화주 정보 보호)
create policy "anon insert cases" on public.dg_cases for insert with check (true);


-- ======================================================================================
-- ▼▼▼ 2 / 4 · 참조 데이터 적재   [원본: sql/seed.sql]
-- ======================================================================================

-- =========================================================
-- Connect DG — 시드 데이터 (js/data_dg.js 와 동일 내용)
-- schema.sql 실행 후 이 파일을 실행하면 웹이 Supabase 원격 데이터로 전환됩니다.
-- 창고·차량·경로 데이터는 기능 시연용 예시입니다(실제 계약 정보 아님).
-- =========================================================

-- ---------- 위험물 창고 ----------
insert into public.dg_warehouses
(id, alias, name, region, loc_type, addr, permit_classes, permit_note, designated_multiple,
 capacity_pl, avail_pl, inspection_valid_until, last_audit, incidents_3y, safety_managers,
 certs, port_km, ic_km, rate_pl_day, ops, temp_zones, insurance) values
('W-01','평택 포승단지 내 제4류·이차전지 허가 창고 A','태웅 평택 포승 위험물센터','경기남부','항만 배후','경기 평택시 포승읍 하만호길 ***',
 '["4류","5류","Class 9","Class 5.1"]','옥내저장소 + 화관법 보관·저장업 등록 · 이차전지 전용 방화구획',2400,2400,620,'2027-03-18','2026-03-18',0,3,
 '["자체소방대","방폭 전기설비","옥내소화전 · 스프링클러","누출 감지 · 방유제"]',12,4.2,1250,'24시간 · 야간 입출고 가능','["상온","정온(15~25℃)"]','화재 · 배상책임 100억'),
('W-02','인천 남동공단 내 제4류·제6류 허가 창고 B','인천 남동 케미컬 물류센터','수도권','내륙 산업단지','인천 남동구 남동서로 ***',
 '["4류","6류","Class 5.1","Class 8"]','옥내저장소 · 산화성/부식성 분리보관 구역 운영',1800,1500,90,'2026-11-02','2025-11-02',1,2,
 '["옥내소화전","중화조 · 방유제","독립 배기 설비"]',21,2.1,1180,'평일 08~20시','["상온"]','화재 · 배상책임 50억'),
('W-03','부산 신항 배후단지 내 종합 위험물 창고 C','부산신항 DG 물류센터','영남권','항만 배후','부산 강서구 신항남로 ***',
 '["4류","5류","6류","Class 9","Class 5.1","Class 8"]','보세구역 내 옥내·옥외저장소 · IMDG 수출입 화물 전문',3200,3000,0,'2027-06-30','2026-06-30',0,4,
 '["자체소방대","보세창고","방폭 전기설비","CCTV · 출입통제"]',3,6.4,1620,'24시간','["상온","정온","냉장"]','화재 · 배상책임 200억'),
('W-04','울산 온산단지 내 제4류 전용 창고 D','울산 온산 석유화학 창고','영남권','내륙 산업단지','울산 울주군 온산읍 ***',
 '["4류"]','제4류 인화성 액체 전용 — 타 유별 허가 없음',5000,2000,1100,'2027-01-15','2026-01-15',0,3,
 '["자체소방대","포소화설비","방유제"]',8,5.0,980,'평일 08~18시','["상온"]','화재 · 배상책임 80억'),
('W-05','여수 화치 산단 내 제5류·제6류 허가 창고 E','여수 화치 스페셜티 창고','호남권','내륙 산업단지','전남 여수시 화치동 ***',
 '["5류","6류","Class 5.1","Class 8"]','산화성 액체 · 자기반응성 물질 온도관리 구역',1500,1200,420,'2026-09-24','2025-09-24',0,2,
 '["정온 설비","중화조","누출 감지"]',14,9.8,1090,'평일 08~20시 · 토 08~13시','["상온","정온"]','화재 · 배상책임 60억'),
('W-06','화성 향남 내 이차전지 특화 창고 F','화성 향남 배터리 물류센터','경기남부','내륙 산업단지','경기 화성시 향남읍 ***',
 '["Class 9","4류"]','이차전지(UN3480/3481) 전용 · 셀 단위 SOC 관리 구역',900,1600,780,'2027-05-11','2026-05-11',0,2,
 '["배터리 전용 방화구획","수막 설비","열폭주 감지 센서","옥내소화전"]',46,3.4,1380,'24시간','["상온","정온(15~25℃)"]','화재 · 배상책임 120억'),
('W-07','안산 반월 내 유해화학물질 보관업 창고 G','안산 반월 화학물류센터','수도권','내륙 산업단지','경기 안산시 단원구 ***',
 '["4류","6류","Class 8","Class 6.1"]','화관법 보관·저장업 등록 · 유독물질 취급시설',1200,1000,260,'2026-08-29','2025-08-29',2,2,
 '["중화조","독립 배기","출입통제"]',32,2.8,1040,'평일 09~18시','["상온"]','화재 · 배상책임 40억'),
('W-08','광양 항만배후단지 내 종합 창고 H','광양 항만배후 DG 창고','호남권','항만 배후','전남 광양시 황금동 ***',
 '["4류","5류","Class 9"]','항만배후단지 옥내저장소 · 수출 컨테이너 적입 연계',2000,1800,510,'2027-02-07','2026-02-07',0,3,
 '["자체소방대","옥내소화전","CCTV · 출입통제"]',5,7.2,1150,'24시간','["상온"]','화재 · 배상책임 90억')
on conflict (id) do update set
  alias = excluded.alias, name = excluded.name, region = excluded.region, loc_type = excluded.loc_type,
  addr = excluded.addr, permit_classes = excluded.permit_classes, permit_note = excluded.permit_note,
  designated_multiple = excluded.designated_multiple, capacity_pl = excluded.capacity_pl, avail_pl = excluded.avail_pl,
  inspection_valid_until = excluded.inspection_valid_until, last_audit = excluded.last_audit,
  incidents_3y = excluded.incidents_3y, safety_managers = excluded.safety_managers, certs = excluded.certs,
  port_km = excluded.port_km, ic_km = excluded.ic_km, rate_pl_day = excluded.rate_pl_day,
  ops = excluded.ops, temp_zones = excluded.temp_zones, insurance = excluded.insurance, updated_at = now();

-- ---------- 위험물 운송 차량 ----------
insert into public.dg_vehicles
(id, carrier, type, classes, capacity_pl, height_m, gvw_t, axle_t, driver, adr, insurance, gps, tunnel_limit, base_fare) values
('V-01','태웅특수운송','박스형 위험물 차량 (11t)','["Class 9","4류","5류"]',16,3.8,24.5,10,'운송자 교육 이수 · 위험물 운송 경력 9년','ADR 교육 이수','적재물배상 30억',true,'E 코드 통행 가능(적재량 기준 충족)',620000),
('V-02','한신위험물운송','탱크로리 (이동탱크저장소, 20kL)','["4류","6류","Class 5.1","Class 8"]',0,3.9,39.0,11.5,'위험물운송자 자격 · 경력 14년','ADR 교육 이수','적재물배상 50억',true,'D/E 코드 터널 통행 제한',880000),
('V-03','경인로지스','컨테이너 트레일러 (40ft)','["Class 9","Class 5.1","4류","5류"]',20,4.1,40.0,11.5,'운송자 교육 이수 · 경력 6년','IMDG 취급 교육','적재물배상 20억',true,'E 코드 제한 구간 우회 필요',740000),
('V-04','평택배터리운송','이차전지 전용 차량 (5t · 정온)','["Class 9"]',8,3.4,12.0,6.5,'이차전지 운송 전담 · 경력 4년','열폭주 대응 교육 이수','적재물배상 25억',true,'제한 없음(소형·정온)',520000),
('V-05','남부케미컬수송','드럼 전용 위험물 차량 (8t)','["Class 5.1","Class 8","6류","4류"]',12,3.6,18.0,9,'위험물운송자 자격 · 경력 11년','ADR 교육 이수','적재물배상 30억',true,'E 코드 통행 가능',590000)
on conflict (id) do update set
  carrier = excluded.carrier, type = excluded.type, classes = excluded.classes, capacity_pl = excluded.capacity_pl,
  height_m = excluded.height_m, gvw_t = excluded.gvw_t, axle_t = excluded.axle_t, driver = excluded.driver,
  adr = excluded.adr, insurance = excluded.insurance, gps = excluded.gps, tunnel_limit = excluded.tunnel_limit,
  base_fare = excluded.base_fare, updated_at = now();

-- ---------- 법령 · 국제기준 ----------
insert into public.dg_regulations (id, name, authority, revised, url, note) values
('REG-DGS','위험물안전관리법 시행령 별표1 (위험물 및 지정수량)','소방청','2025-07-01','https://www.law.go.kr','제1류~제6류 유별 정의 · 지정수량. 과산화수소는 농도 36% 이상만 제6류 해당'),
('REG-DGS2','위험물안전관리법 시행규칙 별표5 (옥내저장소 기준)','소방청','2025-07-01','https://www.law.go.kr','저장창고 구조·설비·저장한도·혼재 저장 기준(유별을 달리하는 위험물의 동일 저장소 저장 원칙 금지)'),
('REG-CCA','화학물질관리법 (유해화학물질 보관·저장업)','환경부 · 화학물질안전원','2026-01-01','https://www.me.go.kr','유해화학물질 취급시설 기준 · 영업허가. 전국 보관창고업 약 210개소'),
('REG-IMDG','IMDG Code (국제해상위험물규칙) Amdt. 42-24','IMO','2026-01-01(강제 시행)','https://www.imo.org','UN 번호 · 등급 · 포장등급 · 해양오염물질 · 분리(Segregation) 기준'),
('REG-IATA','IATA DGR 67th Edition','IATA','2026-01-01','https://www.iata.org','항공 위험물 포장기준 · 리튬배터리 SOC 30% 이하 규정(PI965~967)'),
('REG-ADR','위험물 운반차량 통행제한 · 터널 제한코드(ADR 준용)','국토교통부 · 도로공사','2025-03-01','https://www.molit.go.kr','터널 등급별 통행 제한(A~E), 위험물 운반차량 통행금지 구간·시간대'),
('REG-KOTSA','위험물질 운송안전관리센터 실시간 모니터링 기준','TS한국교통안전공단','2024-01-01','https://main.kotsa.or.kr','위험물 1만ℓ 이상 · 유해화학물질 5톤 이상 운송차량 단말 장착 · 실시간 모니터링 대상')
on conflict (id) do update set
  name = excluded.name, authority = excluded.authority, revised = excluded.revised,
  url = excluded.url, note = excluded.note, updated_at = now();


-- ======================================================================================
-- ▼▼▼ 3 / 4 · 인증 (로그인 · 계정 · 세션)  ← 로그인이 되려면 이 구간이 필수   [원본: sql/auth_setup.sql]
-- ======================================================================================

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

-- 관리자 계정 시드 — 운영 관리자: sitditrd2@naver.com / 초기 비밀번호: [REDACTED-CREDENTIAL]
-- ⚠ 이 저장소는 공개(PUBLIC)이므로 위 비밀번호는 누구나 열람할 수 있다.
--    시연·검증 종료 후 아래 SQL로 반드시 교체할 것(교체 시 기존 세션은 자동 무효화된다):
--      update public.dg_users set pass_hash = crypt('새비밀번호', gen_salt('bf'))
--       where login_id = 'sitditrd2@naver.com';
-- 이메일 인증코드 발송: Edge Function send-code + SMTP(예: smtp.naver.com:465, 앱 비밀번호).
--   시크릿(대시보드 → Edge Functions → Secrets): SMTP_HOST/PORT/USER/PASS/FROM
insert into public.dg_users(login_id, pass_hash, status, role, display_name)
values ('sitditrd2@naver.com', crypt('[REDACTED-CREDENTIAL]', gen_salt('bf')), 'approved', 'admin', '관리자')
on conflict (login_id) do update
   set pass_hash = excluded.pass_hash, status = 'approved', role = 'admin';

-- 일반 사용자 시드 (사번 형식 아이디 — 이메일이 아니어도 로그인 가능)
-- ⚠ login_id 는 반드시 소문자로 저장할 것.
--    dg_login 이 lower(trim(p_login)) 으로 조회하므로 대문자로 저장하면 절대 매칭되지 않는다.
--    사용자는 대소문자 아무렇게나 입력해도 된다(TW190708Z / tw190708z 모두 동일).
insert into public.dg_users(login_id, pass_hash, status, role, display_name)
values
  ('tw190708z', crypt('[REDACTED-CREDENTIAL]', gen_salt('bf')), 'approved', 'user', 'TW190708Z'),
  ('tw200106d', crypt('[REDACTED-CREDENTIAL]', gen_salt('bf')), 'approved', 'user', 'TW200106D')
on conflict (login_id) do update
   set pass_hash = excluded.pass_hash, status = 'approved', role = 'user';

notify pgrst, 'reload schema';


-- ======================================================================================
-- ▼▼▼ 4 / 4 · 케이스 서버 동기화 (3 구간 선행 필요)   [원본: sql/case_sync.sql]
-- ======================================================================================

-- =========================================================
-- Connect DG — 케이스 서버 동기화 (다기기 · 다사용자)
-- 선행: sql/auth_setup.sql (dg_users · dg_sessions) 실행 후 적용.
-- 기존 dg_cases(익명 데모 적재)는 유지하고, 로그인 사용자의 케이스는
-- owner_id + case_no 로 업서트. anon 직접 조회는 계속 차단(RLS) —
-- 조회/삭제는 세션 토큰을 검증하는 SECURITY DEFINER RPC로만 가능.
-- 실행: Connect DG 프로젝트(qgwmqbtkuvozszgaunlp) SQL Editor에서 전체 실행.
-- =========================================================

alter table public.dg_cases add column if not exists owner_id  uuid references public.dg_users(id) on delete cascade;
alter table public.dg_cases add column if not exists updated_at timestamptz default now();
create unique index if not exists dg_cases_owner_case on public.dg_cases(owner_id, case_no) where owner_id is not null;

-- 토큰 → 사용자 조회 (내부 헬퍼, anon 권한 없음)
create or replace function public.dg_auth_user(p_token uuid)
returns uuid language sql security definer set search_path=public as $fn$
  select du.id from dg_sessions s join dg_users du on du.id = s.user_id
  where s.token = p_token and s.expires_at > now() and du.status = 'approved';
$fn$;

-- 업서트: 현재 케이스 전체(payload)를 소유자 기준으로 저장
create or replace function public.dg_case_upsert(p_token uuid, p_case jsonb)
returns json language plpgsql security definer set search_path=public as $fn$
declare v_uid uuid; v_case_no text;
begin
  v_uid := dg_auth_user(p_token);
  if v_uid is null then return json_build_object('error','로그인이 필요합니다'); end if;
  v_case_no := p_case->>'caseNo';
  if v_case_no is null or length(v_case_no) < 4 then return json_build_object('error','케이스 번호가 없습니다'); end if;
  if pg_column_size(p_case) > 256*1024 then return json_build_object('error','케이스 데이터가 너무 큽니다'); end if;

  insert into dg_cases(case_no, payload, verdict, warehouse_id, owner_id, updated_at)
  values (v_case_no, p_case,
          p_case#>>'{compliance,verdict}',
          p_case#>>'{warehouse,id}',
          v_uid, now())
  on conflict (owner_id, case_no) where owner_id is not null
  do update set payload = excluded.payload, verdict = excluded.verdict,
                warehouse_id = excluded.warehouse_id, updated_at = now();
  return json_build_object('ok', true, 'caseNo', v_case_no);
end $fn$;

-- 목록: 내 케이스 메타(payload 제외 요약)
create or replace function public.dg_case_list(p_token uuid)
returns json language plpgsql security definer set search_path=public as $fn$
declare v_uid uuid;
begin
  v_uid := dg_auth_user(p_token);
  if v_uid is null then return json_build_object('error','로그인이 필요합니다'); end if;
  return coalesce((
    select json_agg(json_build_object(
      'caseNo', case_no,
      'verdict', verdict,
      'warehouseId', warehouse_id,
      'item', payload#>>'{request,item}',
      'shipper', payload#>>'{request,shipper}',
      'updatedAt', updated_at
    ) order by updated_at desc)
    from dg_cases where owner_id = v_uid), '[]'::json);
end $fn$;

-- 단건: 전체 payload 반환 (기기 간 복원)
create or replace function public.dg_case_get(p_token uuid, p_case_no text)
returns json language plpgsql security definer set search_path=public as $fn$
declare v_uid uuid; v_payload jsonb;
begin
  v_uid := dg_auth_user(p_token);
  if v_uid is null then return json_build_object('error','로그인이 필요합니다'); end if;
  select payload into v_payload from dg_cases where owner_id = v_uid and case_no = p_case_no;
  if v_payload is null then return json_build_object('error','케이스를 찾을 수 없습니다'); end if;
  return json_build_object('ok', true, 'case', v_payload);
end $fn$;

-- 삭제
create or replace function public.dg_case_delete(p_token uuid, p_case_no text)
returns json language plpgsql security definer set search_path=public as $fn$
declare v_uid uuid; v_n int;
begin
  v_uid := dg_auth_user(p_token);
  if v_uid is null then return json_build_object('error','로그인이 필요합니다'); end if;
  delete from dg_cases where owner_id = v_uid and case_no = p_case_no;
  get diagnostics v_n = row_count;
  if v_n = 0 then return json_build_object('error','케이스를 찾을 수 없습니다'); end if;
  return json_build_object('ok', true);
end $fn$;

grant execute on function public.dg_case_upsert(uuid,jsonb), public.dg_case_list(uuid),
  public.dg_case_get(uuid,text), public.dg_case_delete(uuid,text) to anon;

notify pgrst, 'reload schema';


-- ========== 완료 확인 ==========
select login_id, status, role, display_name from public.dg_users order by role, login_id;
