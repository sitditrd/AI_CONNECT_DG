# RUNBOOK — Connect DG 운영 절차

## 로컬 실행

```bash
cd AI_CONNECT_DG
python -m http.server 8155   # http://localhost:8155  (file:// 로 열어도 동작)
```

## 회귀 테스트

```bash
cd test && npm install && npm test    # jsdom 158개 단언 (업로드 39 + 신뢰성 검증 119) + MSDS 정답지 채점
```

`test/` 는 배포 대상이 아니다(워크플로가 `*.html` 과 `css/ js/ assets/ data/` 만 `_site` 로 옮긴다).
상세는 [test/README.md](../../test/README.md).

## 배포

1. `git push origin master` → GitHub Actions `Deploy Connect DG to GitHub Pages` 자동 실행
2. 확인: https://sitditrd.github.io/AI_CONNECT_DG/
3. 최초 1회만: Settings → Pages → Source = **GitHub Actions**

**캐시 무효화는 자동이다.** 워크플로가 `_site` 사본의 `?v=` 를 커밋 SHA로 치환하므로
저장소의 `?v=` 값을 손으로 올릴 필요가 없다(원본 파일은 건드리지 않는다).
이 자동화 이전에는 수동 갱신이 3회 연속 누락돼 재방문자가 구버전 JS를 받았다.

## 로그인 없이 공개 (현재 기본값)

누구나 로그인 없이 MSDS 분석부터 적법성 · 창고 · 경로 · 배차 · 리포트까지 전 단계를 진행할 수 있다.
전환 지점은 `js/config.js` 의 `gate.enabled` 한 곳이다.

| 값 | 동작 |
|---|---|
| `false` (현재) | 전 기능 공개. 헤더의 로그인 버튼만 남고 잠금 오버레이 · blur 없음 |
| `true` | 미로그인 사용자는 `gate.delayMs`(12초) 후 주요 기능이 가려지는 lock-in 티저 |

로그인이 여전히 필요한 기능 — **내 케이스**(다기기 서버 보관) · **회원 승인**(관리자) · **실문서 AI 분석**(Edge Function 토큰 검증).
미로그인 사용자의 케이스는 브라우저 로컬에만 저장되며 서버 동기화는 조용히 건너뛴다.

## Supabase 자동 일시중지(pause) 방지

무료 플랜 프로젝트는 **7일간 요청이 없으면 자동 일시중지**된다(일시중지 후 90일 안에는 대시보드에서 복구 가능, 이후에는 데이터 내려받기만 가능).
발표 직전에 멈추는 일을 막기 위해 워크플로 `Supabase 일시중지 방지 (keep-alive)` 가 **매일 06:17 KST** 에
`dg_warehouses` 1행을 읽어 활동을 남긴다(js/db.js 의 publishable 키 사용, 시크릿 불필요).

- 응답이 200 이 아니면 실행이 실패하므로 일시중지 · 키 · 테이블 이상을 메일로 알 수 있다
- **GitHub 은 저장소에 60일간 커밋이 없으면 schedule 을 자동 비활성화한다** — 장기 방치 시 Actions 탭에서 `Run workflow` 1회
- 확실히 막으려면 Supabase Pro(유료) 전환 — 유료 플랜은 미사용 일시중지가 없다

## v2.0 백엔드 활성화 (인증 · 케이스 동기화 · 실문서 분석)

→ **[ACTIVATION_V2.md](ACTIVATION_V2.md)** 참조 — SQL 2본(auth_setup/case_sync) 실행 → 관리자 비번 교체 → Edge Functions(send-code/msds-extract) 배포 → 시크릿(SMTP_*, ANTHROPIC_API_KEY). 미활성 상태에서도 사이트는 안전하게 폴백 동작.

## Supabase 전환 / 데이터 갱신

1. https://supabase.com/dashboard → 프로젝트 `qgwmqbtkuvozszgaunlp` → SQL Editor
2. `sql/schema.sql` 실행 (최초 1회) → `sql/seed.sql` 실행 (갱신 시마다 — upsert 멱등)
3. 웹 새로고침 → **워크벤치(process.html) · 적법성 검토 · 매칭 화면** 우측 상단 배지 "Supabase 연결" 확인
4. 창고·차량·법령 데이터 수정은 seed.sql 편집 후 재실행 (또는 Table Editor 직접 수정)

## 신뢰성 검증 — 법령 점검 · DB 동기화

- **DB 동기화** — `sql/verify_2026-09.sql` 을 SQL Editor에서 실행. 창고 허가 품목(CAS) · 법령 현행 시행일 컬럼을 추가하고
  카탈로그를 현행으로 맞춘다. 실행 전에는 적법성 화면 법령 표에 '카탈로그 갱신 필요'가 표시된다(동작에는 영향 없음)
