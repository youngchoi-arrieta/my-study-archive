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
  topics      text[] not null default '{}',  -- '대주제/논점' 태그. 예) '변압기/병렬운전'
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
-- 서브노트 한 장 = 태그 하나('변압기/병렬운전'). 대주제만 단 태그도 한 장이다.
create table if not exists gs_subnotes (
  topic_code   text primary key,          -- '변압기/병렬운전', '회로이론' ...
  status       smallint not null default 0,
  body         text,
  diagram_ids  uuid[] default '{}',       -- diagram_cards 참조 (도식 슬롯)
  updated_at   timestamptz default now()
);

-- ── 3. 덴켄 1·2종 문항에 토픽 코드 달기 ────────────────────────────
-- 이미 쌓여 있는 topic/keywords 자유 텍스트는 앱이 일본어 단서로 추정 매칭하지만,
-- 확정 태깅을 넣으면 그쪽이 우선한다. 서브노트 보드에서 색이 달라진다.
--   진한 보라 = topic_code 로 확정 · 흐린 보라 = 키워드 추정
-- 덴켄 쪽은 대주제까지만 단다 — 記述 한 문항이 논점 여러 개에 걸치는 일이 흔해서다.
alter table denken12_answers add column if not exists topic_code text;
create index if not exists denken12_answers_topic_code_idx
  on denken12_answers (topic_code);

-- ── 확인 ───────────────────────────────────────────────────────────
--   select jong, exam, count(*) from gs_questions group by 1,2 order by 1,2 desc;
--   select topic_code, count(*) from denken12_answers
--     where topic_code is not null group by 1 order by 2 desc;
--   select exam_id, question_url from denken_exam_docs where scope='gisulsa';

-- ── 4. 초기 버전(A1·B1·G4 코드)에서 옮겨온 경우에만 ────────────────
-- 코드를 읽히는 이름으로 바꿨다. 이미 저장한 진행상태가 있으면 아래를 한 번 돌린다.
-- (새로 설치하는 경우엔 실행할 필요 없다)
-- update gs_subnotes set topic_code = case topic_code
--   when 'B1' then '변압기' when 'G1' then '보호계전' when 'I4' then 'HVDC유연송전'
--   when 'C4' then '신재생발전' when 'I1' then '분산형전원연계' when 'D3' then '지중케이블'
--   else topic_code end;
-- lib/constants-topics.ts 의 LEGACY_CODES 에 전체 대응표가 있다.
