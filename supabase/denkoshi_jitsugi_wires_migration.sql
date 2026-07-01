-- 第二種電気工事士 技能試験 · 전선 종류별 소요량 매트릭스
--  행 = 전선 종류(wire_type), 열 = 候補問題(1~13), 셀 = 소요량.
--  amounts: jsonb 맵 { "問題no": "소요량" }  예: { "1": "250", "4": "1.5m" }
--  앱에서 행 합계를 m 단위로 자동 환산(셀은 mm 기준, m·cm 접미사 인식).
create table if not exists denkoshi_jitsugi_wires (
  id          uuid primary key default gen_random_uuid(),
  wire_type   text not null default '',      -- 전선 종류(행 라벨)
  amounts     jsonb default '{}'::jsonb,      -- { 問題no: 소요량 }
  sort_order  int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table denkoshi_jitsugi_wires disable row level security;

-- ── 기본 전선 목록 시드 (스프레드시트 A열 전사) ─────────────────────
--  소요량(셀)은 비워서 시작 → 앱에서 문제별로 직접 기입.
--  이미 시드가 있으면 재실행해도 중복되지 않도록 NOT EXISTS 가드.
insert into denkoshi_jitsugi_wires (wire_type, amounts, sort_order)
select * from (values
  ('VVF 1.6mm 2심',      '{}'::jsonb, 10),
  ('VVF 1.6mm 3심',      '{}'::jsonb, 20),
  ('VVF 2.0mm 2심',      '{}'::jsonb, 30),
  ('VVF 2.0mm 3심',      '{}'::jsonb, 40),
  ('IV 녹색 (접지선용)',  '{}'::jsonb, 50),
  ('IV 빨간색',          '{}'::jsonb, 60),
  ('IV 검정색',          '{}'::jsonb, 70),
  ('VVR 1.6-2C',        '{}'::jsonb, 80),
  ('VVR 2.0-2C',        '{}'::jsonb, 90),
  ('EM-EEF 2.0-2C',     '{}'::jsonb, 100)
) as v(wire_type, amounts, sort_order)
where not exists (select 1 from denkoshi_jitsugi_wires);
