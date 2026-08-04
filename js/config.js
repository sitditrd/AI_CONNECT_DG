/* =========================================================
   Connect DG — 단일 설정 지점
   상용화 전환·운영 파라미터 변경 시 수정 대상은 이 파일 하나로 모읍니다.
   ⚠ API 키는 절대 여기에 두지 않습니다 — ANTHROPIC_API_KEY 는 Supabase 시크릿에만 존재하며,
     클라이언트는 '키가 있는지 여부'만 probe 로 확인합니다(키 값은 내려오지 않음).
   ========================================================= */
(function () {
  'use strict';

  window.DGCONFIG = {
    /* ---------- MSDS 분석 엔진 ---------- */
    msds: {
      /* 'auto'  — 서버에 ANTHROPIC_API_KEY 가 있으면 AI 분석, 없으면 데모 재생 (권장)
         'demo'  — 항상 데모 재생 (시연 고정)
         'ai'    — 항상 AI 분석 시도 (키 없으면 실패 안내) */
      mode: 'auto',

      /* 서버 능력 조사 결과 캐시(ms). probe 는 Anthropic API 를 호출하지 않아 과금 0 */
      probeTtlMs: 10 * 60 * 1000,

      /* 업로드 허용 형식·크기 — Edge Function 측 제한과 맞출 것 */
      accept: ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      maxBytes: 8 * 1024 * 1024,

      /* AI 분석 호출 타임아웃(ms) — 문서가 크면 수십 초 걸립니다 */
      timeoutMs: 180 * 1000
    },

    /* ---------- 인증 게이트 ---------- */
    gate: {
      delayMs: 12000,   /* 미로그인 노출 시간 */
      warnMs: 3000      /* 잠금 전 카운트다운 */
    },

    /* ---------- 케이스 서버 동기화 ---------- */
    sync: {
      debounceMs: 1500,   /* 저장 후 업로드까지 대기 */
      catchUpMs: 800      /* 페이지 로드 후 유실분 복구 시점 */
    }
  };
})();
