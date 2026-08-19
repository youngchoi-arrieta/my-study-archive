-- JLPT 교재 진행 상태
-- ===================================================================
-- 홈 허브의 자격증 상태(cert_status)와 같은 3단 축을 교재에도 준다.
--
--   status ∈ { 'active', 'planned', 'done' }
--     active  진행 중 → 큰 카드
--     planned 예정    → 한 줄 압축 행
--     done    완료    → 최소 행(아카이브)
--
-- 기존 교재는 전부 'active' 로 들어온다. 화면에서 칩을 눌러 옮기면 된다.

alter table jp_books add column if not exists status text not null default 'active';
alter table jp_books add column if not exists status_updated_at timestamptz;

-- 오타 방지 (이미 있으면 무시)
do $$
begin
  alter table jp_books
    add constraint jp_books_status_check
    check (status in ('active', 'planned', 'done'));
exception
  when duplicate_object then null;
end $$;

create index if not exists jp_books_status_idx on jp_books (status, sort_order);


-- ── (선택) 진도에 따라 한 번에 자동 분류하기 ────────────────────────
-- 하나씩 누르기 귀찮으면 아래 블록의 주석을 풀고 한 번만 실행한다.
--   말단 항목 100% 완료  → done
--   말단이 없거나 0%     → planned
--   그 사이              → active
--
-- with leaf as (
--   select n.book_id, n.status
--   from jp_nodes n
--   where not exists (select 1 from jp_nodes c where c.parent_id = n.id)
-- ),
-- agg as (
--   select book_id,
--          count(*)                             as total,
--          count(*) filter (where status >= 1)   as done
--   from leaf group by book_id
-- )
-- update jp_books b
-- set status = case
--       when a.total is null or a.total = 0 then 'planned'
--       when a.done = 0                     then 'planned'
--       when a.done >= a.total              then 'done'
--       else 'active'
--     end,
--     status_updated_at = now()
-- from (select b2.id, a2.total, a2.done
--       from jp_books b2 left join agg a2 on a2.book_id = b2.id) a
-- where a.id = b.id;
