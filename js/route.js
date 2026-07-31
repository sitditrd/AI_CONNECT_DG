/* =========================================================
   Connect DG — DG Route Intelligence (안전경로 검토)
   6개 조건 판정 → 경로 후보 비교 → 경로 확정
   ========================================================= */
(function () {
  'use strict';

  var D = window.DGDATA;
  var routes = [], selectedRoute = null, vehicleId = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]; }); }
  function veh() { return D.VEHICLES.filter(function (v) { return v.id === vehicleId; })[0] || D.VEHICLES[0]; }

  /* 차량 제원 + 위험물 등급을 반영한 조건 재판정
     (데이터의 checks 는 표준 차량 기준 — 대형 차량이면 도로 폭·터널 판정을 강화) */
  function evalRoute(r) {
    var v = veh();
    var c = window.DGCase.get();
    var cls = c.msds && c.msds.profile ? c.msds.profile.hazardClass : '9';
    var checks = JSON.parse(JSON.stringify(r.checks));

    if (v.heightM >= 4.0 || v.gvwT >= 39) {
      if (r.distanceKm > 0 && r.tunnels.length) checks.height = checks.height && r.tunnels.every(function (t) { return t.code >= 'C'; });
      checks.width = checks.width && r.name.indexOf('국도') < 0 && r.name.indexOf('지방도') < 0;
    }
    /* 산화성·부식성(5.1/8)은 제한코드 D 이하 터널 통행 불가로 강화 */
    if (cls === '5.1' || cls === '8' || cls === '3') {
      checks.tunnel = checks.tunnel && r.tunnels.every(function (t) { return t.code === 'E'; });
    }
    var fails = Object.keys(checks).filter(function (k) { return !checks[k]; });
    return { r: r, checks: checks, fails: fails, ok: fails.length === 0 };
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
      '<div>보험 · GPS</div><div>' + esc(v.insurance) + ' · ' + (v.gps ? '실시간 위치 추적 가능' : '미지원') + '</div>';
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
          '<span><span class="rm-k">터널</span><span class="rm-v">' + (r.tunnels.length ? r.tunnels.map(function (t) { return t.name + '(' + t.code + ')'; }).join(', ') : '없음') + '</span></span>' +
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
      var bad = !e.checks.tunnel;
      return '<g>' +
        '<rect x="' + (x - 13) + '" y="' + (y - 13) + '" width="26" height="26" rx="7" fill="' + (bad ? 'var(--v-no)' : 'var(--dg)') + '" opacity=".92"/>' +
        '<text x="' + x + '" y="' + (y + 5) + '" text-anchor="middle" font-size="12" font-weight="800" fill="#1b1200">' + t.code + '</text>' +
        '<text x="' + x + '" y="' + (y + 34) + '" text-anchor="middle" font-size="10.5" fill="currentColor" opacity=".8">' + t.name + '</text>' +
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
    $('confirmBtn').disabled = !e.ok;

    $('routeList').querySelectorAll('.route-card').forEach(function (el) {
      el.style.outline = el.dataset.id === selectedRoute ? '2px solid var(--dg)' : '';
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
    window.DGCase.patch({
      route: {
        id: e.r.id, name: e.r.name, distanceKm: e.r.distanceKm, minutes: e.r.minutes,
        tolls: e.r.tolls, tunnels: e.r.tunnels, emgMin: e.r.emgMin, note: e.r.note,
        vehicleId: v.id, carrier: v.carrier, vehicleType: v.type,
        checkedAt: window.DGCase.stamp()
      }
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
    window.DGUI.initReveal();
  });
})();
