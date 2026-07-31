# CHANGELOG

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
