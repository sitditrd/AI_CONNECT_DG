-- =========================================================
-- Connect DG — 케이스 서버 동기화 (다기기 · 다사용자)
-- 선행: sql/auth_setup.sql (dg_users · dg_sessions) 실행 후 적용.
-- 기존 dg_cases(익명 데모 적재)는 유지하고, 로그인 사용자의 케이스는
-- owner_id + case_no 로 업서트. anon 직접 조회는 계속 차단(RLS) —
-- 조회/삭제는 세션 토큰을 검증하는 SECURITY DEFINER RPC로만 가능.
-- 실행: Connect DG 프로젝트(qgwmqbtkuvozszgaunlp) SQL Editor에서 전체 실행.
-- =========================================================

alter table public.dg_cases add column if not exists owner_id  uuid references public.dg_users(id) on delete cascade;
alter table public.dg_cases add column if not exists updated_at timestamptz default now();
create unique index if not exists dg_cases_owner_case on public.dg_cases(owner_id, case_no) where owner_id is not null;

-- 토큰 → 사용자 조회 (내부 헬퍼, anon 권한 없음)
create or replace function public.dg_auth_user(p_token uuid)
returns uuid language sql security definer set search_path=public as $fn$
  select du.id from dg_sessions s join dg_users du on du.id = s.user_id
  where s.token = p_token and s.expires_at > now() and du.status = 'approved';
$fn$;

-- 업서트: 현재 케이스 전체(payload)를 소유자 기준으로 저장
create or replace function public.dg_case_upsert(p_token uuid, p_case jsonb)
returns json language plpgsql security definer set search_path=public as $fn$
declare v_uid uuid; v_case_no text;
begin
  v_uid := dg_auth_user(p_token);
  if v_uid is null then return json_build_object('error','로그인이 필요합니다'); end if;
  v_case_no := p_case->>'caseNo';
  if v_case_no is null or length(v_case_no) < 4 then return json_build_object('error','케이스 번호가 없습니다'); end if;
  if pg_column_size(p_case) > 256*1024 then return json_build_object('error','케이스 데이터가 너무 큽니다'); end if;

  insert into dg_cases(case_no, payload, verdict, warehouse_id, owner_id, updated_at)
  values (v_case_no, p_case,
          p_case#>>'{compliance,verdict}',
          p_case#>>'{warehouse,id}',
          v_uid, now())
  on conflict (owner_id, case_no) where owner_id is not null
  do update set payload = excluded.payload, verdict = excluded.verdict,
                warehouse_id = excluded.warehouse_id, updated_at = now();
  return json_build_object('ok', true, 'caseNo', v_case_no);
end $fn$;

-- 목록: 내 케이스 메타(payload 제외 요약)
create or replace function public.dg_case_list(p_token uuid)
returns json language plpgsql security definer set search_path=public as $fn$
declare v_uid uuid;
begin
  v_uid := dg_auth_user(p_token);
  if v_uid is null then return json_build_object('error','로그인이 필요합니다'); end if;
  return coalesce((
    select json_agg(json_build_object(
      'caseNo', case_no,
      'verdict', verdict,
      'warehouseId', warehouse_id,
      'item', payload#>>'{request,item}',
      'shipper', payload#>>'{request,shipper}',
      'updatedAt', updated_at
    ) order by updated_at desc)
    from dg_cases where owner_id = v_uid), '[]'::json);
end $fn$;

-- 단건: 전체 payload 반환 (기기 간 복원)
create or replace function public.dg_case_get(p_token uuid, p_case_no text)
returns json language plpgsql security definer set search_path=public as $fn$
declare v_uid uuid; v_payload jsonb;
begin
  v_uid := dg_auth_user(p_token);
  if v_uid is null then return json_build_object('error','로그인이 필요합니다'); end if;
  select payload into v_payload from dg_cases where owner_id = v_uid and case_no = p_case_no;
  if v_payload is null then return json_build_object('error','케이스를 찾을 수 없습니다'); end if;
  return json_build_object('ok', true, 'case', v_payload);
end $fn$;

-- 삭제
create or replace function public.dg_case_delete(p_token uuid, p_case_no text)
returns json language plpgsql security definer set search_path=public as $fn$
declare v_uid uuid; v_n int;
begin
  v_uid := dg_auth_user(p_token);
  if v_uid is null then return json_build_object('error','로그인이 필요합니다'); end if;
  delete from dg_cases where owner_id = v_uid and case_no = p_case_no;
  get diagnostics v_n = row_count;
  if v_n = 0 then return json_build_object('error','케이스를 찾을 수 없습니다'); end if;
  return json_build_object('ok', true);
end $fn$;

grant execute on function public.dg_case_upsert(uuid,jsonb), public.dg_case_list(uuid),
  public.dg_case_get(uuid,text), public.dg_case_delete(uuid,text) to anon;

notify pgrst, 'reload schema';
