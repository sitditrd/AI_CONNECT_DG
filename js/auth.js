/* =========================================================
   Connect DG — 인증 클라이언트 (커스텀 auth, Supabase RPC + Edge Function)
   - 비밀번호는 서버(Supabase)에서 bcrypt 해시로만 검증 (평문 저장/전송 없음, HTTPS)
   - 가입은 이메일 인증코드(OTP) 확인 후 pending → 관리자 승인 시 로그인 가능
   - 백엔드 미활성(sql/auth_setup.sql 미실행) 시 모든 호출은 오류 객체로 안전 폴백
   ========================================================= */
(function () {
  'use strict';
  var SB_URL = 'https://qgwmqbtkuvozszgaunlp.supabase.co';
  var SB_KEY = 'sb_publishable_b-KEOweYGIY9jWtRDLr2yQ_3eKxcLkc'; /* publishable — RPC/Edge 호출용 */
  var LS = 'dg-auth';

  /* opts.keepalive — 페이지 이탈(pagehide) 중에도 전송이 살아남도록 */
  function rpc(fn, args, opts) {
    return fetch(SB_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(args || {}),
      keepalive: !!(opts && opts.keepalive),
    }).then(function (r) { return r.json(); })
      .catch(function () { return { error: '네트워크 오류', network: true }; });
  }
  function edge(fn, body) {
    return fetch(SB_URL + '/functions/v1/' + fn, {
      method: 'POST',
      headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}),
    }).then(function (r) { return r.json(); }).catch(function () { return { error: '네트워크 오류' }; });
  }

  function session() { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } }
  function save(s) { try { localStorage.setItem(LS, JSON.stringify(s)); } catch (e) { /* */ } }
  /* 로그아웃 — 케이스 동기화 서명도 함께 정리(다른 계정으로 로그인 시 오탐 방지) */
  function clear() { try { localStorage.removeItem(LS); localStorage.removeItem('dg-sync-mark'); } catch (e) { /* */ } }

  /* 비밀번호 강도 — 특수문자 등 5기준 */
  function pwStrength(pw) {
    pw = pw || '';
    var checks = {
      len: pw.length >= 8,
      lower: /[a-z]/.test(pw),
      upper: /[A-Z]/.test(pw),
      digit: /[0-9]/.test(pw),
      special: /[^A-Za-z0-9]/.test(pw),
    };
    var score = (checks.len ? 1 : 0) + (checks.lower ? 1 : 0) + (checks.upper ? 1 : 0) + (checks.digit ? 1 : 0) + (checks.special ? 1 : 0);
    var label = score <= 2 ? '약함' : score === 3 ? '보통' : score === 4 ? '강함' : '매우 강함';
    var color = score <= 2 ? 'var(--v-no)' : score === 3 ? 'var(--v-cond)' : 'var(--v-ok)';
    /* 최소 요건: 8자 이상 + 특수문자 포함 */
    var ok = checks.len && checks.special && score >= 3;
    return { score: score, label: label, color: color, checks: checks, ok: ok };
  }

  window.DGAUTH = {
    SB_URL: SB_URL, SB_KEY: SB_KEY,
    session: session, clear: clear, pwStrength: pwStrength,
    isAuthed: function () { var s = session(); return !!(s && s.token); },
    token: function () { var s = session(); return s ? s.token : null; },
    role: function () { var s = session(); return s ? s.role : null; },
    rpc: rpc, edge: edge,

    /* 서버 세션 유효성 확인(만료·삭제 시 로그아웃 처리)
       네트워크 오류는 만료와 구분 — 오프라인·일시 장애로 유효 세션이 지워지지 않도록 낙관적 통과 */
    validate: function () {
      var s = session(); if (!s || !s.token) return Promise.resolve(false);
      return rpc('dg_me', { p_token: s.token }).then(function (r) {
        if (r && r.network) return true;
        if (!r || !r.ok) { clear(); return false; }
        return true;
      });
    },

    login: function (login, pw) {
      return rpc('dg_login', { p_login: login, p_password: pw }).then(function (r) {
        if (r && r.ok) {
          save(r);
          /* 로그아웃 상태에서 진행한 로컬 케이스가 곧바로 서버에 올라가
             다른 기기의 최신본을 덮어쓰지 않도록, 현재 상태를 '동기화됨'으로 표시.
             이후 변경분부터 업로드된다(케이스가 필요하면 cases.html에서 명시적으로 복원) */
          if (window.DGSync && DGSync.markSynced) DGSync.markSynced();
        }
        return r;
      });
    },
    logout: function () {
      var s = session();
      var done = s && s.token ? rpc('dg_logout', { p_token: s.token }) : Promise.resolve();
      return done.then(function () { clear(); });
    },

    /* 가입: 인증코드 발송 → 확인 후 가입신청 */
    signupSendCode: function (login) { return edge('send-code', { login: login, purpose: 'signup' }); },
    signup: function (login, pw, code, name) { return rpc('dg_signup_verified', { p_login: login, p_password: pw, p_code: code, p_name: name }); },

    /* 비밀번호 찾기: 인증코드 발송 → 확인 후 재설정 */
    resetSendCode: function (login) { return edge('send-code', { login: login, purpose: 'reset' }); },
    reset: function (login, code, pw) { return rpc('dg_reset_with_code', { p_login: login, p_code: code, p_new_password: pw }); },

    /* 관리자 */
    adminList: function () { var s = session(); return rpc('dg_admin_list', { p_token: s ? s.token : null }); },
    adminSetStatus: function (id, status) { var s = session(); return rpc('dg_admin_set_status', { p_token: s ? s.token : null, p_id: id, p_status: status }); },
    adminResetPw: function (id, pw) { var s = session(); return rpc('dg_admin_reset_pw', { p_token: s ? s.token : null, p_id: id, p_new_password: pw }); },
  };
})();
