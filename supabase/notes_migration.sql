-- =====================================================================
--  서가 (書架) — /notes
--  클로드와 대화해서 만든 PDF 노트를 꽂아두는 곳.
--  생각은 대화에서 정리하고, 앱은 결과를 보관하고 다시 찾는 데만 쓴다.
--
--  notes            노트 한 권 = PDF 한 개 (+ 선택: 인터랙티브 HTML 위젯)
--  note_tags        내가 자유롭게 추가·이름변경·색변경·삭제하는 태그
--  note_tag_links   노트 ↔ 태그 (여러 개)
--  storage 'notes'  비공개 버킷. 화면에는 서명 URL로만 연다.
--
--  RLS: _new_table_template.sql 규칙대로 처음부터 켠다.
--  여러 번 실행해도 안전하다.
-- =====================================================================

-- 1) 노트 ---------------------------------------------------------------
create table if not exists public.notes (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  made_on      date not null default current_date,
  summary      text,                                  -- 요지 (보통 3줄)
  series       text,                                  -- 허브 · 배전망ESS · 마이크로그리드 …
  ver          int  not null default 1,
  scope        text not null default 'personal',      -- personal | company
  pdf_path     text,                                  -- 'pdf/<uuid>.pdf'  (company면 null)
  widget_path  text,                                  -- 'widget/<uuid>.html' (선택)
  file_name    text,                                  -- 올릴 때 원래 파일명 (참고용)
  file_hash    text unique,                           -- 같은 파일 두 번 올리기 방지
  pages        int,
  body_text    text,                                  -- 본문 검색용 (pdf.js 추출)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint notes_scope_chk check (scope in ('personal', 'company'))
);
create index if not exists notes_made_on_idx on public.notes (made_on desc, created_at desc);
create index if not exists notes_series_idx  on public.notes (series);

alter table public.notes enable row level security;
drop policy if exists owner_all on public.notes;
create policy owner_all on public.notes for all to authenticated using (true) with check (true);

-- 2) 태그 ---------------------------------------------------------------
create table if not exists public.note_tags (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  color       text not null default '#85B7EB',
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);
-- 대소문자·공백 차이로 같은 태그가 두 개 생기지 않게
create unique index if not exists note_tags_label_uq on public.note_tags (lower(trim(label)));

alter table public.note_tags enable row level security;
drop policy if exists owner_all on public.note_tags;
create policy owner_all on public.note_tags for all to authenticated using (true) with check (true);

-- 3) 노트 ↔ 태그 --------------------------------------------------------
--    노트나 태그를 지우면 연결도 같이 사라진다 (노트 자체는 태그 삭제로 안 지워짐).
create table if not exists public.note_tag_links (
  note_id  uuid not null references public.notes(id)     on delete cascade,
  tag_id   uuid not null references public.note_tags(id) on delete cascade,
  primary key (note_id, tag_id)
);
create index if not exists note_tag_links_tag_idx on public.note_tag_links (tag_id);

alter table public.note_tag_links enable row level security;
drop policy if exists owner_all on public.note_tag_links;
create policy owner_all on public.note_tag_links for all to authenticated using (true) with check (true);

-- 4) 기본 태그 — 전부 앱에서 바꾸고 지울 수 있다 ---------------------------
insert into public.note_tags (label, color, sort_order) values
  ('회사생활',   '#5DCAA5', 0),
  ('프로젝트',   '#85B7EB', 1),
  ('조직동역학', '#F0997B', 2),
  ('기술',       '#A78BFA', 3)
on conflict do nothing;

-- 5) 비공개 버킷 'notes' --------------------------------------------------
--    파일 하나 최대 50MB. 공개 아님 → 주소를 알아도 로그인 없이 못 연다.
insert into storage.buckets (id, name, public, file_size_limit)
values ('notes', 'notes', false, 52428800)
on conflict (id) do update set public = false;

-- 기존 owner_all_objects 정책(card-images·session-photos·memorias)은 그대로 두고
-- notes 버킷 전용 정책을 하나 더한다. 정책끼리는 OR 로 합쳐진다.
drop policy if exists owner_notes_objects on storage.objects;
create policy owner_notes_objects on storage.objects
  for all to authenticated
  using      (bucket_id = 'notes')
  with check (bucket_id = 'notes');

-- 6) 확인 — 둘 다 0행이면 성공 -------------------------------------------
select tablename from pg_tables
 where schemaname = 'public' and rowsecurity = false;
select id from storage.buckets where id = 'notes' and public = true;
