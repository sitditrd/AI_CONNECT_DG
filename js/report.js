/* =========================================================
   Connect DG — 적합성 검토 리포트 (인쇄용 · MVP 산출물)
   "MSDS → 프로파일 → 적합성 리포트" (발표자료 34장 8월 MVP 시나리오)
   케이스 전 과정의 근거 · 승인 · 이력을 한 문서로 렌더
   ========================================================= */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }
  function fmt(n) { return window.DGUI.fmt(n); }

  function kv(rows) {
    return '<div class="kv">' + rows.map(function (r) {
      return '<div>' + esc(r[0]) + '</div><div>' + (r[2] ? r[1] : esc(r[1])) + '</div>';
    }).join('') + '</div>';
  }
  function sec(no, title, inner) {
    return '<section class="rpt-sec"><h2><span class="no">' + no + '</span>' + esc(title) + '</h2>' + inner + '</section>';
  }

  function build(c) {
    var U = window.DGUI;
    var html = '';
    var p = c.msds && c.msds.profile;

    /* ---------- 헤더 ---------- */
    var verdict = c.compliance ? U.verdictBadge(c.compliance.verdict, c.compliance.label) : '<span class="badge badge-neutral"><i></i>검토 전</span>';
    html += '<div class="rpt-head">' +
      '<div><div class="rpt-brand">CONNECT DG · COMPLIANCE REPORT</div>' +
      '<h1>위험물 보관 · 운송 적합성 검토 리포트</h1>' +
      '<div style="margin-top:8px;">' + verdict + '</div></div>' +
      '<div class="rpt-meta">리포트 번호 <b class="mono">' + esc(c.caseNo || '-') + '</b><br>' +
      '생성 시각 <span class="mono">' + esc(window.DGCase.stamp()) + '</span><br>' +
      '케이스 생성 <span class="mono">' + esc(c.createdAt || '-') + '</span></div></div>';

    /* ---------- 1. 요청 개요 ---------- */
    if (c.request) {
      html += sec('1', '보관 요청 개요', kv([
        ['화주사', c.request.shipper], ['품목(송장 표기)', c.request.item],
        ['수량', c.request.qtyPL + ' PL'], ['출발지', c.request.from],
        ['희망 권역', c.request.region], ['입고 예정일', c.request.due]
      ]));
    }

    /* ---------- 2. 표준 위험물 프로파일 ---------- */
    if (p) {
      var badges = '<span class="badge badge-dg badge-un"><i></i>' + esc(p.unNo) + '</span> ' +
        '<span class="badge badge-neutral"><i></i>Class ' + esc(p.hazardClass) + (p.subRisk ? '(' + esc(p.subRisk) + ')' : '') + '</span> ' +
        '<span class="badge badge-neutral"><i></i>' + (p.packingGroup ? 'PG ' + esc(p.packingGroup) : 'PG 미지정') + '</span>' +
        (p.marinePollutant ? ' <span class="badge badge-cond"><i></i>Marine Pollutant</span>' : '') +
        (p.tunnelCode ? ' <span class="badge badge-neutral"><i></i>터널코드 ' + esc(p.tunnelCode) + '</span>' : '');
      var comp = '<div class="table-wrap" style="margin-top:10px;"><table class="dg-table"><thead><tr>' +
        '<th>성분</th><th style="width:140px;">CAS No.</th><th style="width:90px;">함유량</th></tr></thead><tbody>' +
        p.components.map(function (x) {
          return '<tr><td class="strong">' + esc(x.name) + '</td><td class="mono">' + esc(x.cas) + '</td><td class="num">' + esc(x.pct) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      html += sec('2', '표준 위험물 프로파일 (' + (c.msds.fileName || '') + ')',
        '<div style="margin-bottom:10px;">' + badges + '</div>' +
        kv([
          ['제품명', p.productName], ['Proper Shipping Name', p.psn],
          ['성상 · 포장', p.state + ' · ' + p.packing], ['보관 온도', p.storageTemp],
          ['특별주의사항', (p.specialProvisions || []).join(' · ') || '-'],
          ['국내 법령', p.korNote], ['화관법', p.chemAct],
          ['혼재 금지', p.incompatible.join(' · ')]
        ]) + comp);

      /* ---------- 3. 추출 근거 ---------- */
      if (c.msds.extraction) {
        html += sec('3', '추출 근거 — 원문 위치 · 신뢰도 (LLM-OCR, ' + esc(c.msds.analyzedAt || '') + ')',
          '<div class="table-wrap"><table class="dg-table"><thead><tr>' +
          '<th style="width:170px;">항목</th><th>추출값</th><th style="width:110px;">위치</th><th style="width:70px;">페이지</th><th style="width:80px;">신뢰도</th></tr></thead><tbody>' +
          c.msds.extraction.map(function (e) {
            var low = e.conf < 0.8;
            return '<tr><td class="strong">' + esc(e.field) + '</td><td>' + esc(e.value) + '</td>' +
              '<td>' + esc(e.section) + '</td><td class="num">p.' + e.page + '</td>' +
              '<td class="num"' + (low ? ' style="color:var(--v-cond); font-weight:700;"' : '') + '>' + Math.round(e.conf * 100) + '%' + (low ? ' ⚠' : '') + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<p class="src-note">⚠ 신뢰도 80% 미만 항목은 전문가 확인 대상으로 승계되었습니다.</p>');
      }
    }

    /* ---------- 4. 적법성 검토 ---------- */
    if (c.compliance) {
      var regRows = window.DGDATA.REGULATIONS.map(function (r) {
        return '<tr><td class="strong">' + esc(r.name) + '</td><td>' + esc(r.authority) + '</td><td class="mono">' + esc(r.revised) + '</td></tr>';
      }).join('');
      html += sec('4', '적법성 사전검토 — 4단계 방어 절차',
        kv([
          ['판정', (window.DGUI.VERDICT[c.compliance.verdict] || window.DGUI.VERDICT.REVIEW).ko + ' — ' + (c.compliance.reason || ''), false],
          ['통과 게이트', c.compliance.passed + ' / 4'],
          ['적합 후보 창고', (c.compliance.candidates != null ? c.compliance.candidates + ' 개소' : '-')],
          ['검토 시각', c.compliance.checkedAt],
          ['전문가 승인', (c.compliance.approver || '미승인') + (c.compliance.approvedAt ? ' · ' + c.compliance.approvedAt : '')],
          ['확인 의견', c.compliance.note || '-']
        ]) +
        '<div class="table-wrap" style="margin-top:10px;"><table class="dg-table"><thead><tr>' +
        '<th>적용 법령 · 기준</th><th style="width:150px;">소관</th><th style="width:130px;">개정 · 시행</th></tr></thead><tbody>' +
        regRows + '</tbody></table></div>');
    }

    /* ---------- 5. 창고 매칭 ---------- */
    if (c.warehouse) {
      var w = c.warehouse;
      var parts = w.parts || {};
      var weightRows = window.DGDATA.WEIGHTS.map(function (k) {
        return '<tr><td class="strong">' + esc(k.label) + '</td><td class="num">' + k.w + '%</td>' +
          '<td class="num">' + Math.round(parts[k.key] || 0) + '점</td></tr>';
      }).join('');
      html += sec('5', '창고 매칭 결과',
        kv([
          ['확정 창고', (c.inbound ? w.name + ' (' + w.addr + ')' : w.alias + ' <span class="muted">· 상호·주소는 계약 확정 후 공개</span>'), true],
          ['권역', w.region], ['판정', w.label + ' · 종합 ' + w.score + '점'],
          ['가용 공간', fmt(w.availPL) + ' PL'], ['보관료', fmt(w.ratePLDay) + '원 / PL·일'],
          ['매칭 시각', w.matchedAt], ['사유', w.reason]
        ]) +
        '<div class="table-wrap" style="margin-top:10px;"><table class="dg-table"><thead><tr>' +
        '<th>평가 지표</th><th style="width:90px;">가중치</th><th style="width:90px;">점수</th></tr></thead><tbody>' +
        weightRows + '</tbody></table></div>' +
        '<p class="src-note">종합 추천점수는 후보 간 우선순위 지표이며, 법적 적합성을 확률로 보증하는 수치가 아닙니다.</p>');
    }

    /* ---------- 6. 안전경로 · 배차 ---------- */
    if (c.route) {
      var rows = [
        ['확정 경로', c.route.name],
        ['거리 · 소요', c.route.distanceKm + ' km · ' + c.route.minutes + ' 분'],
        ['터널', (c.route.tunnels && c.route.tunnels.length) ? c.route.tunnels.map(function (t) { return t.name + '(카테고리 ' + (t.cat || t.code) + ')'; }).join(' · ') : '없음'],
        ['비상대응 접근', c.route.emgMin + ' 분'],
        ['경로 비고', c.route.note],
        ['검토 시각', c.route.checkedAt]
      ];
      if (c.dispatch) {
        rows.push(['운송사 · 차량', c.dispatch.carrier + ' · ' + c.dispatch.type]);
        rows.push(['배차 · 회차', c.dispatch.at + ' · ' + (c.dispatch.trips || 1) + '회차']);
      }
      html += sec('6', '안전경로 · 배차 (DG Route Intelligence)', kv(rows));
    }

    /* ---------- 7. 계약 · 입고 ---------- */
    if (c.contract && c.contract.quote) {
      var q = c.contract.quote;
      html += sec('7', '계약 · 정산 요약', kv([
        ['보관 기간', q.days + ' 일'], ['보관료', fmt(q.storage) + ' 원'],
        ['운송료', fmt(q.freight) + ' 원'], ['중개 수수료 (' + q.feeRate + '% 가설)', fmt(q.fee) + ' 원'],
        ['합계 (부가세 별도)', fmt(q.total) + ' 원'],
        ['계약 서명', c.contract.signedAt || '-'], ['보험', c.contract.insurance || '-']
      ]));
    }
    if (c.inbound) {
      html += sec('8', '입고 검수 · 전자인수증', kv([
        ['전자인수증 번호', c.inbound.receiptNo], ['입고 시각', c.inbound.at],
        ['보관 위치', c.inbound.location],
        ['검수 결과', c.inbound.checks.filter(function (x) { return x.ok; }).length + ' / ' + c.inbound.checks.length + ' 항목 충족'],
        ['미충족 항목', c.inbound.checks.filter(function (x) { return !x.ok; }).map(function (x) { return x.t; }).join(' · ') || '없음']
      ]));
    }

    /* ---------- 9. 감사 로그 ---------- */
    if (c.logs && c.logs.length) {
      html += sec(c.inbound ? '9' : '8', '감사 로그 (Audit Trail) — ' + c.logs.length + '건',
        '<div class="table-wrap"><table class="dg-table"><thead><tr>' +
        '<th style="width:40px;">#</th><th style="width:150px;">시각</th><th style="width:130px;">행위자</th><th>내용</th></tr></thead><tbody>' +
        c.logs.map(function (l, i) {
          return '<tr><td class="num">' + (i + 1) + '</td><td class="mono">' + esc(l.at) + '</td>' +
            '<td>' + esc(l.actor) + '</td><td>' + esc(l.text) + '</td></tr>';
        }).join('') + '</tbody></table></div>');
    }

    /* ---------- 면책 · 서명 ---------- */
    html += '<div class="rpt-disclaimer"><b>고지</b> — 본 리포트는 「법률 적합성 사전검토 + 전문가 검토 지원」 자료이며, ' +
      '100% 적법성 또는 완전 면책을 보증하지 않습니다. 최종 보관·운송 결정은 화주 · 창고 · 전문가 · 관계기관 확인으로 확정됩니다. ' +
      '모든 판정에는 적용 근거 · 원문 페이지 · 데이터 출처 · 조회 시각 · 승인자 · 변경 이력이 함께 저장됩니다.</div>' +
      '<div class="rpt-sign">' +
      '<div class="box"><b>작성 — Connect DG 플랫폼</b>자동 생성 · ' + esc(window.DGCase.stamp()) + '</div>' +
      '<div class="box"><b>검토 — 위험물안전관리자</b>' + esc((c.compliance && c.compliance.approver) || '(서명)') + '</div>' +
      '<div class="box"><b>승인 — 화주 대표</b>' + esc((c.request && c.request.shipper) || '(서명)') + '</div>' +
      '</div>';

    return html;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var c = window.DGCase.get();
    $('caseBadge').textContent = c.caseNo ? ('케이스 ' + c.caseNo) : '케이스 미생성';
    if (c.caseNo) $('reportBody').innerHTML = build(c);

    $('printBtn').addEventListener('click', function () { window.print(); });
    $('csvBtn').addEventListener('click', function () { window.DGExport.auditCsv(window.DGCase.get()); });
    window.DGUI.initReveal();
  });
})();
