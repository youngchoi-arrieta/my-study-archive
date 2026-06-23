-- N제 교재 트래커
-- 문제별 상태 + 핵심토픽 + 정리메모
create table if not exists textbook_problems (
  id          uuid primary key default gen_random_uuid(),
  subject     text not null,            -- kikai, riron 등
  chapter     text not null,            -- dc, trans 등
  q_num       int not null,
  status      text default 'untouched', -- untouched | correct | wrong | unsure
  topic       text,                     -- 핵심 토픽 (한 줄)
  memo        text,                     -- 정리 메모 (HTML, 수식·이미지)
  updated_at  timestamptz default now(),
  unique (subject, chapter, q_num)
);

create index if not exists textbook_problems_idx
  on textbook_problems (subject, chapter);

alter table textbook_problems disable row level security;
