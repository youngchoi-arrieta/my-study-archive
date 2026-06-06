-- 電験三種 機械 과목 풀이 세션 테이블
create table if not exists denken_kikai_sessions (
  id          uuid primary key default gen_random_uuid(),
  exam_id     text not null,          -- ki_2025_2 등
  drive_url   text,                   -- 구글 드라이브 PDF URL
  selected_q  int,                    -- 17 또는 18 (선택문제)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- exam_id 유니크 (회차당 1 세션)
create unique index if not exists denken_kikai_sessions_exam_id_idx
  on denken_kikai_sessions (exam_id);

-- 문제별 채점 + 태그 + 메모 테이블
create table if not exists denken_kikai_answers (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references denken_kikai_sessions(id) on delete cascade,
  exam_id     text not null,
  q_num       int not null,           -- 1~18
  result      text,                   -- 'correct' | 'wrong' | null
  tag_id      int,                    -- KIKAI_TAGS id (1~11)
  memo        text,                   -- 자유 메모
  updated_at  timestamptz default now(),
  unique (exam_id, q_num)
);

-- RLS 비활성화 (프로젝트 정책에 맞게)
alter table denken_kikai_sessions disable row level security;
alter table denken_kikai_answers   disable row level security;
