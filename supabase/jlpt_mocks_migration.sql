-- JLPT 모의고사 채점 기록 (N5 / N4 / N3)
-- ===================================================================
-- 시험지 PDF·메모 없이 "채점 결과만" 남기는 가벼운 테이블.
-- 영역 4개(문자·어휘 / 문법 / 독해 / 청해)의 정답수·문항수만 저장하고,
-- 得点区分 합산·합격선 판정은 앱에서 lib/constants-jlpt-mocks.ts 를 보고 계산한다.
-- (문항수를 함께 저장하는 이유: 교재마다 구성이 조금씩 다름)

create table if not exists jlpt_mocks (
  id            uuid primary key default gen_random_uuid(),

  level         text not null,          -- 'n5' | 'n4' | 'n3'
  title         text not null,          -- 교재명 + 회차  예) 해커스 N5 1회
  taken_on      date not null default current_date,

  moji          int not null default 0, -- 문자·어휘 정답수
  moji_total    int not null default 0,
  bunpou        int not null default 0, -- 문법
  bunpou_total  int not null default 0,
  dokkai        int not null default 0, -- 독해
  dokkai_total  int not null default 0,
  choukai       int not null default 0, -- 청해
  choukai_total int not null default 0,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists jlpt_mocks_level_date_idx
  on jlpt_mocks (level, taken_on desc);

alter table jlpt_mocks disable row level security;
