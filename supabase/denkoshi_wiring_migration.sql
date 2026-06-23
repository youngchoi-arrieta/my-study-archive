-- 배선도 분석 세션
CREATE TABLE denkoshi_wiring_sessions (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text        NOT NULL,
  description text,
  qa_count    int         DEFAULT 0,
  image_count int         DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE denkoshi_wiring_sessions DISABLE ROW LEVEL SECURITY;

-- 배선도 이미지 (base64 data URL 또는 외부 URL)
CREATE TABLE denkoshi_wiring_images (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  uuid        REFERENCES denkoshi_wiring_sessions(id) ON DELETE CASCADE,
  src         text        NOT NULL,   -- base64 data URL or https://...
  caption     text,
  order_num   int         DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE denkoshi_wiring_images DISABLE ROW LEVEL SECURITY;

-- 배선도 분석 Q&A
CREATE TABLE denkoshi_wiring_qa (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  uuid        REFERENCES denkoshi_wiring_sessions(id) ON DELETE CASCADE,
  question    text        NOT NULL,
  answer      text,
  order_num   int         DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE denkoshi_wiring_qa DISABLE ROW LEVEL SECURITY;
