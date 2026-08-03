# Connect DG — AI 기반 위험물 물류 통합 플랫폼

> '창고 매칭'을 넘어, 분석 · 보관 · 운송 · 관리를 하나로.
> 저장소 https://github.com/sitditrd/AI_CONNECT_DG · 배포 **https://sitditrd.github.io/AI_CONNECT_DG/** · 문의 itt@twsc.co.kr

화주 · 위험물 창고 · 운송사를 하나의 네트워크로 연결하는 **위험물(DG) 물류 통합 플랫폼**의 기능 시연 웹.
발표자료 「[TaeSLA] Connect_DG_ver2.pptx」의 **14~20장(플랫폼 개념 · 핵심 기능 · 프로세스 상세 ①~⑤)** 을 실제 동작하는 화면으로 구현했습니다.
구조는 AI_SCM(TWL Control Tower) 템플릿 계열 — 바닐라 정적 사이트, 빌드 불필요.

---

## 1. 60초 요약 — 시작하기

```bash
# 1) 저장소 가져오기
git clone https://github.com/sitditrd/AI_CONNECT_DG.git
cd AI_CONNECT_DG

# 2) 빌드 불필요 — index.html 을 브라우저로 열면 바로 동작(정적)
#    로컬 서버가 필요하면:  python -m http.server 8155

# 3) 코드 수정 후 push 하면 GitHub Pages 로 자동 배포됨
git add -A && git commit -m "..." && git push origin master
```

**데모 시나리오** — `process.html`(워크벤치)에서 보관 요청 등록 → `msds.html`에서 MSDS 3종 중 하나 선택·분석·확정 → `compliance.html` 4단계 검토·전문가 승인 → `matching.html` 창고 확정 → `route.html` 경로 확정 → `dispatch.html` 실행 6단계·입고 확정. 전 과정이 케이스 하나로 이어지고 감사 로그가 쌓입니다.

---

## 2. 화면 구성 (발표자료 장표 매핑)

| 화면 | 파일 | 장표 | 내용 |
|---|---|---|---|
| 플랫폼 개요 | `index.html` | 14 · 15 · 22 | 3면 네트워크 · 4대 기둥 · STEP 01~04 · 수익모델 4축 · JSON-LD |
| 프로세스 워크벤치 | `process.html` | 16 | 보관 요청 등록 · **9단계 파이프라인** · 케이스 요약 · **케이스 보관함**(최근 20건) · 감사 로그(CSV) |
| MSDS 분석 | `msds.html` | 17 | LLM-OCR 4단계 · **실제 MSDS 3종**(UN3077/3480/3098) · 원문 위치·신뢰도 · 표준 프로파일 |
| 적법성 검토 | `compliance.html` | 18 | **4단계 방어 절차**(원문 대조→규제 교차→인허가 대조→전문가 승인) · 판정 4종 · **혼재 금지 매트릭스(별표19)** · 법령 카탈로그 |
| 창고·차량 매칭 | `matching.html` | 19 | **가중치 6종**(법적 40 · 인허가 20 · 용량 15 · 안전 10 · 접근 10 · 비용 5, 조정 가능) · 후보 점수화·CSV · 권역 네트워크 요약 · 단계별 정보 공개 |
| 안전경로 | `route.html` | 20 | **경로 검토 조건 6종** · ADR 준용 터널 제한코드(화물 코드 이상 카테고리 통행 금지) · 통과 높이/중량 물리 제한 · 통행 불가 경로 차단 |
| 배차·입고 | `dispatch.html` | 20 · 23 | **실행 6단계** · 견적/정산 · GPS 시뮬레이션 · 전자인수증 · 입고 검수 · 자동 생성 문서 6종 |
| 적합성 리포트 | `report.html` | 34 (MVP 산출물) | **인쇄용 검토 보고서** — 프로파일·4게이트·매칭·경로·입고·감사 로그 전체를 A4 양식으로, `window.print()` → PDF |
| 시장 현황 | `insight.html` | 4~8 · 12 | 소방청 통계(10.9만 개소 · 옥내저장소 8,702) · 권역/유별 편중 · 화학사고 추이 · 4대 문제 |
| 로그인 (v2.0) | `login.html` | — | 이메일 OTP 가입 → 관리자 승인 → bcrypt 로그인 · 비밀번호 강도 미터 · 찾기/재설정 |
| 회원 승인 (v2.0) | `admin.html` | — | 관리자 전용 — 가입 승인/거부 · 임시 비밀번호 재설정 |
| 내 케이스 (v2.0) | `cases.html` | — | 서버 보관함 — 로그인 케이스 자동 동기화 · 다른 기기에서 열기/삭제 |

