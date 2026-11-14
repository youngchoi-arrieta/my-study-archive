-- =====================================================================
--  병기고 (兵器庫 · Armory) — /armory
--  MIL·SIL HTML Lab 을 '기체(마크)' 단위로 보관하고,
--  리비전마다 [실행 HTML · 소스 zip · 제1원리 노트 PDF] 세 칸을 한 번에 입고한다.
--  회사로는 '소화' 체크를 다 통과한 리비전만 '출고'한다 (출고 대장에 기록).
--
--  arm_units       기체 한 벌 = Mk 하나 (기능시험 놀이터, MG 운전 놀이터 …)
--  arm_revisions   기체의 리비전 (v8.3, E6.3 …) — 파일 세 칸 + 소화 체크 + 보관처
--  arm_releases    출고 대장 — 언제 · 누구에게 · 어떤 형태로 내보냈나
--  arm_unit_notes  기체 ↔ 서가 노트(PDF 보고서) 연결
--  storage 'armory' 비공개 버킷
--
--  RLS: _new_table_template.sql 규칙대로 처음부터 켠다.
--  여러 번 실행해도 안전하다. (notes_migration.sql 을 먼저 실행해 둘 것)
-- =====================================================================

-- 1) 기체 ---------------------------------------------------------------
create table if not exists public.arm_units (
  id             uuid primary key default gen_random_uuid(),
  code           text,                                   -- 'Mk1' … (비워도 됨 = 미배정)
  name           text not null,
  family         text,                                   -- 계열: 증명·시험 / 운전·제어 / 보호 / 통신 / 시장·VPP / 코어 …
  status         text not null default 'concept',        -- concept | building | active | retired
  summary        text,                                   -- 한 줄 임무
  origin_project text,                                   -- 출발 프로젝트 (motivated project)
  standards      text,                                   -- 대응 표준 (KSGA-025-15-5-2, IEEE 1547 …)
  refs           text,                                   -- 참조문헌
  parent_id      uuid references public.arm_units(id) on delete set null,  -- 계승한 이전 마크
  on_core        boolean not null default false,         -- 공통 코어(판정기·신호사전·manifest) 장착 여부
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint arm_units_status_chk check (status in ('concept', 'building', 'active', 'retired'))
);
create index if not exists arm_units_sort_idx on public.arm_units (sort_order, created_at);

alter table public.arm_units enable row level security;
drop policy if exists owner_all on public.arm_units;
create policy owner_all on public.arm_units for all to authenticated using (true) with check (true);

-- 2) 리비전 -------------------------------------------------------------
--    keep = 'home'    집 원본. 파일 세 칸을 비공개 버킷에 올린다.
--    keep = 'company' 회사 보관. 회사 자료가 들어 있어 파일은 회사 PC 에만 — 카드만 남긴다.
create table if not exists public.arm_revisions (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid not null references public.arm_units(id) on delete cascade,
  ver          text not null,
  made_on      date not null default current_date,
  changelog    text,
  keep         text not null default 'home',
  html_path    text,  html_name text,  html_size bigint,
  zip_path     text,  zip_name  text,  zip_size  bigint,
  zip_listing  jsonb,                                    -- zip 안의 파일 이름 목록 (브라우저에서 읽음)
  note_path    text,  note_name text,  note_pages int,   -- 제1원리 노트 PDF
  digest       jsonb not null default '{}'::jsonb,       -- 소화 체크 { key: true }
  digested_at  timestamptz,                              -- 소화 체크를 다 채운 시각
  created_at   timestamptz not null default now(),
  constraint arm_revisions_keep_chk check (keep in ('home', 'company'))
);
create index if not exists arm_revisions_unit_idx on public.arm_revisions (unit_id, made_on desc, created_at desc);

alter table public.arm_revisions enable row level security;
drop policy if exists owner_all on public.arm_revisions;
create policy owner_all on public.arm_revisions for all to authenticated using (true) with check (true);

-- 3) 출고 대장 ----------------------------------------------------------
create table if not exists public.arm_releases (
  id           uuid primary key default gen_random_uuid(),
  revision_id  uuid not null references public.arm_revisions(id) on delete cascade,
  released_on  date not null default current_date,
  target       text not null,                            -- 받는 곳: 동욱 님 / 에너지기술부 공유드라이브 / 주간회의 시연 …
  form         text not null,                            -- HTML · 소스 zip · 사내판 PDF · 시연
  memo         text,
  created_at   timestamptz not null default now()
);
create index if not exists arm_releases_rev_idx on public.arm_releases (revision_id, released_on desc);

alter table public.arm_releases enable row level security;
drop policy if exists owner_all on public.arm_releases;
create policy owner_all on public.arm_releases for all to authenticated using (true) with check (true);

