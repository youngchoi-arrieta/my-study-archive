import { createClient } from '@supabase/supabase-js'

// API 라우트용 — 요청에 실린 로그인 토큰이 유효한지 서버에서 확인한다.
// 호출하는 쪽은 lib/apiFetch.ts 의 apiFetch()를 쓰면 토큰이 자동으로 붙는다.
export async function requireUser(req: Request) {
  const header = req.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token) return null
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data, error } = await sb.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
