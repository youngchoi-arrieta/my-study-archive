-- 단위작업 슬라이드: 한 슬라이드에 사진 여러 장(OK/NG 비교) + 사진별 크기(w) 지원
-- 기존 denkoshi_unit_slides 테이블에 적용 (이미 만든 경우 이 ALTER만 실행)

ALTER TABLE denkoshi_unit_slides ADD COLUMN IF NOT EXISTS images jsonb;

-- 기존 단일 이미지(src) 행을 배열 형태로 백필: [{ "src": ..., "w": 1 }]
UPDATE denkoshi_unit_slides
   SET images = jsonb_build_array(jsonb_build_object('src', src, 'w', 1))
 WHERE images IS NULL AND src IS NOT NULL;

-- 이제 src 는 선택(첫 이미지 미러링용). 신규 행은 images 배열을 사용한다.
ALTER TABLE denkoshi_unit_slides ALTER COLUMN src DROP NOT NULL;
