-- ============================================================
--  회사생활 (会社生活) 섹션 — /dashboard/company
--  퇴근 후 반성용. 회사에서는 열지 않는 개인 앱.
--
--  두 계열로 나뉜다.
--    매일   오늘 · 업무일지 · 업무일정(간트)
--    상시   나침반(목표이력서·이해관계 벤·일의 사분면) · 포트폴리오
--    보류   사람 (앱 안 잠금 + 사실 필드만)
--
--  기존 관례를 따른다: text PK(gen_random_uuid 캐스팅), updated_at 수동,
--  RLS 비활성, 클라이언트 필터. tl_events 를 co_events 로 복제.
-- ============================================================

-- 1) co_items ─ '오늘' 탭의 세 리스트 + 북극성을 한 테이블로
--    group: north(단 하나의 기준) / prep(위생·준비, 매일 체크) /
--           avoid(하지 말 것) / strive(하려 할 것)
--    mode : check(매일 탭) / remind(고정 리마인더, 체크 없음)
create table if not exists co_items (
  id          text primary key default gen_random_uuid()::text,
  grp         text not null,                 -- north | prep | avoid | strive
  mode        text not null default 'remind',-- check | remind
  label       text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true,
  updated_at  timestamptz default now()
);
create index if not exists co_items_grp_idx on co_items (grp, sort_order);
alter table co_items disable row level security;

-- 2) co_days ─ 하루 한 행. 체크 상태(jsonb) + 저녁 반성(삼분법)
--    checks: { itemId: true }  (mode=check 항목만)
--    distress/locus/note = 저녁 반성. 자책 아님. 감정 아닌 분류.
create table if not exists co_days (
  day         date primary key,
  checks      jsonb not null default '{}'::jsonb,
  intent      text,                          -- 오늘의 한 줄 (선택)
  distress    boolean,                       -- 오늘 괴로운 일 있었나
  locus       text,                          -- mine | half | theirs
  note        text,                          -- 한 줄 (선택)
  updated_at  timestamptz default now()
);
alter table co_days disable row level security;

-- 3) co_journal ─ 업무일지. 빠른 기록.
--    kind: 지시 | 상호작용 | 관찰 | 메모
--    action_needed=true & resolved=false → '오늘' 상단 미완료 지시로 노출
create table if not exists co_journal (
  id            text primary key default gen_random_uuid()::text,
  day           date not null default current_date,
  kind          text not null default '관찰',
  person        text,                        -- 선택 (자유 입력)
  body          text not null,
  action_needed boolean not null default false,
  resolved      boolean not null default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index if not exists co_journal_day_idx on co_journal (day desc);
alter table co_journal disable row level security;

-- 4) co_events ─ 업무 간트. tl_events 양식 복제(reg_* → start/end, exam → milestone)
--    track: onboard | project | delivery | trip | review | etc
create table if not exists co_events (
  id          text primary key default gen_random_uuid()::text,
  track       text not null default 'project',
  title       text not null,
  start_date  date,
  end_date    date,
  milestone   date,                          -- ◆ 표시
  note        text,
  done        boolean not null default false,
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);
create index if not exists co_events_track_idx on co_events (track, sort_order);
alter table co_events disable row level security;

-- ── 나침반 (상시) ───────────────────────────────────────────

-- 5) co_resume ─ 목표 이력서. status가 ✓ 아닌 것이 "다음에 확보할 것".
--    section: output | field | cert | education | narrative
--    status : done(✓) | progress(◐) | target(○)
--    tag    : scholar(장학-서사) | life(생활) | null
create table if not exists co_resume (
  id          text primary key default gen_random_uuid()::text,
  section     text not null,
  label       text not null,
  status      text not null default 'target',
  tag         text,
  link        text,
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);
create index if not exists co_resume_section_idx on co_resume (section, sort_order);
alter table co_resume disable row level security;

