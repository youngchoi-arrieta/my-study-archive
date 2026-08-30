-- 주요 일정 및 우선순위 · 3층 보드
-- ===================================================================
-- 마인드맵은 걱정을 구조화하는 데는 좋지만 "무엇에 힘을 쓸까"에는
-- 답하지 않는다. 이 보드는 층을 직접 지정하지 않고 계산한다.
--
--   0층 경계조건   fixed = true
--                  우선순위 대상이 아니라 나머지를 푸는 조건.
--   1층 시효       expires_on 또는 decide_by 가 있는 것.
--                  중요도가 아니라 "지금이 아니면 사라지는가"만 본다.
--   2층 공통분모   살아있는 경로 2개 이상에 걸친 것. 매일 힘을 쓰는 칸.
--   3층 단일용도   경로 1개에만 걸린 것. 그 경로가 확정되기 전엔 잠긴다.
--   옆줄 축적      daily = true. 위 네 층과 자원을 다투지 않는다.
--                  자격은 하나 — 매일 20분으로 성립하는가.
--
-- 경로(pr_paths)의 상태가 이 계산의 입력이다.
--   active   확정   → 3층 항목이 열린다
--   hold     보류   → 3층 항목이 잠긴다
--   dropped  접음   → 태그가 죽는다. 걸침 수에서 빠지므로
--                     2층에 있던 항목이 3층으로 내려앉는 게 눈에 보인다.

-- ── 경로 ────────────────────────────────────────────────────────
create table if not exists pr_paths (
  id          text primary key,          -- 슬러그. 'kps', 'japan' 처럼
  label       text not null,
  status      text not null default 'hold',
  color       text not null default '#60a5fa',
  note        text,
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);

do $$
begin
  alter table pr_paths
    add constraint pr_paths_status_check
    check (status in ('active', 'hold', 'dropped'));
exception
  when duplicate_object then null;
end $$;

-- ── 항목 ────────────────────────────────────────────────────────
create table if not exists pr_items (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  note        text,
  fixed       boolean not null default false,   -- 0층
  daily       boolean not null default false,   -- 옆줄
  expires_on  date,                             -- 만료일
  decide_by   date,                             -- 결정시점 (만료일과 다르다)
  done        boolean not null default false,
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);

-- ── 항목 × 경로 ─────────────────────────────────────────────────
create table if not exists pr_item_paths (
  item_id  uuid not null references pr_items (id) on delete cascade,
  path_id  text not null references pr_paths (id) on delete cascade,
  primary key (item_id, path_id)
);

create index if not exists pr_item_paths_path_idx on pr_item_paths (path_id);

-- ── 월간 점검 기록 ──────────────────────────────────────────────
-- 이 보드가 무너진다면 입력이 귀찮아서가 아니라
-- 월말에 열어볼 이유가 없어서 무너진다. 점검 자체를 기록해 둔다.
create table if not exists pr_reviews (
  id           uuid primary key default gen_random_uuid(),
  reviewed_on  date not null default current_date,
  note         text,
  created_at   timestamptz default now()
);

create index if not exists pr_reviews_date_idx on pr_reviews (reviewed_on desc);

alter table pr_paths      disable row level security;
alter table pr_items      disable row level security;
alter table pr_item_paths disable row level security;
alter table pr_reviews    disable row level security;

-- 확인
--   select p.label, p.status, count(ip.item_id)
--   from pr_paths p left join pr_item_paths ip on ip.path_id = p.id
--   group by p.label, p.status order by p.label;
