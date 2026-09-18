-- =========================================================
-- Connect DG — 신뢰성 검증 기능 DB 동기화 (2026-09-18)
--
-- 실행 위치: Supabase 대시보드 → 프로젝트 qgwmqbtkuvozszgaunlp → SQL Editor
-- 여러 번 실행해도 결과가 같다(멱등).
--
-- 실행하지 않아도 사이트는 정상 동작한다. js/db.js 가 원격 행을 시드에 id 기준으로
-- '병합'하므로 창고 허가 품목(CAS) · 법령 현행 시행일은 시드 값으로 유지된다.
-- 다만 원격 법령 카탈로그의 기준일이 옛 값이라 화면에 '카탈로그 갱신 필요 4건'이 표시된다.
-- 아래를 실행하면 카탈로그가 현행과 일치해 그 표시가 사라진다.
--
-- 현행 시행일은 2026-09-18 국가법령정보(현행)에서 직접 조회한 값이다.
-- =========================================================

-- ---------- 1. 컬럼 추가 ----------
alter table public.dg_warehouses  add column if not exists permit_items jsonb;          -- 허가 품목(CAS) 목록
alter table public.dg_regulations add column if not exists effective   text;           -- 현행 시행일
alter table public.dg_regulations add column if not exists checked_at  text;           -- 현행 확인일
alter table public.dg_regulations add column if not exists law_id      text;           -- 국가법령정보 법령ID

-- ---------- 2. 창고 허가 품목(CAS) — 시연 매핑 3곳 ----------
update public.dg_warehouses set permit_items = '["1308-06-1","12190-79-3","7722-84-1"]'::jsonb where id = 'W-01';
update public.dg_warehouses set permit_items = '["7664-93-9","1310-73-2","7722-84-1"]'::jsonb  where id = 'W-07';
update public.dg_warehouses set permit_items = '["7664-93-9","1310-73-2"]'::jsonb              where id = 'W-08';

-- ---------- 3. 법령 카탈로그 — 현행 시행일로 갱신 · 신규 2건 추가 ----------
insert into public.dg_regulations (id, name, authority, revised, effective, checked_at, law_id, url, note) values
  ('REG-DGS',  '위험물안전관리법 시행령 별표1 (위험물 및 지정수량)', '소방청',
   '2026-07-01', '2026-07-01', '2026-09-18', '009707', 'https://www.law.go.kr',
   '제1류~제6류 유별 정의 · 지정수량. 과산화수소는 농도 36중량% 이상만 제6류 해당(비고 22)'),
  ('REG-DGS2', '위험물안전관리법 시행규칙 별표5 · 별표19 (옥내저장소 · 혼재기준)', '소방청',
   '2026-07-01', '2026-07-01', '2026-09-18', '009732', 'https://www.law.go.kr',
   '저장창고 구조·설비·저장한도, 유별을 달리하는 위험물의 혼재 기준(지정수량 1/10 이하 적용 제외)'),
  ('REG-DGT',  '위험물안전관리법 시행규칙 별표21 (위험물의 운송기준)', '소방청',
   '2026-07-01', '2026-07-01', '2026-09-18', '009732', 'https://www.law.go.kr',
   '이동탱크저장소 장거리 운송(고속국도 340km · 그 밖 200km 이상) 시 운전자 2명 이상. 예외 — 운송책임자 동승, 제2류·제3류(탄화물)·제4류(특수인화물 제외), 2시간마다 20분 이상 휴식'),
  ('REG-CCA',  '화학물질관리법 (유해화학물질 보관·저장업)', '기후에너지환경부 · 화학물질안전원',
   '2025-10-01', '2025-10-01', '2026-09-18', '000162', 'https://www.law.go.kr',
   '유해화학물질 취급시설 기준 · 영업허가. 창고 허가 품목은 CAS 단위로 관리'),
  ('REG-ROAD', '도로법 시행령 제79조 (차량의 운행 제한)', '국토교통부 · 도로관리청',
   '2026-09-18', '2026-09-18', '2026-09-18', '003400', 'https://www.law.go.kr',
   '축하중 10t · 총중량 40t · 폭 2.5m · 높이 4.0m(도로관리청 고시 구간 4.2m) · 길이 16.7m 초과 차량은 운행제한 — 제한차량 운행허가 필요'),
  ('REG-KOTSA', '물류정책기본법 제29조의2 (위험물질 운송안전관리센터 · 단말장치)', '국토교통부 · TS한국교통안전공단',
   '2025-10-01', '2025-10-01', '2026-09-18', '000092', 'https://www.law.go.kr',
   '위험물질 운송차량 단말장치 장착 · 실시간 모니터링(대상 기준은 하위법령 — 시행령 2026-09-15 개정)'),
  ('REG-IMDG', 'IMDG Code (국제해상위험물규칙) Amdt. 42-24', 'IMO',
   '2026-01-01(강제 시행)', '2026-01-01', null, null, 'https://www.imo.org',
   'UN 번호 · 등급 · 포장등급 · 해양오염물질 · 분리(Segregation) 기준 — 국제기준은 개정판 발행 시 수동 확인'),
  ('REG-IATA', 'IATA DGR 67th Edition', 'IATA',
   '2026-01-01', '2026-01-01', null, null, 'https://www.iata.org',
   '항공 위험물 포장기준 · 리튬배터리 SOC 30% 이하 규정(PI965~967)'),
  ('REG-ADR',  'ADR 터널 제한코드 (유럽 기준 — 참조용)', 'UNECE',
   '2025-01-01', '2025-01-01', null, null, 'https://unece.org',
   '터널 카테고리 A~E. 국내 공식 체계가 아니므로 참조값으로만 사용 — 국내 적용은 도로관리청·지자체 지정 통행제한 구간으로 대체 필요')
on conflict (id) do update set
  name = excluded.name, authority = excluded.authority, revised = excluded.revised,
  effective = excluded.effective, checked_at = excluded.checked_at, law_id = excluded.law_id,
  url = excluded.url, note = excluded.note, updated_at = now();

-- ---------- 4. 확인 ----------
select id, revised, effective, checked_at from public.dg_regulations order by id;
select id, permit_items from public.dg_warehouses where permit_items is not null order by id;
