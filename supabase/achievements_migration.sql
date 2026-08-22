-- Achievements — 해낸 것들의 연표
-- ===================================================================
-- 대시보드가 아니다. 진행률도 다음 목표도 없다.
-- 힘들 때 열어서 "이만큼은 해냈다"를 눈으로 확인하는 자리다.
--
-- 증빙 PDF(자격증·성적표)는 구글 드라이브에 올리고 링크만 건다.
-- 앱은 파일을 보관하지 않는다.

create table if not exists achievements (
  id           uuid primary key default gen_random_uuid(),
  happened_on  date not null,              -- 취득일·발표일. 연표의 축
  title        text not null,              -- '전기기사', '第二種電気工事士'
  kind         text not null default 'cert',
                                           -- cert 자격증 / language 어학 /
                                           -- academic 학위 / paper 논문 /
                                           -- milestone 그 밖의 이정표
  issuer       text,                       -- '한국산업인력공단', '電気技術者試験センター'
  score        text,                       -- '실기 84점', 'N3 합격', '95점'
  ref_no       text,                       -- 자격증번호 등
  pdf_url      text,                       -- 구글 드라이브 공유 링크
  note         text,                       -- 그때의 기록. 나중에 읽을 말
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists achievements_date_idx on achievements (happened_on desc);

alter table achievements disable row level security;

-- 확인
--   select happened_on, kind, title, score from achievements order by happened_on;
