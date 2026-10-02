'use client'
import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

// 앱 전체 관문 — 로그인 세션이 없으면 /login 으로 보낸다.
// -------------------------------------------------------------------
// 실제 데이터 보호는 Supabase RLS가 한다(supabase/security_lockdown.sql).
// 이 컴포넌트는 "로그인 안 된 화면이 빈 데이터로 뜨는 것"을 막는 UX 관문이다.
// supabase-js가 세션 토큰을 모든 요청에 자동으로 붙이므로
// 기존 화면 코드는 고칠 필요가 없다.

const PUBLIC_PATHS = ['/login']

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  const isPublic = PUBLIC_PATHS.includes(pathname)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!ready) return
    if (!session && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
    if (session && pathname === '/login') router.replace('/')
  }, [ready, session, isPublic, pathname, router])

  if (isPublic) return <>{children}</>
  if (!ready || !session) {
    return <div className="min-h-screen bg-gray-950" aria-busy="true" />
  }

  return (
    <>
      {children}
      <button
        onClick={() => supabase.auth.signOut()}
        className="fixed bottom-3 right-3 z-50 text-[11px] text-gray-600 hover:text-gray-300 bg-gray-900/80 hover:bg-gray-800 rounded-lg px-2.5 py-1 transition"
        title="로그아웃"
      >
        로그아웃
      </button>
    </>
  )
}
