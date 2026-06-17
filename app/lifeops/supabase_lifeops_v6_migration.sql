-- Run in Supabase SQL Editor

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS study_blocks jsonb;   -- { denken:bool, jisseki:bool, japanese:bool }
