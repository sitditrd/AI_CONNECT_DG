# v2.0 백엔드 활성화 절차 — 인증 · 케이스 동기화 · MSDS 실문서 분석

> v2.0 기능은 **활성화 전에도 안전하게 폴백**합니다.
> 미활성 상태: 로그인 화면은 "발송 실패/로그인 실패" 안내, 게이트는 12초 후 잠금 티저,
> 케이스는 로컬 저장만, MSDS는 데모 재생. 아래 절차를 완료하면 실기능이 켜집니다.
>
> ⚠️ 반드시 **Connect DG 전용 Supabase 프로젝트**(`qgwmqbtkuvozszgaunlp`)에서 실행하세요.
> AI_SCM 프로젝트(kvmyiualdodcvreoqfin)와 혼동 금지 — MCP 기본 연결은 AI_SCM입니다.

## 0. 준비물

| 항목 | 값 / 위치 |
|---|---|
| Supabase 프로젝트 | https://supabase.com/dashboard → `qgwmqbtkuvozszgaunlp` |
| SMTP 계정 | 예: 네이버 메일 — smtp.naver.com:465 + **앱 비밀번호**(2단계 인증 → 애플리케이션 비밀번호) |
| Anthropic API 키 | https://platform.claude.com → API Keys (MSDS 실분석용) |
| Supabase CLI (Edge 배포용) | `npm i -g supabase` 또는 대시보드에서 함수 생성 |

## 1. SQL 실행 (SQL Editor)

**가장 빠른 방법 — `sql/_ACTIVATE_ALL.sql` 파일 하나를 통째로 붙여넣고 Run.**
아래 4개를 올바른 순서로 합쳐 둔 파일이며, 여러 번 실행해도 안전합니다(멱등).

개별로 실행하려면 반드시 이 순서를 지킬 것:

1. `sql/schema.sql` — 창고·차량·법령·케이스 테이블
2. `sql/seed.sql` — 참조 데이터 적재
3. `sql/auth_setup.sql` — dg_users / dg_sessions / dg_email_codes + 로그인·가입·승인 RPC + 관리자 시드
4. `sql/case_sync.sql` — dg_cases 소유자 컬럼 + dg_case_upsert/list/get/delete RPC (3번 선행 필요)

실행 여부는 이걸로 바로 확인됩니다 — 함수가 없으면 `PGRST202`가 돌아옵니다:

```bash
curl -s -X POST "https://qgwmqbtkuvozszgaunlp.supabase.co/rest/v1/rpc/dg_login" -H "apikey: sb_publishable_b-KEOweYGIY9jWtRDLr2yQ_3eKxcLkc" -H "Authorization: Bearer sb_publishable_b-KEOweYGIY9jWtRDLr2yQ_3eKxcLkc" -H "Content-Type: application/json" -d "{\"p_login\":\"sitditrd2@naver.com\",\"p_password\":\"설정한_비밀번호\"}"
```

## 2. 계정 비밀번호 설정 (필수 — 이 단계 전에는 아무도 로그인 불가)

`auth_setup.sql` 은 계정 **골격만** 만듭니다. 비밀번호는 추측 불가능한 임의값이라 그대로는 로그인되지 않습니다.
**저장소가 공개(PUBLIC)이고 깃 이력은 영구 보존되므로, 비밀번호는 저장소에 두지 않습니다.**

`sql/set_passwords.sql` 을 열어 자리표시자를 실제 값으로 바꾼 뒤 SQL Editor에서 실행하세요.

| 구분 | 아이디 | 비밀번호 |
|---|---|---|
| 관리자 | `sitditrd2@naver.com` | set_passwords.sql 에서 지정 |
| 사용자 | `TW190708Z` (DB 저장은 `tw190708z`) | " |
| 사용자 | `TW200106D` (DB 저장은 `tw200106d`) | " |

조건: 8자 이상 + 특수문자 포함. 실행 후 SQL Editor 편집기 내용을 지우세요(쿼리 이력이 남습니다).

> 사번 형식 아이디도 로그인됩니다. `dg_login` 이 `lower(trim())` 으로 조회하므로
> **DB에는 반드시 소문자로 저장**해야 하며, 사용자는 대소문자 구분 없이 입력해도 됩니다.
> 로그인 폼 입력칸이 `type=email` 이 아니라 `type=text` 인 이유입니다(가입·재설정은 OTP 발송 때문에 이메일 전용).

> 비밀번호를 바꾸면 해당 계정의 **기존 세션은 자동으로 전부 무효화**됩니다.

## 3. Edge Function 배포

