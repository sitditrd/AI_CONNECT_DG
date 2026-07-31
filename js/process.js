/* =========================================================
   Connect DG — 프로세스 워크벤치
   보관 요청 등록 · 9단계 파이프라인 · 케이스 요약 · 감사 로그
   ========================================================= */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]; }); }

  /* ---------- 기본 입고 예정일: 오늘 + 7일 ---------- */
  function defaultDue() {
    var d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  }

  /* ---------- 요청 등록 ---------- */
  function submitRequest() {
    var req = {
      shipper: $('rqShipper').value.trim() || '미기재',
      item: $('rqItem').value.trim() || '미기재',
      qtyPL: Number($('rqQty').value) || 0,
      from: $('rqFrom').value.trim() || '미기재',
      region: $('rqRegion').value,
      due: $('rqDue').value || defaultDue()
    };
    window.DGCase.patch({ request: req },
      '보관 요청 등록 — ' + req.shipper + ' · ' + req.item + ' · ' + req.qtyPL + 'PL · 입고예정 ' + req.due,
      '화주');
    renderAll();
  }

  /* ---------- 케이스 요약 ---------- */
  function summaryCards(c) {
    var U = window.DGUI;
    var cards = [];

    cards.push(card('보관 요청', c.request
      ? [['화주사', c.request.shipper], ['품목', c.request.item],
         ['수량', c.request.qtyPL + ' PL'], ['출발지', c.request.from],
         ['희망 권역', c.request.region], ['입고 예정일', c.request.due]]
      : null, 'process.html#request', '요청 등록'));

    cards.push(card('위험물 프로파일', c.msds && c.msds.profile
      ? [['제품명', c.msds.profile.productName], ['UN No.', c.msds.profile.unNo],
         ['등급', 'Class ' + c.msds.profile.hazardClass + (c.msds.profile.subRisk ? '(' + c.msds.profile.subRisk + ')' : '')],
         ['포장등급', 'PG ' + c.msds.profile.packingGroup],
         ['해양오염물질', c.msds.profile.marinePollutant ? 'Yes' : 'No'],
         ['원본', c.msds.fileName]]
      : null, 'msds.html', 'MSDS 등록'));

    cards.push(card('적법성 검토', c.compliance
      ? [['판정', U.VERDICT[c.compliance.verdict].ko],
         ['통과 게이트', c.compliance.passed + ' / 4'],
         ['검토 시각', c.compliance.checkedAt],
         ['승인자', c.compliance.approver || '미승인']]
      : null, 'compliance.html', '검토 실행'));

    cards.push(card('확정 창고', c.warehouse
      ? [['창고', c.warehouse.alias], ['권역', c.warehouse.region],
         ['종합 점수', c.warehouse.score + '점'], ['판정', U.VERDICT[c.warehouse.verdict].ko],
         ['보관료', window.DGUI.fmt(c.warehouse.ratePLDay) + '원/PL·일']]
      : null, 'matching.html', '매칭 실행'));

    cards.push(card('확정 경로', c.route
      ? [['경로', c.route.name], ['거리', c.route.distanceKm + ' km'],
         ['예상 소요', c.route.minutes + ' 분'],
         ['터널', (c.route.tunnels && c.route.tunnels.length) ? c.route.tunnels.map(function (t) { return t.name + '(' + t.code + ')'; }).join(', ') : '없음'],
         ['비상대응 접근', c.route.emgMin + ' 분']]
      : null, 'route.html', '경로 검토'));

    cards.push(card('운송 · 입고', c.dispatch
      ? [['운송사', c.dispatch.carrier], ['차량', c.dispatch.type],
         ['배차 시각', c.dispatch.at],
         ['입고 상태', c.inbound ? '입고 완료 · ' + c.inbound.at : '입고 대기']]
      : null, 'dispatch.html', '계약 · 배차'));

    return cards.join('');
  }

  function card(title, rows, href, cta) {
    if (!rows) {
      return '<div class="card"><h3>' + title + '</h3>' +
             '<p class="muted">아직 진행되지 않은 단계입니다.</p>' +
             '<a class="tagline" href="' + href + '">↳ ' + cta + '</a></div>';
    }
    var kv = rows.map(function (r) {
      return '<div>' + esc(r[0]) + '</div><div>' + esc(r[1]) + '</div>';
    }).join('');
    return '<div class="card"><h3>' + title + '</h3><div class="kv">' + kv + '</div>' +
           '<a class="tagline" href="' + href + '">↳ 화면 열기</a></div>';
  }

  /* ---------- 감사 로그 ---------- */
  function renderLogs(c) {
    var el = $('auditLog');
    if (!el) return;
    if (!c.logs || !c.logs.length) {
      el.innerHTML = '<p class="muted" style="font-size:13px;">기록된 이력이 없습니다. 보관 요청을 등록하면 이력이 쌓이기 시작합니다.</p>';
      return;
    }
    el.innerHTML = c.logs.slice().reverse().map(function (l) {
      return '<div class="tl-item ok">' +
        '<div class="t-t">' + esc(l.text) + '</div>' +
        '<div class="t-m">' + esc(l.at) + ' · ' + esc(l.actor) + '</div>' +
        '</div>';
    }).join('');
  }

  /* ---------- 전체 렌더 ---------- */
  function renderAll() {
    var c = window.DGCase.get();

    var badge = $('caseBadge');
    if (badge) badge.textContent = c.caseNo ? ('케이스 ' + c.caseNo) : '케이스 미생성';

    var st = $('rqState');
    if (st) {
      st.innerHTML = c.request
        ? '등록 완료 — <b>' + esc(c.request.shipper) + '</b> · ' + esc(c.request.item) + ' · ' +
          c.request.qtyPL + 'PL · 입고예정 ' + esc(c.request.due) + ' (케이스 ' + esc(c.caseNo) + ')'
        : '아직 등록된 요청이 없습니다.';
    }

    if (c.request) {
      $('rqShipper').value = c.request.shipper;
      $('rqItem').value = c.request.item;
      $('rqQty').value = c.request.qtyPL;
      $('rqFrom').value = c.request.from;
      $('rqRegion').value = c.request.region;
      $('rqDue').value = c.request.due;
    }

    window.DGPipe.render($('pipeline'));
    var sum = $('caseSummary');
    if (sum) sum.innerHTML = summaryCards(c);
    renderLogs(c);
    window.DGUI.initReveal();
  }

  document.addEventListener('DOMContentLoaded', function () {
    if ($('rqDue') && !$('rqDue').value) $('rqDue').value = defaultDue();
    $('rqSubmit').addEventListener('click', submitRequest);
    $('caseReset').addEventListener('click', function () {
      if (confirm('현재 케이스와 감사 로그를 모두 초기화합니다. 계속할까요?')) {
        window.DGCase.reset();
        renderAll();
      }
    });
    renderAll();
    window.addEventListener('dg-case', renderAll);
  });
})();
