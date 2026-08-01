/* =========================================================
   Connect DG — 공통 스크립트
   로고 · 테마 · 헤더 · 리빌 · 카운트업 · 툴팁 · 케이스 스토어
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 로고 ---------- */
  var LOGO_HTML =
    '<img class="logo-sym" src="assets/twl_symbol.png" alt="">' +
    '<span class="logo-text">' +
    '<span class="l1"><b>CONNECT</b> DG</span>' +
    '<span class="l2">TAEWOONG LOGISTICS</span>' +
    '</span>';

  function injectLogos() {
    document.querySelectorAll('.logo-slot').forEach(function (el) { el.innerHTML = LOGO_HTML; });
  }

  /* ---------- 테마 (기본 다크) ---------- */
  var ICON_SUN =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7"/></svg>';
  var ICON_MOON =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z"/></svg>';

  function applyTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.setAttribute('aria-label', t === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환');
      btn.innerHTML = t === 'dark' ? ICON_SUN : ICON_MOON;
    });
    window.dispatchEvent(new CustomEvent('dg-theme', { detail: t }));
  }
  function initTheme() {
    var saved = null;
    try { saved = localStorage.getItem('dg-theme'); } catch (e) { /* 무시 */ }
    applyTheme(saved || 'dark');
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem('dg-theme', next); } catch (e) { /* 무시 */ }
        applyTheme(next);
      });
    });
  }

  /* ---------- 헤더 ---------- */
  function initHeader() {
    var header = document.querySelector('.site-header');
    if (!header) return;
    var onScroll = function () { header.classList.toggle('scrolled', window.scrollY > 12); };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    var burger = document.querySelector('.nav-burger');
    var nav = document.querySelector('.site-nav');
    if (burger && nav) {
      var setOpen = function (open) {
        nav.classList.toggle('open', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        burger.setAttribute('aria-label', open ? '메뉴 닫기' : '메뉴 열기');
      };
      burger.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
      nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { setOpen(false); });
      });
      /* Escape 로 닫고 버거로 포커스 복귀, 바깥 클릭 시 닫기 */
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); burger.focus(); }
      });
      document.addEventListener('click', function (e) {
        if (nav.classList.contains('open') && !nav.contains(e.target) && !burger.contains(e.target)) setOpen(false);
      });
    }
  }

  /* ---------- 가로 스크롤 표 — 키보드 스크롤 접근 ---------- */
  function initTableWraps() {
    document.querySelectorAll('.table-wrap').forEach(function (el) {
      if (el.hasAttribute('tabindex')) return;
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'region');
      if (!el.getAttribute('aria-label')) {
        var head = el.closest('.panel') && el.closest('.panel').querySelector('.panel-head h3');
        el.setAttribute('aria-label', (head ? head.textContent + ' ' : '') + '표 — 좌우 스크롤 가능');
      }
    });
  }

  /* ---------- 스크롤 리빌 ---------- */
  function initReveal() {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var items = document.querySelectorAll('.reveal:not(.in)');
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.01 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 숫자 ---------- */
  function fmt(n, dec) {
    return Number(n).toLocaleString('ko-KR', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  }
  function countUp(el, to, opts) {
    opts = opts || {};
    var dur = opts.dur || 900;
    var dec = opts.dec != null ? opts.dec : (to % 1 !== 0 ? 1 : 0);
    var suffix = opts.suffix || '';
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = fmt(to, dec) + suffix; return;
    }
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      el.textContent = fmt(to * (1 - Math.pow(1 - p, 3)), dec) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- 툴팁 ---------- */
  var tipEl = null;
  function ensureTip() {
    if (!tipEl) {
      tipEl = document.createElement('div');
      tipEl.className = 'tw-tooltip';
      tipEl.setAttribute('role', 'tooltip');
      document.body.appendChild(tipEl);
    }
    return tipEl;
  }
  function bindTooltips(root) {
    (root || document).querySelectorAll('[data-tip]').forEach(function (el) {
      if (el.dataset.tipBound) return;
      el.dataset.tipBound = '1';
      var show = function () {
        var t = ensureTip();
        t.textContent = el.getAttribute('data-tip');   /* HTML 주입 차단 — 텍스트 전용 */
        t.classList.add('show');
      };
      var hide = function () { if (tipEl) tipEl.classList.remove('show'); };
      el.addEventListener('mouseenter', show);
      el.addEventListener('mousemove', function (e) {
        var t = ensureTip();
        var x = e.clientX + 14, y = e.clientY + 16, r = t.getBoundingClientRect();
        if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 12;
        if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 12;
        t.style.left = x + 'px'; t.style.top = y + 'px';
      });
      el.addEventListener('mouseleave', hide);
      /* 키보드 접근 — 포커스 시에도 표시 */
      el.addEventListener('focusin', function () {
        show();
        var t = ensureTip(); var r = el.getBoundingClientRect();
        t.style.left = r.left + 'px'; t.style.top = (r.bottom + 8) + 'px';
      });
      el.addEventListener('focusout', hide);
    });
  }

  /* ---------- 판정 배지 (색+텍스트 병기: 접근성) ---------- */
  var VERDICT = {
    OK:     { cls: 'badge-ok',     ko: '적합' },
    COND:   { cls: 'badge-cond',   ko: '조건부 검토' },
    REVIEW: { cls: 'badge-review', ko: '전문가 확인 필요' },
    NO:     { cls: 'badge-no',     ko: '보관 불가' }
  };
  function verdictBadge(code, label) {
    var v = VERDICT[code] || VERDICT.REVIEW;
    return '<span class="badge ' + v.cls + '"><i></i>' + (label || v.ko) + '</span>';
  }

  /* =========================================================
     케이스 스토어 — 9단계 프로세스의 상태를 화면 간 공유
     (요청 → MSDS → 추출 → 법규검토 → 창고매칭 → 경로검토
      → 견적·계약 → 배차 → 입고관리)
     ========================================================= */
  var KEY = 'dg-case';
  var AKEY = 'dg-archive';
  var EMPTY = {
    caseNo: null,
    createdAt: null,
    request: null,     // { shipper, qty, unit, from, to, dueDate }
    msds: null,        // 표준 위험물 프로파일
    compliance: null,  // { verdict, gates[], checkedAt }
    warehouse: null,   // 확정 창고
    route: null,       // 확정 경로
    contract: null,    // 견적·계약
    dispatch: null,    // 배차
    inbound: null,     // 입고
    logs: []           // 감사 로그
  };

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return JSON.parse(JSON.stringify(EMPTY));
      var o = JSON.parse(raw);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return JSON.parse(JSON.stringify(EMPTY));
      Object.keys(EMPTY).forEach(function (k) { if (!(k in o)) o[k] = EMPTY[k]; });
      /* 파손 데이터 타입 정규화 — logs 는 반드시 배열, 객체 키는 객체 또는 null */
      if (!Array.isArray(o.logs)) o.logs = [];
      ['request', 'msds', 'compliance', 'warehouse', 'route', 'contract', 'dispatch', 'inbound']
        .forEach(function (k) { if (o[k] != null && typeof o[k] !== 'object') o[k] = null; });
      return o;
    } catch (e) { return JSON.parse(JSON.stringify(EMPTY)); }
  }
  function save(c) {
    try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { /* 무시 */ }
    window.dispatchEvent(new CustomEvent('dg-case', { detail: c }));
    return c;
  }
  function nowStamp() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) +
           ' ' + p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
  }
  function newCaseNo() {
    var d = new Date();
    function p(n) { return String(n).padStart(2, '0'); }
    return 'DG-' + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' +
           String(Math.floor(Math.random() * 9000) + 1000);
  }

  var DGCase = {
    get: function () { return load(); },
    patch: function (obj, logText, actor) {
      var c = load();
      if (!c.caseNo) { c.caseNo = newCaseNo(); c.createdAt = nowStamp(); }
      Object.keys(obj).forEach(function (k) { c[k] = obj[k]; });
      if (logText) {
        c.logs = c.logs || [];
        c.logs.push({ at: nowStamp(), actor: actor || '시스템', text: logText });
      }
      return save(c);
    },
    log: function (text, actor) { return DGCase.patch({}, text, actor); },
    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) { /* 무시 */ }
      window.dispatchEvent(new CustomEvent('dg-case', { detail: load() }));
      return load();
    },
    /* ---------- 케이스 보관함 (완료 케이스 이력) ---------- */
    archives: function () {
      try { return JSON.parse(localStorage.getItem(AKEY) || '[]'); } catch (e) { return []; }
    },
    /* 현재 케이스를 보관함에 넣고 새 케이스로 초기화 */
    archive: function () {
      var c = load();
      if (!c.caseNo) return null;
      var list = DGCase.archives().filter(function (x) { return x.caseNo !== c.caseNo; });
      c.archivedAt = nowStamp();
      list.unshift(c);
      if (list.length > 20) list = list.slice(0, 20);   /* 최근 20건 유지 */
      try { localStorage.setItem(AKEY, JSON.stringify(list)); } catch (e) { /* 무시 */ }
      return DGCase.reset();
    },
    /* 보관 케이스를 현재 케이스로 복원 (현재 케이스는 덮어씀) */
    restore: function (caseNo) {
      var hit = DGCase.archives().filter(function (x) { return x.caseNo === caseNo; })[0];
      if (!hit) return null;
      var c = JSON.parse(JSON.stringify(hit));
      delete c.archivedAt;
      return save(c);
    },
    removeArchive: function (caseNo) {
      var list = DGCase.archives().filter(function (x) { return x.caseNo !== caseNo; });
      try { localStorage.setItem(AKEY, JSON.stringify(list)); } catch (e) { /* 무시 */ }
      window.dispatchEvent(new CustomEvent('dg-case', { detail: load() }));
    },

    /* 9단계 진행 상태 — done / active / todo */
    steps: function (c) {
      c = c || load();
      var done = [
        !!c.request,
        !!(c.msds && c.msds.fileName),
        !!(c.msds && c.msds.profile),
        !!c.compliance,
        !!c.warehouse,
        !!c.route,
        !!c.contract,
        !!c.dispatch,
        !!c.inbound
      ];
      var firstTodo = done.indexOf(false);
      return done.map(function (d, i) {
        return d ? 'done' : (i === firstTodo ? 'active' : 'todo');
      });
    },
    stamp: nowStamp
  };

  /* ---------- 초기화 ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    injectLogos();
    initTheme();
    initHeader();
    initReveal();
    initTableWraps();
    bindTooltips(document);
    var y = document.querySelector('.footer-year');
    if (y) y.textContent = new Date().getFullYear();
  });

  window.DGUI = {
    fmt: fmt,
    countUp: countUp,
    bindTooltips: bindTooltips,
    initReveal: initReveal,
    verdictBadge: verdictBadge,
    VERDICT: VERDICT
  };
  window.DGCase = DGCase;
})();
