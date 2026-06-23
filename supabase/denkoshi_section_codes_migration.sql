-- ① section_codes 컬럼 추가 (text 배열)
ALTER TABLE denkoshi_section_tags
  ADD COLUMN IF NOT EXISTS section_codes text[] DEFAULT '{}';

-- ② 기존 section_code 데이터를 section_codes 배열로 마이그레이션
UPDATE denkoshi_section_tags
SET section_codes = ARRAY[section_code]
WHERE section_code IS NOT NULL
  AND (section_codes IS NULL OR section_codes = '{}');
