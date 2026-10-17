-- =====================================================================
--  서가 태그 v2 — 성격 / 주제 두 묶음 + 추천 태그셋
--
--  성격 (하나만)  통찰 · 로드맵 · 분석 · 설계 · 도구 · 문헌
--  주제 (여러 개) 조직 · 배전망ESS · 테스트벤치 · KERI알고리즘 · 마이크로그리드·인버터
--
--  1) note_tags 에 grp 열 추가 ('type' = 성격, 'topic' = 주제, null = 기타)
--  2) 예전 기본 태그 4개(회사생활·프로젝트·조직동역학·기술) 중
--     아직 어느 노트에도 안 붙은 것만 지운다. 붙어 있으면 '기타'로 남는다
--     → 앱의 「✎ 태그 편집·삭제」에서 마저 지우거나 묶음을 바꾸면 된다.
--  3) 추천 태그 11개를 넣는다. 같은 이름이 이미 있으면 묶음만 맞춘다.
--  여러 번 실행해도 안전하다.
-- =====================================================================

-- 1) 묶음 열 -------------------------------------------------------------
alter table public.note_tags add column if not exists grp text;
alter table public.note_tags drop constraint if exists note_tags_grp_chk;
alter table public.note_tags add constraint note_tags_grp_chk check (grp is null or grp in ('type', 'topic'));

-- 2) 예전 기본 태그 정리 (안 쓰인 것만) -----------------------------------
delete from public.note_tags t
 where t.label in ('회사생활', '프로젝트', '조직동역학', '기술')
   and not exists (select 1 from public.note_tag_links l where l.tag_id = t.id);

-- 3) 추천 태그셋 ---------------------------------------------------------
with rec(label, grp, color, ord) as (values
  ('통찰',                  'type',  '#F0997B',  0),
  ('로드맵',                'type',  '#85B7EB',  1),
  ('분석',                  'type',  '#A78BFA',  2),
  ('설계',                  'type',  '#34D399',  3),
  ('도구',                  'type',  '#E0B341',  4),
  ('문헌',                  'type',  '#94A3B8',  5),
  ('조직',                  'topic', '#F472B6',  0),
  ('배전망ESS',             'topic', '#5DCAA5',  1),
  ('테스트벤치',            'topic', '#85B7EB',  2),
  ('KERI알고리즘',          'topic', '#A78BFA',  3),
  ('마이크로그리드·인버터', 'topic', '#E0B341',  4)
)
insert into public.note_tags (label, grp, color, sort_order)
select label, grp, color, ord from rec
on conflict do nothing;

update public.note_tags t set grp = r.grp
  from (values
    ('통찰','type'),('로드맵','type'),('분석','type'),('설계','type'),('도구','type'),('문헌','type'),
    ('조직','topic'),('배전망ESS','topic'),('테스트벤치','topic'),('KERI알고리즘','topic'),('마이크로그리드·인버터','topic')
  ) as r(label, grp)
 where lower(trim(t.label)) = lower(r.label) and t.grp is distinct from r.grp;

-- 4) 확인 — 묶음별 태그 ---------------------------------------------------
select coalesce(grp, '(기타)') as grp, string_agg(label, ' · ' order by sort_order) as tags
  from public.note_tags group by grp order by grp nulls last;
