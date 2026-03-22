-- ============================================================
-- 시퀀스 트레이너 — Supabase 마이그레이션 SQL
-- 현재는 lib/trainer/problems.ts 로컬 데이터로 동작
-- 문제 수가 늘어나면 이 SQL로 DB 마이그레이션
-- ============================================================

-- 문제 테이블
create table if not exists trainer_problems (
  id           text primary key,
  title        text not null,
  exam_type    text not null default '전기기능사',
  source_doc   text,
  description  text,
  operation_text text,
  main_circuit jsonb not null default '[]',
  aux_circuit  jsonb not null default '[]',
  timechart    jsonb not null default '{}',
  difficulty   int  not null default 2 check (difficulty between 1 and 3),
  tags         text[] default '{}',
  created_at   timestamptz default now()
);

-- 풀이 기록 테이블 (나중에 로그인 기능 추가 시 user_id 컬럼 추가)
create table if not exists trainer_attempts (
  id               uuid primary key default gen_random_uuid(),
  problem_id       text references trainer_problems(id) on delete cascade,
  circuit_answers  jsonb default '{}',
  tc_answers       jsonb default '{}',
  circuit_score    jsonb,   -- {correct: int, total: int}
  tc_score         jsonb,
  completed_at     timestamptz default now()
);

-- 로컬 problems.ts → DB 마이그레이션 함수 예시
-- (Node.js 스크립트로 실행: ts-node scripts/migrate-problems.ts)
--
-- import { supabase } from '../lib/supabase'
-- import { PROBLEMS } from '../lib/trainer/problems'
-- const { error } = await supabase.from('trainer_problems').upsert(PROBLEMS)

-- ============================================================
-- DB 전환 후 lib/trainer/problems.ts 대신 이걸로 교체:
-- ============================================================
-- app/tools/trainer/page.tsx 상단에서:
--
-- import { supabase } from '@/lib/supabase'
-- const { data: problems } = await supabase
--   .from('trainer_problems')
--   .select('*')
--   .order('created_at')
