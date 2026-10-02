-- 기록함 — 어디서든 한 줄로 던져 넣는 곳
-- 규칙 없음: 본문만 필수. 처리하면 done = true.
create table if not exists inbox (
  id          uuid primary key default gen_random_uuid(),
  body        text not null,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists inbox_open_idx on inbox (done, created_at desc);

alter table public.inbox enable row level security;
drop policy if exists owner_all on public.inbox;
create policy owner_all on public.inbox for all to authenticated using (true) with check (true);
