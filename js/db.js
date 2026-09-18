/* =========================================================
   Connect DG — Supabase 데이터 액세스 (REST · publishable key)
   · 공개키(publishable)는 클라이언트 노출 전제 키이며, 실제 보호는
     RLS(Row Level Security) 정책이 담당합니다. service key는 절대 넣지 않습니다.
   · 테이블이 아직 없거나 오프라인이면 js/data_dg.js 의 시드 데이터로 동작합니다.
     (sql/schema.sql · sql/seed.sql 을 Supabase SQL Editor 에서 실행하면 원격 전환)
   ========================================================= */
(function () {
  'use strict';

  var CONFIG = {
    url: 'https://qgwmqbtkuvozszgaunlp.supabase.co',
    key: 'sb_publishable_b-KEOweYGIY9jWtRDLr2yQ_3eKxcLkc'
  };

  var state = { mode: 'seed', checkedAt: null, error: null };

  function headers(extra) {
    var h = {
      apikey: CONFIG.key,
      Authorization: 'Bearer ' + CONFIG.key,
      'Content-Type': 'application/json'
    };
    if (extra) Object.keys(extra).forEach(function (k) { h[k] = extra[k]; });
    return h;
  }

  function rest(path, opts) {
    opts = opts || {};
    return fetch(CONFIG.url + '/rest/v1/' + path, {
      method: opts.method || 'GET',
      headers: headers(opts.headers),
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      if (!res.ok) return res.text().then(function (t) { throw new Error(res.status + ' ' + t.slice(0, 140)); });
      return res.status === 204 ? null : res.json();
    });
  }

  function select(table, query) {
    return rest(table + '?' + (query || 'select=*'));
  }

  function insert(table, rows) {
    return rest(table, { method: 'POST', body: rows, headers: { Prefer: 'return=representation' } });
  }

  /* 원격 행을 시드에 id 기준으로 병합한다.
     통째로 교체하면 원격 스키마에 아직 없는 로컬 전용 필드(창고 허가 품목 CAS, 법령 현행 시행일 등)가
     조용히 사라진다. 원격 값이 있는 필드만 덮고 나머지는 시드 값을 유지한다.
     appendSeed — 원격에 없는 시드 행을 뒤에 붙일지(법령처럼 카탈로그가 늘어나는 경우) */
  function mergeById(seed, remote, appendSeed) {
    var byId = {};
    (seed || []).forEach(function (s) { byId[s.id] = s; });
    var out = remote.map(function (r) {
      var m = {};
      var base = byId[r.id] || {};
      Object.keys(base).forEach(function (k) { m[k] = base[k]; });
      Object.keys(r).forEach(function (k) { if (r[k] !== undefined && r[k] !== null) m[k] = r[k]; });
      return m;
    });
    if (appendSeed) {
      (seed || []).forEach(function (s) {
        if (!remote.some(function (r) { return r.id === s.id; })) out.push(s);
      });
    }
    return out;
  }

  /* 원격 데이터로 시드 갱신 — 실패해도 화면은 시드로 정상 동작 */
  function hydrate() {
    if (!window.DGDATA) return Promise.resolve(state);
    return Promise.all([
      select('dg_warehouses', 'select=*&order=id').catch(function () { return null; }),
      select('dg_vehicles', 'select=*&order=id').catch(function () { return null; }),
      select('dg_regulations', 'select=*&order=id').catch(function () { return null; })
    ]).then(function (r) {
      var got = false;
      var D = window.DGDATA;
      if (r[0] && r[0].length) { D.WAREHOUSES = mergeById(D.WAREHOUSES, r[0].map(normWarehouse), false); got = true; }
      if (r[1] && r[1].length) { D.VEHICLES = mergeById(D.VEHICLES, r[1].map(normVehicle), false); got = true; }
      if (r[2] && r[2].length) {
        /* 시드의 의도된 순서(국내법 → 국제기준 → 운송) 유지 — id 알파벳순 정렬 방지 */
        var seedOrder = D.REGULATIONS.map(function (x) { return x.id; });
        D.REGULATIONS = mergeById(D.REGULATIONS, r[2].map(normRegulation), true).sort(function (a, b) {
          var ia = seedOrder.indexOf(a.id), ib = seedOrder.indexOf(b.id);
          return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
        });
        got = true;
      }
      state.mode = got ? 'supabase' : 'seed';
      state.checkedAt = new Date().toISOString();
      window.dispatchEvent(new CustomEvent('dg-data', { detail: state }));
      renderStatus();
      return state;
    }).catch(function (e) {
      state.mode = 'seed'; state.error = String(e.message || e);
      renderStatus();
      return state;
    });
  }

  /* 원격 스키마(snake_case) → 화면 모델(camelCase) */
  function normWarehouse(w) {
    return {
      id: w.id, alias: w.alias, name: w.name, region: w.region, locType: w.loc_type, addr: w.addr,
      permitClasses: w.permit_classes || [], permitNote: w.permit_note,
      designatedMultiple: w.designated_multiple, capacityPL: w.capacity_pl, availPL: w.avail_pl,
      inspectionValidUntil: w.inspection_valid_until, lastAudit: w.last_audit,
      incidents3y: w.incidents_3y, safetyManagers: w.safety_managers, certs: w.certs || [],
      portKm: w.port_km, icKm: w.ic_km, ratePLDay: w.rate_pl_day,
      ops: w.ops, tempZones: w.temp_zones || [], insurance: w.insurance,
      permitItems: w.permit_items   /* 컬럼이 없으면 undefined → 병합 시 시드 값 유지 */
    };
  }
  function normRegulation(g) {
    return {
      id: g.id, name: g.name, authority: g.authority, revised: g.revised, url: g.url, note: g.note,
      effective: g.effective, checkedAt: g.checked_at, lawId: g.law_id
    };
  }
  function normVehicle(v) {
    return {
      id: v.id, carrier: v.carrier, type: v.type, classes: v.classes || [], capacityPL: v.capacity_pl,
      heightM: v.height_m, gvwT: v.gvw_t, axleT: v.axle_t, driver: v.driver, adr: v.adr,
      insurance: v.insurance, gps: v.gps, tunnelLimit: v.tunnel_limit, baseFare: v.base_fare
    };
  }

  /* 케이스 저장 (RLS 정책이 허용될 때만 성공 — 실패는 조용히 무시) */
  function saveCase(c) {
    if (!c || !c.caseNo) return Promise.resolve(null);
    return insert('dg_cases', [{
      case_no: c.caseNo,
      payload: c,
      verdict: c.compliance ? c.compliance.verdict : null,
      warehouse_id: c.warehouse ? c.warehouse.id : null
    }]).catch(function () { return null; });
  }

  /* 데이터 출처 배지 렌더 */
  function renderStatus() {
    document.querySelectorAll('[data-db-status]').forEach(function (el) {
      if (state.mode === 'supabase') {
        el.innerHTML = '<span class="badge badge-ok"><i></i>Supabase 연결</span>';
      } else {
        el.innerHTML = '<span class="badge badge-neutral"><i></i>내장 시드 데이터</span>';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderStatus();
    hydrate();
  });

  window.DGDB = {
    CONFIG: CONFIG,
    state: state,
    select: select,
    insert: insert,
    hydrate: hydrate,
    saveCase: saveCase
  };
})();
