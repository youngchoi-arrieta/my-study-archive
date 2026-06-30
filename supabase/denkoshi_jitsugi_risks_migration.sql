-- 第二種電気工事士 技能試験 · 시공 리스크 관리
-- Risk item별 치수 · 시공상 유의사항 · 해당 候補問題(1~13) 태깅
create table if not exists denkoshi_jitsugi_risks (
  id          uuid primary key default gen_random_uuid(),
  item        text not null,                 -- Risk item
  dimension   text default '',               -- 치수 (피복/심선 길이 등)
  caution     text default '',               -- 시공상 유의사항 및 주의할 결함
  problem_nos integer[] default '{}',         -- 해당 候補問題 (1~13)
  sort_order  int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table denkoshi_jitsugi_risks disable row level security;

-- ── 초기 시드 (스프레드시트 전사본) ────────────────────────────────
--  치수·항목명은 신뢰 가능, 후보문제 태깅은 스크린샷 전사라 앱에서 검수 권장.
--  이미 시드를 넣었으면 재실행 시 중복되지 않도록 NOT EXISTS 가드.
insert into denkoshi_jitsugi_risks (item, dimension, caution, problem_nos, sort_order)
select * from (values
  ('引掛シーリング 각형',      '피복 20mm + 심선 10mm (케이블 치수 반영 X)', '', '{1,3,5,6,10,11,12}'::int[],          10),
  ('引掛シーリング 구형',      '피복 20mm + 심선 10mm (케이블 치수 반영 X)', '', '{8,9}'::int[],                       20),
  ('레셉터클(レセプタクル)',    '피복 50mm + 심선 20mm',                  '', '{1,2,3,5,7,8,9,10,11,12,13}'::int[], 30),
  ('노출형 콘센트',            '피복 50mm + 심선 20mm',                  '', '{6}'::int[],                         40),
  ('단자대(端子台)',           '피복 50mm + 심선 10mm',                  '', '{3,4,5,8,13}'::int[],                50),
  ('배선용차단기(配線用遮断器)', '피복 50mm + 심선 10mm',                  '', '{10}'::int[],                        60),
  ('접지콘센트 + 접지선',       '',                                      '', '{4,9,13}'::int[],                    70),
  ('조인트박스 + 고무부싱',     '',                                      '', '{12}'::int[],                        80),
  ('IV선 + 전선관',           '',                                      '', '{11,12}'::int[],                     90),
  ('3로 · 4로 스위치',         '',                                      '', '{6,7}'::int[],                       100),
  ('파일럿램프등',             '',                                      '', '{1,2}'::int[],                       110),
  ('중 size 압착',            '',                                      '', '{}'::int[],                          120),
  ('특수전선 (EM-EEF / VVR2.0-2C / VVF2.0-3C(RGB))', '',                '', '{1,5,8}'::int[],                     130)
) as v(item, dimension, caution, problem_nos, sort_order)
where not exists (select 1 from denkoshi_jitsugi_risks);
