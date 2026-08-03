/* =========================================================
   Connect DG — 다국어(i18n) 한/영/중 · 사이트 전역 엔진
   AI_SCM(TWL Control Tower) i18n 아키텍처 계승:
   · 구문(phrase) 사전 기반 텍스트 노드 자동 번역 — 페이지별 태깅 불필요
   · 숫자는 '#' 플레이스홀더 템플릿으로 정규화해 동적 수치도 매칭
   · MutationObserver 로 JS 동적 렌더(후보 카드·감사 로그 등)도 실시간 번역
   · placeholder · aria-label · title · data-tip · alt 속성 번역
   · alert/confirm 팝업 문구 번역 · ko 복귀 시 원문 복원
   · 언어 스위처(한/EN/中)를 헤더에 자동 주입 · localStorage 'dg-lang'
   사전은 build 시 주입 — window.DGI18N_DICT (js/i18n-dict.js)
   ========================================================= */
(function () {
  'use strict';
  var LANGS = ['ko', 'en', 'zh'];
  var TRANSLATE_ATTRS = ['placeholder', 'aria-label', 'title', 'data-tip', 'alt'];

  function dicts() { return window.DGI18N_DICT || { en: {}, zh: {} }; }

  /* ---------- 템플릿 정규화 ----------
     공백 압축 + 숫자(콤마·소수점 포함)를 '#'로 치환 —
     "요청 180PL 수용 가능 6개소" 와 "요청 20PL 수용 가능 3개소" 가 같은 키로 매칭 */
  function normTemplate(s) {
    return s.trim().replace(/\s+/g, ' ').replace(/\d[\d,\.]*/g, '#');
  }
  function extractNums(s) { return s.match(/\d[\d,\.]*/g) || []; }
  function fill(tpl, nums) {
    var i = 0;
    return tpl.replace(/#/g, function () { return i < nums.length ? nums[i++] : '#'; });
  }

  function translateValue(v, lang) {
    if (lang === 'ko' || v == null) return v;
    var src = String(v);
    if (!/[가-힣]/.test(src)) return src;
    var dict = dicts()[lang];
    if (!dict) return src;
    var lead = (src.match(/^\s*/) || [''])[0];
    var tail = (src.match(/\s*$/) || [''])[0];
    var hit = dict[normTemplate(src)];
    if (hit != null) return lead + fill(hit, extractNums(src)) + tail;
    return src;   /* 미등재 문구는 원문 유지 */
  }

  /* ---------- DOM 번역 ---------- */
  function skipTextNode(n) {
    var p = n && n.parentElement;
    return !p || /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA|CODE|PRE)$/i.test(p.tagName);
  }

  var translating = false;
  var observer = null;

  /* ---------- 네비 전용 짧은 라벨 ----------
     영문 풀 번역("Warehouse·vehicle matching" 등)은 헤더 폭을 넘치므로
     상단 네비에만 href 기준 축약 라벨 사용(본문·푸터는 풀 번역 유지).
     translateNode 내부에서 적용해 MutationObserver 재번역과 충돌하지 않음. */
  var NAV_SHORT = {
    en: {
      'process.html': 'Process', 'msds.html': 'MSDS', 'compliance.html': 'Compliance',
      'matching.html': 'Matching', 'route.html': 'Safe route', 'dispatch.html': 'Dispatch',
      'insight.html': 'Market', 'report.html': 'Report', 'index.html': 'Home'
    },
    zh: {
      'process.html': '流程', 'msds.html': 'MSDS 分析', 'compliance.html': '合规审查',
      'matching.html': '仓库·车辆匹配', 'route.html': '安全路线', 'dispatch.html': '派车·入库',
      'insight.html': '市场现状', 'report.html': '报告', 'index.html': '首页'
    }
  };
  function navShortFor(n, lang) {
    var map = NAV_SHORT[lang];
    if (!map) return null;
    var p = n.parentElement;
    if (!p || p.tagName !== 'A' || !p.closest || !p.closest('.site-nav')) return null;
    return map[p.getAttribute('href')] || null;
  }

  /* 영어 번역 시 인라인 요소(<b> 등) 경계 공백 보정 —
     한국어는 조사("…MSDS 한 장</b>에서")가 붙어 원문에 공백이 없지만
     영어에서는 요소 앞뒤에 공백이 필요("A single MSDS covers…"). */
  function fixEnSpacing(n, text) {
    var prev = n.previousSibling, next = n.nextSibling;
    if (prev && prev.nodeType === 1 && /^[A-Za-z0-9(·—-]/.test(text)) text = ' ' + text;
    if (next && next.nodeType === 1 && /[A-Za-z0-9,.)·—-]$/.test(text)) text = text + ' ';
    return text;
  }

  function translateNode(root, lang) {
    if (lang === 'ko' || !root || translating) return;
    translating = true;
    try {
      var start = root.nodeType === 9 ? root.documentElement : root;
      if (!start) return;
      var handle = function (n) {
        if (skipTextNode(n)) return;
        if (/[가-힣]/.test(n.nodeValue)) n.__dgOrig = n.nodeValue;
        else if (n.__dgLast && n.nodeValue !== n.__dgLast) return;   /* 앱이 새 값을 씀 */
        if (n.__dgOrig == null) return;
        var next = navShortFor(n, lang);   /* 상단 네비는 축약 라벨 우선 */
        if (next == null) {
          next = translateValue(n.__dgOrig, lang);
          if (lang === 'en' && next !== n.__dgOrig) next = fixEnSpacing(n, next);
        }
        n.__dgLast = next;
        if (n.nodeValue !== next) n.nodeValue = next;
      };
      if (start.nodeType === 3) handle(start);
      else {
        var walker = document.createTreeWalker(start, NodeFilter.SHOW_TEXT, null);
        var n;
        while ((n = walker.nextNode())) handle(n);
        translateAttrs(start, lang);
      }
    } finally { translating = false; }
  }

  function translateAttrs(root, lang) {
    function visit(el) {
      if (!el || !el.getAttribute) return;
      TRANSLATE_ATTRS.forEach(function (a) {
        if (!el.hasAttribute(a)) return;
        var cur = el.getAttribute(a);
        if (cur == null) return;
        if (!el.__dgOrigA) el.__dgOrigA = {};
        if (!el.__dgLastA) el.__dgLastA = {};
        if (/[가-힣]/.test(cur)) el.__dgOrigA[a] = cur;
        else if (el.__dgLastA[a] && cur !== el.__dgLastA[a]) return;
        if (el.__dgOrigA[a] == null) return;
        var next = translateValue(el.__dgOrigA[a], lang);
        el.__dgLastA[a] = next;
        if (cur !== next) el.setAttribute(a, next);
      });
    }
    if (root.nodeType === 1) visit(root);
    if (root.querySelectorAll) root.querySelectorAll('*').forEach(visit);
  }

  function restoreOriginals() {
    if (translating) return;
    translating = true;
    try {
      var walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT, null);
      var n;
      while ((n = walker.nextNode())) {
        if (n.__dgOrig != null && (!n.__dgLast || n.nodeValue === n.__dgLast)) n.nodeValue = n.__dgOrig;
      }
      document.querySelectorAll('*').forEach(function (el) {
        if (!el.__dgOrigA) return;
        Object.keys(el.__dgOrigA).forEach(function (a) {
          if (el.hasAttribute(a) && (!el.__dgLastA || !el.__dgLastA[a] || el.getAttribute(a) === el.__dgLastA[a])) {
            el.setAttribute(a, el.__dgOrigA[a]);
          }
        });
      });
    } finally { translating = false; }
  }

  function installObserver() {
    if (observer || typeof MutationObserver === 'undefined') return;
    observer = new MutationObserver(function (items) {
      if (translating || getLang() === 'ko') return;
      items.forEach(function (m) {
        if (m.type === 'childList') m.addedNodes.forEach(function (n) { translateNode(n, getLang()); });
        else translateNode(m.target, getLang());
      });
    });
    observer.observe(document.documentElement, {
      childList: true, subtree: true, characterData: true,
      attributes: true, attributeFilter: TRANSLATE_ATTRS
    });
  }

  /* ---------- alert / confirm 번역 ---------- */
  function installPopupTranslator() {
    ['alert', 'confirm', 'prompt'].forEach(function (name) {
      var fn = window[name];
      if (!fn || fn.__dgWrapped) return;
      var wrapped = function (msg, def) {
        var text = translateValue(msg, getLang());
        return name === 'prompt' ? fn.call(window, text, def) : fn.call(window, text);
      };
      wrapped.__dgWrapped = true;
      window[name] = wrapped;
    });
  }

  /* ---------- 언어 상태 ---------- */
  function getLang() {
    try { var l = localStorage.getItem('dg-lang'); return LANGS.indexOf(l) >= 0 ? l : 'ko'; }
    catch (e) { return 'ko'; }
  }
  function saveLang(l) { try { localStorage.setItem('dg-lang', l); } catch (e) { /* 무시 */ } }

  function t(text) { return translateValue(text, getLang()); }

  var origTitle = null;
  function apply(l) {
    if (LANGS.indexOf(l) < 0) l = 'ko';
    document.documentElement.setAttribute('lang', l === 'zh' ? 'zh-CN' : l);
    if (origTitle == null) origTitle = document.title;
    document.title = l === 'ko' ? origTitle : translateValue(origTitle, l);
    if (l === 'ko') restoreOriginals();
    else translateNode(document, l);
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-lang') === l);
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === l ? 'true' : 'false');
    });
    window.dispatchEvent(new CustomEvent('dg-lang', { detail: l }));
  }

  function setLang(l) { saveLang(l); apply(l); }

  /* ---------- 스위처 주입 (한 · EN · 中) ---------- */
  function injectSwitch() {
    if (document.querySelector('.lang-switch')) return;
    var host = document.querySelector('.site-header .header-actions');
    if (!host) return;
    var box = document.createElement('div');
    box.className = 'lang-switch';
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', '언어 선택 / Language');
    box.innerHTML =
      '<button class="lang-btn" data-lang="ko" title="한국어" type="button">한</button>' +
      '<button class="lang-btn" data-lang="en" title="English" type="button">EN</button>' +
      '<button class="lang-btn" data-lang="zh" title="中文" type="button">中</button>';
    host.insertBefore(box, host.firstChild);
  }
  function bindSwitch() {
    document.querySelectorAll('.lang-btn').forEach(function (b) {
      if (b.__dgBound) return;
      b.__dgBound = true;
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang')); });
    });
  }

  window.DGI18N = { LANGS: LANGS, getLang: getLang, setLang: setLang, t: t, apply: apply };

  function boot() {
    installPopupTranslator();
    injectSwitch();
    bindSwitch();
    apply(getLang());
    installObserver();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
