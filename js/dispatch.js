/* =========================================================
   Connect DG — 계약 · 배차 · 입고 관리 (실행 6단계)
   견적 → 표준계약 → 보험 → 배차 → 입고예정 → 검수
   ========================================================= */
(function () {
  'use strict';

  var D = window.DGDATA;
  var STEPS = D.EXEC_STEPS;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }
  function money(n) { return window.DGUI.fmt(Math.round(n)) + '원'; }

  function progress() {
    var c = window.DGCase.get();
    return (c.contract && c.contract.step) || 0;   /* 0~6 */
  }

  /* ---------- 견적 계산 ---------- */
  function quote() {
    var c = window.DGCase.get();
    var qty = (c.request && c.request.qtyPL) || 0;
    var rate = (c.warehouse && c.warehouse.ratePLDay) || 0;
    var days = Number($('stayDays').value) || 30;
    var feeRate = Number($('feeRate').value) || 0;
    var v = D.VEHICLES.filter(function (x) { return x.id === (c.route && c.route.vehicleId); })[0] || D.VEHICLES[0];
    var trips = v.capacityPL ? Math.ceil(qty / v.capacityPL) : 1;
    var dist = (c.route && c.route.distanceKm) || 0;

    var storage = qty * rate * days;
    var freight = v.baseFare * trips + dist * 1800 * trips;
    var tolls = ((c.route && c.route.tolls) || 0) * trips * 2;
    var insurance = Math.round((storage + freight) * 0.008);
    var fee = Math.round(storage * (feeRate / 100));
    var settle = Math.round((storage + freight) * 0.006);   /* 정산 PG 0.6% 가정 */
    var total = storage + freight + tolls + insurance + fee + settle;

    return {
      qty: qty, days: days, rate: rate, trips: trips, vehicle: v,
      storage: storage, freight: freight, tolls: tolls,
      insurance: insurance, fee: fee, feeRate: feeRate, settle: settle, total: total
    };
  }

  function renderQuote() {
    var c = window.DGCase.get();
    /* 빈 상태 — 선행 단계 없이 0원 견적을 노출하지 않음 */
    if (!c.warehouse || !c.route || !c.request) {
      $('quoteTable').innerHTML = '<tbody><tr><td class="muted" style="padding:16px 12px;">' +
        '보관 요청 · 창고 · 경로가 확정되면 견적이 산출됩니다 — ' +
        '<a href="' + (!c.request ? 'process.html' : (!c.warehouse ? 'matching.html' : 'route.html')) +
        '" style="color:var(--dg); font-weight:700;">' +
        (!c.request ? '보관 요청 등록' : (!c.warehouse ? '창고 매칭' : '안전경로 검토')) + ' 하러 가기</a></td></tr></tbody>';
      return;
    }
    var q = quote();
    var rows = [
      ['보관료', q.qty + 'PL × ' + window.DGUI.fmt(q.rate) + '원 × ' + q.days + '일', q.storage],
      ['운송료', q.vehicle.carrier + ' ' + q.vehicle.type + ' · ' + q.trips + '회차', q.freight],
      ['통행료 (왕복)', q.trips + '회차 왕복', q.tolls],
      ['운송 · 보관 보험료', '적재물배상 + 창고 화재 특약 0.8%', q.insurance],
      ['플랫폼 중개 수수료', '첫 달 보관료의 ' + q.feeRate + '% (가설)', q.fee],
      ['통합 정산 수수료', '에스크로 · PG 0.6% (가설)', q.settle]
    ].map(function (r) {
      return '<tr><td class="strong">' + r[0] + '</td><td class="muted">' + esc(r[1]) + '</td><td class="num">' + money(r[2]) + '</td></tr>';
    }).join('');

    $('quoteTable').innerHTML =
      '<caption class="hide">견적 내역 — 항목 · 산출 기준 · 금액</caption>' +
      '<thead><tr><th style="width:170px;">항목</th><th>산출 기준</th><th style="width:130px;">금액</th></tr></thead>' +
      '<tbody>' + rows +
      '<tr><td class="strong">합계</td><td class="muted">부가세 별도</td>' +
      '<td class="num" style="font-size:15px; font-weight:800; color:var(--dg);">' + money(q.total) + '</td></tr></tbody>';
  }

  /* ---------- 실행 단계 ---------- */
  function renderSteps() {
    var p = progress();
    $('execSteps').innerHTML = STEPS.map(function (s, i) {
      var cls = i < p ? 'done' : (i === p ? 'cur' : '');
      return '<div class="exec-step ' + cls + '">' +
        '<div class="e-n">' + s.no + '</div>' +
        '<div class="e-t">' + esc(s.label) + '</div>' +
        '<div class="e-s">' + esc(s.desc) + '</div>' +
        '</div>';
    }).join('');

    var c = window.DGCase.get();
    $('execState').textContent = p >= 6 ? '6단계 완료 — 입고 검수 단계에서 확정하세요.'
      : (c.route ? ('다음: ' + STEPS[p].label) : '경로 확정 후 실행할 수 있습니다.');
    $('nextStepBtn').disabled = !c.route || p >= 6;
    $('undoBtn').disabled = p === 0;
    $('gpsBtn').disabled = p < 4;
    $('receiveBtn').disabled = p < 6 || !!c.inbound;
  }

  function nextStep() {
    var c = window.DGCase.get();
    if (!c.route) return;
    var p = progress();
    if (p >= 6) return;
    var s = STEPS[p];
    var q = quote();

    var contract = c.contract || {};
    contract.step = p + 1;
    contract.quote = { total: q.total, storage: q.storage, freight: q.freight, fee: q.fee, days: q.days, feeRate: q.feeRate };
    if (s.key === 'contract') contract.signedAt = window.DGCase.stamp();
    if (s.key === 'insure') contract.insurance = q.vehicle.insurance + ' · 창고 ' + ((c.warehouse && c.warehouse.insurance) || '화재 특약');

    var patch = { contract: contract };
    if (s.key === 'dispatch') {
      patch.dispatch = {
        carrier: q.vehicle.carrier, type: q.vehicle.type, vehicleId: q.vehicle.id,
        trips: q.trips, at: window.DGCase.stamp(), gps: q.vehicle.gps,
        eta: (c.route && c.route.minutes) || 0
      };
    }

    var msg = {
      quote: '견적 산출 — 합계 ' + money(q.total) + ' (보관 ' + q.days + '일 · 수수료율 ' + q.feeRate + '%)',
      contract: '표준계약 전자서명 완료 — 책임 분담 · 면책 조항 포함',
      insure: '보험 확인 — ' + q.vehicle.insurance + ' · 창고 화재보험 유효성 확인',
      dispatch: '위험물 차량 배차 — ' + q.vehicle.carrier + ' ' + q.vehicle.type + ' · ' + q.trips + '회차',
      preadv: '입고예정 전송 — 창고 안전관리자 사전 통보 (입고예정일 ' + ((c.request && c.request.due) || '-') + ')',
      receive: '입고 검수 준비 완료 — 체크리스트 · 보관위치 지정 대기'
    }[s.key];

    window.DGCase.patch(patch, msg, s.key === 'contract' ? '화주 · 창고' : '플랫폼');
    renderAll();
  }

  function undoStep() {
    var c = window.DGCase.get();
    var p = progress();
    if (p === 0) return;
    var contract = c.contract || {};
    contract.step = p - 1;
    var patch = { contract: contract };
    if (p - 1 < 4) patch.dispatch = null;
    if (p - 1 < 6) patch.inbound = null;
    window.DGCase.patch(patch, '실행 단계 되돌림 — ' + STEPS[p - 1].label + ' 취소', '운영자');
    renderAll();
  }

  /* ---------- 배차 · GPS ---------- */
  function renderDispatch() {
    var c = window.DGCase.get();
    if (!c.route) {
      $('dispatchInfo').innerHTML = '<div>안내</div><div class="muted">확정된 경로가 없습니다. <a href="route.html" style="color:var(--dg);">안전경로 검토</a>를 먼저 진행하세요.</div>';
      return;
    }
    var q = quote();
    $('dispatchInfo').innerHTML =
      '<div>운송사 · 차량</div><div>' + esc(q.vehicle.carrier) + ' · ' + esc(q.vehicle.type) + '</div>' +
      '<div>운행 경로</div><div>' + esc(c.route.name) + ' · ' + c.route.distanceKm + 'km · ' + c.route.minutes + '분</div>' +
      '<div>회차</div><div>' + q.trips + ' 회</div>' +
      '<div>목적지</div><div>' + esc(c.warehouse ? c.warehouse.alias : '-') + '</div>' +
      '<div>배차 상태</div><div>' + (c.dispatch ? ('배차 완료 · ' + esc(c.dispatch.at)) : '배차 전') + '</div>' +
      '<div>모니터링</div><div>' + (q.vehicle.gps ? '실시간 위치(GPS) 추적 · 전자인수증 발행 가능' : '미지원') + '</div>';

    $('gpsState').textContent = c.inbound ? '운행 완료' : (c.dispatch ? '배차 완료 · 추적 대기' : '배차 전');
    drawGps(c.inbound ? 1 : 0);
  }

  function drawGps(t) {
    var c = window.DGCase.get();
    var x0 = 40, x1 = 480, y = 60;
    var x = x0 + (x1 - x0) * Math.max(0, Math.min(1, t));
    var eta = c.route ? Math.round(c.route.minutes * (1 - t)) : 0;
    $('gpsTrack').innerHTML =
      '<g fill="currentColor">' +
      '<path d="M' + x0 + ' ' + y + ' L' + x1 + ' ' + y + '" stroke="var(--grid)" stroke-width="6" stroke-linecap="round" fill="none"/>' +
      '<path d="M' + x0 + ' ' + y + ' L' + x + ' ' + y + '" stroke="var(--dg)" stroke-width="6" stroke-linecap="round" fill="none"/>' +
      '<circle cx="' + x0 + '" cy="' + y + '" r="9" fill="var(--brand-accent)"/>' +
      '<circle cx="' + x1 + '" cy="' + y + '" r="9" fill="var(--v-ok)"/>' +
      '<circle cx="' + x + '" cy="' + y + '" r="7" fill="#fff" stroke="var(--dg)" stroke-width="3"/>' +
      '<text x="' + x0 + '" y="' + (y - 20) + '" text-anchor="middle" font-size="11">출발</text>' +
      '<text x="' + x1 + '" y="' + (y - 20) + '" text-anchor="middle" font-size="11">창고</text>' +
      '<text x="260" y="' + (y + 34) + '" text-anchor="middle" font-size="11.5" font-weight="700">진행률 ' +
        Math.round(t * 100) + '% · 잔여 ETA ' + eta + '분</text>' +
      '</g>';
    $('etaText').textContent = t >= 1 ? '도착 — 전자인수증 발행 대기' : '';
  }

  function playGps() {
    var t = 0;
    $('gpsBtn').disabled = true;
    var iv = setInterval(function () {
      t += 0.04;
      drawGps(Math.min(1, t));
      if (t >= 1) {
        clearInterval(iv);
        $('gpsBtn').disabled = false;
        window.DGCase.log('운행 완료 — 목적지 도착, 전자인수증 발행 대기', '차량 GPS');
        renderLogs();
      }
    }, 60);
  }

  /* ---------- 입고 검수 ---------- */
  var CHECKS = [
    { t: '포장 상태 · 표지', d: 'UN 번호 · 등급 표지 부착, 파손 · 누출 없음' },
    { t: '수량 대조', d: '입고예정 수량과 실입고 파렛트 수 일치' },
    { t: 'MSDS 대조', d: '입고 물질과 승인 프로파일(UN No. · Class · PG) 일치' },
    { t: '혼재 금지 확인', d: '지정 구역 인접 물질과 혼재 금지 조건 위반 없음' },
    { t: '지정수량 배수', d: '입고 후 누계 배수가 허가 범위 이내' },
    { t: '온도 · 환기', d: '보관 구역 온도 · 환기 · 방유제 상태 정상' }
  ];

  function renderChecks() {
    $('receiveChecks').innerHTML = CHECKS.map(function (k, i) {
      return '<label class="check-item" style="cursor:pointer;">' +
        '<input type="checkbox" class="rc" data-i="' + i + '" checked style="accent-color:var(--v-ok);">' +
        '<span><span class="ci-t">' + esc(k.t) + '</span><br><span class="ci-d">' + esc(k.d) + '</span></span>' +
        '</label>';
    }).join('');
  }

  function receive() {
    var c = window.DGCase.get();
    var boxes = Array.prototype.slice.call(document.querySelectorAll('.rc'));
    var ng = boxes.filter(function (b) { return !b.checked; });
    if (ng.length) {
      if (!confirm('미충족 검수 항목이 ' + ng.length + '건 있습니다. 이상 보고로 기록하고 입고를 확정할까요?')) return;
    }
    var loc = $('location').value.trim() || 'A동 2구역 R-04';
    var inbound = {
      at: window.DGCase.stamp(),
      location: loc,
      checks: CHECKS.map(function (k, i) { return { t: k.t, ok: boxes[i].checked }; }),
      receiptNo: 'ER-' + (c.caseNo || 'DG') + '-01'
    };
    window.DGCase.patch({ inbound: inbound },
      '입고 확정 — 보관위치 ' + loc + ' · 검수 ' + (boxes.length - ng.length) + '/' + boxes.length +
      ' 충족 · 전자인수증 ' + inbound.receiptNo + ' 발행', '창고 검수자');
    if (window.DGDB) window.DGDB.saveCase(window.DGCase.get());
    renderAll();
  }

  function renderReceipt() {
    var c = window.DGCase.get();
    if (!c.inbound) {
      $('receiptBox').innerHTML = '<p class="muted" style="font-size:13px;">입고가 확정되면 전자인수증과 입출고 기록부가 생성됩니다.</p>';
      $('docState').textContent = '미발행';
      return;
    }
    /* 단계를 건너뛴 케이스(요청 미등록 등)에도 크래시 없이 렌더 — null 가드 */
    var rq = c.request || {};
    var p = (c.msds && c.msds.profile) || {};
    var wh = c.warehouse || {};
    var dp = c.dispatch || {};
    var checks = c.inbound.checks || [];
    $('docState').textContent = '발행 완료 · ' + c.inbound.receiptNo;
    $('receiptBox').innerHTML =
      '<div class="row" style="margin-bottom:10px;"><span class="badge badge-ok"><i></i>전자인수증 발행</span>' +
      '<span class="badge badge-neutral"><i></i>' + esc(c.inbound.receiptNo) + '</span></div>' +
      '<div class="kv">' +
        '<div>케이스</div><div class="mono">' + esc(c.caseNo) + '</div>' +
        '<div>화주</div><div>' + esc(rq.shipper || '미기재') + '</div>' +
        '<div>품목 · UN</div><div>' + esc(p.productName || '-') + ' · ' + esc(p.unNo || '-') + ' Class ' + esc(p.hazardClass || '-') +
          ' · ' + (p.packingGroup ? 'PG ' + esc(p.packingGroup) : 'PG 미지정') + '</div>' +
        '<div>수량</div><div>' + (rq.qtyPL != null ? rq.qtyPL : '-') + ' PL</div>' +
        '<div>보관 창고</div><div>' + esc(wh.name || '-') + (wh.addr ? ' (' + esc(wh.addr) + ')' : '') + '</div>' +
        '<div>보관 위치</div><div>' + esc(c.inbound.location) + '</div>' +
        '<div>운송사 · 차량</div><div>' + esc(dp.carrier || '-') + ' · ' + esc(dp.type || '-') + '</div>' +
        '<div>입고 시각</div><div class="mono">' + esc(c.inbound.at) + '</div>' +
        '<div>검수 결과</div><div>' + checks.filter(function (x) { return x.ok; }).length + ' / ' + checks.length + ' 항목 충족</div>' +
        '<div>적법성 근거</div><div>' + esc(c.compliance ? (c.compliance.label + ' · 승인 ' + (c.compliance.approver || '미승인')) : '-') + '</div>' +
      '</div>' +
      '<p class="src-note">※ 계약 확정 이후이므로 창고 실제 상호·주소가 공개됩니다(단계별 정보 공개 원칙).</p>' +
      '<div class="row" style="margin-top:12px;"><a class="btn btn-dg btn-sm" href="report.html">적합성 리포트 · 인쇄</a></div>';
  }

  function renderDocs() {
    var c = window.DGCase.get();
    var on = !!c.inbound;
    $('docList').innerHTML = D.AUTO_DOCS.map(function (d) {
      return '<div class="doc-item" style="' + (on ? '' : 'opacity:.6;') + '">' +
        '<span class="d-ico">' + (on ? '✓' : '•') + '</span>' +
        '<span><span class="d-t">' + esc(d.t) + '</span><br><span class="d-d">' + esc(d.d) + '</span></span>' +
        '</div>';
    }).join('');
  }

  function renderLogs() {
    var c = window.DGCase.get();
    var el = $('auditLog');
    if (!c.logs || !c.logs.length) { el.innerHTML = '<p class="muted" style="font-size:13px;">기록된 이력이 없습니다.</p>'; return; }
    el.innerHTML = c.logs.slice().reverse().map(function (l) {
      return '<div class="tl-item ok"><div class="t-t">' + esc(l.text) + '</div>' +
        '<div class="t-m">' + esc(l.at) + ' · ' + esc(l.actor) + '</div></div>';
    }).join('');
  }

  function renderAll() {
    var c = window.DGCase.get();
    $('caseBadge').textContent = c.caseNo ? ('케이스 ' + c.caseNo) : '케이스 미생성';
    $('whBadge').textContent = c.warehouse ? c.warehouse.alias : '창고 미확정';
    renderQuote(); renderSteps(); renderDispatch(); renderReceipt(); renderDocs(); renderLogs();
    window.DGUI.initReveal();
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderChecks();
    var c = window.DGCase.get();
    if (c.contract && c.contract.quote) {
      $('stayDays').value = c.contract.quote.days || 30;
      $('feeRate').value = c.contract.quote.feeRate != null ? c.contract.quote.feeRate : 10;
    }
    if (c.inbound) $('location').value = c.inbound.location;

    $('nextStepBtn').addEventListener('click', nextStep);
    $('undoBtn').addEventListener('click', undoStep);
    $('gpsBtn').addEventListener('click', playGps);
    $('receiveBtn').addEventListener('click', receive);
    ['stayDays', 'feeRate'].forEach(function (id) { $(id).addEventListener('input', renderQuote); });

    renderAll();
    /* Supabase 하이드레이션 완료 시 차량 단가 등 원격 데이터로 재렌더 */
    window.addEventListener('dg-data', renderAll);
  });
})();
