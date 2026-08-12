-- 電験一種・二種 (1·2종 통합 섹션)
-- ===================================================================
-- 三種 테이블(denken_general_*, denken_kikai_*)과 분리한다.
-- 이유는 채점 모델이 아예 다르기 때문:
--   三種  : 문제당 result / result_a / result_b  (구조 고정)
--   1·2종 : 문제당 小問 배열 (小問 수가 회차·문제마다 다름) + 二次는 기술식 점수
-- 같은 테이블에 욱여넣으면 두 화면이 서로의 null을 해석하느라 망가진다.
--
-- exam_id 규칙: dk1_{年度} / dk2_{年度}   예) dk2_2025 = 令和7年度 第二種
--   1·2종은 연 1회이고 一次(8월)·二次(11월)가 같은 年度에 묶이므로
--   회차 = 年度 이고, 단계는 subject 로 갈린다.
-- subject 값: '理論' '電力' '機械' '法規' (一次) / '電力・管理' '機械・制御' (二次)

-- ── 회차×과목 세션 ─────────────────────────────────────────────────
create table if not exists denken12_sessions (
  id                uuid primary key default gen_random_uuid(),
  exam_id           text not null,
  subject           text not null,
  drive_url         text,               -- 문제지 PDF
  answer_drive_url  text,               -- 정답/해답례 PDF
  selected_q        int,                -- 一次 선택문제 (理論·機械에만 존재)
  memo              text,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (exam_id, subject)
);

-- ── 문제별 채점 ────────────────────────────────────────────────────
-- 一次: sub_count + subs 를 쓴다 (score/selected 는 null)
--   subs 는 小問별 정오 배열. 'correct' | 'wrong' | null 이 sub_count 개.
--   大問 점수 = (correct 개수 / sub_count) × 大問 배점
--   1종 B문제는 小問이 5~10개로 들쭉날쭉해서 sub_count 를 회차마다 고칠 수 있어야 한다.
-- 二次: selected + score 를 쓴다 (sub_count/subs 는 null)
--   記述式이라 자동 채점이 불가능하다. 30점 만점 자기채점 점수를 직접 넣는다.
create table if not exists denken12_answers (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid references denken12_sessions(id) on delete cascade,
  exam_id     text not null,
  subject     text not null,
  q_num       int  not null,

  sub_count   int,                      -- 一次: 小問 수
  subs        text[],                   -- 一次: 小問별 정오

  selected    boolean default false,    -- 二次: 이 문제를 골라 풀었는가
  score       numeric,                  -- 二次: 자기채점 점수 (0~30, 0.5 단위)

  memo        text,
  review      text,                     -- null | 'todo' | 'done'  (三種과 동일 규약)
  review_at   timestamptz,
  updated_at  timestamptz default now(),
  unique (exam_id, subject, q_num)
);

-- ── 회차별 난이도 덮어쓰기 ─────────────────────────────────────────
-- 기본값은 lib/constants-denken12-rate.ts 의 BASELINE 표에 들어 있고,
-- 여기에는 "고친 값만" 넣는다. null 인 열은 기본값으로 폴백된다.
-- 용도: 미발표 회차(令和8年度 등) 직접 입력, 二次 합격기준점 인하 기록.
create table if not exists denken12_rates (
  exam_id         text primary key,

  ichiji_takers   int,
  ichiji_passers  int,
  niji_takers     int,
  niji_passers    int,

  pass_mark_niji  numeric,   -- 二次 합격기준점 (180점 만점 · 원칙 108, 난회차엔 105/102)

  note            text,
  updated_at      timestamptz default now()
);

alter table denken12_sessions disable row level security;
alter table denken12_answers  disable row level security;
alter table denken12_rates    disable row level security;

create index if not exists denken12_answers_exam_idx
  on denken12_answers (exam_id, subject);

create index if not exists denken12_answers_review_idx
  on denken12_answers (exam_id, subject) where review is not null;
