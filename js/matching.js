/* =========================================================
   Connect DG — 창고 · 차량 매칭
   가중치 조정 → 후보 점수화 → 창고 확정
   ========================================================= */
(function () {
  'use strict';

  var D = window.DGDATA;
  var weights = D.WEIGHTS.map(function (w) { return { key: w.key, label: w.label, w: w.w, safety: w.safety, tip: w.tip }; });
  var ranked = [], selectedId = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }

  function ctx() {
    var c = window.DGCase.get();
    return {
      profile: c.msds && c.msds.profile,
      qtyPL: Number($('mQty').value) || 1,
      region: $('mRegion').value,
      tempNeed: $('mTemp').value || null,
      caseObj: c
    };
  }

  /* ---------- 가중치 UI ----------
     슬라이더 input 마다 DOM 을 재생성하면 드래그·키보드 조작이 끊기므로
     ① 최초/리셋 시에만 renderWeights() 로 재생성
     ② input 시에는 % 텍스트만 갱신(updateWeightLabels) + 재랭킹은 rAF 디바운스 */
  var runScheduled = false;
  function scheduleRun() {
    if (runScheduled) return;
    runScheduled = true;
    requestAnimationFrame(function () { runScheduled = false; run(); });
  }

  function updateWeightLabels() {
    var total = Math.max(1, weights.reduce(function (a, b) { return a + b.w; }, 0));
    var safety = weights.filter(function (w) { return w.safety; }).reduce(function (a, b) { return a + b.w; }, 0);
    $('safetyShare').textContent = '안전 · 법적 적합성 ' + Math.round(safety / total * 100) + '%';
    $('weightRows').querySelectorAll('.meter-row').forEach(function (row, i) {
      var v = row.querySelector('.m-v');
      if (v && weights[i]) v.textContent = Math.round(weights[i].w / total * 100) + '%';
    });
  }

  function renderWeights() {
    var total = Math.max(1, weights.reduce(function (a, b) { return a + b.w; }, 0));
    $('weightRows').innerHTML = weights.map(function (w, i) {
      var pct = Math.round(w.w / total * 100);
      return '<div class="meter-row">' +
        '<span class="m-k" data-tip="' + esc(w.tip) + '">' + esc(w.label) + '</span>' +
        '<span><input type="range" min="0" max="50" value="' + w.w + '" data-i="' + i + '" aria-label="' + esc(w.label) + ' 가중치"></span>' +
        '<span class="m-v">' + pct + '%</span>' +
        '</div>';
    }).join('');

    $('weightRows').querySelectorAll('input[type=range]').forEach(function (r) {
      r.addEventListener('input', function () {
        weights[Number(r.dataset.i)].w = Number(r.value);
        updateWeightLabels();      /* DOM 재생성 없음 — 슬라이더 유지 */
        scheduleRun();
      });
    });
    updateWeightLabels();
    window.DGUI.bindTooltips($('weightRows'));
  }

  /* ---------- 후보 렌더 ---------- */
  function barColor(v) {
    return v === 'OK' ? 'var(--v-ok)' : v === 'COND' ? 'var(--v-cond)' : v === 'REVIEW' ? 'var(--v-review)' : 'var(--v-no)';
  }

  function renderList() {
    var only = $('mOnly').value;
    var list = only === 'fit' ? ranked.filter(function (r) { return r.verdict === 'OK' || r.verdict === 'COND'; }) : ranked;
    if (!list.length) {
      $('whList').innerHTML = '<div class="card"><p class="muted">조건에 맞는 후보가 없습니다. MSDS 프로파일 또는 조건을 확인하세요.</p></div>';
      return;
    }
    $('whList').innerHTML = list.map(function (r) {
      var w = r.wh;
      var on = selectedId === w.id;
      return '<div class="cand' + (on ? ' sel' : '') + '" data-id="' + w.id + '" tabindex="0" role="button" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<div>' +
          '<div class="c-t">' + esc(w.alias) + ' ' + window.DGUI.verdictBadge(r.verdict, r.label) +
            (on ? ' <span class="badge badge-dg"><i></i>선택됨</span>' : '') + '</div>' +
          '<div class="c-d">' + esc(r.reason) + '</div>' +
          '<div class="c-meta">' +
            '<span>권역 <b>' + esc(w.region) + '</b></span>' +
            '<span>입지 <b>' + esc(w.locType) + '</b></span>' +
            '<span>가용 <b>' + window.DGUI.fmt(w.availPL) + ' PL</b></span>' +
            '<span>보관료 <b>' + window.DGUI.fmt(w.ratePLDay) + '원</b>/PL·일</span>' +
            '<span>검사 유효 <b>' + esc(w.inspectionValidUntil) + '</b></span>' +
          '</div>' +
          '<div class="score-line" style="margin-top:10px;">' +
            '<span class="sl-bar"><span class="sl-fill" style="width:' + r.score + '%; background:' + barColor(r.verdict) + '"></span></span>' +
          '</div>' +
        '</div>' +
        '<div class="c-score">' +
          '<div class="sc" style="color:' + barColor(r.verdict) + '">' + r.score + '</div>' +
          '<div class="sc-l">종합 점수</div>' +
        '</div>' +
        '</div>';
    }).join('');

    $('whList').querySelectorAll('.cand').forEach(function (el) {
      el.addEventListener('click', function () { select(el.dataset.id); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(el.dataset.id); } });
    });
  }

  /* ---------- 창고 상세 ---------- */
  function renderDetail() {
    var r = ranked.filter(function (x) { return x.wh.id === selectedId; })[0];
    if (!r) {
      $('whDetail').innerHTML = '<p class="muted" style="font-size:13px;">후보를 선택하면 지표별 점수와 인허가 정보가 표시됩니다.</p>';
      $('detailName').textContent = '-';
      $('confirmBtn').disabled = true;
      return;
    }
    var w = r.wh;
    var total = weights.reduce(function (a, b) { return a + b.w; }, 0);
    var rows = weights.map(function (k) {
      var v = r.parts[k.key] || 0;
      return '<div class="meter-row">' +
        '<span class="m-k">' + esc(k.label) + ' <span class="muted">(' + Math.round(k.w / total * 100) + '%)</span></span>' +
        '<span class="meter"><span class="meter-fill' + (k.safety ? ' safe' : '') + '" style="width:' + v + '%"></span></span>' +
        '<span class="m-v">' + Math.round(v) + '</span>' +
        '</div>';
    }).join('');

    $('detailName').textContent = w.alias;
    $('whDetail').innerHTML =
      '<div class="row" style="margin-bottom:12px;">' + window.DGUI.verdictBadge(r.verdict, r.label) +
        '<span class="badge badge-neutral"><i></i>종합 ' + r.score + '점</span></div>' +
      rows +
      '<div class="kv" style="margin-top:14px;">' +
        '<div>허가 유별 · 등급</div><div>' + esc(w.permitClasses.join(' · ')) + '</div>' +
        '<div>허가 비고</div><div>' + esc(w.permitNote) + '</div>' +
        '<div>지정수량 배수</div><div class="mono">' + window.DGUI.fmt(w.designatedMultiple) + ' 배</div>' +
        '<div>보관 능력</div><div class="mono">' + window.DGUI.fmt(w.capacityPL) + ' PL (가용 ' + window.DGUI.fmt(w.availPL) + ' PL)</div>' +
        '<div>온도 구역</div><div>' + esc(w.tempZones.join(' · ')) + '</div>' +
        '<div>정기검사 유효</div><div class="mono">' + esc(w.inspectionValidUntil) + ' (D' + (window.DGMatch.daysUntil(w.inspectionValidUntil) >= 0 ? '-' : '+') + Math.abs(window.DGMatch.daysUntil(w.inspectionValidUntil)) + ')</div>' +
        '<div>최근 3년 사고</div><div>' + w.incidents3y + ' 건 · 안전관리자 ' + w.safetyManagers + '명</div>' +
        '<div>소방 · 안전 설비</div><div>' + esc(w.certs.join(' · ')) + '</div>' +
        '<div>접근성</div><div>항만 ' + w.portKm + 'km · IC ' + w.icKm + 'km · ' + esc(w.ops) + '</div>' +
        '<div>보험</div><div>' + esc(w.insurance) + '</div>' +
      '</div>';

    $('confirmBtn').disabled = (r.verdict === 'NO');
  }

  /* ---------- 차량 ---------- */
  function renderVehicles() {
    var cx = ctx();
    if (!cx.profile) { $('vehList').innerHTML = '<p class="muted" style="font-size:13px;">MSDS 프로파일이 필요합니다.</p>'; return; }
    var list = window.DGMatch.rankVehicles(D.VEHICLES, cx);
    $('vehList').innerHTML = list.map(function (x) {
      var v = x.v;
      return '<div class="check-item' + (x.ok ? '' : ' ng') + '" style="align-items:flex-start; margin-bottom:8px;">' +
        '<span class="ck">' + (x.ok ? '✓' : '✕') + '</span>' +
        '<span>' +
          '<span class="ci-t">' + esc(v.carrier) + ' · ' + esc(v.type) + '</span><br>' +
          '<span class="ci-d">' + esc(x.note) + ' · 높이 ' + v.heightM + 'm · 총중량 ' + v.gvwT + 't · ' + esc(v.tunnelLimit) + '</span><br>' +
          '<span class="ci-d">' + esc(v.driver) + ' · ' + esc(v.adr) + ' · ' + esc(v.insurance) + ' · 기본운임 ' + window.DGUI.fmt(v.baseFare) + '원</span>' +
        '</span>' +
        '</div>';
    }).join('');
  }

  /* ---------- 권역별 네트워크 요약 ---------- */
  function renderRegionSummary() {
    var el = $('regionSummary');
    if (!el) return;
    var byRegion = {};
    D.WAREHOUSES.forEach(function (w) {
      var r = byRegion[w.region] || (byRegion[w.region] = { n: 0, avail: 0, port: 0 });
      r.n++; r.avail += w.availPL || 0;
      if (w.locType === '항만 배후') r.port++;
    });
    el.innerHTML = Object.keys(byRegion).map(function (k) {
      var r = byRegion[k];
      return '<div class="card pad-sm"><h3 style="font-size:14px;">' + esc(k) + '</h3>' +
        '<p style="font-size:12.5px;">창고 <b>' + r.n + '</b>개소 · 가용 <b>' + window.DGUI.fmt(r.avail) + '</b> PL' +
        (r.port ? ' · 항만배후 ' + r.port : '') + '</p></div>';
    }).join('');
  }

  /* ---------- CSV 내보내기 ---------- */
  function exportCsv() {
    if (!ranked.length) { alert('내보낼 후보가 없습니다.'); return; }
    var head = ['순위', '창고', '판정', '종합점수'];
    weights.forEach(function (k) { head.push(k.label); });
    head.push('권역', '입지', '가용PL', '보관료(원/PL·일)', '검사유효');
    var rows = [head];
    ranked.forEach(function (r, i) {
      var row = [i + 1, r.wh.alias, r.label, r.score];
      weights.forEach(function (k) { row.push(Math.round(r.parts[k.key] || 0)); });
      row.push(r.wh.region, r.wh.locType, r.wh.availPL, r.wh.ratePLDay, r.wh.inspectionValidUntil);
      rows.push(row);
    });
    var c = window.DGCase.get();
    window.DGExport.csv('ConnectDG_창고후보_' + (c.caseNo || 'case') + '.csv', rows);
  }

  /* ---------- 실행 ---------- */
  function run() {
    var cx = ctx();
    if (!cx.profile) {
      $('whList').innerHTML = '<div class="card"><p class="muted">MSDS 프로파일이 없습니다 — <a href="msds.html" style="color:var(--dg); font-weight:700;">MSDS 분석</a>을 먼저 완료하세요.</p></div>';
      return;
    }
    ranked = window.DGMatch.rank(D.WAREHOUSES, cx, weights);
    if (!selectedId) {
      var first = ranked.filter(function (r) { return r.verdict === 'OK' || r.verdict === 'COND'; })[0];
      selectedId = first ? first.wh.id : null;
    }
    renderList(); renderDetail(); renderVehicles();
  }

  /* 선택 변경 — 목록을 재생성하지 않고 클래스만 토글해 키보드 포커스 유지 */
  function select(id) {
    selectedId = id;
    $('whList').querySelectorAll('.cand').forEach(function (el) {
      var on = el.dataset.id === id;
      el.classList.toggle('sel', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
      var t = el.querySelector('.c-t');
      if (t) {
        var old = t.querySelector('.badge-dg');
        if (old && !on) old.remove();
        if (on && !old) t.insertAdjacentHTML('beforeend', ' <span class="badge badge-dg"><i></i>선택됨</span>');
      }
    });
    renderDetail();
  }

  function confirmWarehouse() {
    var r = ranked.filter(function (x) { return x.wh.id === selectedId; })[0];
    if (!r) return;
    var c = window.DGCase.get();
    if (!c.compliance || !c.compliance.approver) {
      if (!confirm('적법성 검토의 전문가 승인이 아직 없습니다. 그래도 창고를 확정할까요?\n(운영 기준으로는 승인 이후 진행이 원칙입니다)')) return;
    }
    window.DGCase.patch({
      warehouse: {
        id: r.wh.id, alias: r.wh.alias, name: r.wh.name, region: r.wh.region,
        addr: r.wh.addr, ratePLDay: r.wh.ratePLDay, availPL: r.wh.availPL,
        score: r.score, verdict: r.verdict, label: r.label, reason: r.reason,
        parts: r.parts, matchedAt: window.DGCase.stamp()
      },
      route: null, contract: null, dispatch: null, inbound: null
    }, '창고 확정 — ' + r.wh.alias + ' (종합 ' + r.score + '점 · ' + r.label + ')', '매칭 엔진');
    location.href = 'route.html';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var c = window.DGCase.get();
    $('caseBadge').textContent = c.caseNo ? ('케이스 ' + c.caseNo) : '케이스 미생성';
    $('targetBadge').textContent = c.msds ? (c.msds.profile.unNo + ' · ' + c.msds.title) : '대상 없음';

    $('mQty').value = (c.request && c.request.qtyPL) || 180;
    $('mRegion').value = (c.request && c.request.region) || '무관';
    if (c.warehouse) selectedId = c.warehouse.id;

    renderWeights();
    renderRegionSummary();
    run();

    ['mQty', 'mRegion', 'mTemp', 'mOnly'].forEach(function (id) {
      $(id).addEventListener('change', function () { run(); });
    });
    $('wReset').addEventListener('click', function () {
      weights = D.WEIGHTS.map(function (w) { return { key: w.key, label: w.label, w: w.w, safety: w.safety, tip: w.tip }; });
      renderWeights(); run();
    });
    $('confirmBtn').addEventListener('click', confirmWarehouse);
    var csvBtn = $('csvBtn');
    if (csvBtn) csvBtn.addEventListener('click', exportCsv);
    /* Supabase 하이드레이션 완료 시 원격 창고 데이터로 재랭킹 */
    window.addEventListener('dg-data', function () { renderRegionSummary(); run(); });
    window.DGUI.initReveal();
  });
})();
