/* =========================================================
   Connect DG — 랜딩 화면 스크립트
   히어로 파티클 · KPI 카운트업 · 파이프라인 미리보기 · 수익모델
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 히어로 배경: 위험물 화물 노드 네트워크 ---------- */
  function initHeroCanvas() {
    var cv = document.getElementById('heroCanvas');
    if (!cv || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var ctx = cv.getContext && cv.getContext('2d');
    if (!ctx) return;
    var nodes = [], W = 0, H = 0, raf = null;

    function resize() {
      var r = cv.parentElement.getBoundingClientRect();
      W = cv.width = r.width * devicePixelRatio;
      H = cv.height = (cv.parentElement.offsetHeight || 520) * devicePixelRatio;
      cv.style.width = r.width + 'px';
      cv.style.height = (cv.parentElement.offsetHeight || 520) + 'px';
      var count = Math.max(26, Math.min(60, Math.round(r.width / 26)));
      nodes = [];
      for (var i = 0; i < count; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.22 * devicePixelRatio,
          vy: (Math.random() - 0.5) * 0.22 * devicePixelRatio,
          r: (Math.random() * 1.6 + 0.9) * devicePixelRatio,
          dg: Math.random() < 0.28
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < nodes.length; i++) {
        var a = nodes[i];
        a.x += a.vx; a.y += a.vy;
        if (a.x < 0 || a.x > W) a.vx *= -1;
        if (a.y < 0 || a.y > H) a.vy *= -1;
        for (var j = i + 1; j < nodes.length; j++) {
          var b = nodes[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d2 = dx * dx + dy * dy;
          var lim = 128 * devicePixelRatio;
          if (d2 < lim * lim) {
            var o = (1 - Math.sqrt(d2) / lim) * 0.3;
            ctx.strokeStyle = 'rgba(158,197,244,' + o.toFixed(3) + ')';
            ctx.lineWidth = 0.6 * devicePixelRatio;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
        ctx.fillStyle = a.dg ? 'rgba(245,165,36,.85)' : 'rgba(190,215,245,.55)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener('resize', function () {
      cancelAnimationFrame(raf); resize(); draw();
    }, { passive: true });
    draw();
  }

  /* ---------- KPI ---------- */
  function initKpi() {
    var D = window.DGDATA;
    var pairs = [
      ['kpiWh', D.WAREHOUSES.length, '개소'],
      ['kpiVeh', D.VEHICLES.length, '대'],
      ['kpiReg', D.REGULATIONS.length, '종'],
      ['kpiNat', D.STATS.storageTypes.filter(function (s) { return s.k.indexOf('옥내저장소') === 0; })[0].v, '개소']
    ];
    pairs.forEach(function (p) {
      var el = document.getElementById(p[0]);
      if (!el) return;
      el.innerHTML = '<span class="n"></span><small>' + p[2] + '</small>';
      window.DGUI.countUp(el.querySelector('.n'), p[1], { dur: 1000 });
    });
  }

  /* ---------- 수익 모델 ---------- */
  function initBM() {
    var el = document.getElementById('bmGrid');
    if (!el) return;
    el.innerHTML = window.DGDATA.REVENUE.map(function (r) {
      return '<div class="card pad-sm">' +
        '<span class="badge badge-dg"><i></i>' + r.stage + '</span>' +
        '<h3 style="margin-top:10px;">' + r.t + '</h3>' +
        '<p>' + r.d + '</p>' +
        '<span class="tagline">' + r.h + '</span>' +
        '</div>';
    }).join('');
  }

  document.addEventListener('DOMContentLoaded', function () {
    initHeroCanvas();
    initKpi();
    initBM();
    window.DGPipe && window.DGPipe.render(document.getElementById('pipelinePreview'));
    window.addEventListener('dg-data', initKpi);
    window.DGUI.initReveal();
  });
})();
