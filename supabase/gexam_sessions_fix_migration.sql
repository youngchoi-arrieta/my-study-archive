-- 범용 시험 프레임 저장 오류 수정
-- ===================================================================
-- 원인
--   exams_migration.sql 이 만들려 했던 exam_sessions 는 이미 존재하는
--   레거시 테이블(denkoshi / engineer 대시보드가 쓰는 exam_type·year 스키마)과
--   이름이 겹쳤다. create table IF NOT EXISTS 였으므로 아무 것도 만들어지지
--   않았고, /dashboard/exam/* 화면은 exam_slug·exam_id·subject 컬럼도
--   unique 제약도 없는 테이블에 upsert 를 보내고 있었다.
--   에러를 확인하지 않는 코드라 조용히 실패 → PDF 링크도 채점도 저장 안 됨.
--
-- 조치
--   범용 프레임 전용 테이블 gexam_sessions 를 새로 만들고,
--   exam_answers 의 session_id 외래키(구 exam_sessions 참조)를 떼어낸다.
--   레거시 exam_sessions 와 denkoshi/engineer 화면은 그대로 둔다.

create table if not exists gexam_sessions (
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

alter table gexam_sessions disable row level security;

-- exam_answers.session_id 에 걸린 외래키를 이름과 무관하게 제거
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'exam_answers'::regclass
      and contype = 'f'
  loop
    execute format('alter table exam_answers drop constraint %I', c.conname);
  end loop;
end $$;

-- 혹시 레거시 테이블에 새 스키마 행이 들어가 있었다면 옮겨온다 (보통 0건)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'exam_sessions' and column_name = 'exam_slug'
  ) then
    insert into gexam_sessions (exam_slug, exam_id, subject, drive_url, answer_drive_url, memo)
    select exam_slug, exam_id, subject, drive_url, answer_drive_url, memo
    from exam_sessions
    where exam_slug is not null
    on conflict (exam_slug, exam_id, subject) do nothing;
  end if;
end $$;

-- ── 회차 단위 공유 解答 (電験과 같은 구조) ──
-- 이 시험들도 정답지가 과목 통합 PDF 한 장이다.
-- denken_exam_docs 를 그대로 쓰되 scope 에 시험 slug 를 넣는다.
create table if not exists denken_exam_docs (
  scope        text not null,
  exam_id      text not null,
  phase        text not null default 'all',
  answer_url   text,
  question_url text,
  updated_at   timestamptz default now(),
  primary key (scope, exam_id, phase)
);
alter table denken_exam_docs disable row level security;

-- 확인
--   select count(*) from gexam_sessions;
--   select conname from pg_constraint where conrelid = 'exam_answers'::regclass;