-- 6) co_venn ─ 이해관계 벤다이어그램
--    side: company(회사가 얻는 것) | me(내가 얻는 것) | overlap(교집합)
create table if not exists co_venn (
  id          text primary key default gen_random_uuid()::text,
  side        text not null,
  label       text not null,
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);
create index if not exists co_venn_side_idx on co_venn (side, sort_order);
alter table co_venn disable row level security;

-- 7) co_quadrant ─ 일의 사분면 (9/19 축)
--    가로 = 회사 중요도(important), 세로 = 경쟁 적음/무용지용(uncontested)
--    노리는 칸 = important && uncontested
create table if not exists co_quadrant (
  id          text primary key default gen_random_uuid()::text,
  label       text not null,
  important   boolean not null default false,
  uncontested boolean not null default false,
  growth      boolean not null default false, -- 내 성장(이력서 기여) — 색/태그용
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);
alter table co_quadrant disable row level security;

-- ── 포트폴리오 (상시) ───────────────────────────────────────

-- 8) co_projects ─ 프로젝트 실적. site·MW/MWh·역할 (목표 이력서 재료)
create table if not exists co_projects (
  id          text primary key default gen_random_uuid()::text,
  site        text not null,
  scale       text,                          -- MW / MWh
  role        text,
  period      text,
  note        text,
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);
alter table co_projects disable row level security;

-- 9) co_outputs ─ 산출물 아카이브(기술기획메모·테스트벤치·오픈소스)
create table if not exists co_outputs (
  id          text primary key default gen_random_uuid()::text,
  title       text not null,
  kind        text not null default '문서',   -- 오픈소스 | 문서 | 테스트벤치 | 기타
  status      text not null default 'progress',
  link        text,
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);
alter table co_outputs disable row level security;

-- 10) co_watch ─ 업계 동향 관찰 채널
--     layer: 제조 | EPC | 운영 | 정책
create table if not exists co_watch (
  id          text primary key default gen_random_uuid()::text,
  channel     text not null,
  url         text,
  cadence     text,                          -- 매일 | 수시 | 분기 등
  layer       text,
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);
alter table co_watch disable row level security;

-- 11) co_people ─ 사람. 앱 안 잠금 뒤에서만 열림. 평가 아닌 사실 필드.
create table if not exists co_people (
  id          text primary key default gen_random_uuid()::text,
  name        text not null,
  role        text,                          -- 직급·부서 (사실)
  strengths   text,                          -- 강점·특기 (사실)
  cautions    text,                          -- 주의점 (사실·맥락만, 험담 금지)
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);
alter table co_people disable row level security;

-- ============================================================
--  시드 — 지금까지 대화에서 확정한 내용. 전부 앱에서 편집 가능.
-- ============================================================

insert into co_items (grp, mode, label, sort_order) values
  ('north',  'remind', '정확한 신호가 되기 — 본 대로, 한 만큼, 모르면 모른다고', 0),
  ('prep',   'check',  '씻고 단정하게', 0),
  ('prep',   'check',  '5분 일찍 도착', 1),
  ('prep',   'check',  '오늘 할 일 3개 이하로', 2),
  ('avoid',  'remind', '아는 티 내지 않기', 0),
  ('avoid',  'remind', '지식으로 맞붙지 않기 (특히 상무)', 1),
  ('avoid',  'remind', '편들거나 험담에 끼지 않기', 2),
  ('avoid',  'remind', '뼈에 정색·반격하지 않기', 3),
  ('avoid',  'remind', '사생활 깊은 층은 웃으며 흘리기', 4),
  ('avoid',  'remind', '혼자 밤새우지 않기', 5),
  ('avoid',  'remind', '아직 안 온 일 며칠씩 시뮬레이션하지 않기', 6),
  ('strive', 'remind', '받은 지시 요약해 되짚기', 0),
  ('strive', 'remind', '8년차한테 먼저 낮춰 묻기', 1),
  ('strive', 'remind', '상무 방향에 정렬해 조용히 성과 얹기', 2),
  ('strive', 'remind', '판단 보류하고 관찰하기', 3),
  ('strive', 'remind', '담배 대신 바람은 같이 쐬기', 4),
  ('strive', 'remind', '하루 한 줄 업무일지', 5),
  ('strive', 'remind', '정시 퇴근 기본값', 6)
