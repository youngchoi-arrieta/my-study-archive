-- 범용 시험 프레임 (에너지관리사 전기 · 기술사 1차 · 한국 기술고시)
-- ===================================================================
-- 세 시험이 한 벌의 테이블을 공유한다. exam_slug 로 구분.
--   exam_slug ∈ { 'enekan', 'gijutsushi', 'gosi' }
--   exam_id   = {prefix}_{year}   예) enk_2024, gjs_2023, gosi_2022
--   subject   = SubjectSpec.slug  예) kamoku2, senmon, jagi
--
-- 채점 모델은 lib/constants-exams.ts 참고:
--   marksheet 과목 → 블록별 小問 정오 배열(subs_json)
--   essay 과목     → 문제별 selected + score
-- 두 모드를 한 테이블에 담되, 안 쓰는 열은 null 로 둔다.

create table if not exists exam_sessions (
  id                uuid primary key default gen_random_uuid(),
  exam_slug         text not null,
  exam_id           text not null,
  subject           text not null,
  drive_url         text,
  answer_drive_url  text,
  memo              text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (exam_slug, exam_id, subject)
);

-- marksheet: 블록별 정오 배열을 한 행에 통째로 저장 (subs_json)
--   subs_json 예: [["correct","wrong",...], [...]]  (블록 index 순서 = SubjectSpec.mark 순서)
-- essay: 문제별 한 행씩 (q_num / selected / score)
create table if not exists exam_answers (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references exam_sessions(id) on delete cascade,
  exam_slug   text not null,
  exam_id     text not null,
  subject     text not null,

  -- marksheet 과목: 이 과목 전체를 대표하는 단일 행(q_num = 0)에 subs_json 저장
  subs_json   jsonb,

  -- essay 과목: 문제별 행 (q_num ≥ 1)
  q_num       int not null default 0,
  selected    boolean default false,
  score       numeric,

  memo        text,
  review      text,             -- null | 'todo' | 'done'
  review_at   timestamptz,
  updated_at  timestamptz default now(),
  unique (exam_slug, exam_id, subject, q_num)
);

create table if not exists exam_rates (
  exam_id     text primary key,
  exam_slug   text,
  rate        numeric,          -- 회차 전체 합격률 %
  note        text,
  updated_at  timestamptz default now()
);

alter table exam_sessions disable row level security;
alter table exam_answers  disable row level security;
alter table exam_rates    disable row level security;

create index if not exists exam_answers_lookup_idx
  on exam_answers (exam_slug, exam_id, subject);

create index if not exists exam_answers_review_idx
  on exam_answers (exam_slug, exam_id, subject) where review is not null;