**설계 원칙(발표자료 15 · 18 · 33장 반영)** — AI는 판단을 대신하지 않고 전문가가 검토할 근거를 구조화. "100% 적법·완전 면책"이 아닌 **'법률 적합성 사전검토 + 전문가 검토 지원'** 으로 표현. 추천점수는 우선순위 지표일 뿐 적법성 확률이 아님을 화면에 명시.

---

## 3. 폴더 구조

```
AI_CONNECT_DG/
├─ README.md              ← 본 문서 (마스터 인수인계)
├─ *.html                 웹 화면 9종 (8 + report.html 인쇄용 리포트)
├─ css/style.css          토큰 기반 라이트/다크 테마 (DG 오렌지 · 라이트 AA 대비 토큰 분리)
├─ js/
│  ├─ common.js           로고·테마·리빌·툴팁 + DGCase(케이스 스토어·보관함, localStorage)
│  ├─ data_dg.js          시드 데이터 — MSDS 3종·창고 8·차량 5·가중치·법령 7·경로(전 창고)·혼재 매트릭스·통계
│  ├─ db.js               Supabase REST 연동(publishable key) — 실패 시 시드로 동작, dg-data 이벤트로 재렌더
│  ├─ match-engine.js     매칭·적합성 평가 엔진 (가중 점수 + 판정 4종 + 국내 유별 대조)
│  ├─ pipeline.js         9단계 파이프라인 렌더러 (상태 텍스트 배지)
│  ├─ i18n.js · i18n-dict.js  다국어(한/영/중) 엔진 + 자동 생성 사전(하베스트→번역 워크플로→빌드)
│  ├─ export.js           CSV 내보내기 (UTF-8 BOM · Excel 호환)
│  └─ landing/process/msds/compliance/matching/route/dispatch/insight/report.js  화면별
├─ sql/schema.sql         Supabase 테이블 + RLS (참조 공개읽기 · 케이스 insert-only)
├─ sql/seed.sql           시드 적재 (실행 시 웹이 원격 데이터로 전환)
├─ assets/                twl_symbol.png · twl_logo.ico · og-image.png(DG 브랜드) · touch-icon.png
├─ .github/workflows/     deploy-pages.yml (push → Pages 자동배포)
└─ docs/                  01-overview · 02-requirements · 03-architecture · 05-development · 06-operations
```

---

## 3.5 v2.0 — 계정 · 서버 기능 (현업 완성도)

| 기능 | 구성 | 미활성 시 폴백 |
|---|---|---|
| 커스텀 인증 | `js/auth.js`(DGAUTH) + `sql/auth_setup.sql` RPC + Edge `send-code` — 이메일 OTP · 관리자 승인 · bcrypt · 30일 세션 | 로그인 실패 안내만, 데모는 정상 |
| 미로그인 게이트 | `js/auth-gate.js` — 워크벤치 12초 노출 → 카운트다운 → blur + 로그인 유도 | 티저로만 동작(보안 아님) |
| 케이스 서버 동기화 | `js/case-sync.js` + `sql/case_sync.sql` — dg-case 이벤트 1.5초 디바운스 업서트, `cases.html` 보관함 | 로컬(localStorage)만 저장 |
| MSDS 실문서 분석 | Edge `msds-extract` — 세션 토큰 검증 → Claude 문서 AI(JSON 스키마 출력) → 표준 프로파일 | 데모 재생 자동 폴백 |
| 견고화 | `js/ui-kit.js` 토스트·오프라인 감지·폼 검증, PWA `manifest.webmanifest` | — |

**활성화 절차**: `docs/06-operations/ACTIVATION_V2.md` — Connect DG 전용 Supabase(`qgwmqbtkuvozszgaunlp`) SQL Editor에서 `sql/auth_setup.sql`·`sql/case_sync.sql` 실행 → 관리자 초기 비번 교체 → Edge Functions 2종 배포 → 시크릿(SMTP_*, ANTHROPIC_API_KEY) 등록.

---

## 4. 데이터 · Supabase 연동

