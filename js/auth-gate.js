/* =========================================================
   Connect DG — 미로그인 게이트 (lock-in 티저)
   처음엔 정상 노출 → 알림(카운트다운) → 주요기능 blur + "로그인 필요" 오버레이.
   로그인(승인 계정)하면 게이트 해제 · 전 화면 열람.
   인증 백엔드 미활성 시 validate()가 false → 게이트는 예약되지만
   데모 노출 시간(GATE_DELAY_MS) 동안은 전 기능 정상 동작.
   ※ 정적 사이트 특성상 화면 게이트는 억제(UX) 수준이며 완벽 보안 아님.
   문구는 한국어 원문 — 다국어는 i18n 구문 엔진(MutationObserver)이 자동 번역.
   ========================================================= */
(function () {
  'use strict';
  var GATE_DELAY_MS = 12000; /* [조정] 처음 노출 시간(ms) — 이후 게이트 */
  var WARN_BEFORE = 3000;    /* [조정] blur 몇 ms 전에 알림 카운트다운 */
  var gateApplied = false, timers = [];
  var lastAuthed = false, lastName = null;

  function acctHost() { return document.querySelector('.site-header .header-inner'); }

  function injectAccount(authed, name) {
    lastAuthed = authed; lastName = name;
    var host = acctHost(); if (!host) return;
    var role = authed ? (DGAUTH.session() || {}).role : null;

    /* 로그인 / 로그아웃 버튼 */
    var a = document.getElementById('acctBtn');
    if (!a) { a = document.createElement('a'); a.id = 'acctBtn'; a.className = 'acct-btn'; host.appendChild(a); }
    if (authed) {
      a.textContent = '로그아웃' + (name ? ' · ' + name : '');
      a.href = 'javascript:void(0)'; a.title = '로그아웃';
      a.onclick = function () { DGAUTH.logout().then(function () { location.reload(); }); };
    } else {
      a.textContent = '로그인'; a.href = 'login.html'; a.title = '로그인'; a.onclick = null;
    }

    /* 로그인 사용자: '내 케이스' 링크(서버 케이스 보관함) */
    var cs = document.getElementById('casesBtn');
    if (authed) {
      if (!cs) { cs = document.createElement('a'); cs.id = 'casesBtn'; cs.className = 'acct-btn'; host.insertBefore(cs, a); }
      cs.textContent = '내 케이스'; cs.href = 'cases.html'; cs.title = '내 케이스';
    } else if (cs) { cs.remove(); }

    /* 관리자: '회원 승인' 링크 */
    var adm = document.getElementById('adminBtn');
    if (authed && role === 'admin') {
      if (!adm) { adm = document.createElement('a'); adm.id = 'adminBtn'; adm.className = 'acct-btn acct-btn-admin'; host.insertBefore(adm, cs || a); }
      adm.textContent = '회원 승인'; adm.href = 'admin.html'; adm.title = '회원 승인';
    } else if (adm) { adm.remove(); }
  }

  /* blur 직전 알림 토스트 (카운트다운) */
  function showToast(secondsLeft) {
    var t = document.getElementById('gateToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'gateToast'; t.className = 'gate-toast';
      document.body.appendChild(t);
    }
    t.innerHTML =
      '<span class="gt-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.6"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.4v2.4"/></svg></span>' +
      '<span class="gt-txt"><b>로그인이 필요한 서비스입니다</b>' +
      '<small><b>' + secondsLeft + '초</b> 후 주요 기능이 가려집니다 · 로그인 시 계속 이용</small></span>' +
      '<a class="gt-btn" href="login.html">로그인</a>';
  }
  function removeToast() { var t = document.getElementById('gateToast'); if (t) t.remove(); }

  function gateOverlayHTML() {
    return '<div class="auth-gate-card">' +
        '<div class="agc-lock" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="9.5" rx="2.6"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.4v2.5"/></svg></div>' +
        '<h2>로그인이 필요한 서비스입니다</h2>' +
        '<p>주요 기능은 로그인 후 이용하실 수 있습니다.<br>승인된 계정으로 로그인하거나 회원가입을 신청해 주세요.</p>' +
        '<div class="agc-cta">' +
          '<a class="btn btn-dg" href="login.html">로그인 / 회원가입</a>' +
          '<a class="btn btn-ghost" href="index.html">홈으로</a>' +
        '</div>' +
      '</div>';
  }
  function applyGate() {
    if (gateApplied || DGAUTH.isAuthed()) return;
    gateApplied = true;
    removeToast();
    document.body.classList.add('auth-gated');
    if (document.getElementById('authGate')) return;
    var ov = document.createElement('div');
    ov.id = 'authGate'; ov.className = 'auth-gate-ov';
    ov.innerHTML = gateOverlayHTML();
    document.body.appendChild(ov);
  }

  function clearTimers() { timers.forEach(function (id) { clearTimeout(id); clearInterval(id); }); timers = []; }
  function releaseGate() {
    gateApplied = false; clearTimers(); removeToast();
    document.body.classList.remove('auth-gated');
    var ov = document.getElementById('authGate'); if (ov) ov.remove();
  }

  /* 게이트 예약: (지연-알림) 시점에 카운트다운 알림 → 지연 시점에 blur */
  function scheduleGate() {
    var warnAt = Math.max(0, GATE_DELAY_MS - WARN_BEFORE);
    timers.push(setTimeout(function () {
      if (DGAUTH.isAuthed()) return;
      var n = Math.round(WARN_BEFORE / 1000);
      showToast(n);
      var cd = setInterval(function () { n--; if (n > 0) showToast(n); else clearInterval(cd); }, 1000);
      timers.push(cd);
    }, warnAt));
    timers.push(setTimeout(applyGate, GATE_DELAY_MS));
  }

  function boot() {
    if (typeof DGAUTH === 'undefined') return;
    var s = DGAUTH.session();
    injectAccount(DGAUTH.isAuthed(), s && s.name);

    var hasContent = !!document.querySelector('.dash-section'); /* 워크벤치 화면만 게이트(랜딩 제외) */
    DGAUTH.validate().then(function (authed) {
      s = DGAUTH.session();
      injectAccount(authed, s && s.name);
      if (authed) { releaseGate(); }
      else if (hasContent) { scheduleGate(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* 언어 전환 시 동적 주입 요소(계정 버튼·게이트 오버레이) 재번역 —
     i18n 엔진이 원문(한국어) 기준으로 다시 번역하도록 원문으로 재주입 */
  window.addEventListener('dg-lang', function () {
    injectAccount(lastAuthed, lastName);
    var g = document.getElementById('authGate'); if (g) g.innerHTML = gateOverlayHTML();
  });
})();
