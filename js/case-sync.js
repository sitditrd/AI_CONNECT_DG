/* =========================================================
   Connect DG — 케이스 서버 동기화 (로그인 사용자 · 다기기)
   · DGCase 저장(dg-case 이벤트)마다 1.5초 디바운스 후 dg_case_upsert RPC 호출
   · 확정 직후 화면 이동(location.href)으로 디바운스가 유실되지 않도록
     ① pagehide 시 즉시 flush(keepalive) ② 다음 페이지 로드 시 catch-up push
     — payload는 델타가 아니라 케이스 전체라 어느 쪽이 성공해도 결과가 같다
   · catch-up은 '마지막으로 올린 내용과 다를 때'만 — 변경 없는 오래된 브라우저가
     다른 기기의 최신본을 덮어쓰지 않도록(다기기 정합성)
   · 세대 카운터(seq)로 늦게 도착한 구버전 응답이 최신 상태를 덮어쓰지 않도록 차단
   · 미로그인 / 백엔드 미활성 시 조용히 건너뜀 — 로컬 저장은 항상 유지
   · [data-sync-status] 배지에 마지막 동기화 상태 표시
   ========================================================= */
(function () {
  'use strict';
  if (typeof window === 'undefined') return;

  var MARK = 'dg-sync-mark';            /* 이 브라우저가 마지막으로 올린 케이스 서명 */
  var timer = null, lastState = null;   /* null | 'ok' | 'err' | 'busy' */
  var seq = 0, inflight = 0;            /* 세대 카운터 · 진행 중 요청 수 */

  function authed() { return typeof DGAUTH !== 'undefined' && DGAUTH.isAuthed(); }

  /* 케이스 내용 서명 — 길이 + djb2 해시 (충돌 확률 무시 가능, 로컬 비교 전용) */
  function sign(c) {
    var s = JSON.stringify(c), h = 5381, i = 0;
    for (; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return s.length + ':' + h;
  }
  function mark(v) { try { if (v == null) localStorage.removeItem(MARK); else localStorage.setItem(MARK, v); } catch (e) { /* 무시 */ } }
  function marked() { try { return localStorage.getItem(MARK); } catch (e) { return null; } }

  function badge(state, detail) {
    lastState = state;
    document.querySelectorAll('[data-sync-status]').forEach(function (el) {
      if (state === 'ok') { el.className = 'case-sync-badge on'; el.textContent = '서버 동기화 완료'; }
      else if (state === 'busy') { el.className = 'case-sync-badge'; el.textContent = '동기화 중…'; }
      else if (state === 'err') { el.className = 'case-sync-badge err'; el.textContent = '동기화 실패' + (detail ? ' — ' + detail : ''); }
      else { el.className = 'case-sync-badge'; el.textContent = ''; }
    });
  }

  function pushNow(opts) {
    if (!authed()) return Promise.resolve(null);
    var c = (opts && opts.caseData) || (window.DGCase && DGCase.get());
    if (!c || !c.caseNo) return Promise.resolve(null);
    clearTimeout(timer); timer = null;              /* 대기 중 디바운스는 이 전송으로 대체 */
    var sig = sign(c), my = ++seq;
    inflight++;
    badge('busy');
    return DGAUTH.rpc('dg_case_upsert', { p_token: DGAUTH.token(), p_case: c },
                      { keepalive: !!(opts && opts.keepalive) })
      .then(function (r) {
        inflight--;
        if (r && r.ok) mark(sig);
        if (my !== seq) return r;                   /* 더 최신 요청이 있음 — 배지 반영 안 함 */
        if (r && r.ok) { badge('ok'); return r; }
        badge('err', r && r.error);
        return null;
      });
  }

  function schedule(c) {
    if (!authed() || !c || !c.caseNo) return;
    clearTimeout(timer);
    timer = setTimeout(function () { timer = null; pushNow({ caseData: c }); }, 1500);
  }

  window.addEventListener('dg-case', function (e) { schedule(e.detail); });

  /* 화면 이동·탭 닫힘 — 대기 중이거나 아직 올리지 못한 변경을 즉시 전송 */
  window.addEventListener('pagehide', function () {
    if (!authed()) return;
    if (timer || dirty()) pushNow({ keepalive: true });
  });

  /* 아직 서버에 올리지 못한 변경이 있는가 */
  function dirty() {
    var c = window.DGCase && DGCase.get();
    if (!c || !c.caseNo) return false;
    return sign(c) !== marked();
  }

  /* 페이지 로드 직후 catch-up — 직전 화면에서 유실된 확정분만 복구.
     내용이 마지막 업로드와 같으면 전송하지 않음(다른 기기 최신본 보호) */
  function catchUp() {
    if (!authed() || !dirty()) return;
    setTimeout(function () { if (dirty()) pushNow(); }, 800);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', catchUp);
  else catchUp();

  window.DGSync = {
    push: pushNow,
    state: function () { return lastState; },
    /* 현재 로컬 케이스를 '이미 서버와 같음'으로 표시 —
       로그인 직후 호출해, 로그아웃 상태에서 남아 있던 로컬 케이스가
       catch-up으로 다른 기기의 최신본을 덮어쓰지 않도록 한다 */
    markSynced: function () {
      var c = window.DGCase && DGCase.get();
      if (c && c.caseNo) mark(sign(c)); else mark(null);
    },
    list: function () {
      if (!authed()) return Promise.resolve({ error: '로그인이 필요합니다' });
      return DGAUTH.rpc('dg_case_list', { p_token: DGAUTH.token() });
    },
    get: function (caseNo) {
      if (!authed()) return Promise.resolve({ error: '로그인이 필요합니다' });
      return DGAUTH.rpc('dg_case_get', { p_token: DGAUTH.token(), p_case_no: caseNo });
    },
    remove: function (caseNo) {
      if (!authed()) return Promise.resolve({ error: '로그인이 필요합니다' });
      return DGAUTH.rpc('dg_case_delete', { p_token: DGAUTH.token(), p_case_no: caseNo });
    },
    /* 서버 케이스를 현재 케이스로 복원 — 복원 직후는 서버와 동일하므로 재업로드 불필요 */
    restore: function (caseNo) {
      return window.DGSync.get(caseNo).then(function (r) {
        if (!r || !r.ok || !r.case) return r || { error: '복원 실패' };
        try { localStorage.setItem('dg-case', JSON.stringify(r.case)); } catch (e) { /* 무시 */ }
        seq++;                                      /* 복원본이 최신 — 진행 중이던 업로드 응답 무시 */
        mark(sign(r.case));
        window.dispatchEvent(new CustomEvent('dg-case', { detail: r.case }));
        clearTimeout(timer); timer = null;          /* 위 이벤트가 예약한 재업로드 취소 */
        return { ok: true, case: r.case };
      });
    }
  };
})();
