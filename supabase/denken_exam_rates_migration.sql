-- 電験三種 회차별 난이도(합격률·합격기준점) 덮어쓰기 테이블
-- 기본값은 lib/constants-denken-rate.ts 의 BASELINE 표에 들어 있고,
-- 이 테이블에는 "고친 값만" 넣는다. null 인 열은 기본값으로 폴백된다.
--
-- 용도 1: 2025年度下期(dk_2026_1) / 2026年度上期(dk_2026_2) 처럼 표에 없는 회차 직접 입력
-- 용도 2: 기본 표의 오타/오류 발견 시 앱에서 바로 수정

create table if not exists denken_exam_rates (
  exam_id        text primary key,   -- dk_2025_2 등 (앱 exam_id 규칙과 동일)

  overall_rate   numeric,            -- 전체(4과목) 합격률 %
  applicants     int,                -- 수험자 수

  rate_riron     numeric,            -- 理論 합격률 %
  rate_denryoku  numeric,            -- 電力 합격률 %
  rate_kikai     numeric,            -- 機械 합격률 %
  rate_hoki      numeric,            -- 法規 합격률 %

  pass_riron     numeric,            -- 理論 합격기준점 (원칙 60, 조정 시 인하)
  pass_denryoku  numeric,            -- 電力 합격기준점
  pass_kikai     numeric,            -- 機械 합격기준점
  pass_hoki      numeric,            -- 法規 합격기준점

  note           text,               -- 메모 (출처·조정 사유 등)
  updated_at     timestamptz default now()
);

-- RLS 비활성화 (프로젝트 정책에 맞게)
alter table denken_exam_rates disable row level security;
