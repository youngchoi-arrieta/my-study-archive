# 보안 잠금 — 적용 순서

압축을 프로젝트 루트에 풀면 경로대로 덮어써집니다 (신규 8 · 수정 3).

## 바뀌는 것
- 신규 `app/login/page.tsx` — 로그인 화면 (가입 버튼 없음)
- 신규 `app/_components/AuthGate.tsx` — 로그인 안 됐으면 /login 으로. 오른쪽 아래 작은 로그아웃 버튼
- 수정 `app/layout.tsx` — 전체를 AuthGate로 감쌈
- 수정 `app/api/analyze-jp/route.ts` — 로그인 토큰 없으면 401 (크레딧 보호)
- 신규 `lib/serverAuth.ts`, `lib/apiFetch.ts` — API 토큰 확인 / 토큰 붙이는 fetch
- 신규 `lib/storageSign.ts` + 수정 `app/familia/memorias/MemoriasGallery.tsx` — 비공개 사진을 서명 URL로 표시
- 신규 `supabase/security_lockdown.sql` — RLS 잠금
- 신규 `supabase/_new_table_template.sql` — 새 테이블 만들 때 붙일 두 줄

## 순서 (꼭 이 순서로)
1. 코드 덮어쓰기 → `npm run dev` → 로그인 화면이 뜨는지, 로그인 후 평소처럼 보이는지 확인
2. 커밋·푸시 → Vercel 배포 → 배포된 사이트에서도 로그인 확인
3. 그다음 Supabase SQL Editor에서 `supabase/security_lockdown.sql` 실행
   - 마지막 확인 쿼리 결과가 0행이면 성공
4. 로그인한 상태로 여러 화면을 돌아보고, 시크릿 창에서는 로그인 화면만 뜨는지 확인
5. memorias 갤러리에서 사진이 보이는지 확인

## 문제가 생기면
- B 단계(storage)에서 권한 오류가 나면: A 단계는 이미 적용된 상태입니다.
  Storage → Policies 화면에서 기존 정책을 지우고, memorias 버킷 설정에서 Public을 끄면 됩니다.
- 급하게 원래대로 돌려야 하면 SQL 한 줄씩: `alter table public.테이블명 disable row level security;`
