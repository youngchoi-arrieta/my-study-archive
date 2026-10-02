# 1단계 — 기록함 + 오늘 화면

## 순서
1. Supabase SQL Editor에서 `supabase/inbox_migration.sql` 실행 (RLS·정책 포함)
2. 코드 덮어쓰기 → `npm run dev` → 확인 → 푸시

## 바뀌는 것 (신규 4 · 수정 2)
- 신규 `app/_components/QuickCapture.tsx` — 모든 화면 오른쪽 아래 ✏️. 한 줄 적고 엔터
- 신규 `app/_components/TodayBoard.tsx` — 홈 맨 위 입력창 + 카드 3장 (기록함 · 다가오는 마감 · 안 끝난 지시)
- 신규 `lib/inbox.ts` — 기록함 저장 공용 함수
- 신규 `supabase/inbox_migration.sql`
- 수정 `app/_components/AuthGate.tsx` — ✏️ 버튼 추가, 로그아웃은 왼쪽 아래로
- 수정 `app/page.tsx` — 2줄만 추가 (import 한 줄, 헤더 아래 `<TodayBoard />` 한 줄)

## page.tsx를 노트북에서 고친 적이 있다면
덮어쓰지 말고 아래 두 줄만 손으로 넣어도 됩니다.
- 맨 위 import 들 옆: `import TodayBoard from './_components/TodayBoard'`
- 헤더 `</div>` 바로 아래: `<TodayBoard />`

## 쓰는 법
- 적기: ✏️ 또는 홈 맨 위 칸 → 엔터. Shift+엔터는 줄바꿈
- 치우기: 기록함 카드의 네모를 누르면 처리됨(사라짐)
- 규칙 없음. 분류는 나중에 주간 점검에서
