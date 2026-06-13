-- 심화 연구 섹션
-- 회차 세션 (PDF 컨테이너)
create table if not exists research_sessions (
  id               uuid primary key default gen_random_uuid(),
  track            text not null,
  exam_id          text not null,
  drive_url        text,                   -- 문제 PDF
  answer_drive_url text,                   -- 정답 PDF
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (track, exam_id)
);

-- 회차 안의 개별 문제 (자유 추가)
create table if not exists research_problems (
  id          uuid primary key default gen_random_uuid(),
  track       text not null,
  exam_id     text not null,
  title       text not null,              -- '전력·구조 문1' 등 사용자 입력
  status      text default 'untouched',   -- untouched | studying | understood
  memo        text,                       -- 솔루션 노트 (HTML, 수식·이미지)
  sort_order  int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists research_problems_exam_idx
  on research_problems (track, exam_id);

alter table research_sessions disable row level security;
alter table research_problems disable row level security;
