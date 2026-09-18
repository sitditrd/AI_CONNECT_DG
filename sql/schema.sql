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
  permit_items          jsonb,                  -- 허가 품목(CAS) — 화관법 보관·저장업 등록 품목
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
  revised    text,                            -- 카탈로그 기준 개정 · 시행일
  effective  text,                            -- 현행 시행일(국가법령정보 확인값)
  checked_at text,                            -- 현행 확인일
  law_id     text,                            -- 국가법령정보 법령ID
  url        text,
  note       text,
  updated_at timestamptz default now()
);
-- 기존 설치본에 컬럼 보강 (create table if not exists 는 컬럼을 추가하지 않는다)
alter table public.dg_warehouses  add column if not exists permit_items jsonb;
alter table public.dg_regulations add column if not exists effective   text;
alter table public.dg_regulations add column if not exists checked_at  text;
alter table public.dg_regulations add column if not exists law_id      text;

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
