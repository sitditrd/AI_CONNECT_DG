# CHANGELOG

## 2026-08-03 — v2.0 현업 완성도 고도화 (인증 · 서버 동기화 · 실문서 분석)

### 신규
- **커스텀 인증 포팅(AI_SCM 계열)** — 이메일 OTP 가입 → 관리자 승인 → bcrypt 로그인 → 30일 세션 토큰
  - `js/auth.js`(DGAUTH) · `login.html` · `admin.html` · `css/auth.css` · `sql/auth_setup.sql` · Edge `send-code`(60초 레이트리밋 · ASCII 제목)
  - `js/auth-gate.js` — 워크벤치 화면 12초 노출 후 카운트다운 토스트 → blur 게이트, 로그인 시 해제 · 헤더 계정/내 케이스/회원 승인 버튼 주입
- **케이스 서버 동기화(다기기)** — `sql/case_sync.sql`(owner 기반 upsert/list/get/delete RPC) · `js/case-sync.js`(dg-case 1.5초 디바운스 자동 업로드) · `cases.html`(서버 보관함: 열기/삭제/즉시 동기화)
- **MSDS 실문서 분석** — Edge `msds-extract`: 세션 토큰 검증 후 Claude 문서 AI(document block + JSON 스키마 구조화 출력)로 PDF/이미지에서 표준 위험물 프로파일 추출(8MB 제한). `msds.js` 로그인+업로드 시 실분석, 실패 시 데모 재생 자동 폴백 · 케이스 복원 경로 지원
- **견고화** — `js/ui-kit.js`(토스트 스택 · 오프라인 바 · 복구 시 재동기화 · 폼 검증 헬퍼) · process 요청 폼 검증(화주/품목/수량/일자) · PWA `manifest.webmanifest` · 신규 화면 noindex
- **i18n 확장** — v2.0 문구 130키 × EN/中 병합(누락 키만) → 총 1,061 템플릿

### 보안·정합성 강화 (6관점 적대 검증 확정 9건 반영)
- **OTP 무차별 대입 차단** — `dg_email_codes.attempts` 추가, 오입력 5회 초과 시 코드 즉시 소각(가입·재설정 공통). 발송 측은 새 코드 발급 시 같은 주소·목적의 기존 미사용 코드를 무효화해 동시 유효 코드를 1개로 유지
- **세션 회수** — `dg_me`가 `status='approved'`까지 확인(승인 취소 계정의 잔여 토큰 즉시 무력화 → 클라이언트 게이트·유료 MSDS 분석 경로 동시 차단) · 비밀번호 재설정(본인·관리자)과 승인 취소 시 해당 사용자 세션 삭제
- **메일 발송 남용 방어** — 레이트리밋 조회 실패 시 통과하던 fail-open을 차단(fail-closed)으로, 주소당 60초 제한을 목적 무관으로 통합, 전역 시간당 30건 상한 추가, 인증코드를 `crypto.getRandomValues` 기반으로 교체
- **케이스 동기화 유실 수정** — 확정 직후 화면 이동으로 1.5초 디바운스가 버려지던 문제를 `pagehide` 즉시 flush(keepalive) + 다음 페이지 catch-up으로 해소. catch-up은 마지막 업로드 서명과 다를 때만 전송해 오래된 브라우저가 타 기기 최신본을 덮어쓰지 않음. 세대 카운터로 늦게 도착한 구버전 응답 무시
- **MSDS 실분석 견고화** — `validToken`이 status까지 확인 · `stop_reason=max_tokens`(출력 잘림)를 파싱 실패로 넘기지 않고 원인 안내 · `effort: medium`으로 thinking 토큰 여유 확보
- **오프라인 오탐 수정** — `validate()`가 네트워크 오류를 세션 만료와 구분(일시 장애 시 로그인 세션 유지)

### 운영
- 활성화 런북 `docs/06-operations/ACTIVATION_V2.md` — SQL 2본 실행 → 관리자 비번 교체 → Edge 2종 배포 → 시크릿(SMTP·ANTHROPIC) → 체크리스트 6항
- 미활성 상태에서도 전 기능 안전 폴백(로컬 케이스 · 데모 재생 · 게이트 티저)

## 2026-08-03 — v1.2 다국어(한/영/중) · TaeSLA 표기 제거

### 신규
- **다국어 전환(한/EN/中)** — AI_SCM(TWL Control Tower) i18n 아키텍처 계승 확장:
  - `js/i18n.js` 엔진: 구문(phrase) 사전 자동 번역 · 숫자 `#` 템플릿 매칭(동적 수치 대응) · MutationObserver 로 JS 동적 렌더(후보 카드·감사 로그·리포트) 실시간 번역 · placeholder/aria-label/data-tip/title 속성 · alert/confirm · 문서 title · ko 복귀 시 원문 복원
  - `js/i18n-dict.js` 사전(자동 생성 109KB): 전 화면 렌더 하베스트 965건 → 정규화 931 템플릿 × 영/중 — 커버리지 100% · 플레이스홀더 불일치 0
  - 언어 스위처(한·EN·中) 헤더 자동 주입 · localStorage `dg-lang` 유지
  - 생성 파이프라인: harvest.js(빈 케이스+완료 케이스 전 화면 렌더 수집) → 8-에이전트 병렬 번역 워크플로 → build_dict.js
- **TaeSLA 4기 표기 제거** — 히어로·푸터·OG 공유 이미지에서 제거(TAEWOONG LOGISTICS · CONNECT DG 로 대체)

