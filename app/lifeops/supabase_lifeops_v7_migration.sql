-- v7: 고정 루틴 타이머 — key별 누적 분(分) 기록
-- study_blocks(jsonb, boolean 완료여부)는 유지. study_minutes(jsonb, 누적 분) 추가.
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS study_minutes jsonb;
