-- 자작 풀이 PDF + 출제 주제·키워드
-- ===================================================================

-- ── 1. 내가 만든 풀이 PDF 링크 (과목별) ──
-- 記述式(電験 二次)과 논술(기술고시)은 공식 해답만으로 부족해서
-- 직접 만든 풀이를 따로 붙여둔다.
alter table denken12_sessions add column if not exists solution_url text;
alter table gexam_sessions    add column if not exists solution_url text;

-- ── 2. 출제 주제 · 키워드 (문항별) ──
-- 三種은 미리 정한 태그 목록으로 충분하지만 1·2종은 범위가 넓어
-- 자유 입력으로 받는다. /dashboard/denken12/topics 에서 집계된다.
alter table denken12_answers add column if not exists topic    text;
alter table denken12_answers add column if not exists keywords text[];

-- 키워드 검색용
create index if not exists denken12_answers_keywords_idx
  on denken12_answers using gin (keywords);

-- 확인
--   select exam_id, subject, q_num, topic, keywords
--   from denken12_answers where topic is not null or keywords is not null
--   order by exam_id desc, subject, q_num;
