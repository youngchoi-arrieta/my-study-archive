-- 第二種電気工事士 技能試験 · 후보문제 체감 난이도(내가 태깅)
-- KOUHO_MONDAI.difficulty(공표 고정 기준값)와 별개로, 연습하며 느낀 난이도를 저장.
-- 값: 'easy' | 'mid' | 'hard' | NULL(미설정)
ALTER TABLE denkoshi_jitsugi_problems
  ADD COLUMN IF NOT EXISTS felt_difficulty text;

-- (선택) 허용값 가드 — 잘못된 문자열 방지. 이미 있으면 무시.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'denkoshi_jitsugi_felt_difficulty_chk'
  ) THEN
    ALTER TABLE denkoshi_jitsugi_problems
      ADD CONSTRAINT denkoshi_jitsugi_felt_difficulty_chk
      CHECK (felt_difficulty IS NULL OR felt_difficulty IN ('easy', 'mid', 'hard'));
  END IF;
END $$;
