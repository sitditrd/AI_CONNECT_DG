# Connect DG — 아키텍처

## 전체 구조

```
[브라우저 · 정적 웹 (GitHub Pages)]
   ├─ js/data_dg.js   내장 시드 (MSDS 3종 · 창고 8 · 차량 5 · 법령 7 · 경로 · 통계)
   ├─ js/db.js ────────(REST · publishable key)────▶ [Supabase qgwmqbtkuvozszgaunlp]
   │      성공 시 시드 덮어쓰기 · 실패 시 시드로 동작           dg_warehouses / dg_vehicles
   │                                                        dg_regulations / dg_cases(insert-only)
   └─ localStorage 'dg-case'   케이스 상태 (9단계 진행 · 감사 로그)
```

- **빌드 없음** — 바닐라 HTML/CSS/JS. AI_SCM(TWL Control Tower)과 동일 계열 구조.
- **오프라인 우선** — Supabase 미설정/차단 환경에서도 전 기능 동작(시드).
- **키 정책** — publishable(anon) key만 클라이언트에 존재. 보호는 RLS. service key 사용 금지.

## 모듈 구성

| 모듈 | 책임 |
|---|---|
| `common.js` | 공통 UI(로고·테마·리빌·툴팁) + **DGCase** 케이스 스토어 |
| `data_dg.js` | 도메인 시드 데이터 · `DGDATA` 네임스페이스 |
| `db.js` | Supabase REST hydrate · snake_case→camelCase 정규화 · 케이스 적재 |
| `match-engine.js` | **DGMatch** — 창고 6지표 가중 평가 + 판정(OK/COND/REVIEW/NO), 차량 적합성 |
| `pipeline.js` | 9단계 파이프라인 상태 렌더 (done/active/todo) |
| 화면별 js | landing / process / msds / compliance / matching / route / dispatch / insight |

## 케이스 상태 머신 (DGCase)

```
request → msds(fileName, profile) → compliance → warehouse → route
        → contract(step 1~6) → dispatch → inbound
```

- `DGCase.patch(obj, logText, actor)` — 상태 갱신 + 감사 로그 1건 추가 (`dg-case` 이벤트 발행)
- 상류 단계가 바뀌면 하류 단계는 null로 리셋 (예: MSDS 재확정 시 compliance 이후 전부 무효화)
- `DGCase.steps()` — 9단계 각각 done/active/todo 계산 → 파이프라인·워크벤치가 공유

## 매칭 평가 (match-engine.js)

- 지표: 법적 적합성 40 · 인허가 범위 20 · 가용 용량 15 · 안전관리 이력 10 · 운송 접근성 10 · 비용 5 (UI에서 조정 가능)
- 하드컷: 주 등급 허가 없음 → NO(제외) · 정기검사 만료 → NO · 가용 0 → REVIEW(보류)
- 소프트: 부차위험성 허가 미보유 / 가용 부족 → COND(조건부)
- 발표자료 19장의 A(적합)/B(조건부)/C(보류)/D(제외) 시나리오가 시드 데이터로 재현됨

## 적법성 검토 (compliance.js)

4게이트: ① 원문 대조(저신뢰<80% 승계) → ② 규제 교차(국내 유별 vs UN 분류 충돌 탐지 — UN3098 H₂O₂ 농도 사례) → ③ 창고 인허가 대조(매칭 엔진 재사용) → ④ 전문가 승인(승인자 없으면 REVIEW 고정).
판정: OK / COND / REVIEW / NO — 항상 근거·조회 시각·승인자와 함께 저장.

## 경로 검토 (route.js)

6조건: 차량 제원(높이·총중량·축중) · 위험물 통행제한 · 터널 제한코드(A~E, ADR 준용) · 도로 폭 · ETA · 비상대응 접근성.
차량 제원과 위험물 등급(5.1/8/3은 E 이외 터널 불가)에 따라 동일 경로도 판정이 달라짐. 위반 경로는 확정 버튼 비활성.

## Supabase 스키마

`sql/schema.sql` 참조 — 참조 3테이블은 public select, `dg_cases`는 anon insert-only(조회 차단, 화주 정보 보호).