-- 4) 기체 ↔ 서가 노트 ----------------------------------------------------
create table if not exists public.arm_unit_notes (
  unit_id  uuid not null references public.arm_units(id) on delete cascade,
  note_id  uuid not null references public.notes(id)     on delete cascade,
  primary key (unit_id, note_id)
);
alter table public.arm_unit_notes enable row level security;
drop policy if exists owner_all on public.arm_unit_notes;
create policy owner_all on public.arm_unit_notes for all to authenticated using (true) with check (true);

-- 5) 비공개 버킷 'armory' -------------------------------------------------
--    파일 하나 최대 50MB (Supabase 무료 요금제 상한).
insert into storage.buckets (id, name, public, file_size_limit)
values ('armory', 'armory', false, 52428800)
on conflict (id) do update set public = false;

drop policy if exists owner_armory_objects on storage.objects;
create policy owner_armory_objects on storage.objects
  for all to authenticated
  using      (bucket_id = 'armory')
  with check (bucket_id = 'armory');

-- 6) 첫 기체 목록 — 마크 계보(2026-11-05) + 이후 생긴 놀이터 ----------------
--    기체가 하나도 없을 때만 넣는다. 이름·번호·계열은 전부 앱에서 고칠 수 있다.
do $$
begin
  if not exists (select 1 from public.arm_units) then
    insert into public.arm_units (code, name, family, status, summary, origin_project, standards, on_core, sort_order) values
      ('Mk1', '기능시험 놀이터',        '증명·시험', 'active',   '절차서대로 배전망 ESS 기능시험 데이터를 획득하는 MIL (E6 엔진)', '배전망 ESS 기능시험', 'KSGA-025-15-5-2', false, 1),
      ('Mk2', 'MG 운전 놀이터',         '운전·제어', 'active',   '마이크로그리드 계통연계 ↔ 단독운전 전환과 PMS 운영 알고리즘',     '육군 MG (공병학교 정전 대비)', 'IEEE 1547 · IEEE 2030.7/8', false, 2),
      ('Mk3', 'ESS 열폭주 보호 놀이터', '보호',      'active',   '열폭주 징후 → PMS 대응 → 기록, 보호가 모든 운전 모드를 이기는 우선순위', 'ESS 화재 안전', 'UL 9540A (참고)', false, 3),
      ('Mk4', 'PCS 응동 MIL',           '증명·시험', 'active',   'FR 제어기·LPMS 기반 PCS 응동시간 판정',                         '응동시험 (현대플라스포)', 'GS-6130-0060', false, 4),
      ('Mk5', '통신 시운전 방탈출',     '통신',      'active',   'Modbus · DNP3 · IEC 61850 통신 시운전을 가상으로',              '통신 시운전', 'IEC 61850 · DNP3 · Modbus', false, 5),
      ('Mk6', '공통 코어',              '코어',      'building', '판정기 · 신호 사전 · 타이밍 버스 · manifest(증명 묶음)',          '놀이터 시리즈 유지 부담', null, false, 6),
      ('Mk7', '중앙계약시장 BESS',      '시장·VPP',  'active',   '입찰 놀이터 + 열화 장부 간이판 — 급전지시 이행 vs SOC·보호',     '중앙계약시장 입찰', null, true, 7),
      ('Mk8', '열폭주 보호 v3 증명형',  '보호',      'concept',  'Mk3 엔진 그대로 + 시나리오 판정식, Mk2·Mk7 에 신호 주입',        'ESS 화재 안전', null, true, 8),
      ('Mk9', 'VPP 놀이터',             '시장·VPP',  'building', 'VPP 절차 + 입찰 경제 통합',                                       'VPP', null, true, 9),
      (null,  '피크저감 놀이터',        '운전·제어', 'active',   '정전 예비 · 목표 T · MESSIS 현행을 실부하로',                    'MESSIS 피크저감', null, false, 20),
      (null,  'AIDC 부하 지연예산 판정기', '부하',   'concept',  '계통측 램프·진동 한도를 지키는 제어 경로 허용 지연 판정',          'AIDC UC ESS 검토', null, false, 21),
      (null,  'ESS 현장 시뮬레이터',    '현장',      'concept',  '전기설비 도감을 MIL 로 — 현장 가기 전 비행 시뮬레이터',            'ESS·EMS·PMS 전기설비 도감', null, false, 22);

    update public.arm_units c set parent_id = p.id
      from public.arm_units p where c.code = 'Mk8' and p.code = 'Mk3';
  end if;
end $$;

-- 7) 확인 — 둘 다 0행이면 성공 -------------------------------------------
select tablename from pg_tables
 where schemaname = 'public' and rowsecurity = false and tablename like 'arm_%';
select id from storage.buckets where id = 'armory' and public = true;
