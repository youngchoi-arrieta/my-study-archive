-- Run in Supabase SQL Editor

ALTER TABLE budget_config
  ADD COLUMN IF NOT EXISTS activity_cats jsonb;

ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS activities         jsonb,
  ADD COLUMN IF NOT EXISTS listening_min      integer,
  ADD COLUMN IF NOT EXISTS listening_content  text;