- **기본은 내장 시드** (`js/data_dg.js`) — 오프라인·미설정 상태에서도 전 기능 동작.
- **Supabase 전환**: 대시보드 SQL Editor에서 `sql/schema.sql` → `sql/seed.sql` 순서로 실행하면
  `js/db.js`가 자동으로 원격 데이터(`dg_warehouses` · `dg_vehicles` · `dg_regulations`)를 읽어 시드를 덮어쓰고,
  `dg-data` 이벤트로 각 화면이 즉시 재렌더됩니다.
  **워크벤치 · 적법성 검토 · 매칭 화면**의 우측 상단 배지가 "내장 시드 데이터" → "Supabase 연결"로 바뀝니다.
- 프로젝트: `https://qgwmqbtkuvozszgaunlp.supabase.co` (publishable key는 `js/db.js` — 클라이언트 노출 전제 키, 보호는 RLS가 담당. **service key 사용 금지**)
- `dg_cases`는 insert-only 정책(조회 차단) — 입고 확정 시 케이스 스냅샷을 적재 시도하며 실패해도 화면 동작에 영향 없음.
- 케이스 진행 상태는 **브라우저 localStorage**(`dg-case`)에 저장 — 워크벤치의 "케이스 초기화"로 리셋.

### 창고·차량·경로 데이터는 시연용 예시
발표자료의 매칭 시나리오(A 적합 / B 조건부 / C 가용공간 없음 / D 허가 없음)가 재현되도록 구성한 가상 데이터입니다
(발표자료 A창고 97점 → 실제 엔진 산출 98점, ±1 재현). 시장 현황(`insight.html`)의 통계만 실제 출처(소방청 「2025 위험물 통계자료」 등) 기반입니다.
터널 제한코드는 **ADR 준용 규칙(화물 코드 X = X 이상 카테고리 터널 통행 금지)** 으로 판정합니다.

---

## 5. 배포 (GitHub Pages)

- `git push origin master` → GitHub Actions(`Deploy Connect DG to GitHub Pages`) → **https://sitditrd.github.io/AI_CONNECT_DG/**
- ⚠️ 무료 계정은 **저장소 public 유지** 필수 (private 전환 시 Pages 꺼짐).
- 최초 1회: Settings → Pages → Source **`GitHub Actions`** 지정.
- 웹 파일(html·css·js·assets)만 게시 — docs·sql은 사이트에 노출되지 않음.

---

## 6. 검증 이력

**2026-08-03 (v1.2 다국어)** — 한/영/중 전환(전 화면·동적 렌더 포함), i18n E2E 13/13 · 회귀 16/16 + 25/25 PASS. TaeSLA 표기 제거.

**2026-08-01 (v1.1 고도화)** — 멀티에이전트 감사(19 에이전트) 확정 버그 14건 전량 수정 후:
- `node --check` — JS 15종 문법 통과.
- jsdom 스모크 — **9개 페이지**(리포트 포함) 콘솔 에러 0 · 빈 컨테이너 0.
- 기본 E2E — UN3480 전체 흐름 **16/16 PASS**.
- 고도화 E2E — UN3098 조건부 흐름 · ADR 터널 차단(덕양터널 E) · 혼재 매트릭스 · 보관함 보관/복원 ·
  리포트 렌더/인쇄 · 수량 변경 시 하류 무효화 · 단계 건너뛰기 크래시 방지 — **25/25 PASS**.

**2026-07-31 (v1.0)** — 스모크 8페이지 · E2E 16/16 PASS.

---

## 7. 남은 작업 (운영 전환 시)

1. **LLM-OCR 실연동** — 현재는 실제 MSDS 3종의 사전 추출 결과 재생(데모 모드). 운영 시 문서 인식 AI 사용료 발생(발표자료 26장 '실제 현금 지출 항목').
2. **법령 DB 구독** — `dg_regulations`의 개정일 자동 갱신(법령·인허가 DB 구독).
3. **지도·경로 API** — 위험물 통행 제한 반영 실경로(현재는 사전계산 경로 카드).
4. **전자계약·PG** — 표준계약 서명·에스크로 정산 실연동.
5. **TIMS WMS 연계** — 입고 검수·보관위치 실데이터 연동.

---

*Connect DG · 태웅로직스 · itt@twsc.co.kr · 본 문서는 이어받기용 단일 진입점입니다.*
