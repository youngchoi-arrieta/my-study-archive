-- 앞으로 새 테이블을 만들 때마다 create table 바로 뒤에 붙일 두 줄.
-- (예전 마이그레이션의 "disable row level security" 는 더 이상 쓰지 않는다)
alter table public.새테이블 enable row level security;
create policy owner_all on public.새테이블 for all to authenticated using (true) with check (true);
