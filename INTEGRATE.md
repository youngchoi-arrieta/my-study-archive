# 한국 기술사 통합 — 변경 요약

일본 시험 허브와 **별도 버튼**으로 갈랐습니다. 구조가 달라서입니다 —
덴켄·에관사는 「과목별 점수 → 과목 합격」이지만 기술사는 과목이 없고
31문 중 9문을 버리는 선택제 논술이라, 범용 프레임(constants-exams)에 넣으면
둘 다 망가집니다. 대신 **서브노트 토픽 체계에서 합류**시켰습니다.

## 새 파일

| 경로 | 역할 |
|---|---|
| `lib/constants-topics.ts` | 공통 토픽 43개. 기술사 ↔ 電験 사이의 중립 좌표계 |
| `lib/constants-gisulsa.ts` | 종목 4개 + 교시 구조 + 회차 유틸 |
| `lib/data-gisulsa-balsong.ts` | 발송배전 130~139회 **310문항 태깅 시드** |
| `lib/gisulsaData.ts` | 시드·DB·덴켄 참조를 합치는 데이터 계층 |
| `app/dashboard/gisulsa/page.tsx` | 한국 기술사 허브 |
| `app/dashboard/gisulsa/[jong]/page.tsx` | 종목별 — 회차 목록·PDF·출제 분포 |
| `app/dashboard/gisulsa/[jong]/[exam]/page.tsx` | 회차 상세 — 문항 태깅 |
| `app/dashboard/gisulsa/subnote/page.tsx` | 서브노트 우선순위 보드 |
| `app/dashboard/gisulsa/subnote/[code]/page.tsx` | 토픽 서브노트 (TipTap 에디터) |
| `supabase/gisulsa_migration.sql` | 마이그레이션 |

## 고친 파일

`lib/constants-certs.ts` — CERTS 배열에 `gisulsa-kr` 한 줄 추가.
홈 상태 편집에서 진행중/예정/취득을 바꿀 수 있습니다. 그 외 수정 없음.

## 먼저 할 일

Supabase SQL 에디터에서 `supabase/gisulsa_migration.sql` 실행.
`gs_questions` / `gs_subnotes` 두 테이블과, `denken12_answers.topic_code`
컬럼 하나가 추가됩니다. 기존 테이블은 건드리지 않습니다.

## 덴켄과 어떻게 물리는가

덴켄 1·2종 풀이 화면에 이미 쌓인 `topic/keywords` 자유 텍스트를
**소급 태깅 없이** 끌어옵니다. `constants-topics.ts` 의 토픽마다 일본어 단서
(`jpKeywords`: シース, 対称座標, 調相設備 …)를 달아두고 문자열 매칭합니다.

- 흐린 보라 눈금 = 키워드 추정
- 진한 보라 눈금 = `denken12_answers.topic_code` 로 확정 태깅

즉 마이그레이션만 돌리면 지금 있는 덴켄 데이터로 바로 오른쪽 눈금이 그려지고,
나중에 코드를 확정해 넣으면 그쪽이 우선합니다.

## 나머지 세 종목

건축전기·전기응용·전기안전은 `GISULSA_SPECS` 에 자리를 잡아뒀습니다.
기출이 비어 있어도 화면이 열리고, **회차 번호 추가 → PDF 링크 → 문항 태깅**
순으로 채우면 같은 보드에 합쳐집니다. 회차 PDF는 새 테이블 없이
`denken_exam_docs` 를 `scope='gisulsa'` 로 재사용합니다.

시드를 코드로 넣고 싶으면 `lib/data-gisulsa-*.ts` 를 발송배전과 같은 형식으로
만들고 `lib/gisulsaData.ts` 의 `SEEDS` 에 연결하면 됩니다.

## 검증

`npx tsc --noEmit` 통과, `npx next build` 통과 (신규 라우트 5개 모두 컴파일).
ESLint 의 `set-state-in-effect` 경고는 기존 페이지들과 같은 패턴이라
일부러 맞춰 두었습니다.
