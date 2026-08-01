/* =========================================================
   Connect DG — 데모 데이터 레이어
   · MSDS 3종(실제 문서 Section 3·14 기반 표준 프로파일)
   · 위험물 창고 8개소 / 위험물 운송 차량 5대
   · 매칭 가중치 · 법령 규제 카탈로그 · 현황 통계
   Supabase 연결 시 js/db.js 가 동일 스키마로 원격 데이터를 덮어씁니다.
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. MSDS 표준 위험물 프로파일 (발표자료 17장 · 실제 MSDS 3종)
     --------------------------------------------------------- */
  var MSDS = [
    {
      id: 'MSDS-3077',
      fileName: 'MSDS_Lithium-Cobalt-Oxide-Mixture.pdf',
      title: '리튬 · 코발트 산화물 혼합물',
      summary: '주요 성분 Cobalt oxide · Lithium cobalt oxide — Marine Pollutant 표시',
      pages: 12,
      profile: {
        productName: 'Lithium cobalt oxide mixture',
        casNo: ['1308-06-1', '12190-79-3'],
        components: [
          { name: 'Cobalt oxide (Co3O4)', cas: '1308-06-1', pct: '30~60%' },
          { name: 'Lithium cobalt oxide', cas: '12190-79-3', pct: '20~40%' },
          { name: 'Graphite', cas: '7782-42-5', pct: '5~15%' }
        ],
        unNo: 'UN 3077',
        psn: 'ENVIRONMENTALLY HAZARDOUS SUBSTANCE, SOLID, N.O.S.',
        hazardClass: '9',
        subRisk: null,
        packingGroup: 'III',
        marinePollutant: true,
        tunnelCode: 'E',
        specialProvisions: ['274', '331', '335', '375'],
        korClass: null,
        korNote: '위험물안전관리법 유별(제1~6류) 비대상 — 해양오염물질·환경유해성 기준 적용',
        chemAct: '유해화학물질(코발트 화합물) 해당 — 화관법 보관·저장업 등록 시설 필요',
        state: '고체 · 분말',
        packing: 'Fibre drum · 25kg × 40',
        storageTemp: '상온 (5~35℃)',
        incompatible: ['강산', '강환원제', '제3류 금수성 물질']
      },
      extraction: [
        { field: '제품명', value: 'Lithium cobalt oxide mixture', page: 1, section: 'Section 1', conf: 0.99 },
        { field: 'CAS No.', value: '1308-06-1 / 12190-79-3', page: 3, section: 'Section 3', conf: 0.97 },
        { field: '구성성분 · 함유량', value: 'Co3O4 30~60% · LiCoO2 20~40%', page: 3, section: 'Section 3', conf: 0.94 },
        { field: 'UN Number', value: 'UN 3077', page: 9, section: 'Section 14', conf: 0.99 },
        { field: 'Proper Shipping Name', value: 'ENVIRONMENTALLY HAZARDOUS SUBSTANCE, SOLID, N.O.S.', page: 9, section: 'Section 14', conf: 0.98 },
        { field: 'Hazard Class', value: 'Class 9', page: 9, section: 'Section 14', conf: 0.99 },
        { field: 'Packing Group', value: 'PG III', page: 9, section: 'Section 14', conf: 0.98 },
        { field: 'Marine Pollutant', value: 'Yes (해양오염물질)', page: 9, section: 'Section 14', conf: 0.96 },
        { field: '특별주의사항', value: 'SP 274 · 331 · 335 · 375', page: 10, section: 'Section 14', conf: 0.88 }
      ]
    },
    {
      id: 'MSDS-3480',
      fileName: 'MSDS_Lithium-ion-Battery-Cell.pdf',
      title: '리튬이온 배터리 셀',
      summary: 'Lithium-ion battery cell — 터널 제한코드 E · Marine Pollutant No',
      pages: 10,
      profile: {
        productName: 'Lithium-ion battery cell (INR21700)',
        casNo: ['—(제품 · 물품)'],
        components: [
          { name: 'Lithium nickel cobalt manganese oxide', cas: '346417-97-8', pct: '25~45%' },
          { name: 'Graphite', cas: '7782-42-5', pct: '10~25%' },
          { name: 'Organic electrolyte (carbonate 계)', cas: '혼합물', pct: '10~20%' },
          { name: 'Aluminium / Copper foil', cas: '7429-90-5 / 7440-50-8', pct: '10~20%' }
        ],
        unNo: 'UN 3480',
        psn: 'LITHIUM ION BATTERIES',
        hazardClass: '9',
        subRisk: null,
        packingGroup: null,   /* UN 3480은 포장등급 미지정 품목 — 포장은 PG II '성능 기준' 충족 요구 */
        packingNote: '포장등급 미지정 — 포장은 PG II 성능 기준 충족 요구 (IMDG/IATA)',
        marinePollutant: false,
        tunnelCode: 'E',
        specialProvisions: ['188', '230', '310', '348', '376', '377'],
        korClass: null,
        korNote: '위험물안전관리법 유별 비대상 — 다만 전해액(인화성 액체) 내장으로 화재하중 관리 필요',
        chemAct: '화관법 유해화학물질 비해당 — 이차전지 보관 화재안전기준(소방청 지침) 적용',
        state: '고체 · 물품(Cell)',
        packing: 'Carton on pallet · 800 cells/PL',
        storageTemp: '상온 (0~35℃) · 직사광선 회피',
        incompatible: ['제1류 산화성 고체', '제5류 자기반응성', '수분 · 침수']
      },
      extraction: [
        { field: '제품명', value: 'Lithium-ion battery cell (INR21700)', page: 1, section: 'Section 1', conf: 0.99 },
        { field: 'CAS No.', value: '물품(Article) — 구성물질별 표기', page: 3, section: 'Section 3', conf: 0.82 },
        { field: '구성성분 · 함유량', value: 'NCM 25~45% · 흑연 10~25% · 전해액 10~20%', page: 3, section: 'Section 3', conf: 0.91 },
        { field: 'UN Number', value: 'UN 3480', page: 8, section: 'Section 14', conf: 0.99 },
        { field: 'Proper Shipping Name', value: 'LITHIUM ION BATTERIES', page: 8, section: 'Section 14', conf: 0.99 },
        { field: 'Hazard Class', value: 'Class 9', page: 8, section: 'Section 14', conf: 0.99 },
        { field: 'Packing Group', value: '미지정 — 포장은 PG II 성능 기준 충족 요구', page: 8, section: 'Section 14', conf: 0.93 },
        { field: 'Marine Pollutant', value: 'No', page: 8, section: 'Section 14', conf: 0.95 },
        { field: '터널 제한코드', value: 'E', page: 8, section: 'Section 14', conf: 0.90 },
        { field: '특별주의사항', value: 'SP 188 · 230 · 310 · 348 · 376 · 377', page: 9, section: 'Section 14', conf: 0.87 }
      ]
    },
    {
      id: 'MSDS-3098',
      fileName: 'MSDS_WLC-C5H_Oxidizing-Corrosive.pdf',
      title: 'WLC-C5H 산화성 · 부식성 액체',
      summary: 'H₂O₂ 2~6% · Citric acid 1~5% — 국내 위험물안전관리법 문서상 비대상 표기',
      pages: 14,
      profile: {
        productName: 'WLC-C5H (세정용 산화성 액체)',
        casNo: ['7722-84-1', '77-92-9'],
        components: [
          { name: 'Hydrogen peroxide (H₂O₂)', cas: '7722-84-1', pct: '2~6%' },
          { name: 'Citric acid', cas: '77-92-9', pct: '1~5%' },
          { name: 'Water', cas: '7732-18-5', pct: '90% 이상' }
        ],
        unNo: 'UN 3098',
        psn: 'OXIDIZING LIQUID, CORROSIVE, N.O.S.',
        hazardClass: '5.1',
        subRisk: '8',
        packingGroup: 'II',
        marinePollutant: false,
        tunnelCode: 'E',
        specialProvisions: ['274'],
        korClass: '제6류 비해당 (H₂O₂ 농도 36% 미만 — 시행령 별표1 비고)',
        korNote: '⚠ MSDS 기재 UN3098(Class 5.1/8 · PG II)이 신고 농도(H₂O₂ 2~6%, UN 운송규정 규제 하한 8% 미만)와 불일치 — 분류 과대표기 의심, 제조사 확인 필요',
        chemAct: '화관법 유독물질 해당 여부 농도 기준 확인 필요',
        state: '액체 · 무색',
        packing: 'HDPE Drum 200L × 20',
        storageTemp: '상온 (5~30℃) · 직사광선 · 열원 회피',
        incompatible: ['제2류 가연성 고체', '제4류 인화성 액체', '금속 분말', '강알칼리']
      },
      extraction: [
        { field: '제품명', value: 'WLC-C5H', page: 1, section: 'Section 1', conf: 0.98 },
        { field: 'CAS No.', value: '7722-84-1 / 77-92-9', page: 2, section: 'Section 3', conf: 0.96 },
        { field: '구성성분 · 함유량', value: 'H₂O₂ 2~6% · Citric acid 1~5%', page: 2, section: 'Section 3', conf: 0.93 },
        { field: 'UN Number', value: 'UN 3098', page: 11, section: 'Section 14', conf: 0.97 },
        { field: 'Proper Shipping Name', value: 'OXIDIZING LIQUID, CORROSIVE, N.O.S.', page: 11, section: 'Section 14', conf: 0.95 },
        { field: 'Hazard Class', value: 'Class 5.1 (부차위험성 8)', page: 11, section: 'Section 14', conf: 0.94 },
        { field: 'Packing Group', value: 'PG II', page: 11, section: 'Section 14', conf: 0.92 },
        { field: 'Marine Pollutant', value: 'No', page: 11, section: 'Section 14', conf: 0.90 },
        { field: '국내 법령 적용', value: '「위험물안전관리법 비대상」 문서 표기', page: 12, section: 'Section 15', conf: 0.61 }
      ]
    }
  ];

  /* ---------------------------------------------------------
     2. 위험물 창고 네트워크 (초기 제휴 후보 · 발표자료 30장 Phase 1)
        · 탐색 단계에서는 창고명·주소를 가림(단계별 정보 공개, 23장)
     --------------------------------------------------------- */
  var WAREHOUSES = [
    {
      id: 'W-01', alias: '평택 포승단지 내 제4류·이차전지 허가 창고 A', name: '태웅 평택 포승 위험물센터',
      region: '경기남부', locType: '항만 배후', addr: '경기 평택시 포승읍 하만호길 ***',
      permitClasses: ['4류', '5류', 'Class 9', 'Class 5.1'],
      permitNote: '옥내저장소 + 화관법 보관·저장업 등록 · 이차전지 전용 방화구획',
      designatedMultiple: 2400, capacityPL: 2400, availPL: 620,
      inspectionValidUntil: '2027-03-18', lastAudit: '2026-03-18',
      incidents3y: 0, safetyManagers: 3,
      certs: ['자체소방대', '방폭 전기설비', '옥내소화전 · 스프링클러', '누출 감지 · 방유제'],
      portKm: 12, icKm: 4.2, ratePLDay: 1250,
      ops: '24시간 · 야간 입출고 가능', tempZones: ['상온', '정온(15~25℃)'],
      insurance: '화재 · 배상책임 100억'
    },
    {
      id: 'W-02', alias: '인천 남동공단 내 제4류·제6류 허가 창고 B', name: '인천 남동 케미컬 물류센터',
      region: '수도권', locType: '내륙 산업단지', addr: '인천 남동구 남동서로 ***',
      permitClasses: ['4류', '6류', 'Class 5.1', 'Class 8'],
      permitNote: '옥내저장소 · 산화성/부식성 분리보관 구역 운영',
      designatedMultiple: 1800, capacityPL: 1500, availPL: 90,
      inspectionValidUntil: '2026-11-02', lastAudit: '2025-11-02',
      incidents3y: 1, safetyManagers: 2,
      certs: ['옥내소화전', '중화조 · 방유제', '독립 배기 설비'],
      portKm: 21, icKm: 2.1, ratePLDay: 1180,
      ops: '평일 08~20시', tempZones: ['상온'],
      insurance: '화재 · 배상책임 50억'
    },
    {
      id: 'W-03', alias: '부산 신항 배후단지 내 종합 위험물 창고 C', name: '부산신항 DG 물류센터',
      region: '영남권', locType: '항만 배후', addr: '부산 강서구 신항남로 ***',
      permitClasses: ['4류', '5류', '6류', 'Class 9', 'Class 5.1', 'Class 8'],
      permitNote: '보세구역 내 옥내·옥외저장소 · IMDG 수출입 화물 전문',
      designatedMultiple: 3200, capacityPL: 3000, availPL: 0,
      inspectionValidUntil: '2027-06-30', lastAudit: '2026-06-30',
      incidents3y: 0, safetyManagers: 4,
      certs: ['자체소방대', '보세창고', '방폭 전기설비', 'CCTV · 출입통제'],
      portKm: 3, icKm: 6.4, ratePLDay: 1620,
      ops: '24시간', tempZones: ['상온', '정온', '냉장'],
      insurance: '화재 · 배상책임 200억'
    },
    {
      id: 'W-04', alias: '울산 온산단지 내 제4류 전용 창고 D', name: '울산 온산 석유화학 창고',
      region: '영남권', locType: '내륙 산업단지', addr: '울산 울주군 온산읍 ***',
      permitClasses: ['4류'],
      permitNote: '제4류 인화성 액체 전용 — 타 유별 허가 없음',
      designatedMultiple: 5000, capacityPL: 2000, availPL: 1100,
      inspectionValidUntil: '2027-01-15', lastAudit: '2026-01-15',
      incidents3y: 0, safetyManagers: 3,
      certs: ['자체소방대', '포소화설비', '방유제'],
      portKm: 8, icKm: 5.0, ratePLDay: 980,
      ops: '평일 08~18시', tempZones: ['상온'],
      insurance: '화재 · 배상책임 80억'
    },
    {
      id: 'W-05', alias: '여수 화치 산단 내 제5류·제6류 허가 창고 E', name: '여수 화치 스페셜티 창고',
      region: '호남권', locType: '내륙 산업단지', addr: '전남 여수시 화치동 ***',
      permitClasses: ['5류', '6류', 'Class 5.1', 'Class 8'],
      permitNote: '산화성 액체 · 자기반응성 물질 온도관리 구역',
      designatedMultiple: 1500, capacityPL: 1200, availPL: 420,
      inspectionValidUntil: '2026-09-24', lastAudit: '2025-09-24',
      incidents3y: 0, safetyManagers: 2,
      certs: ['정온 설비', '중화조', '누출 감지'],
      portKm: 14, icKm: 9.8, ratePLDay: 1090,
      ops: '평일 08~20시 · 토 08~13시', tempZones: ['상온', '정온'],
      insurance: '화재 · 배상책임 60억'
    },
    {
      id: 'W-06', alias: '화성 향남 내 이차전지 특화 창고 F', name: '화성 향남 배터리 물류센터',
      region: '경기남부', locType: '내륙 산업단지', addr: '경기 화성시 향남읍 ***',
      permitClasses: ['Class 9', '4류'],
      permitNote: '이차전지(UN3480/3481) 전용 · 셀 단위 SOC 관리 구역',
      designatedMultiple: 900, capacityPL: 1600, availPL: 780,
      inspectionValidUntil: '2027-05-11', lastAudit: '2026-05-11',
      incidents3y: 0, safetyManagers: 2,
      certs: ['배터리 전용 방화구획', '수막 설비', '열폭주 감지 센서', '옥내소화전'],
      portKm: 46, icKm: 3.4, ratePLDay: 1380,
      ops: '24시간', tempZones: ['상온', '정온(15~25℃)'],
      insurance: '화재 · 배상책임 120억'
    },
    {
      id: 'W-07', alias: '안산 반월 내 유해화학물질 보관업 창고 G', name: '안산 반월 화학물류센터',
      region: '수도권', locType: '내륙 산업단지', addr: '경기 안산시 단원구 ***',
      permitClasses: ['4류', '6류', 'Class 8', 'Class 6.1'],
      permitNote: '화관법 보관·저장업 등록 · 유독물질 취급시설',
      designatedMultiple: 1200, capacityPL: 1000, availPL: 260,
      inspectionValidUntil: '2026-08-29', lastAudit: '2025-08-29',
      incidents3y: 2, safetyManagers: 2,
      certs: ['중화조', '독립 배기', '출입통제'],
      portKm: 32, icKm: 2.8, ratePLDay: 1040,
      ops: '평일 09~18시', tempZones: ['상온'],
      insurance: '화재 · 배상책임 40억'
    },
    {
      id: 'W-08', alias: '광양 항만배후단지 내 종합 창고 H', name: '광양 항만배후 DG 창고',
      region: '호남권', locType: '항만 배후', addr: '전남 광양시 황금동 ***',
      permitClasses: ['4류', '5류', 'Class 9'],
      permitNote: '항만배후단지 옥내저장소 · 수출 컨테이너 적입 연계',
      designatedMultiple: 2000, capacityPL: 1800, availPL: 510,
      inspectionValidUntil: '2027-02-07', lastAudit: '2026-02-07',
      incidents3y: 0, safetyManagers: 3,
      certs: ['자체소방대', '옥내소화전', 'CCTV · 출입통제'],
      portKm: 5, icKm: 7.2, ratePLDay: 1150,
      ops: '24시간', tempZones: ['상온'],
      insurance: '화재 · 배상책임 90억'
    }
  ];

  /* ---------------------------------------------------------
     3. 위험물 운송 차량 · 운송사
     --------------------------------------------------------- */
  var VEHICLES = [
    {
      id: 'V-01', carrier: '태웅특수운송', type: '박스형 위험물 차량 (11t)',
      classes: ['Class 9', '4류', '5류'], capacityPL: 16,
      heightM: 3.8, gvwT: 24.5, axleT: 10,
      driver: '운송자 교육 이수 · 위험물 운송 경력 9년', adr: 'ADR 교육 이수',
      insurance: '적재물배상 30억', gps: true, tunnelLimit: '제한코드 E 화물 적재 시 E 카테고리 터널만 통행 금지',
      baseFare: 620000
    },
    {
      id: 'V-02', carrier: '한신위험물운송', type: '탱크로리 (이동탱크저장소, 20kL)',
      classes: ['4류', '6류', 'Class 5.1', 'Class 8'], capacityPL: 0,
      heightM: 3.9, gvwT: 39.0, axleT: 11.5,
      driver: '위험물운송자 자격 · 경력 14년', adr: 'ADR 교육 이수',
      insurance: '적재물배상 50억', gps: true, tunnelLimit: '제4류 적재(제한코드 D) 시 D·E 카테고리 터널 통행 금지',
      baseFare: 880000
    },
    {
      id: 'V-03', carrier: '경인로지스', type: '컨테이너 트레일러 (40ft)',
      classes: ['Class 9', 'Class 5.1', '4류', '5류'], capacityPL: 20,
      heightM: 4.1, gvwT: 40.0, axleT: 11.5,
      driver: '운송자 교육 이수 · 경력 6년', adr: 'IMDG 취급 교육',
      insurance: '적재물배상 20억', gps: true, tunnelLimit: 'E 카테고리 터널 회피 운행 원칙(제한코드 E 화물)',
      baseFare: 740000
    },
    {
      id: 'V-04', carrier: '평택배터리운송', type: '이차전지 전용 차량 (5t · 정온)',
      classes: ['Class 9'], capacityPL: 8,
      heightM: 3.4, gvwT: 12.0, axleT: 6.5,
      driver: '이차전지 운송 전담 · 경력 4년', adr: '열폭주 대응 교육 이수',
      insurance: '적재물배상 25억', gps: true, tunnelLimit: '제한 없음(소형·정온)',
      baseFare: 520000
    },
    {
      id: 'V-05', carrier: '남부케미컬수송', type: '드럼 전용 위험물 차량 (8t)',
      classes: ['Class 5.1', 'Class 8', '6류', '4류'], capacityPL: 12,
      heightM: 3.6, gvwT: 18.0, axleT: 9,
      driver: '위험물운송자 자격 · 경력 11년', adr: 'ADR 교육 이수',
      insurance: '적재물배상 30억', gps: true, tunnelLimit: 'E 카테고리 터널 외 전 구간 통행 가능',
      baseFare: 590000
    }
  ];

  /* ---------------------------------------------------------
     4. 매칭 가중치 (발표자료 19장) — 안전·법적 적합성이 60%
     --------------------------------------------------------- */
  var WEIGHTS = [
    { key: 'legal',   label: '법적 적합성',   w: 40, safety: true,  tip: '해당 위험물 유별·등급에 대한 허가 보유 여부 — 미보유 시 즉시 제외' },
    { key: 'permit',  label: '인허가 범위',   w: 20, safety: true,  tip: '지정수량 배수·최대 저장수량·시설조건·검사 유효기간' },
    { key: 'capacity',label: '가용 용량',     w: 15, safety: false, tip: '입고 예정일 기준 가용 파렛트 · 온도구역 충족 여부' },
    { key: 'safety',  label: '안전관리 이력', w: 10, safety: true,  tip: '최근 3년 사고·행정처분 이력, 안전관리자 선임 수, 소방설비' },
    { key: 'access',  label: '운송 접근성',   w: 10, safety: false, tip: '항만·IC 접근거리, 운영시간, 야간 입출고 가능 여부' },
    { key: 'cost',    label: '비용',          w: 5,  safety: false, tip: '파렛트·일 보관료 (최저가 대비 상대 점수)' }
  ];

  /* ---------------------------------------------------------
     5. 법령 · 규제 카탈로그 (적법성 교차검증 근거)
     --------------------------------------------------------- */
  var REGULATIONS = [
    {
      id: 'REG-DGS', name: '위험물안전관리법 시행령 별표1 (위험물 및 지정수량)',
      authority: '소방청', revised: '2025-07-01', url: 'https://www.law.go.kr',
      note: '제1류~제6류 유별 정의 · 지정수량. 과산화수소는 농도 36% 이상만 제6류 해당'
    },
    {
      id: 'REG-DGS2', name: '위험물안전관리법 시행규칙 별표5 (옥내저장소 기준)',
      authority: '소방청', revised: '2025-07-01', url: 'https://www.law.go.kr',
      note: '저장창고 구조·설비·저장한도·혼재 저장 기준(유별을 달리하는 위험물의 동일 저장소 저장 원칙 금지)'
    },
    {
      id: 'REG-CCA', name: '화학물질관리법 (유해화학물질 보관·저장업)',
      authority: '환경부 · 화학물질안전원', revised: '2026-01-01', url: 'https://www.me.go.kr',
      note: '유해화학물질 취급시설 기준 · 영업허가. 전국 보관창고업 약 210개소'
    },
    {
      id: 'REG-IMDG', name: 'IMDG Code (국제해상위험물규칙) Amdt. 42-24',
      authority: 'IMO', revised: '2026-01-01(강제 시행)', url: 'https://www.imo.org',
      note: 'UN 번호 · 등급 · 포장등급 · 해양오염물질 · 분리(Segregation) 기준'
    },
    {
      id: 'REG-IATA', name: 'IATA DGR 67th Edition',
      authority: 'IATA', revised: '2026-01-01', url: 'https://www.iata.org',
      note: '항공 위험물 포장기준 · 리튬배터리 SOC 30% 이하 규정(PI965~967)'
    },
    {
      id: 'REG-ADR', name: '위험물 운반차량 통행제한 · 터널 제한코드(ADR 준용)',
      authority: '국토교통부 · 도로공사', revised: '2025-03-01', url: 'https://www.molit.go.kr',
      note: '터널 등급별 통행 제한(A~E), 위험물 운반차량 통행금지 구간·시간대'
    },
    {
      id: 'REG-KOTSA', name: '위험물질 운송안전관리센터 실시간 모니터링 기준',
      authority: 'TS한국교통안전공단', revised: '2024-01-01', url: 'https://main.kotsa.or.kr',
      note: '위험물 1만ℓ 이상 · 유해화학물질 5톤 이상 운송차량 단말 장착 · 실시간 모니터링 대상'
    }
  ];

  /* ---------------------------------------------------------
     6. 경로 후보 (DG Route Intelligence · 발표자료 20장)
     --------------------------------------------------------- */
  var ROUTE_CONDITIONS = [
    { key: 'height', label: '차량 높이 · 총중량 · 축중', tip: '경로의 통과 높이·중량 제한 구간과 차량 제원을 직접 대조' },
    { key: 'dgban', label: '위험물 차량 통행 제한', tip: '도심 통과 금지 구간·시간대, 지하차도 진입 제한' },
    { key: 'tunnel', label: '터널 제한코드 (ADR 준용)', tip: '화물의 터널 제한코드 이상 카테고리 터널은 통행 금지 — 예: 코드 E 화물은 E 카테고리 터널만 금지(A~D 통행 가능), 코드 B 화물은 B~E 전부 금지' },
    { key: 'width', label: '도로 폭 · 회전반경', tip: '트레일러 회전반경 미달 구간, 협소 산업도로 회피' },
    { key: 'eta', label: '예상 도착시간 · 교통정보', tip: '입고 예약시간 대비 도착 여유 · 정체 예측' },
    { key: 'emg', label: '비상대응 접근성 · 운행거리', tip: '소방서·유해화학물질 대응기관 접근시간, 총 운행거리' }
  ];

  /* 출발지(공장/항만) → 창고 경로 후보. 조건 위반은 blocked 로 표시.
     ADR 터널 규칙(준용): 터널 카테고리 A~E 중 E가 가장 엄격.
     화물의 터널 제한코드 X = 'X 이상 카테고리 터널 통행 금지' (코드 E → E 카테고리만 금지).
     · cat        : 터널 카테고리 (통행 가능 여부는 화물 제한코드와 대조해 동적 판정)
     · clearanceM : 경로 최소 통과 높이(m) — 차량 높이와 직접 비교
     · limitT     : 경로 최소 중량 제한(t) — 차량 총중량과 직접 비교
     · narrow     : 협소 구간 존재(대형 트레일러·로리 회전반경 부족)
     · checks     : 정적 조건 — dgban(위험물 통행 허용) · eta(도착 여유) · emg(비상대응 접근) */
  var ROUTES = {
    'W-01': [
      {
        id: 'R-A', name: '고속 최단 — 경부 · 평택제천선', distanceKm: 78, minutes: 71, tolls: 8600,
        clearanceM: 4.8, limitT: 40, narrow: false,
        tunnels: [{ name: '오성터널', cat: 'C' }, { name: '서평택터널', cat: 'D' }],
        checks: { dgban: true, eta: true, emg: true },
        emgMin: 8, note: '전 구간 위험물 통행 허용 · 터널 카테고리 C·D — 제한코드 E 화물은 E 카테고리 터널만 통행 금지'
      },
      {
        id: 'R-B', name: '국도 우회 — 39번 국도 경유', distanceKm: 92, minutes: 96, tolls: 0,
        clearanceM: 4.3, limitT: 32, narrow: true,
        tunnels: [], checks: { dgban: true, eta: true, emg: true },
        emgMin: 14, note: '터널 없음 · 일부 구간 도로 폭 6m 미만 — 대형 트레일러·로리 회전반경 부족'
      },
      {
        id: 'R-C', name: '도심 통과 — 평택 시내 관통', distanceKm: 66, minutes: 62, tolls: 0,
        clearanceM: 3.5, limitT: 40, narrow: false,
        tunnels: [{ name: '평택지하차도', cat: 'E' }],
        checks: { dgban: false, eta: true, emg: false },
        emgMin: 6, note: '위험물 운반차량 통행금지 구간 포함 · E 카테고리 지하차도 — 제한코드 E 화물 통행 금지 · 통과 높이 3.5m'
      }
    ],
    'W-02': [
      {
        id: 'R-A', name: '고속 — 서해안 · 제2경인', distanceKm: 92, minutes: 84, tolls: 7400,
        clearanceM: 4.8, limitT: 40, narrow: false,
        tunnels: [{ name: '문학터널', cat: 'C' }],
        checks: { dgban: true, eta: true, emg: true },
        emgMin: 9, note: '터널 카테고리 C — 제한코드 E 화물 통행 가능'
      },
      {
        id: 'R-B', name: '국도 — 77번 해안도로', distanceKm: 108, minutes: 118, tolls: 0,
        clearanceM: 4.2, limitT: 28, narrow: true,
        tunnels: [], checks: { dgban: true, eta: false, emg: true },
        emgMin: 15, note: '교량 중량 제한 28t 구간 · 입고 예약시간 대비 지연 예상'
      }
    ],
    'W-03': [
      {
        id: 'R-A', name: '고속 — 경부 · 남해선 · 신항배후로', distanceKm: 402, minutes: 292, tolls: 28400,
        clearanceM: 4.8, limitT: 40, narrow: false,
        tunnels: [{ name: '가락터널', cat: 'C' }, { name: '불모산터널', cat: 'D' }],
        checks: { dgban: true, eta: true, emg: true },
        emgMin: 10, note: '터널 카테고리 C·D — 제한코드 E 화물 통행 가능 · 장거리 운행(휴게 계획 포함)'
      },
      {
        id: 'R-B', name: '중앙고속 우회 — 대동 경유', distanceKm: 445, minutes: 330, tolls: 26800,
        clearanceM: 4.8, limitT: 40, narrow: false,
        tunnels: [{ name: '대동터널', cat: 'E' }],
        checks: { dgban: true, eta: false, emg: true },
        emgMin: 13, note: 'E 카테고리 터널 포함 — 제한코드 E 화물 통행 금지'
      }
    ],
    'W-04': [
      {
        id: 'R-A', name: '고속 — 경부 · 울산고속 · 온산산단로', distanceKm: 368, minutes: 272, tolls: 24200,
        clearanceM: 4.8, limitT: 40, narrow: false,
        tunnels: [{ name: '활천터널', cat: 'C' }],
        checks: { dgban: true, eta: true, emg: true },
        emgMin: 9, note: '터널 카테고리 C — 통행 가능 · 온산산단 소방 거점 인접'
      },
      {
        id: 'R-B', name: '국도 7호 우회', distanceKm: 396, minutes: 318, tolls: 0,
        clearanceM: 4.5, limitT: 40, narrow: false,
        tunnels: [], checks: { dgban: false, eta: false, emg: true },
        emgMin: 12, note: '산단 진입 구간 위험물 통행 시간제한(주간만) — 야간 배차 불가'
      }
    ],
    'W-05': [
      {
        id: 'R-A', name: '고속 — 남해선 · 여수산단로', distanceKm: 122, minutes: 108, tolls: 11200,
        clearanceM: 4.8, limitT: 40, narrow: false,
        tunnels: [{ name: '율촌터널', cat: 'C' }],
        checks: { dgban: true, eta: true, emg: true },
        emgMin: 11, note: '터널 카테고리 C — 제한코드 E 화물 통행 가능'
      },
      {
        id: 'R-B', name: '국도 — 17번 국도', distanceKm: 138, minutes: 131, tolls: 0,
        clearanceM: 4.5, limitT: 40, narrow: false,
        tunnels: [{ name: '덕양터널', cat: 'E' }],
        checks: { dgban: true, eta: false, emg: true },
        emgMin: 18, note: 'E 카테고리 터널 — 제한코드 E 화물 통행 금지'
      }
    ],
    'W-06': [
      {
        id: 'R-A', name: '고속 최단 — 서해안 · 향남IC', distanceKm: 64, minutes: 63, tolls: 6200,
        clearanceM: 4.8, limitT: 40, narrow: false,
        tunnels: [{ name: '발안터널', cat: 'D' }],
        checks: { dgban: true, eta: true, emg: true },
        emgMin: 9, note: '터널 카테고리 D — 제한코드 E 화물 통행 가능'
      },
      {
        id: 'R-B', name: '지방도 우회 — 313번 지방도', distanceKm: 77, minutes: 84, tolls: 0,
        clearanceM: 4.3, limitT: 36, narrow: false,
        tunnels: [], checks: { dgban: true, eta: false, emg: true },
        emgMin: 16, note: '터널 회피 · 입고 예약시간 대비 도착 지연 예상(+21분)'
      }
    ],
    'W-07': [
      {
        id: 'R-A', name: '고속 — 서해안 · 영동 · 반월IC', distanceKm: 86, minutes: 78, tolls: 6900,
        clearanceM: 4.8, limitT: 40, narrow: false,
        tunnels: [{ name: '수리터널', cat: 'D' }],
        checks: { dgban: true, eta: true, emg: true },
        emgMin: 9, note: '터널 카테고리 D — 제한코드 E 화물 통행 가능'
      },
      {
        id: 'R-B', name: '해안 — 시화방조제 경유', distanceKm: 74, minutes: 70, tolls: 0,
        clearanceM: 4.8, limitT: 40, narrow: false,
        tunnels: [], checks: { dgban: false, eta: true, emg: false },
        emgMin: 7, note: '방조제 구간 위험물 운반차량 통행 제한 · 비상대응 접근 취약'
      }
    ],
    'W-08': [
      {
        id: 'R-A', name: '고속 — 남해선 · 이순신대교', distanceKm: 302, minutes: 232, tolls: 19800,
        clearanceM: 4.8, limitT: 40, narrow: false,
        tunnels: [{ name: '광양터널', cat: 'C' }],
        checks: { dgban: true, eta: true, emg: true },
        emgMin: 10, note: '터널 카테고리 C — 통행 가능 · 항만배후 소방 거점 인접'
      },
      {
        id: 'R-B', name: '국도 2호 우회', distanceKm: 335, minutes: 290, tolls: 0,
        clearanceM: 4.1, limitT: 32, narrow: true,
        tunnels: [], checks: { dgban: true, eta: false, emg: true },
        emgMin: 16, note: '통과 높이 4.1m · 중량 32t 제한 구간 · 협소 구간 포함'
      }
    ]
  };

  /* 등록되지 않은 창고 id 는 W-01 패턴을 복제해 '유사 패턴 시연'으로 명시 후 재사용 */
  function routesFor(whId) {
    if (ROUTES[whId]) return ROUTES[whId];
    return ROUTES['W-01'].map(function (r) {
      var c = JSON.parse(JSON.stringify(r));
      c.name += ' (유사 패턴 시연)';
      return c;
    });
  }

  /* ---------------------------------------------------------
     7. 실행 6단계 (창고 확정 이후) · 자동 생성 문서
     --------------------------------------------------------- */
  var EXEC_STEPS = [
    { key: 'quote',    no: 1, label: '견적 요청',        desc: '보관료 · 운송료 · 부대비용 산출' },
    { key: 'contract', no: 2, label: '표준계약 · 서명',  desc: '전자계약 · 책임 분담 조항 포함' },
    { key: 'insure',   no: 3, label: '보험 확인',        desc: '적재물배상 · 창고 화재보험 유효성' },
    { key: 'dispatch', no: 4, label: '위험물 차량 배차', desc: '차량 제원 · 자격 · 경로 확정' },
    { key: 'preadv',   no: 5, label: '입고예정 전송',    desc: '창고 · 안전관리자 사전 통보' },
    { key: 'receive',  no: 6, label: '검수 · 보관위치 기록', desc: '입고 검수 체크리스트 · 보관 구역 지정' }
  ];

  var AUTO_DOCS = [
    { t: '위험물 입출고 기록부', d: '입고일시 · 유별 · 수량 · 보관위치 자동 기록 (소방 점검 대응)' },
    { t: '입고 검수 체크리스트', d: '포장 상태 · 표지 · 누출 여부 · 수량 대조 결과' },
    { t: '보관 위치 배치도', d: '구역별 혼재 금지 조건 반영 배치 · 지정수량 배수 누계' },
    { t: 'MSDS · 인허가 연결 이력', d: '적용 MSDS 버전 · 창고 허가증 · 검사 유효기간 스냅샷' },
    { t: '감사 추적자료(Audit Trail)', d: '근거 · 승인자 · 변경 이력 · 조회 시각 전체 로그' },
    { t: '정기점검 일지', d: '소방시설 · 누출 감지 · 온습도 점검 결과 (SaaS 무료 배포 항목)' }
  ];

  /* ---------------------------------------------------------
     8. 현황 통계 (발표자료 1부 · 소방청 2025 위험물 통계자료 등)
     --------------------------------------------------------- */
  var STATS = {
    facilities: { total: 108829, storage: 81573, handling: 24599, manufacture: 2657, asOf: '2024-12-31' },
    storageTypes: [
      { k: '옥외탱크저장소', v: 29523 },
      { k: '이동탱크저장소(로리)', v: 22836 },
      { k: '옥내탱크저장소', v: 9456 },
      { k: '옥내저장소(창고)', v: 8702 },
      { k: '지하탱크저장소', v: 5813 },
      { k: '옥외저장소', v: 5183 }
    ],
    regions: [
      { k: '영남권', v: 32789, pct: 30.1 },
      { k: '수도권', v: 30126, pct: 27.7 },
      { k: '충청권', v: 19573, pct: 18.0 },
      { k: '호남권', v: 17887, pct: 16.4 },
      { k: '강원', v: 6890, pct: 6.3 },
      { k: '제주', v: 1564, pct: 1.4 }
    ],
    classes: [
      { k: '제4류 인화성액체', v: 106954, pct: 96.8 },
      { k: '제1류 산화성고체', v: 906, pct: 0.8 },
      { k: '제2류 가연성고체', v: 874, pct: 0.8 },
      { k: '제5류 자기반응성', v: 771, pct: 0.7 },
      { k: '제3류 자연발화성', v: 576, pct: 0.5 },
      { k: '제6류 산화성액체', v: 451, pct: 0.4 }
    ],
    accidents: [
      { y: '2020', v: 238 }, { y: '2021', v: 237 }, { y: '2022', v: 218 },
      { y: '2023', v: 216 }, { y: '2024', v: 195 }, { y: '2025', v: 282 }
    ],
    transport: { tankLorry: 22836, driversEdu: 110273, carriersEdu: 6362, hazCarriers: 488, hazWarehouses: 210 },
    market: { narrowUSD: '274.8억$', narrowCagr: '6.0%', broadUSD: '2,511억$', broadCagr: '8.1%', chemUSD: '2,417억$' },
    keyFindings: [
      '허가 옥내저장소(영업용 보관 대상)는 전국 8,702개소뿐',
      '제4류 인화성액체가 유별 허가의 96.8% — 사실상 석유류 물류',
      '화학사고 5건 중 1건(21%)은 운송 중 발생 · 탱크로리가 54%',
      '위험물 운송사 수를 집계한 공식 통계 자체가 부재'
    ]
  };

  /* ---------------------------------------------------------
     8-1. 유별 혼재 저장 기준 (위험물안전관리법 시행규칙 별표19)
          지정수량 1/10 이하 위험물은 적용 제외.
          O = 혼재 가능 · X = 혼재 금지
     --------------------------------------------------------- */
  var MIX_RULES = {
    note: '위험물안전관리법 시행규칙 별표19 「유별을 달리하는 위험물의 혼재 기준」 — 지정수량 1/10 이하 위험물에는 적용하지 않음',
    classes: ['제1류', '제2류', '제3류', '제4류', '제5류', '제6류'],
    labels: ['산화성 고체', '가연성 고체', '자연발화성 · 금수성', '인화성 액체', '자기반응성', '산화성 액체'],
    /* 혼재 가능 쌍 (작은 번호-큰 번호) */
    okPairs: ['1-6', '2-4', '2-5', '3-4', '4-5']
  };
  function mixOk(a, b) {
    if (a === b) return null; /* 동일 유별 — 매트릭스 대상 아님 */
    var lo = Math.min(a, b), hi = Math.max(a, b);
    return MIX_RULES.okPairs.indexOf(lo + '-' + hi) >= 0;
  }

  /* ---------------------------------------------------------
     9. 수익 모델 (발표자료 22장) — 정산·금융 축 표시용
     --------------------------------------------------------- */
  var REVENUE = [
    { stage: '핵심 · 거래액 기반', t: '중개 수수료', d: '매칭·배차 성사 건별 수수료', h: '첫 달 보관료 10~15% 또는 월 3~5%' },
    { stage: '성장 · 월 정액', t: '구독 (SaaS)', d: '재고관리 · 안전 컴플라이언스 · 리포트', h: 'Freemium — 기본 무료 + 고급 유료' },
    { stage: '성숙 · 부가', t: '데이터 · 광고', d: '물동 · 수급 · 요율 데이터 판매', h: '물동 인덱스 · 리포트' },
    { stage: '확장 · 금융', t: '물류금융', d: '통합 정산 · 운송보험 · 담보 대출 중개', h: '정산 PG 0.3~2% + 보험 GA' }
  ];

  window.DGDATA = {
    MSDS: MSDS,
    WAREHOUSES: WAREHOUSES,
    VEHICLES: VEHICLES,
    WEIGHTS: WEIGHTS,
    REGULATIONS: REGULATIONS,
    ROUTE_CONDITIONS: ROUTE_CONDITIONS,
    ROUTES: ROUTES,
    routesFor: routesFor,
    EXEC_STEPS: EXEC_STEPS,
    AUTO_DOCS: AUTO_DOCS,
    STATS: STATS,
    REVENUE: REVENUE,
    MIX_RULES: MIX_RULES,
    mixOk: mixOk
  };
})();
