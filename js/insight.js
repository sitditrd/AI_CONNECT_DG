/* =========================================================
   Connect DG — 위험물 물류 시장 현황 대시보드
   소방청 2025 위험물 통계자료 · 국립소방연구원 화학사고 통계
   ========================================================= */
(function () {
  'use strict';

  var S = window.DGDATA.STATS;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (m) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]; }); }
  var fmt = function (n) { return window.DGUI.fmt(n); };

  /* ---------- 스탯 ---------- */
  function renderStats() {
    var items = [
      { k: '전국 위험물 제조소등', v: S.facilities.total, d: '2024.12.31 · 소방청 국가승인통계', dg: false },
      { k: '영업용 허가 창고 (옥내저장소)', v: 8702, d: '화주가 빌릴 수 있는 보관 인프라', dg: true },
      { k: '제4류 인화성액체 비중', v: 96.8, d: '유별 허가 110,432건 중', dg: false, suffix: '%' },
      { k: '2025년 국내 화학사고', v: 282, d: '경기 53 · 울산 36건 집중', dg: true, suffix: '건' }
    ];
    $('statDeck').innerHTML = items.map(function (i) {
      return '<div class="stat"><div class="s-k">' + esc(i.k) + '</div>' +
        '<div class="s-v' + (i.dg ? ' dg' : '') + '"><span class="n">0</span>' + (i.suffix || '') + '</div>' +
        '<div class="s-d">' + esc(i.d) + '</div></div>';
    }).join('');
    var nodes = $('statDeck').querySelectorAll('.n');
    items.forEach(function (i, idx) {
      window.DGUI.countUp(nodes[idx], i.v, { dur: 1100, dec: i.v % 1 ? 1 : 0 });
    });
  }

  /* ---------- 가로 막대 ---------- */
  function bars(el, rows, opts) {
    opts = opts || {};
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }));
    el.innerHTML = rows.map(function (r) {
      var pct = Math.round(r.v / max * 100);
      var label = opts.pct ? (r.pct + '%') : fmt(r.v);
      return '<div class="meter-row" style="grid-template-columns:150px 1fr 74px;">' +
        '<span class="m-k">' + esc(r.k) + '</span>' +
        '<span class="meter"><span class="meter-fill' + (opts.safe && r.safe ? ' safe' : '') + '" style="width:' + pct + '%"></span></span>' +
        '<span class="m-v">' + label + '</span></div>';
    }).join('');
  }

  /* ---------- 사고 추이 라인 ---------- */
  function accidentChart() {
    var d = S.accidents;
    var w = 520, h = 220, pad = { l: 44, r: 16, t: 22, b: 32 };
    var max = Math.max.apply(null, d.map(function (x) { return x.v; })) * 1.15;
    var iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
    var px = function (i) { return pad.l + iw * (i / (d.length - 1)); };
    var py = function (v) { return pad.t + ih * (1 - v / max); };

    var line = d.map(function (x, i) { return (i ? 'L' : 'M') + px(i).toFixed(1) + ' ' + py(x.v).toFixed(1); }).join(' ');
    var area = line + ' L' + px(d.length - 1) + ' ' + (pad.t + ih) + ' L' + pad.l + ' ' + (pad.t + ih) + ' Z';
    var dots = d.map(function (x, i) {
      return '<circle cx="' + px(i).toFixed(1) + '" cy="' + py(x.v).toFixed(1) + '" r="4.5" fill="var(--dg)"/>' +
        '<text x="' + px(i).toFixed(1) + '" y="' + (py(x.v) - 12).toFixed(1) + '" text-anchor="middle" font-size="11" font-weight="700" fill="currentColor">' + x.v + '</text>' +
        '<text x="' + px(i).toFixed(1) + '" y="' + (h - 10) + '" text-anchor="middle" font-size="11" fill="currentColor" opacity=".65">' + x.y + '</text>';
    }).join('');
    var grid = [0, 0.5, 1].map(function (g) {
      var y = pad.t + ih * g;
      return '<line x1="' + pad.l + '" y1="' + y + '" x2="' + (w - pad.r) + '" y2="' + y + '" stroke="var(--grid)" stroke-width="1"/>' +
        '<text x="' + (pad.l - 8) + '" y="' + (y + 4) + '" text-anchor="end" font-size="10.5" fill="currentColor" opacity=".55">' + Math.round(max * (1 - g)) + '</text>';
    }).join('');

    $('chartAccident').innerHTML = '<g fill="currentColor" font-family="inherit">' + grid +
      '<path d="' + area + '" fill="var(--dg)" opacity=".13"/>' +
      '<path d="' + line + '" fill="none" stroke="var(--dg)" stroke-width="2.6" stroke-linejoin="round"/>' +
      dots + '</g>';
  }

  /* ---------- 4대 문제 ---------- */
  var PAINS = [
    { no: '01', t: '매칭 부재', d: '위험물 적재 가능 창고·차량을 찾는 공식 채널이 없어 전화·인맥에 의존. 유별·등급별 적합성 판단도 수작업.' },
    { no: '02', t: '공급 희소', d: '허가 옥내저장소는 전국 8,702개소뿐. 이차전지 수요는 연 18.5% 성장하나 신규 허가는 정체.' },
    { no: '03', t: '안전 · 규제 이중 부담', d: '위험물안전관리법(소방청) · 화학물질관리법(환경부) 이원 규제. 운송 중 사고 21%, 위반 시 형사처벌.' },
    { no: '04', t: '정보 단절', d: '창고 재고 · 차량 위치 · 통관 상태가 각 사에 흩어져 실시간 가시성 부재. 대부분 수기 · 엑셀 운영.' }
  ];

  function renderPains() {
    $('painGrid').innerHTML = PAINS.map(function (p) {
      return '<div class="card pad-sm"><span class="badge badge-dg"><i></i>' + p.no + '</span>' +
        '<h3 style="margin-top:10px;">' + esc(p.t) + '</h3><p>' + esc(p.d) + '</p></div>';
    }).join('');
  }

  function renderKvs() {
    var t = S.transport;
    $('transportKv').innerHTML =
      '<div>이동탱크저장소(로리)</div><div class="mono">' + fmt(t.tankLorry) + ' 대</div>' +
      '<div>운송자 교육 이수</div><div class="mono">' + fmt(t.driversEdu) + ' 명</div>' +
      '<div>운반자 교육 이수</div><div class="mono">' + fmt(t.carriersEdu) + ' 명</div>' +
      '<div>유해화학물질 운반업체</div><div class="mono">≈ ' + fmt(t.hazCarriers) + ' 개 (업계 추산)</div>' +
      '<div>유해화학물질 보관창고업</div><div class="mono">' + fmt(t.hazWarehouses) + ' 개소</div>' +
      '<div>공식 통계</div><div>위험물 운송사 수를 집계한 공식 자료 <b>부재</b></div>';

    var m = S.market;
    $('marketKv').innerHTML =
      '<div>협의 시장 (운송)</div><div>' + esc(m.narrowUSD) + ' · CAGR ' + esc(m.narrowCagr) + '</div>' +
      '<div>광의 시장 (2025)</div><div>' + esc(m.broadUSD) + ' · CAGR ' + esc(m.broadCagr) + '</div>' +
      '<div>인접 화학물류 (2023)</div><div>' + esc(m.chemUSD) + ' · APAC 38%</div>' +
      '<div>성장 수요처</div><div>이차전지 · 제약 부문 연 10%+ 성장</div>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    renderStats();
    bars($('chartStorage'), S.storageTypes.map(function (x) {
      return { k: x.k, v: x.v, safe: x.k.indexOf('옥내저장소') === 0 };
    }), { safe: true });
    bars($('chartRegion'), S.regions, { pct: true });
    bars($('chartClass'), S.classes, { pct: true });
    accidentChart();
    renderPains();
    renderKvs();
    window.DGUI.initReveal();
    window.addEventListener('dg-theme', accidentChart);
  });
})();
