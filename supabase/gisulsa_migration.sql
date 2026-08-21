-- 한국 기술사 + 서브노트 토픽 체계
-- ===================================================================
-- 이름 충돌을 피하려고 전부 gs_ 접두사를 쓴다.
-- (exam_sessions 가 denkoshi·engineer 레거시와 부딪혔던 전례가 있어서다)
--
-- 회차 PDF는 새 테이블을 만들지 않고 denken_exam_docs 를 재사용한다.
--   scope   = 'gisulsa'
--   exam_id = 'gs_{종목}_{회차}'   예) gs_balsong_136
--   phase   = 'all'                 기술사는 1차/2차 구분이 없다
--   question_url = 문제지 PDF · answer_url = 자작 풀이 PDF

-- ── 1. 문항 ────────────────────────────────────────────────────────
-- 시드(lib/data-gisulsa-*.ts)에 없는 회차를 앱에서 직접 태깅해 쌓는 곳.
-- 같은 (종목·회차·교시·번호)면 여기가 시드를 덮어쓴다.
create table if not exists gs_questions (
  id          uuid primary key default gen_random_uuid(),
  jong        text not null,              -- balsong | geonchuk | eungyong | anjeon
  exam        int  not null,              -- 회차 (136)
  session     int  not null,              -- 교시 (1~4)
  no          int  not null,              -- 문항 번호
  points      int  not null default 25,
  topics      text[] not null default '{}',  -- lib/constants-topics.ts 코드
  title       text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique (jong, exam, session, no)
);
create index if not exists gs_questions_topics_idx on gs_questions using gin (topics);
create index if not exists gs_questions_jong_idx   on gs_questions (jong, exam);

-- ── 2. 서브노트 ────────────────────────────────────────────────────
-- 토픽 하나에 한 장. status 0 미착수 / 1 작성중 / 2 완료.
-- body 는 TipTap HTML (DenkenMemoEditor 와 같은 포맷).
create table if not exists gs_subnotes (
  topic_code   text primary key,          -- 'B1', 'G4' ...
  status       smallint not null default 0,
  body         text,
  diagram_ids  uuid[] default '{}',       -- diagram_cards 참조 (도식 슬롯)
  updated_at   timestamptz default now()
);

-- ── 3. 덴켄 1·2종 문항에 토픽 코드 달기 ────────────────────────────
-- 이미 쌓여 있는 topic/keywords 자유 텍스트는 앱이 일본어 단서로 추정 매칭하지만,
-- 확정 태깅을 넣으면 그쪽이 우선한다. 서브노트 보드에서 색이 달라진다.
--   진한 보라 = topic_code 로 확정 · 흐린 보라 = 키워드 추정
alter table denken12_answers add column if not exists topic_code text;
create index if not exists denken12_answers_topic_code_idx
  on denken12_answers (topic_code);

-- ── 확인 ───────────────────────────────────────────────────────────
--   select jong, exam, count(*) from gs_questions group by 1,2 order by 1,2 desc;
--   select topic_code, count(*) from denken12_answers
--     where topic_code is not null group by 1 order by 2 desc;
--   select exam_id, question_url from denken_exam_docs where scope='gisulsa';