- **법령 정기 점검(월 1회 권장)** — 국가법령정보센터에서 `js/data_dg.js` `REGULATIONS` 의 국내 법령 현행 시행일을 확인
  1. 시행일이 바뀌었으면 `effective` · `checkedAt` 갱신 → 해당 법령의 `rules` 에 연결된 판정 규칙 검토
  2. 규칙 검토를 마치면 `RULESET.version` · `RULESET.reviewedAt` 갱신 — 검토 전에는 `effective > reviewedAt` 인 법령이
     '규칙 재검토 필요'로 표시되고, 해당 케이스는 담당자 확인으로 전환된다
  3. DB 카탈로그(`dg_regulations`)의 `revised` 도 같은 값으로 갱신
- **국제기준(IMDG · IATA · ADR)** 은 개정판 발행 시 수동 확인
- 기준값 출처와 점검 이력은 `docs/04-design/시스템_구현범위_신뢰성검증.md`

## 트러블슈팅

| 증상 | 원인 · 조치 |
|---|---|
| 사이트 전부 404 | 저장소가 private으로 변경되어 Pages 꺼짐 → public 전환 + Pages 재활성화 |
| 배지가 "내장 시드 데이터" 고정 | schema/seed 미실행, RLS select 정책 누락, 또는 네트워크 차단 — 시드로 정상 동작하므로 기능 문제는 아님 |
| 케이스가 꼬임 (단계 안 열림) | process.html → "케이스 초기화" (localStorage `dg-case` 삭제) |
| 화면 갱신 안 됨 | 브라우저 캐시 — Ctrl+F5. 배포본의 `?v=` 는 배포 시 커밋 SHA로 자동 치환되므로 보통 발생하지 않는다 |
| dg_cases 적재 실패 | 정상 범위 — insert-only 정책이며 실패해도 화면 동작에 영향 없음 |
| Supabase "프로젝트 일시중지 예정" 메일 | 7일 무활동 경고 — keep-alive 워크플로가 도는지 확인(Actions 탭), 멈춰 있으면 `Run workflow` 수동 실행 |
| 사이트 배지가 시드로 바뀌고 REST 가 모두 실패 | 프로젝트가 이미 일시중지됨 → 대시보드에서 Restore(90일 이내), 이후 keep-alive 재개 확인 |

## 자격증명 관리

**원칙 — 평문 자격증명은 저장소에 넣지 않는다.** 파일 본문뿐 아니라 커밋 메시지도 포함이다.
SQL 은 자리표시자(`sql/set_passwords.sql`)나 임의값 생성(`sql/auth_setup.sql` 의
`crypt(gen_random_uuid()::text, gen_salt('bf'))`)으로 두고, 실제 값은 SQL Editor 에서 직접 넣는다.
그 상태의 계정으로는 로그인이 불가능하므로 비밀번호 설정이 활성화의 필수 단계다.

**한 번 푸시되면 되돌릴 수 없다.** 2026-08-03 커밋에 관리자 비밀번호가 평문으로 들어갔고,
`git filter-repo` 로 이력을 재작성해 force push 했는데도 **참조가 끊긴 옛 커밋 객체는
직접 SHA 로 계속 조회됐다**(GitHub 이 회수하기 전까지). 즉 사후 조치로 완전 제거가 안 된다.
공개 저장소이므로 이미 복제된 사본도 회수되지 않는다.

**순환 절차**

1. 노출된 값·그 파생값·`login_id` 로 공개된 사번은 후보에서 제외한다
   (유출 비밀번호 기반 추측은 접미 문자 추가·반복을 가장 먼저 시도한다)
2. `sql/set_passwords.sql` 의 자리표시자를 SQL Editor 에서 채워 실행 → 편집기 내용 삭제
   (Supabase SQL Editor 는 실행 이력을 남긴다)
3. `pass_hash = crypt('값', pass_hash)` 로 적용 확인, 옛 값이 거부되는지도 함께 확인
4. 비밀번호 변경 시 해당 계정 세션은 자동 무효화된다
5. 같은 값을 다른 시스템(AI_SCM 등)과 공유하지 않는다 — 한쪽 유출이 다른 쪽으로 번진다

**커밋 전 점검** — `git diff --cached` 로 평문 유출 여부를 확인한다.

## 키 관리

- publishable key는 공개 전제 키이며 **두 곳**에 있다 — `js/db.js` CONFIG.key(참조 데이터 조회), `js/auth.js` SB_KEY(인증·케이스 동기화 RPC/Edge).
  **service_role 키는 어떤 경우에도 저장소·클라이언트에 넣지 않는다.**
- 키 회전 시: Supabase 대시보드에서 재발급 → `js/db.js`·`js/auth.js` **두 파일 모두** 교체 → 캐시버스팅 `?v=` 갱신 → push → 로그인·케이스 동기화까지 동작 확인
