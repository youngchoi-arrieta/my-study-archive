-- 홈 자격증 상태 덮어쓰기
-- ===================================================================
-- 기본값은 lib/constants-certs.ts 의 defaultStatus 에 들어 있고,
-- 이 테이블에는 "홈에서 직접 바꾼 것만" 들어간다.
-- 행이 없으면 기본값으로 폴백된다.
--
--   status ∈ { 'active', 'planned', 'done' }
--     active  진행 중   → 큰 카드
--     planned 예정      → 한 줄 압축 행
--     done    취득 완료 → 최소 행(아카이브)

create table if not exists cert_status (
  slug        text primary key,   -- lib/constants-certs.ts 의 Cert.slug
  status      text not null,
  sort        int,                -- 같은 상태 안에서의 순서 (미사용 시 null)
  updated_at  timestamptz default now()
);

alter table cert_status disable row level security;

-- 초기 상태 반영 (기본값과 다른 것만 넣어도 되지만, 명시해두면 안전)
insert into cert_status (slug, status) values
  ('denken12', 'active'),
  ('denkoshi-jitsugi', 'done')
on conflict (slug) do update set status = excluded.status, updated_at = now();
