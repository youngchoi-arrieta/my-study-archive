-- JLPT 모의고사: 「확신 정답수」 컬럼 추가
-- ===================================================================
-- 찍어서 맞은 문항을 걸러내기 위한 선택 입력.
--   moji / bunpou / dokkai / choukai   = 채점상 정답수 (실제 점수)
--   *_sure                             = 그중 "확신을 갖고 맞힌" 개수
--   정답수 − 확신수                     = 찍어서 맞은 것(추정)
--
-- null 이면 "입력 안 함"이고, 앱은 그 영역의 확신 표시를 생략한다.
-- 청해처럼 우연 정답이 섞이기 쉬운 영역만 채워도 된다.

alter table jlpt_mocks
  add column if not exists moji_sure    int,
  add column if not exists bunpou_sure  int,
  add column if not exists dokkai_sure  int,
  add column if not exists choukai_sure int;
