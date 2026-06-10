-- Run in Supabase SQL Editor

-- v2: exchange rate + custom categories (이전에 실행 안 했으면 같이)
ALTER TABLE budget_config
  ADD COLUMN IF NOT EXISTS cop_per_krw  numeric(8,4) NOT NULL DEFAULT 0.42,
  ADD COLUMN IF NOT EXISTS expense_cats jsonb,
  ADD COLUMN IF NOT EXISTS income_cats  jsonb;

-- v3: daily reflection (명상록의 물음 답변)
ALTER TABLE daily_logs
  ADD COLUMN IF NOT EXISTS income_krw  jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS weight_kg   numeric(4,1),
  ADD COLUMN IF NOT EXISTS reflection  text;
