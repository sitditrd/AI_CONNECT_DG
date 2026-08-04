# 회귀 테스트

운영본은 빌드가 없는 바닐라 정적 사이트다. 이 디렉터리만 Node + jsdom 을 쓰며
**배포 대상이 아니다**(`.github/workflows/deploy-pages.yml` 은 `*.html` 과 `css/ js/ assets/ data/` 만 `_site` 로 옮긴다).

## 실행

```bash
cd test
npm install
npm test
```

## msds-upload.test.js

`msds.html` 을 jsdom 으로 띄우고 실제 `change` 이벤트를 발생시켜 관측한다. 39개 단언.

| 절 | 확인 내용 |
|---|---|
| 1 | 초기 상태 — 칩 3개, 선택 없음, 분석 버튼 비활성, 배지 `데모 재생` |
| 2 | 업로드 → 무작위 자동 선택, 버튼 활성, 파일명·무작위·미분석 사실 표기 |
| 3 | 분석 실행 → 추출표·프로파일 생성, 확정 버튼 활성 |
| 4 | 40회 연속 업로드 분포 — 3종 전부 등장, 직전 샘플 연속 중복 0회 |
| 4b | `Math.random` 고정 시 직전 샘플 제외가 결정적으로 성립 |
| 5 | 비허용 형식도 데모 재생으로 안전 처리 |
| 6 | 칩 수동 선택이 업로드 상태를 덮어씀 |
| 6b | **AI 분석 모드 죽은 버튼 회귀** — 세션·서버 응답을 주입해 실분석 경로가 실제로 실행되는지 |
| 6c | 다국어 — 신규 문구가 EN/ZH 사전에 걸리는지(한글 잔존 0자) |
| 7 | MSDS 1종만 있어도 예외 없음 |

### 하네스 주의사항

- **`DOMContentLoaded` 를 수동으로 dispatch 하지 말 것.** jsdom 이 파싱 완료 시 자연 발화시키므로
  수동 dispatch 를 더하면 `initDrop()` 이 두 번 걸려 `change` 리스너가 중복 등록되고
  업로드 1회에 `handleFile` 이 2회 돈다. 실제 브라우저에는 없는 현상이라 **거짓 실패**가 난다.
- 기본은 `fetch` 를 막아 데모 모드를 강제한다(= 키 미등록 상태의 실제 배포 동작).
  AI 경로는 `aiHarness(w)` 가 `dg-auth` 세션과 `msds-extract` 응답을 주입해 재현한다.

### 회귀 감지력 확인(뮤테이션 테스트)

인자로 다른 사본 경로를 주면 그 사본을 검사한다. 예를 들어 `analyze()` 가드를
옛 코드(`if (!selected) return;`)로 되돌린 사본에 돌리면 6b 에서 3건이 실패해야 한다.

```bash
node msds-upload.test.js /path/to/mutated-copy
```
