-- 공기업별 자료 PDF 링크
-- ===================================================================
-- 채용공고 · 직무기술서 · 외국어 성적 환산표 · 서류심사 배점표처럼
-- 회차마다 다시 꺼내 보게 되는 문서를 기업 카드 안에 붙여둔다.
-- 파일을 올리는 게 아니라 구글 드라이브 링크를 저장한다.
--
--   kind : notice(채용공고) | jd(직무기술서) | rubric(배점표)
--          lang(어학 환산표) | essay(자소서 문항) | etc(기타)

create table if not exists kp_docs (
  id          uuid primary key default gen_random_uuid(),
  company_id  text not null,
  kind        text not null default 'etc',
  title       text not null,
  url         text not null,
  note        text,                -- 회차·연도 등
  sort_order  int  not null default 0,
  updated_at  timestamptz default now()
);

create index if not exists kp_docs_company_idx on kp_docs (company_id, kind, sort_order);

alter table kp_docs disable row level security;

-- 확인
--   select company_id, kind, title from kp_docs order by company_id, sort_order;
