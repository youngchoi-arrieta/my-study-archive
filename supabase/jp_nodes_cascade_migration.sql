-- jp_nodes 삭제 연쇄 (선택 사항)
-- ===================================================================
-- 앱 쪽에서 이미 "아래층부터 지우기"로 처리하므로 이 마이그레이션이
-- 없어도 삭제는 동작한다. 다만 외래키에 cascade가 걸려 있으면
-- DB 한 번의 호출로 끝나고, 다른 경로로 지울 때도 안전하다.
--
-- 기존 제약 이름은 환경마다 다를 수 있으니 아래 쿼리로 먼저 확인:
--   select conname from pg_constraint
--   where conrelid = 'jp_nodes'::regclass and contype = 'f';

-- 부모 노드가 지워지면 자식 노드도 함께
alter table jp_nodes drop constraint if exists jp_nodes_parent_id_fkey;
alter table jp_nodes
  add constraint jp_nodes_parent_id_fkey
  foreign key (parent_id) references jp_nodes(id) on delete cascade;

-- 교재가 지워지면 그 안의 노드도 함께
alter table jp_nodes drop constraint if exists jp_nodes_book_id_fkey;
alter table jp_nodes
  add constraint jp_nodes_book_id_fkey
  foreign key (book_id) references jp_books(id) on delete cascade;
