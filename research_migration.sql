-- 심화 연구 섹션 세션 테이블
-- 회차 = 1세션 (PDF 하나 + 상태 하나 + 솔루션 메모 하나)
create table if not exists research_sessions (
  id               uuid primary key default gen_random_uuid(),
  track            text not null,          -- denken2-2ji, gosi-jeongi 등
  exam_id          text not null,          -- d2_2ji_2025 등
  status           text default 'untouched', -- untouched | studying | understood
  drive_url        text,                   -- 문제 PDF
  answer_drive_url text,                   -- 정답 PDF
  memo             text,                   -- 솔루션/연구 메모 (HTML, 수식·이미지 포함)
  created_at       timestamptz default now(),
  updated_at       timestamptz default now(),
  unique (track, exam_id)
);

alter table research_sessions disable row level security;
