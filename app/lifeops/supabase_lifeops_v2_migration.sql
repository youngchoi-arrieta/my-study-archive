-- Run in Supabase SQL Editor

-- budget_config additions
ALTER TABLE budget_config
  ADD COLUMN IF NOT EXISTS cop_per_krw     numeric(8,4) NOT NULL DEFAULT 0.42,
  ADD COLUMN IF NOT EXISTS expense_cats    jsonb,   -- [{key,en,es,type}]
  ADD COLUMN IF NOT EXISTS income_cats     jsonb;   -- [{key,en,es}]

-- daily_logs additions
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS income_krw jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weight_kg  numeric(4,1);
