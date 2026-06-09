-- Run in Supabase SQL Editor

-- Add cop_per_krw to budget_config
ALTER TABLE budget_config
  ADD COLUMN IF NOT EXISTS cop_per_krw numeric(8,4) NOT NULL DEFAULT 0.42;

-- Add income_krw and weight_kg to daily_logs (if not already added)
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS income_krw jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weight_kg  numeric(4,1);
