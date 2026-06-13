-- 第二種電気工事士 技能試験 — 単位作業 슬라이드
-- 단위 메타데이터는 lib/constants-denkoshi-units.ts 에 정적 보관.
-- 여기 테이블은 유닛별 슬라이드(캡쳐 이미지 + 캡션)만 저장한다.
-- denkoshi 관례: RLS 비활성화, user_id 없음(단일 사용자).

CREATE TABLE IF NOT EXISTS denkoshi_unit_slides (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_slug  text        NOT NULL,   -- constants-denkoshi-units.ts 의 slug
  src        text        NOT NULL,   -- compressToBase64() JPEG data URL 또는 https URL
  caption    text,                   -- 한글 핵심 instruction (여러 줄 가능)
  order_num  int         DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE denkoshi_unit_slides DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS denkoshi_unit_slides_slug_idx
  ON denkoshi_unit_slides (unit_slug, order_num);
