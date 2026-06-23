-- Run in Supabase SQL Editor (idempotent — safe to re-run)

-- per-day completion of the fixed routine: { "b1": true, "b2": false, ... }
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS study_blocks jsonb;

-- user-editable block definitions: [{ key, label, minutes, accent }]
ALTER TABLE budget_config
  ADD COLUMN IF NOT EXISTS study_blocks_cfg jsonb;
