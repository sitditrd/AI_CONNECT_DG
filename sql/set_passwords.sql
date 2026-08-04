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