on conflict do nothing;

insert into co_resume (section, label, status, tag, sort_order) values
  ('output', 'Nano Letters 1저자 논문', 'done', 'scholar', 0),
  ('output', 'SimpleBESS — SimSES 한국 계통·시장 fork', 'target', 'scholar', 1),
  ('output', '계통연계 국제규정 비교집', 'target', 'scholar', 2),
  ('output', '최적화·제어·전력전자 시뮬 학습노트', 'progress', 'scholar', 3),
  ('field',  '사이트 BESS 시운전 기록', 'progress', 'scholar', 0),
  ('field',  '도면 분석 및 보호계전 실습', 'progress', 'scholar', 1),
  ('field',  '전기·통신 계측 실습', 'progress', 'scholar', 2),
  ('cert',   '전기기사', 'done', null, 0),
  ('cert',   '전기기능사', 'done', null, 1),
  ('cert',   'TOEFL 109 · OPIc AL', 'done', 'scholar', 2),
  ('cert',   '덴켄 1~3종', 'target', 'life', 3),
  ('cert',   'ISA CAP (제어·자동화)', 'target', 'scholar', 4),
  ('cert',   'INCOSE ASEP (시스템 엔지니어링)', 'target', 'scholar', 5),
  ('cert',   'CCNA (네트워크)', 'target', 'scholar', 6),
  ('cert',   '정보처리기사', 'target', 'scholar', 7),
  ('cert',   '정보통신기사', 'target', 'scholar', 8),
  ('cert',   '공조냉동기사', 'target', 'scholar', 9),
  ('cert',   'FP · 일상부기(日商簿記)', 'target', 'life', 10),
  ('education', 'CU Boulder 전력전자 (Coursera)', 'progress', 'scholar', 0),
  ('narrative', '물리에서 응용·공학으로 의도적 피벗 — 오픈소스·현장·시뮬로 증명', 'target', 'scholar', 0)
on conflict do nothing;

insert into co_venn (side, label, sort_order) values
  ('company', '시운전 인력', 0),
  ('company', '제어↔IT 경계 문제 해결', 1),
  ('company', 'AI 제어 접목', 2),
  ('me', 'NTIS 참여연구원 기록', 0),
  ('me', '현장 시운전 경험 (site·MW·역할)', 1),
  ('me', '기술 스택 · 네트워크', 2),
  ('overlap', 'EMS 통합 검증 프레임 (회사도 나도 이득)', 0)
on conflict do nothing;

insert into co_quadrant (label, important, uncontested, growth, sort_order) values
  ('현장 시운전', true, true, true, 0),
  ('운영 데이터 정리', true, true, false, 1),
  ('영문 자료 · 규정 번역', true, true, true, 2)
on conflict do nothing;

insert into co_watch (channel, url, cadence, layer, sort_order) values
  ('전기신문', 'https://www.electimes.com', '매일', '운영', 0),
  ('전력거래소 공고', 'https://www.kpx.or.kr', '수시', 'EPC', 1),
  ('기후에너지환경부 보도자료', 'https://www.mcee.go.kr', '수시', '정책', 2),
  ('DART 수주공시 (LS·효성·HD현대일렉)', 'https://dart.fss.or.kr', '수시', 'EPC', 3),
  ('그리드포밍 요건 (2027.12 적용)', null, '분기', '정책', 4)
on conflict do nothing;

insert into co_outputs (title, kind, status, sort_order) values
  ('대건 기술기획 메모 (국책과제 대비)', '문서', 'progress', 0),
  ('SimpleBESS (오픈소스)', '오픈소스', 'target', 1),
  ('저비용 BESS 테스트벤치 (LiFePO4·Modbus BMS·PLC·Ignition)', '테스트벤치', 'target', 2)
on conflict do nothing;