```bash
supabase login
supabase init          # supabase/config.toml 이 없을 때만 — 이미 있으면 건너뜀(중복 실행 시 거부됨)
supabase link --project-ref qgwmqbtkuvozszgaunlp
supabase functions deploy send-code     --no-verify-jwt
supabase functions deploy msds-extract  --no-verify-jwt
```

> 저장소에는 `supabase/functions/` 소스만 있고 `config.toml` 은 없습니다 —
> `link` 이전에 `init` 을 한 번 실행해야 CLI가 프로젝트로 인식합니다.

(대시보드 → Edge Functions 에서 소스 붙여넣기로 만들어도 동일 — `supabase/functions/*/index.ts`)

## 4. 시크릿 등록 (대시보드 → Edge Functions → Secrets)

| 키 | 값 | 용도 |
|---|---|---|
| `SMTP_HOST` | smtp.naver.com | 인증코드 메일 |
| `SMTP_PORT` | 465 | " |
| `SMTP_USER` | 발신 계정 | " |
| `SMTP_PASS` | 앱 비밀번호 | " |
| `SMTP_FROM` | 발신 주소(생략 시 SMTP_USER) | " |
| `ANTHROPIC_API_KEY` | sk-ant-… | MSDS 실문서 분석 |

`SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` 는 자동 주입 — 등록 불필요.

## 4-1. 활성화 현황 (2026-08-03 실측)

| 구성요소 | 상태 | 검증 방법 |
|---|---|---|
| `dg_*` 테이블·RPC (schema/seed/auth/case_sync) | **활성** | 창고 8·차량 5·법령 7건 조회 확인 |
| 계정 3종 (admin 1 · user 2) | **활성** | `dg_login` 호출 → `ok:true` + 토큰 발급 |
| Edge Function `send-code` | **활성** | 실제 메일 수신 확인 |
| SMTP (네이버) | **활성** | `{"ok":true}` — 인증 통과 |
| 레이트리밋 60초 / purpose 우회 차단 | **동작** | 연속 호출 시 429 |
| `dg_email_codes` RLS | **차단됨** | publishable key 조회 시 `[]` |
| Edge Function `msds-extract` | **미배포** | 무료 추출 대안 검토 중 (유료 API 회피) |

> `msds-extract` 미배포 상태에서는 MSDS 화면이 데모 재생으로 동작합니다 — 다른 기능에는 영향이 없습니다.

## 5. 동작 확인 체크리스트

| # | 확인 | 기대 결과 |
|---|---|---|
| 1 | login.html → 회원가입 → 인증코드 받기 | 메일 수신(10분 유효) → 가입 신청 → "관리자 승인 후" 안내 |
| 2 | 관리자 로그인 → admin.html | 대기 회원 승인/거부 동작 |
| 3 | 일반 계정 로그인 → process.html | 헤더에 '내 케이스' · 로그아웃 표시, 게이트 미발동 |
| 4 | 케이스 진행(요청 등록 등) | cases.html 목록에 자동 등장, 다른 브라우저에서 '열기' 복원 |
| 5 | msds.html 로그인 후 실제 MSDS PDF 업로드 → 분석 실행 | 수십 초 후 실추출 프로파일 표시. 실패 시 원인 토스트만 뜨고 **데모 샘플로 대체되지 않음** |
| 6 | 미로그인 워크벤치 12초 대기 | 카운트다운 토스트 → blur + 로그인 오버레이 |
| 7 | `msds-extract` 미배포 상태에서 PDF 업로드 | 배지 `데모 재생` · MSDS 3종 중 하나가 **무작위 자동 선택**되어 분석 실행 버튼 활성화 |

## 6. 요금 · 보호 장치

- **send-code**: 주소당 60초 레이트리밋(목적 무관) + 전역 시간당 30건 상한, 레이트리밋 조회 실패 시 차단(fail-closed), 새 코드 발급 시 기존 미사용 코드 무효화. 코드는 10분 만료·1회성이며 오입력 5회 초과 시 즉시 소각.
- **msds-extract**: 로그인(승인 계정) 토큰 필수 → 익명 호출로 인한 Claude API 과금 차단. 파일 8MB 제한.
- **세션 회수**: 승인 취소·비밀번호 재설정 시 해당 사용자 세션이 즉시 삭제되며, `dg_me`가 승인 상태까지 확인합니다.
- publishable key 만 클라이언트에 노출 — 민감 테이블은 RLS 잠금 + SECURITY DEFINER RPC 경유.
- **service_role 키는 절대 클라이언트/저장소에 넣지 않습니다.**
