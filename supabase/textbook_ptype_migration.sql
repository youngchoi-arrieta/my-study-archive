-- 문제 유형 태깅 컬럼 추가
-- N제 교재
alter table textbook_problems add column if not exists ptype text;  -- fill|calc|truefalse|etc

-- 덴켄3종 기출 (機械)
alter table denken_kikai_answers add column if not exists ptype text;
