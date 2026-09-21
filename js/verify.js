/* =========================================================
   Connect DG — 시스템 구현 범위 · 신뢰성 검증
   · 구현 범위 총괄 · 문서 오류 처리 절차 · 법령 변경 관리 절차
   · 담당자 확인 전환 기준 / 법령 현행 대조는 DGVerify 에서 직접 그린다
     — 화면 설명과 실제 코드가 어긋나지 않도록 규칙 정의를 한 곳에서 가져온다
   ========================================================= */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }

  var STATE_CLS = { '구현': 'badge-ok', '부분': 'badge-cond', '미구현': 'badge-no' };
  function stateBadge(s) { return '<span class="badge ' + (STATE_CLS[s] || 'badge-neutral') + '"><i></i>' + esc(s) + '</span>'; }

  /* 영역 · 기능 · 상태 · 현재 구현 · 추가 개발 · 화면 */
  var SCOPE = [
    { area: '① 운송 배차 · 경로', rows: [
      { f: '차량 적합성 매칭', s: '구현', now: '운송 등급 · 차량 구조 대조, 필요 회차 산출', next: '운송사 · 차량 실데이터 등록(현재 샘플 5대)', href: 'matching.html' },
      { f: '경로 6조건 판정', s: '부분', now: '높이 · 중량 · 통행제한 · 터널 · 도로 폭 · 도착시간 · 비상대응 판정, 위반 경로 배차 차단', next: '실제 경로탐색 API · 국내 제한구간 DB(현재 창고별 경로 2~3개 샘플)', href: 'route.html' },
      { f: '도로법 운행제한 · 운송기준', s: '구현', now: '시행령 제79조 차량 제원 대조, 별표21 장거리 2인 운전 판정', next: '제한차량 운행허가 발급 이력 연계', href: 'route.html' },
      { f: '운행 관제(GPS · ETA)', s: '미구현', now: '화면 시연용 진행 표시', next: '운송사 단말 · 위험물질 운송안전관리센터 연계', href: 'dispatch.html' }
    ] },
    { area: '② LLM · OCR 문서 판독', rows: [
      { f: '문서 AI 분석', s: '부분', now: 'PDF · 스캔 · 이미지를 JSON 스키마로 구조화하는 코드 구현, 분석 서버는 미배포(시연은 실제 MSDS 3종 재생)', next: '분석 서버 배포 후 샘플셋 정확도 실측', href: 'msds.html' },
      { f: '비정형 문서(B/L) 처리', s: '부분', now: '분석 엔진에 문서 유형(MSDS · B/L) 스키마 구현 — 발행사마다 다른 B/L 양식에서 당사자 · 선박 · 컨테이너 · 위험물 신고 행 추출', next: 'B/L 실제 샘플 확보 · 정답지 작성 후 정확도 검증, 화면 연결', href: 'verify.html#doc' },
      { f: '양식 · 언어 · 스캔 품질 판독', s: '구현', now: '문서 특성(언어 · 형식 · 판독 품질)을 함께 판독 — 저품질 스캔 · 사진 · 정답지 미확보 언어는 담당자 확인 전환', next: '국문 · 스캔본 정답지 추가로 검증 언어 확대', href: 'msds.html' },
      { f: '정확도 채점 도구', s: '구현', now: '실제 MSDS 3종 원본 정답지(원문 표기 · 쪽수 · 원문 오기) + 필드별 채점기 — 시연 데이터 원본 대조 필드 30/30 · 쪽수 25/25', next: 'AI 분석 결과를 같은 채점기로 실측(샘플 30건 이상)', href: 'verify.html#doc' },
      { f: '원문 위치 · 신뢰도 · 인식 적합도', s: '구현', now: '필드별 섹션 · 페이지 · 신뢰도, 적합도 4지표', next: '원문 영역(좌표) 하이라이트', href: 'msds.html' },
      { f: '오류 검출', s: '구현', now: '누락 · 저신뢰 · CAS 체크디짓 · 농도와 분류 상충을 확인 필요로 전환', next: '물질별 농도 기준 확대', href: 'msds.html' },
      { f: '원문 대조 수정', s: '구현', now: '담당자 수정 시 전후 값 · 사유 · 수정자를 기록하고 프로파일에 반영', next: '수정 권한 관리', href: 'msds.html' }
    ] },
    { area: '③ 법규 검증 · 창고 매칭', rows: [
      { f: '창고 인허가 대조 · 판정', s: '구현', now: '유별 · 등급 허가, 검사 유효기간, 가용공간, 부차위험 대조', next: '창고 인허가 원본 DB(현재 샘플 8곳)', href: 'matching.html' },
      { f: '보관 조건(온도) 대조', s: '구현', now: 'MSDS 보관 온도 표기에서 온도구역 요구를 도출해 창고 온도구역과 대조', next: '습도 · 환기 · 방폭 등 시설 조건 대조 확대', href: 'compliance.html' },
      { f: 'CAS 단위 허가 품목 대조', s: '부분', now: '창고 허가 품목(CAS)과 MSDS 성분 대조 — 시연 매핑 3곳, 물품(Article)은 대조 비대상', next: '유해화학물질 고시 목록 연동 · 전 창고 허가 품목 등록', href: 'matching.html' },
      { f: '담당자 확인 전환', s: '구현', now: '13개 전환 기준 — 사유가 남으면 승인 후에도 조건부', next: '승인 권한 · 이력 관리', href: 'compliance.html' },
      { f: '법령 변경 관리', s: '부분', now: '현행 시행일 대조 · 카탈로그 갱신 표시 · 판정마다 규칙 세트 버전 기록', next: '국가법령정보 Open API 자동 조회(인증키 발급 필요)', href: 'compliance.html' },
      { f: '지정수량 배수 환산', s: '부분', now: '시행령 별표1 지정수량 15개 품명 반영, 환산 불가 시 확인 전환', next: '품명별 입고 수량 단위(L · kg) 입력', href: 'compliance.html' }
    ] }
  ];

  var DOC_STEPS = [
    { t: '자동 검사', d: '필수 필드 누락 · 신뢰도 80% 미만 · 인식 적합도 85점 미만 · CAS 체크디짓 · 농도와 분류 상충 · 문서 품질과 언어', s: '구현' },
    { t: '확인 필요 표시', d: '해당 필드와 원문 섹션 · 페이지를 함께 제시', s: '구현' },
    { t: '담당자 원문 대조 · 수정', d: '전후 값 · 사유 · 수정자 이력 저장, 원문 영역 하이라이트는 추가 개발', s: '부분' },
    { t: '승인 후 확정', d: '전문가 승인 전에는 적법성 판정을 확정하지 않음', s: '구현' }
  ];

  var LAW_STEPS = [
    { t: '변경 탐지', d: '대상 법령의 공포일 · 시행일을 현행 법령과 대조 — 자동 조회는 국가법령정보 Open API 연동 예정', s: '부분' },
    { t: '영향 분석', d: '법령마다 근거가 되는 판정 규칙(유별 · 지정수량 · 혼재 · 운송기준)을 연결해 영향 규칙 식별', s: '구현' },
    { t: '규칙 검토', d: '위험물 · 법률 담당자가 변경 조문을 검토하고 승인', s: '부분' },
    { t: '시행일 기준 반영', d: '규칙 세트 버전 관리 — 판정마다 적용 버전과 근거 법령 시행일을 기록', s: '구현' },
    { t: '재검토 · 알림', d: '규칙 검토일 이후 시행되는 개정이 있으면 해당 건을 담당자 확인으로 전환', s: '구현' }
  ];

  var RULE_LABEL = {
    korClass: '국내 유별', designatedQty: '지정수량', conc: '농도 기준', permit: '저장소 기준', mix: '혼재 기준',
    driver: '운송기준', casPermit: 'CAS 허가 품목', roadLaw: '운행제한', monitor: '운행 관제', imdg: 'IMDG 분류',
    iata: '항공 운송', tunnel: '터널 제한'
  };

  function renderScope() {
    $('scopeBody').innerHTML = SCOPE.map(function (g) {
      return g.rows.map(function (r, i) {
        return '<tr>' +
          (i === 0 ? '<td class="strong" rowspan="' + g.rows.length + '">' + esc(g.area) + '</td>' : '') +
          '<td><a href="' + r.href + '" style="color:var(--dg); font-weight:700;">' + esc(r.f) + '</a></td>' +
          '<td>' + stateBadge(r.s) + '</td>' +
          '<td>' + esc(r.now) + '</td>' +
          '<td>' + esc(r.next) + '</td>' +
          '</tr>';
      }).join('');
    }).join('');
  }

  function renderSteps(el, steps) {
    $(el).innerHTML = steps.map(function (s, i) {
      return '<div class="step">' +
        '<span class="s-no">' + (i + 1) + '</span>' +
        '<h3 style="margin:12px 0 6px; font-size:15px;">' + esc(s.t) + '</h3>' +
        '<p>' + esc(s.d) + '</p>' +
        '<span class="s-out">' + stateBadge(s.s) + '</span>' +
        '</div>';
    }).join('');
  }

  function renderTriggers() {
    var V = window.DGVerify;
    if (!V) return;
    $('triggerBody').innerHTML = V.TRIGGERS.map(function (t) {
      return '<tr><td class="strong">' + esc(t.label) + '</td><td>' + esc(t.example) + '</td><td>' + stateBadge(t.impl) + '</td></tr>';
    }).join('');
  }

  function renderLaw() {
    var V = window.DGVerify;
    var D = window.DGDATA || {};
    if (!V) return;
    var cls = { '현행 일치': 'badge-ok', '카탈로그 갱신 필요': 'badge-cond', '규칙 재검토 필요': 'badge-no', '수동 확인': 'badge-neutral' };
    var st = V.lawStatus();
    $('lawBody').innerHTML = st.map(function (s) {
      var g = s.reg;
      return '<tr>' +
        '<td class="strong">' + esc(g.name) + '</td>' +
        '<td class="mono">' + esc(g.revised) + '</td>' +
        '<td class="mono">' + esc(g.effective || '-') + '</td>' +
        '<td><span class="badge ' + (cls[s.state] || 'badge-neutral') + '"><i></i>' + esc(s.state) + '</span></td>' +
        '<td>' + esc((g.rules || []).map(function (k) { return RULE_LABEL[k] || k; }).join(' · ')) + '</td>' +
        '</tr>';
    }).join('');
    var RS = D.RULESET || {};
    var stale = st.filter(function (s) { return s.catalogStale; }).length;
    var review = st.filter(function (s) { return s.ruleReview; }).length;
    $('lawNote').textContent = '판정 규칙 세트 ' + (RS.version || '-') + ' · 법령 대조 기준일 ' + (RS.reviewedAt || '-') +
      ' · 규칙 재검토 필요 ' + review + '건 · 카탈로그 갱신 필요 ' + stale + '건';
    $('rulesetBadge').textContent = '규칙 세트 ' + (RS.version || '-');
    $('lawBadge').textContent = '법령 현행 확인 ' + (RS.reviewedAt || '-');
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderScope();
    renderSteps('docSteps', DOC_STEPS);
    renderSteps('lawSteps', LAW_STEPS);
    renderTriggers();
    renderLaw();
    /* 원격 법령 카탈로그가 들어오면 기준일 대조를 다시 그린다 */
    window.addEventListener('dg-data', renderLaw);
    if (window.DGUI && window.DGUI.initReveal) window.DGUI.initReveal();
  });
})();
