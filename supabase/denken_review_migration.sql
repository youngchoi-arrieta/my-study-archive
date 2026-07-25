-- 電験三種 복습 태깅
-- ------------------------------------------------------------------
-- 채점 결과(정오)와 별개로 "다시 볼 문제"를 표시한다.
-- 맞았지만 찍은 문제 / 틀렸지만 이미 이해한 문제를 구분하기 위한 축.
--
--   null    복습 대상 아님
--   'todo'  복습 필요
--   'done'  복습 완료 (기록은 남기되 대기 목록에서 빠짐)
--
-- review_at 은 마지막으로 상태를 바꾼 시각. 허브에서 "언제 복습했는지" 표시용.

alter table denken_kikai_answers
  add column if not exists review    text,
  add column if not exists review_at timestamptz;

alter table denken_general_answers
  add column if not exists review    text,
  add column if not exists review_at timestamptz;

-- 허브에서 회차·과목별 대기 건수를 훑으므로 부분 인덱스
create index if not exists denken_kikai_answers_review_idx
  on denken_kikai_answers (exam_id) where review is not null;

create index if not exists denken_general_answers_review_idx
  on denken_general_answers (exam_id, subject) where review is not null;
