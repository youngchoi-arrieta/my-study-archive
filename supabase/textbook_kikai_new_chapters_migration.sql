-- 機械 N제 단원 재편 마이그레이션
-- 정보: 114~122 (기존 114~123)
-- 신규: 조명(light) 123~128 / 전열(heat) 129~137 / 전동기응용(motor-app) 138~146 / 전기화학(electrochem) 147~157
--
-- 123번을 기존에 '정보(info)' 단원에서 찍어둔 기록이 있다면
-- 새 '조명(light)' 단원으로 이동시킨다. 없으면 아무 일도 안 함.

UPDATE textbook_problems
SET chapter = 'light'
WHERE subject = 'kikai'
  AND chapter = 'info'
  AND q_num = 123;

-- 확인용: 정보 단원에 122 초과 문제가 남아있으면 안 됨
-- SELECT * FROM textbook_problems WHERE subject = 'kikai' AND chapter = 'info' AND q_num > 122;