### 검증
- i18n E2E 13/13 (EN/中 전환·KO 복원·언어 유지·동적 렌더 번역·title) · 스모크 9페이지 에러 0 · 기존 E2E 16/16 + 25/25 회귀 통과

## 2026-08-01 — v1.1 고도화 (멀티에이전트 감사 반영)

### 신규 기능
- **적합성 검토 리포트** `report.html` — 케이스 전 과정(프로파일·4게이트·매칭·경로·입고·감사 로그)을 인쇄용 A4 보고서로. `@media print` 라이트 강제 + 서명란 + 면책 고지 (발표자료 34장 8월 MVP 산출물)
- **혼재 금지 매트릭스** — 시행규칙 별표19 유별 6×6 O/X 매트릭스를 적법성 화면에 시각화, 현재 화물 유별 하이라이트 · 비대상 화물은 IMDG 분리 기준 안내
- **케이스 보관함** — 완료 케이스 보관/복원/삭제(최근 20건, localStorage) — MSDS 3종 시나리오 전환 자유화
- **CSV 내보내기** `js/export.js` — 창고 후보(지표 6종 포함)·감사 로그, UTF-8 BOM Excel 호환
- **권역별 네트워크 요약** — 매칭 화면에 권역·창고수·가용PL 집계 카드
- OG 이미지 DG 브랜드 교체(기존 TWL Control Tower 아트워크) · 180×180 터치 아이콘 분리 · JSON-LD(index) · og:description/twitter:card 전 페이지 통일

### 버그 수정 (감사 확정 14건)
- **[도메인·high] ADR 터널 제한코드 의미 반전 정정** — '화물 코드 X = X 이상 카테고리 터널 통행 금지' 규칙으로 재구현, 전 경로 데이터·차량 문구 정합화. 높이/중량은 터널코드가 아닌 경로 물리 제한(clearanceM·limitT)과 직접 비교
- **[크래시·high]** dispatch 전자인수증 렌더 시 request 등 null 가드 — 단계 건너뛴 케이스에서 화면 사용 불능 해소
- **[UX·high]** 매칭 가중치 슬라이더 — input마다 DOM 재생성으로 드래그·키보드 조작이 끊기던 문제 해소(라벨만 갱신 + rAF 디바운스 재랭킹)
- **[상태]** route 재확정·요청 수량/권역 변경·적법성 NO 재판정 시 하류 단계 무효화 누락 3건 수정
- **[도메인]** UN3480 포장등급 '미지정(PG II 성능 기준 포장)'으로 정정 · UN3098 충돌 사유를 'UN 규제 하한 8% 미만 vs 기재 분류 과대표기 의심'으로 정정 · 국내 유별 허가 대조 로직 활성화(죽은 코드 → 정규화 대조)
- **[데이터]** Supabase 하이드레이션 후 화면 재렌더 누락(dg-data 구독 추가) · 법령 표시 순서 유지 · seed.sql REG-DGS2 노트 불일치 · 경로 폴백 주석-코드 불일치(전 창고 8곳 경로 데이터 추가) · 온도구역 표기 접두 정규화 · scoreCost NaN 가드
- **[a11y]** 라이트 테마 AA 대비 토큰 분리(--dg·판정색·muted) · 후보/경로 선택 aria-pressed+텍스트 배지 · 파이프라인 상태 텍스트 병기 · 파일 선택 키보드 접근 · aria-live(role=status) · 툴팁 textContent화+포커스 표시 · 버거 메뉴 Escape/바깥클릭 · 표 키보드 스크롤 · 테마 FOUC 방지 · prefers-reduced-motion 확대 · esc()에 따옴표 이스케이프

### 검증
- 스모크 9페이지 에러 0 · 기본 E2E 16/16 · 고도화 E2E 25/25 PASS

## 2026-07-31 — v1.0 최초 구축

- 발표자료 「[TaeSLA] Connect_DG_ver2.pptx」 14~20장 기반 기능 시연 웹 8화면 구축
  - index(플랫폼 개념·4 STEP·수익모델) / process(9단계 워크벤치·감사 로그)
  - msds(LLM-OCR 4단계·실제 MSDS 3종·원문 위치·신뢰도) / compliance(4단계 방어·판정 4종·법령 7종)
  - matching(가중치 6종 조정·후보 점수화·단계별 정보 공개·차량 적합성)
  - route(조건 6종·터널 제한코드·차량 제원 반영·경로 개요도 SVG)
  - dispatch(실행 6단계·견적/정산·GPS 시뮬레이션·전자인수증·검수·자동 문서 6종)
  - insight(소방청 통계 대시보드·화학사고 추이 차트·4대 문제)
- AI_SCM(TWL Control Tower) 템플릿 계열 구조 채택 — 바닐라 정적, 토큰 기반 라이트/다크, Pretendard
- DG 오렌지(#f5a524) 브랜드 아이덴티티 · 판정 배지(적합/조건부/전문가확인/불가) 색+텍스트 병기
- DGCase 케이스 스토어(localStorage) — 9단계 상태 공유 · 상류 변경 시 하류 무효화 · 감사 로그
- DGMatch 매칭 엔진 — 6지표 가중 평가, 발표자료 19장 A/B/C/D 시나리오 재현
- Supabase 연동(sql/schema.sql·seed.sql, RLS) — 미설정 시 시드로 동작하는 오프라인 우선 설계
- GitHub Pages 배포 워크플로(deploy-pages.yml)
- 검증: node --check 13종 · jsdom 스모크 8페이지 · E2E 16/16 PASS (요청→입고 9/9 완료)
