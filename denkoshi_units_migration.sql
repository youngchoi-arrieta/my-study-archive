-- 第二種電気工事士 技能試験 — 単位作業 슬라이드
-- 단위 메타데이터는 lib/constants-denkoshi-units.ts 에 정적 보관.
-- 이 테이블은 유닛별 슬라이드(캡쳐 이미지 + 캡션)만 저장.
-- 한 슬라이드에 사진 여러 장(OK/NG 비교) 가능 → images jsonb 배열.
-- denkoshi 관례: RLS 비활성화, user_id 없음(단일 사용자).
-- ※ 이미 구버전(src 단일) 테이블을 만든 경우엔 denkoshi_unit_slides_multi_image_migration.sql 만 실행.

CREATE TABLE IF NOT EXISTS denkoshi_unit_slides (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_slug  text        NOT NULL,                 -- constants-denkoshi-units.ts 의 slug
  images     jsonb,                                -- [{ "src": "...", "w": 1 }, ...] (다중 이미지 + 사진별 크기)
  src        text,                                 -- 첫 이미지 미러(하위호환), 선택
  caption    text,                                 -- 한글 핵심 instruction (여러 줄 가능)
  order_num  int         DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE denkoshi_unit_slides DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS denkoshi_unit_slides_slug_idx
  ON denkoshi_unit_slides (unit_slug, order_num);
