-- 공기업 자기소개서 + 시험 일정 간트
-- ===================================================================
-- koreapub_migration.sql 을 먼저 실행한 뒤 이 파일을 실행하세요.

-- ── 기업별 자기소개서 문항 ──
create table if not exists kp_essays (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null,
  idx         int  not null default 0,      -- 문항 번호
  prompt      text not null,                -- 문항 원문
  body        text,                         -- 내 답안
  min_chars   int,                          -- 500
  max_chars   int,                          -- 1000
  updated_at  timestamptz default now()
);
create index if not exists kp_essays_company_idx on kp_essays (company_id, idx);

-- ── 시험 일정 (간트) ──
-- track: language | kr-license | jp-license | skill | career | public
create table if not exists tl_events (
  id          uuid primary key default gen_random_uuid(),
  track       text not null,
  title       text not null,
  reg_start   date,          -- 원서접수 시작
  reg_end     date,          -- 원서접수 마감
  exam_date   date,          -- 시험일
  note        text,
  done        boolean not null default false,
  sort_order  int not null default 0,
  updated_at  timestamptz default now()
);
create index if not exists tl_events_date_idx on tl_events (exam_date);

alter table kp_essays disable row level security;
alter table tl_events disable row level security;

-- ── 초기 일정 (스프레드시트 기준 · 전부 수정 가능) ──
insert into tl_events (track, title, reg_start, reg_end, exam_date, note, sort_order) values
  ('language','JLPT N3','2026-09-01','2026-09-30','2026-12-06',null,1),
  ('language','JLPT N2','2027-04-01','2027-04-30','2027-07-04',null,2),
  ('language','OPIc',null,null,'2026-08-29',null,3),

  ('kr-license','전기공사기사 필기','2027-01-01','2027-01-31','2027-02-20',null,11),
  ('kr-license','전기공사기사 실기','2027-03-01','2027-03-31','2027-04-20',null,12),
  ('kr-license','정보처리기사 필기','2027-01-01','2027-01-31','2027-02-20',null,13),
  ('kr-license','정보처리기사 실기','2027-03-01','2027-03-31','2027-04-20',null,14),

  ('jp-license','電験三種 (전력·법규)','2026-11-01','2026-11-30','2027-03-15','CBT 기간 응시',21),
  ('jp-license','電験二種 1次','2027-05-01','2027-05-31','2027-08-20',null,22),
  ('jp-license','電験二種 2次','2027-05-01','2027-05-31','2027-11-14',null,23),
  ('jp-license','電験一種 1次','2027-05-01','2027-05-31','2027-08-20',null,24),
  ('jp-license','電験一種 2次','2027-05-01','2027-05-31','2027-11-14',null,25),
  ('jp-license','第一種電気工事士 筆記','2027-02-01','2027-02-28','2027-04-15',null,26),
  ('jp-license','第一種電気工事士 技能','2027-07-01','2027-07-31','2027-11-20',null,27),
  ('jp-license','電気工事施工管理技士 1次',null,null,'2027-07-15',null,28),
  ('jp-license','工事担任者 (総合種) 1회','2027-02-01','2027-02-28','2027-07-15',null,29),
  ('jp-license','工事担任者 (総合種) 2회','2027-08-01','2027-08-31','2027-10-15',null,30),
  ('jp-license','エネルギー管理士 (전기)','2027-04-01','2027-06-30','2027-08-10',null,31),
  ('jp-license','기술사 1차',null,null,'2027-05-15',null,32),

  ('skill','PCQ 3급','2026-09-01','2026-09-15','2026-09-30',null,41),
  ('skill','시퀀스제어 3급','2026-09-01','2026-09-15','2027-01-20',null,42),
  ('skill','실용수학 1급',null,null,'2026-10-15',null,43),

  ('career','공대 학사편입 (부산대/경북대)','2026-12-01','2026-12-31','2027-01-15',null,51),
  ('career','폴리텍 하이테크',null,null,null,'일정 확인 필요',52),

  ('public','한전KPS (하반기)','2026-09-01','2026-09-15',null,'서류 접수',61),
  ('public','한전KPS (상반기)','2027-04-01','2027-04-15',null,'서류 접수',62),
  ('public','한전KPS (하반기)','2027-10-01','2027-10-15',null,'서류 접수',63),
  ('public','한국전기안전공사',null,null,null,'공고 확인 필요',64),
  ('public','코레일 (상반기)',null,null,null,'공고 확인 필요',65)
on conflict do nothing;
