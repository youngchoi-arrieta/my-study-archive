-- =====================================================================
-- 보안 잠금 — 로그인한 본인만 데이터에 접근
-- ---------------------------------------------------------------------
-- 반드시 순서대로:
--   (1) 로그인 코드가 배포된 상태에서
--   (2) 실제로 로그인이 되는 걸 확인한 뒤에
--   (3) 이 파일을 실행한다.
-- 로그인 코드 없이 먼저 돌리면 앱이 빈 화면이 된다(데이터는 안전).
--
-- 혼자 쓰는 앱이고 신규 가입을 꺼 두었으므로
-- "로그인한 사용자(authenticated) = 본인" 이다. user_id 칸은 필요 없다.
-- 여러 번 돌려도 안전하다.
-- =====================================================================


-- ── A. 테이블 ────────────────────────────────────────────────────────
-- public 스키마의 기존 정책을 모두 지우고(anon 허용 정책이 남아 있으면
-- 정책끼리 OR로 합쳐져 구멍이 되므로), 모든 테이블에 RLS를 켠 뒤
-- "로그인한 사용자만 전부 허용" 정책 하나만 건다.
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname
             from pg_policies where schemaname = 'public' loop
    execute format('drop policy if exists %I on %I.%I',
                   r.policyname, r.schemaname, r.tablename);
  end loop;

  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', r.tablename);
    execute format(
      'create policy owner_all on public.%I for all to authenticated using (true) with check (true)',
      r.tablename);
  end loop;
end $$;


-- ── B. 사진 저장소 ───────────────────────────────────────────────────
-- memorias(가족 사진)는 비공개로 전환 — 앱은 서명 URL로 보여준다.
-- card-images, session-photos 는 일단 공개 유지(나중에 같은 방식으로 전환).
-- 업로드·삭제는 세 버킷 모두 로그인한 사용자만.
update storage.buckets set public = false where id = 'memorias';

do $$
declare r record;
begin
  for r in select policyname from pg_policies
            where schemaname = 'storage' and tablename = 'objects' loop
    execute format('drop policy if exists %I on storage.objects', r.policyname);
  end loop;
end $$;

create policy owner_all_objects on storage.objects
  for all to authenticated
  using      (bucket_id in ('card-images', 'session-photos', 'memorias'))
  with check (bucket_id in ('card-images', 'session-photos', 'memorias'));


-- ── C. 확인 ──────────────────────────────────────────────────────────
-- 결과가 0행이면 모든 테이블이 잠긴 것.
select tablename from pg_tables
 where schemaname = 'public' and rowsecurity = false;
