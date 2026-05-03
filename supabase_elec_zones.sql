-- 전기직 지도 데이터 테이블
-- Supabase SQL Editor에서 실행하세요

create table if not exists elec_zones (
  id          text primary key,          -- zone identifier (e.g. 'relay', 'substation')
  data        jsonb not null,            -- full JobZone object as JSON
  updated_at  timestamptz default now()
);

-- RLS 비활성화 (프로젝트 전체 정책과 일치)
alter table elec_zones disable row level security;

-- updated_at 자동 갱신 트리거
create or replace function update_elec_zones_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger elec_zones_updated_at
  before update on elec_zones
  for each row execute function update_elec_zones_updated_at();
