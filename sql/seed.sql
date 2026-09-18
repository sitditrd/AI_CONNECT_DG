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

-- ---------- 창고 허가 품목(CAS) — 시연 매핑 ----------
update public.dg_warehouses set permit_items = '["1308-06-1","12190-79-3","7722-84-1"]'::jsonb where id = 'W-01';
update public.dg_warehouses set permit_items = '["7664-93-9","1310-73-2","7722-84-1"]'::jsonb  where id = 'W-07';
update public.dg_warehouses set permit_items = '["7664-93-9","1310-73-2"]'::jsonb              where id = 'W-08';

-- ---------- 법령 · 국제기준 (현행 시행일 2026-09-18 국가법령정보 확인) ----------
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
