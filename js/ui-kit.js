/* =========================================================
   Connect DG — UI 키트 (토스트 · 오프라인 감지 · 폼 검증 헬퍼)
   ========================================================= */
(function () {
  'use strict';

  /* ---------- 토스트 ---------- */
  function stack() {
    var s = document.querySelector('.dg-toast-stack');
    if (!s) { s = document.createElement('div'); s.className = 'dg-toast-stack'; document.body.appendChild(s); }
    return s;
  }
  function toast(text, kind, ms) {
    var t = document.createElement('div');
    t.className = 'dg-toast' + (kind ? ' ' + kind : '');
    t.setAttribute('role', 'status');
    t.textContent = text;
    stack().appendChild(t);
    setTimeout(function () {
      t.style.transition = 'opacity .3s ease';
      t.style.opacity = '0';
      setTimeout(function () { t.remove(); }, 320);
    }, ms || 3200);
    return t;
  }

  /* ---------- 오프라인 감지 ---------- */
  function offlineBar(show) {
    var b = document.getElementById('dgOfflineBar');
    if (show) {
      if (!b) {
        b = document.createElement('div');
        b.id = 'dgOfflineBar'; b.className = 'dg-offline-bar';
        b.textContent = '오프라인 상태입니다 — 케이스는 브라우저에 저장되며 연결 복구 시 동기화됩니다.';
        document.body.appendChild(b);
      }
    } else if (b) { b.remove(); }
  }
  window.addEventListener('offline', function () { offlineBar(true); });
  window.addEventListener('online', function () {
    offlineBar(false);
    toast('연결이 복구되었습니다.', 'ok');
    if (window.DGSync) DGSync.push();   /* 복구 시 케이스 재동기화 */
  });

  /* ---------- 폼 검증 헬퍼 ----------
     rules: [{ el, test(value)→bool, msg }] — 첫 실패 항목에 포커스 + 토스트 */
  function validate(rules) {
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      var v = r.el && ('value' in r.el) ? String(r.el.value || '').trim() : '';
      if (!r.test(v)) {
        toast(r.msg, 'err');
        if (r.el && r.el.focus) { r.el.focus(); if (r.el.select) try { r.el.select(); } catch (e) { /* */ } }
        return false;
      }
    }
    return true;
  }

  window.DGKit = { toast: toast, validate: validate };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { if (!navigator.onLine) offlineBar(true); });
  } else if (!navigator.onLine) offlineBar(true);
})();
