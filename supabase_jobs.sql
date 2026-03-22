-- Supabase SQL Editor에 붙여넣고 실행하세요

create table if not exists jobs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  company text not null,
  role text,
  cat text check (cat in ('top', 'foreign', 'sme', 'dc')) default 'top',
  priority text check (priority in ('high', 'mid', 'low')) default 'mid',
  stage text check (stage in ('watch', 'apply', 'submitted', 'interview', 'offer', 'pass')) default 'watch',
  deadline date,
  url text,
  memo text,
  jp_score numeric(3,1),
  blind_score numeric(3,1)
);

-- RLS 비활성화 (개인 앱이므로 간단하게)
-- 만약 인증(auth)을 추가할 계획이 있으면 아래 주석 해제
-- alter table jobs enable row level security;
-- create policy "all access" on jobs for all using (true);
