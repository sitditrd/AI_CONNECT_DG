-- =========================================================
-- Connect DG — 계정 비밀번호 설정 (템플릿)
--
-- ⚠ 이 파일에 실제 비밀번호를 적어 저장·커밋하지 말 것.
--    아래 자리표시자를 SQL Editor 에서 직접 바꿔 실행하고, 실행 후 편집기 내용을 지운다.
--    (Supabase SQL Editor 는 실행한 쿼리를 이력에 남긴다)
--
-- 조건: 8자 이상 + 특수문자 포함 (화면 검증 기준과 동일)
-- 효과: 비밀번호를 바꾸면 해당 계정의 기존 세션은 전부 자동 무효화된다.
--
-- ⚠ 재사용 금지 목록
--    2026-08-03 이전 커밋에 평문으로 들어갔던 값, 그리고 login_id 로 공개된 사번은
--    비밀번호로 쓰지 않는다. 해당 커밋은 이력 재작성 후에도 GitHub 이 회수할 때까지
--    직접 SHA 로 조회되며, 이미 복제된 사본은 회수되지 않는다.
--    끝에 문자를 덧붙인 파생값(예: 기호 1자 추가·반복)도 마찬가지다 —
--    유출 비밀번호 기반 추측은 접미 변형을 가장 먼저 시도한다.
--
-- 실행 위치: Supabase 대시보드 → 프로젝트 qgwmqbtkuvozszgaunlp → SQL Editor
-- =========================================================

-- 관리자
update public.dg_users
   set pass_hash = crypt('여기에_관리자_비밀번호', gen_salt('bf'))
 where login_id = 'sitditrd2@naver.com';

-- 일반 사용자 (아이디는 소문자로 저장되어 있다)
update public.dg_users
   set pass_hash = crypt('여기에_사용자1_비밀번호', gen_salt('bf'))
 where login_id = 'tw190708z';

update public.dg_users
   set pass_hash = crypt('여기에_사용자2_비밀번호', gen_salt('bf'))
 where login_id = 'tw200106d';

-- 확인 — 계정 목록(해시는 조회되지 않는다)
select login_id, status, role, display_name, created_at
  from public.dg_users
 order by role, login_id;

-- 검증 — 새 값이 실제로 적용됐는지. 위와 같은 자리표시자를 넣어 실행하고,
-- 세 행 모두 pw_ok = true 인지 확인한 뒤 편집기 내용을 지운다.
-- select login_id, role, status,
--        (pass_hash = crypt('여기에_관리자_비밀번호', pass_hash)) as pw_ok
--   from public.dg_users where login_id = 'sitditrd2@naver.com';

-- 세션 정리(선택) — 비밀번호 변경 시 자동 무효화되므로 보통 불필요하다.
-- 점검용 로그인 등으로 생긴 세션을 즉시 끊고 싶을 때만 실행한다.
-- delete from public.dg_sessions
--  where user_id in (select id from public.dg_users
--                     where login_id in ('sitditrd2@naver.com','tw190708z','tw200106d'));
