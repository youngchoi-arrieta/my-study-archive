-- 電験三種 B문제 (a)(b) 소문항 채점 지원
-- ------------------------------------------------------------------
-- B영역(理論·機械 15~18, 電力 15~17, 法規 11~13)은 (a)/(b) 소문항으로
-- 나뉘어 각각 정오/배점이 매겨진다. 기존 단일 result 컬럼(=A문제용)에
-- 소문항용 result_a / result_b 를 추가한다.
--
-- 기존 B문제의 통짜 result 값은 채점 모델이 바뀌었으므로 사용되지 않는다
-- (A문제는 계속 result 사용). 필요하면 해당 회차 B문제만 재채점하면 된다.

-- ── 理論·電力·法規 공용 테이블 (없으면 생성) ───────────────────────
create table if not exists denken_general_sessions (
  id                uuid primary key default gen_random_uuid(),
  exam_id           text not null,
  subject           text not null,      -- '理論' | '電力' | '法規'
  drive_url         text,
  answer_drive_url  text,
  selected_q        int,                -- 選択문제 (理論만 17/18)
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (exam_id, subject)
);

create table if not exists denken_general_answers (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references denken_general_sessions(id) on delete cascade,
  exam_id     text not null,
  subject     text not null,
  q_num       int not null,
  result      text,                     -- A문제: 'correct' | 'wrong' | null
  result_a    text,                     -- B문제 (a)
  result_b    text,                     -- B문제 (b)
  memo        text,
  updated_at  timestamptz default now(),
  unique (exam_id, subject, q_num)
);

alter table denken_general_sessions disable row level security;
alter table denken_general_answers  disable row level security;

-- ── 소문항 컬럼 추가 (기존 테이블 대상) ────────────────────────────
alter table denken_kikai_answers
  add column if not exists result_a text,   -- B문제 (a): 'correct' | 'wrong' | null
  add column if not exists result_b text;   -- B문제 (b): 'correct' | 'wrong' | null

alter table denken_general_answers
  add column if not exists result_a text,
  add column if not exists result_b text;
