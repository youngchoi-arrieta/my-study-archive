-- 電験 회차 단위 공유 문서 (解答 PDF)
-- ===================================================================
-- 解答은 회차·차수당 PDF 한 장에 전 과목이 들어 있다.
-- 과목마다 같은 링크를 반복 입력하지 않도록 (scope, exam_id, phase)에
-- 한 번만 저장하고 모든 과목이 함께 본다.
--
--   scope : 'denken12' (1·2종) | 'denken3' (3종)
--   phase : 'ichiji' | 'niji' | 'all'   ← 三種처럼 구분 없으면 'all'

create table if not exists denken_exam_docs (
  scope        text not null,
  exam_id      text not null,
  phase        text not null default 'all',
  answer_url   text,
  question_url text,               -- 회차 통합 문제지가 있을 때만
  updated_at   timestamptz default now(),
  primary key (scope, exam_id, phase)
);

alter table denken_exam_docs disable row level security;

-- ── 기존에 과목별로 넣어둔 解答 URL을 회차 단위로 끌어올린다 ──
-- 1·2종 一次
insert into denken_exam_docs (scope, exam_id, phase, answer_url)
select 'denken12', exam_id, 'ichiji', min(answer_drive_url)
from denken12_sessions
where answer_drive_url is not null
  and subject not like '%電力・管理%'
  and subject not like '%機械・制御%'
group by exam_id
on conflict (scope, exam_id, phase) do nothing;

-- 1·2종 二次
insert into denken_exam_docs (scope, exam_id, phase, answer_url)
select 'denken12', exam_id, 'niji', min(answer_drive_url)
from denken12_sessions
where answer_drive_url is not null
  and (subject like '%電力・管理%' or subject like '%機械・制御%')
group by exam_id
on conflict (scope, exam_id, phase) do nothing;

-- 3종 (차수 구분 없음)
insert into denken_exam_docs (scope, exam_id, phase, answer_url)
select 'denken3', exam_id, 'all', min(answer_drive_url)
from denken_general_sessions
where answer_drive_url is not null
group by exam_id
on conflict (scope, exam_id, phase) do nothing;

-- 확인
--   select scope, exam_id, phase, answer_url is not null as has_answer
--   from denken_exam_docs order by scope, exam_id, phase;
