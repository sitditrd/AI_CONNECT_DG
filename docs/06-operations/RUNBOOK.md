# RUNBOOK — Connect DG 운영 절차

## 로컬 실행

```bash
cd AI_CONNECT_DG
python -m http.server 8155   # http://localhost:8155  (file:// 로 열어도 동작)
```

## 배포

1. `git push origin master` → GitHub Actions `Deploy Connect DG to GitHub Pages` 자동 실행
2. 확인: https://sitditrd.github.io/AI_CONNECT_DG/
3. 최초 1회만: Settings → Pages → Source = **GitHub Actions**

## v2.0 백엔드 활성화 (인증 · 케이스 동기화 · 실문서 분석)

→ **[ACTIVATION_V2.md](ACTIVATION_V2.md)** 참조 — SQL 2본(auth_setup/case_sync) 실행 → 관리자 비번 교체 → Edge Functions(send-code/msds-extract) 배포 → 시크릿(SMTP_*, ANTHROPIC_API_KEY). 미활성 상태에서도 사이트는 안전하게 폴백 동작.

## Supabase 전환 / 데이터 갱신

1. https://supabase.com/dashboard → 프로젝트 `qgwmqbtkuvozszgaunlp` → SQL Editor
2. `sql/schema.sql` 실행 (최초 1회) → `sql/seed.sql` 실행 (갱신 시마다 — upsert 멱등)
3. 웹 새로고침 → **워크벤치(process.html) · 적법성 검토 · 매칭 화면** 우측 상단 배지 "Supabase 연결" 확인
4. 창고·차량·법령 데이터 수정은 seed.sql 편집 후 재실행 (또는 Table Editor 직접 수정)

## 트러블슈팅

| 증상 | 원인 · 조치 |
|---|---|
| 사이트 전부 404 | 저장소가 private으로 변경되어 Pages 꺼짐 → public 전환 + Pages 재활성화 |
| 배지가 "내장 시드 데이터" 고정 | schema/seed 미실행, RLS select 정책 누락, 또는 네트워크 차단 — 시드로 정상 동작하므로 기능 문제는 아님 |
| 케이스가 꼬임 (단계 안 열림) | process.html → "케이스 초기화" (localStorage `dg-case` 삭제) |
| 화면 갱신 안 됨 | 브라우저 캐시 — Ctrl+F5. 정적 자산은 `?v=` 캐시버스팅 사용 중 |
| dg_cases 적재 실패 | 정상 범위 — insert-only 정책이며 실패해도 화면 동작에 영향 없음 |

## 키 관리

- publishable key는 공개 전제 키이며 **두 곳**에 있다 — `js/db.js` CONFIG.key(참조 데이터 조회), `js/auth.js` SB_KEY(인증·케이스 동기화 RPC/Edge).
  **service_role 키는 어떤 경우에도 저장소·클라이언트에 넣지 않는다.**
- 키 회전 시: Supabase 대시보드에서 재발급 → `js/db.js`·`js/auth.js` **두 파일 모두** 교체 → 캐시버스팅 `?v=` 갱신 → push → 로그인·케이스 동기화까지 동작 확인
