-- 한국 공기업 채용 준비
-- ===================================================================
-- 3개 테이블:
--   kp_specs    내가 가진 스펙 (자격증·어학·한국사…)
--   kp_rubrics  기업별 가점 규칙 덮어쓰기 (공고 보고 직접 수정)
--   kp_mocks    NCS / 전공 / 법령 모의고사 성적
--
-- 기업 목록과 기본 배점은 lib/constants-koreapub.ts 에 있고,
-- kp_rubrics 에 행이 있으면 그쪽이 우선한다.

create table if not exists kp_specs (
  cert_key    text primary key,      -- CERT_CATALOG 의 key
  has         boolean not null default true,
  value       text,                  -- 토익 점수, 한국사 급수 등
  acquired_on date,
  updated_at  timestamptz default now()
);

create table if not exists kp_rubrics (
  company_id  text primary key,      -- COMPANIES 의 id
  bonus_max   int,
  groups      jsonb not null,        -- RuleGroup[] 전체를 통째로 저장
  memo        text,                  -- 공고 URL·회차 등
  updated_at  timestamptz default now()
);

create table if not exists kp_mocks (
  id          uuid primary key default gen_random_uuid(),
  company_id  text,                  -- null = 일반 교재
  title       text not null,
  taken_on    date not null default current_date,

  ncs         int, ncs_total   int,
  major       int, major_total int,
  law         int, law_total   int,

  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists kp_mocks_date_idx on kp_mocks (taken_on desc);

alter table kp_specs   disable row level security;
alter table kp_rubrics disable row level security;
alter table kp_mocks   disable row level security;
