/* =========================================================
   Connect DG — DG Route Intelligence (안전경로 검토)
   6개 조건 판정 → 경로 후보 비교 → 경로 확정
   ========================================================= */
(function () {
  'use strict';

  var D = window.DGDATA;
  var routes = [], selectedRoute = null, vehicleId = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }
  function veh() { return D.VEHICLES.filter(function (v) { return v.id === vehicleId; })[0] || D.VEHICLES[0]; }

  /* 차량 제원 + 화물 터널 제한코드(ADR 준용)를 반영한 6조건 판정
     · 높이/중량 : 경로 물리 제한(clearanceM · limitT)과 차량 제원 직접 비교
     · 터널     : 화물 제한코드 X → X 이상 카테고리(cat) 터널 통행 금지
                  (예: 코드 E 화물은 E 카테고리만 금지 — A~D 통행 가능)
     · 도로 폭  : 협소 구간(narrow)은 대형 차량(총중량 20t 이상)만 위반 */
  function evalRoute(r) {
    var v = veh();
    var c = window.DGCase.get();
    var cargoCode = (c.msds && c.msds.profile && c.msds.profile.tunnelCode) || null;

    var checks = {
      height: v.heightM <= (r.clearanceM || 4.5) && v.gvwT <= (r.limitT || 40),
      dgban: !!r.checks.dgban,
      tunnel: !cargoCode || (r.tunnels || []).every(function (t) { return t.cat < cargoCode; }),
      width: !r.narrow || v.gvwT < 20,
      eta: !!r.checks.eta,
      emg: !!r.checks.emg
    };
    var fails = Object.keys(checks).filter(function (k) { return !checks[k]; });
    return { r: r, checks: checks, fails: fails, ok: fails.length === 0, cargoCode: cargoCode };
  }

  /* ---------- 조건 카드 ---------- */
  function renderConds() {
    $('condList').innerHTML = D.ROUTE_CONDITIONS.map(function (c) {
      return '<div class="check-item" data-tip="' + esc(c.tip) + '">' +
        '<span class="ck">✓</span>' +
        '<span><span class="ci-t">' + esc(c.label) + '</span><br><span class="ci-d">' + esc(c.tip) + '</span></span>' +
        '</div>';
    }).join('');
    window.DGUI.bindTooltips($('condList'));
  }

  /* ---------- 차량 ---------- */
  function renderVehChips() {
    var c = window.DGCase.get();
    var cx = { profile: c.msds && c.msds.profile, qtyPL: (c.request && c.request.qtyPL) || 1 };
    var list = cx.profile ? window.DGMatch.rankVehicles(D.VEHICLES, cx) : D.VEHICLES.map(function (v) { return { v: v, ok: true, note: '' }; });

    $('vehChips').innerHTML = list.map(function (x) {
      return '<button class="f-chip' + (x.v.id === vehicleId ? ' on' : '') + '" data-id="' + x.v.id + '"' +
        (x.ok ? '' : ' title="등급 미충족"') + '>' + (x.ok ? '' : '⚠ ') + esc(x.v.carrier) + ' · ' + esc(x.v.type) + '</button>';
    }).join('');
    $('vehChips').querySelectorAll('.f-chip').forEach(function (b) {
      b.addEventListener('click', function () { vehicleId = b.dataset.id; renderVehChips(); renderSpec(); run(); });
    });
  }

  function renderSpec() {
    var v = veh();
    $('vehSpec').innerHTML =
      '<div>차량</div><div>' + esc(v.carrier) + ' · ' + esc(v.type) + '</div>' +
      '<div>제원</div><div class="mono">높이 ' + v.heightM + 'm · 총중량 ' + v.gvwT + 't · 축중 ' + v.axleT + 't</div>' +
      '<div>적재</div><div>' + (v.capacityPL ? v.capacityPL + ' PL' : '탱크 20kL') + '</div>' +
      '<div>운전자</div><div>' + esc(v.driver) + ' · ' + esc(v.adr) + '</div>' +
      '<div>터널 제한</div><div>' + esc(v.tunnelLimit) + '</div>' +
      '<div>보험 · GPS</div><div>' + esc(v.insurance) + ' · ' + (v.gps ? '실시간 위치 추적 가능' : '미지원') + '</div>' +
      (window.DGVerify ? '<div>도로법 운행제한</div><div>' + esc(window.DGVerify.roadLaw(v).note) + '</div>' : '');
  }

  /* 경로 판정과 별개로 확인해야 하는 국내 운송 기준 — 도로법 운행제한 · 위험물 운송기준(별표21) */
  function advisories(e) {
    if (!window.DGVerify) return { html: '', warn: false, dr: null, rl: null };
    var c = window.DGCase.get();
    var p = c.msds && c.msds.profile;
    var dr = window.DGVerify.driverRule(e.r, veh(), p);
    var rl = window.DGVerify.roadLaw(veh());
    var warn = dr.twoDrivers || !rl.ok;
    return {
      dr: dr, rl: rl, warn: warn,
      html: '<div class="notice' + (warn ? ' warn' : '') + '" style="margin-top:12px;">' +
        '<b>운송 기준 (위험물안전관리법 시행규칙 별표21)</b><br><span>' + esc(dr.text) + '</span><br>' +
        '<b>도로법 운행제한 (시행령 제79조)</b><br><span>' + esc(rl.note) + '</span></div>'
    };
  }

  /* ---------- 경로 목록 ---------- */
  function condLabel(k) {
    var m = { height: '차량 높이·중량', dgban: '위험물 통행제한', tunnel: '터널 제한코드', width: '도로 폭·회전반경', eta: '도착시간', emg: '비상대응 접근성' };
    return m[k] || k;
  }

  function renderRoutes() {
    var evaluated = routes.map(evalRoute);
    var best = evaluated.filter(function (e) { return e.ok; }).sort(function (a, b) { return a.r.minutes - b.r.minutes; })[0];

    $('routeList').innerHTML = evaluated.map(function (e) {
      var r = e.r;
      var cls = !e.ok ? 'blocked' : (best && best.r.id === r.id ? 'best' : '');
      var badge = e.ok
        ? (best && best.r.id === r.id ? '<span class="badge badge-ok"><i></i>권장 경로</span>' : '<span class="badge badge-cond"><i></i>통행 가능</span>')
        : '<span class="badge badge-no"><i></i>통행 불가</span>';
      var fails = e.fails.length ? '<div class="c-d" style="color:var(--v-no); margin-top:8px;">위반 — ' +
        e.fails.map(condLabel).join(' · ') + '</div>' : '';
      return '<div class="route-card ' + cls + '" data-id="' + r.id + '" tabindex="0" role="button">' +
        '<div class="route-head"><span class="r-t">' + esc(r.name) + '</span>' + badge + '</div>' +
        '<div class="route-metrics">' +
          '<span><span class="rm-k">거리</span><span class="rm-v">' + r.distanceKm + ' km</span></span>' +
          '<span><span class="rm-k">소요</span><span class="rm-v">' + r.minutes + ' 분</span></span>' +
          '<span><span class="rm-k">통행료</span><span class="rm-v">' + window.DGUI.fmt(r.tolls) + ' 원</span></span>' +
          '<span><span class="rm-k">터널 (카테고리)</span><span class="rm-v">' + (r.tunnels.length ? r.tunnels.map(function (t) { return t.name + '(' + (t.cat || t.code) + ')'; }).join(', ') : '없음') + '</span></span>' +
          '<span><span class="rm-k">통과 높이·중량</span><span class="rm-v">' + (r.clearanceM || 4.5) + 'm · ' + (r.limitT || 40) + 't</span></span>' +
          '<span><span class="rm-k">비상대응</span><span class="rm-v">' + r.emgMin + ' 분</span></span>' +
        '</div>' +
        '<div class="c-d" style="margin-top:8px;">' + esc(r.note) + '</div>' + fails +
        '</div>';
    }).join('');

    $('routeList').querySelectorAll('.route-card').forEach(function (el) {
      el.addEventListener('click', function () { select(el.dataset.id); });
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(el.dataset.id); } });
    });

    if (!selectedRoute) selectedRoute = (best || evaluated[0]) ? (best || evaluated[0]).r.id : null;
    renderDetail();
  }

  /* ---------- 경로 개요도 ---------- */
  function renderMap(e) {
    var r = e.r;
    var c = window.DGCase.get();
    var from = (c.request && c.request.from) || '출발지';
    var to = (c.warehouse && c.warehouse.alias) || '확정 창고';
    var n = Math.max(2, r.tunnels.length + 2);
    var x0 = 60, x1 = 460, y = 96;
    var pts = [];
    for (var i = 0; i < n; i++) pts.push(x0 + (x1 - x0) * (i / (n - 1)));

    var line = '<path d="M' + x0 + ' ' + y + ' L' + x1 + ' ' + y + '" stroke="' + (e.ok ? 'var(--v-ok)' : 'var(--v-no)') +
      '" stroke-width="5" stroke-linecap="round" fill="none" opacity=".85"' + (e.ok ? '' : ' stroke-dasharray="10 7"') + '/>';

    var marks = r.tunnels.map(function (t, i) {
      var x = pts[i + 1];
      var cat = t.cat || t.code;
      /* 이 터널이 화물 제한코드에 걸리는지 개별 판정 */
      var bad = !!(e.cargoCode && cat >= e.cargoCode);
      return '<g>' +
        '<rect x="' + (x - 13) + '" y="' + (y - 13) + '" width="26" height="26" rx="7" fill="' + (bad ? 'var(--v-no)' : 'var(--dg)') + '" opacity=".92"/>' +
        '<text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#1b1200">' + cat + '</text>' +
        '<text x="' + x + '" y="' + (y + 34) + '" text-anchor="middle" font-size="10.5" fill="currentColor" opacity=".8">' + t.name + (bad ? ' · 통행 금지' : '') + '</text>' +
        '</g>';
    }).join('');

    $('routeMap').innerHTML =
      '<g fill="currentColor" font-family="inherit">' +
      line + marks +
      '<circle cx="' + x0 + '" cy="' + y + '" r="11" fill="var(--brand-accent)"/>' +
      '<circle cx="' + x1 + '" cy="' + y + '" r="11" fill="var(--dg)"/>' +
      '<text x="' + x0 + '" y="' + (y - 24) + '" text-anchor="middle" font-size="11.5" font-weight="700">' + esc(from.slice(0, 14)) + '</text>' +
      '<text x="' + x1 + '" y="' + (y - 24) + '" text-anchor="middle" font-size="11.5" font-weight="700">' + esc(to.slice(0, 16)) + '</text>' +
      '<text x="260" y="' + (y - 40) + '" text-anchor="middle" font-size="12" font-weight="800" fill="' + (e.ok ? 'var(--v-ok)' : 'var(--v-no)') + '">' +
        r.distanceKm + 'km · ' + r.minutes + '분 · ' + (e.ok ? '통행 가능' : '통행 불가') + '</text>' +
      '<text x="260" y="176" text-anchor="middle" font-size="10.5" opacity=".7">비상대응 접근 ' + r.emgMin + '분 · 통행료 ' + window.DGUI.fmt(r.tolls) + '원</text>' +
      '</g>';
  }

  function renderDetail() {
    var e = routes.map(evalRoute).filter(function (x) { return x.r.id === selectedRoute; })[0];
    if (!e) { $('confirmBtn').disabled = true; return; }
    $('routeName').textContent = e.r.name;
    renderMap(e);
    $('routeChecks').innerHTML = '<div class="check-list">' + Object.keys(e.checks).map(function (k) {
      return '<div class="check-item' + (e.checks[k] ? '' : ' ng') + '">' +
        '<span class="ck">' + (e.checks[k] ? '✓' : '✕') + '</span>' +
        '<span><span class="ci-t">' + condLabel(k) + '</span><br><span class="ci-d">' + (e.checks[k] ? '조건 충족' : '조건 위반 — 이 경로로 배차 불가') + '</span></span>' +
        '</div>';
    }).join('') + '</div>';
    $('routeChecks').innerHTML += advisories(e).html;
    $('confirmBtn').disabled = !e.ok;

    /* 선택 상태 — 색상 단독 전달 방지: .sel 클래스 + aria-pressed */
    $('routeList').querySelectorAll('.route-card').forEach(function (el) {
      var on = el.dataset.id === selectedRoute;
      el.classList.toggle('sel', on);
      el.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function select(id) { selectedRoute = id; renderDetail(); }

  function run() {
    var c = window.DGCase.get();
    if (!c.warehouse) {
      $('routeList').innerHTML = '<div class="card"><p class="muted">확정된 창고가 없습니다 — <a href="matching.html" style="color:var(--dg); font-weight:700;">창고 매칭</a>을 먼저 완료하세요.</p></div>';
      return;
    }
    routes = D.routesFor(c.warehouse.id);
    renderRoutes();
  }

  function confirmRoute() {
    var e = routes.map(evalRoute).filter(function (x) { return x.r.id === selectedRoute; })[0];
    if (!e || !e.ok) return;
    var v = veh();
    var adv = advisories(e);
    window.DGCase.patch({
      route: {
        id: e.r.id, name: e.r.name, distanceKm: e.r.distanceKm, minutes: e.r.minutes,
        tolls: e.r.tolls, tunnels: e.r.tunnels, emgMin: e.r.emgMin, note: e.r.note,
        vehicleId: v.id, carrier: v.carrier, vehicleType: v.type,
        /* 배차 단계에서 운전자 수 · 운행허가를 챙기도록 판정 결과를 함께 넘긴다 */
        driverRule: adv.dr ? adv.dr.text : null, twoDrivers: adv.dr ? !!adv.dr.twoDrivers : false,
        roadLaw: adv.rl ? adv.rl.note : null,
        checkedAt: window.DGCase.stamp()
      },
      /* 경로·차량 재확정 시 하류(계약·배차·입고) 무효화 — 다른 확정 함수들과 동일 패턴 */
      contract: null, dispatch: null, inbound: null
    }, '안전경로 확정 — ' + e.r.name + ' (' + e.r.distanceKm + 'km · ' + e.r.minutes + '분) · 차량 ' + v.carrier + ' ' + v.type,
       'DG Route Intelligence');
    location.href = 'dispatch.html';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var c = window.DGCase.get();
    $('caseBadge').textContent = c.caseNo ? ('케이스 ' + c.caseNo) : '케이스 미생성';
    $('whBadge').textContent = c.warehouse ? c.warehouse.alias : '창고 미확정';
    vehicleId = (c.route && c.route.vehicleId) || D.VEHICLES[0].id;
    if (c.route) selectedRoute = c.route.id;

    renderConds();
    renderVehChips();
    renderSpec();
    run();
    $('confirmBtn').addEventListener('click', confirmRoute);
    /* Supabase 하이드레이션 완료 시 원격 차량 데이터로 재렌더 */
    window.addEventListener('dg-data', function () { renderVehChips(); renderSpec(); run(); });
    window.DGUI.initReveal();
  });
})();
