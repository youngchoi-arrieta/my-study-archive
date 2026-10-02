import { supabase } from './supabase'

// 내 API 라우트(/api/...)를 부를 때 쓰는 fetch — 로그인 토큰을 자동으로 붙인다.
export async function apiFetch(input: string, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const headers = new Headers(init.headers)
  if (data.session) headers.set('Authorization', `Bearer ${data.session.access_token}`)
  return fetch(input, { ...init, headers })
}
