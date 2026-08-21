-- 공기업 필기(NCS 영역 · 시험시간) + 교재 진도
-- ===================================================================
-- koreapub_migration.sql 을 먼저 실행한 뒤 이 파일을 실행하세요.
--
--   kp_ncs    기업별 NCS 영역 채택 여부 · 문항수 · 시험시간
--   kp_books  교재 (NCS · 전공 · 한국사 …) — JLPT jp_books 와 같은 모양
--   kp_nodes  교재 안의 목차 트리 — JLPT jp_nodes 와 같은 모양


-- ── ① NCS 영역 매트릭스 + 필기 시험시간 ──────────────────────────
-- areas 는 이런 모양의 jsonb:
--   { "comm": {"on": true, "q": 10}, "math": {"on": true, "q": null}, ... }
-- 키는 lib/constants-koreapub-ncs.ts 의 NcsAreaKey 10종:
--   comm 의사소통 · math 수리 · solve 문제해결 · resource 자원관리 ·
--   info 정보 · tech 기술 · org 조직이해 · self 자기개발 ·
--   people 대인관계 · ethic 직업윤리
--
-- 값은 전부 공고를 보고 손으로 넣는다. 여기에 시드 데이터를 넣지 않는 이유:
-- 영역 구성은 기업마다 다르고 회차마다 바뀌어서, 미리 채워두면
-- "확인했다고 착각한 값"이 남는다. 빈 칸이 낫다.

create table if not exists kp_ncs (
  company_id  text primary key,          -- COMPANIES 의 id (또는 직접 추가한 기업 슬러그)
  areas       jsonb not null default '{}'::jsonb,

  ncs_q       int,                       -- NCS 직업기초 문항수
  ncs_min     int,                       -- NCS 시간(분)
  major_q     int,                       -- 전공(직무수행) 문항수
  major_min   int,                       -- 전공 시간(분)

  ncs_label   text,                      -- NCS 과목명 (기업마다 다름: 직무능력검사 등)
  major_label text,                      -- 전공 과목명
  extras      jsonb not null default '[]'::jsonb,  -- 추가 과목 [{label,q,min}, ...]

  extra_label text,                      -- (레거시) 단일 제3과목
  extra_q     int,
  extra_min   int,

  combined    boolean not null default false,  -- NCS+전공 통합 교시
  total_min   int,                       -- 통합 시간을 공고가 못박은 경우
  cutoff      text,                      -- 과락 규정 원문
  memo        text,                      -- 회차 · 공고 출처

  updated_at  timestamptz default now()
);

-- 이미 만들어 둔 테이블에 뒤늦게 붙이는 경우
alter table kp_ncs add column if not exists ncs_label   text;
alter table kp_ncs add column if not exists major_label text;
alter table kp_ncs add column if not exists extras      jsonb not null default '[]'::jsonb;

alter table kp_ncs disable row level security;


-- ── ② 교재 ───────────────────────────────────────────────────────
-- 상태 3단은 JLPT 교재(jp_books.status)와 같은 축을 쓴다.
--   active 진행중 / planned 예정 / done 완료

create table if not exists kp_books (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  tag               text,                       -- NCS · 전공(전기) · 한국사 …
  color             text not null default '#2563eb',
  sort_order        int  not null default 0,
  status            text not null default 'active',
  status_updated_at timestamptz,
  created_at        timestamptz default now()
);

do $$
begin
  alter table kp_books
    add constraint kp_books_status_check
    check (status in ('active', 'planned', 'done'));
exception
  when duplicate_object then null;
end $$;

create index if not exists kp_books_status_idx on kp_books (status, sort_order);


-- ── ③ 교재 목차 트리 ─────────────────────────────────────────────
-- parent_id 로 무한 깊이. 말단(자식 없는) 노드만 진도로 센다.
--   status 0 미완 / 1 완료 / 2 약점
-- JLPT 쪽은 cascade 가 없어서 앱이 아래층부터 지우고 있는데,
-- 여기는 처음부터 걸어둔다. (앱 코드는 어느 쪽이든 통과하도록 짜여 있다)

create table if not exists kp_nodes (
  id         uuid primary key default gen_random_uuid(),
  book_id    uuid not null references kp_books(id) on delete cascade,
  parent_id  uuid references kp_nodes(id) on delete cascade,
  title      text not null,
  sort_order int  not null default 0,
  status     smallint not null default 0,
  memo       text,
  created_at timestamptz default now()
);

create index if not exists kp_nodes_book_idx   on kp_nodes (book_id, parent_id, sort_order);
create index if not exists kp_nodes_parent_idx on kp_nodes (parent_id);

alter table kp_books disable row level security;
alter table kp_nodes disable row level security;


-- ── 확인 ─────────────────────────────────────────────────────────
--   select company_id, jsonb_object_keys(areas) from kp_ncs;
--   select b.title, b.status, count(n.id)
--     from kp_books b left join kp_nodes n on n.book_id = b.id
--    group by b.id order by b.sort_order;
