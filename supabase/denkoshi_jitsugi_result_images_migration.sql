-- 후보문제별 작업 결과(완성 작품) 사진 — base64 압축 이미지 배열
ALTER TABLE denkoshi_jitsugi_problems
  ADD COLUMN IF NOT EXISTS result_images jsonb DEFAULT '[]'::jsonb;
