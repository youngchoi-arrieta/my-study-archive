'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

// 로그인 — 대시보드에서 만든 단 하나의 계정으로만 들어온다.
// 신규 가입은 Supabase 설정에서 꺼 두었으므로 가입 버튼은 없다.

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!email.trim() || !password) { setError('이메일과 비밀번호를 입력하세요.'); return }
    setBusy(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) { setError('로그인 실패 — 이메일이나 비밀번호를 확인하세요.'); return }
    const next = new URLSearchParams(window.location.search).get('next')
    router.replace(next && next.startsWith('/') && next !== '/login' ? next : '/')
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl p-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold">⚡ 나의 전기공학 도장</h1>
          <p className="text-xs text-gray-500 mt-1">개인 아카이브 — 로그인이 필요합니다</p>
        </div>
        <input
          type="email" autoComplete="email" placeholder="이메일"
          value={email} onChange={e => { setEmail(e.target.value); setError('') }}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-600"
        />
        <input
          type="password" autoComplete="current-password" placeholder="비밀번호"
          value={password} onChange={e => { setPassword(e.target.value); setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-600"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          onClick={submit} disabled={busy}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg py-2 text-sm font-semibold transition"
        >
          {busy ? '확인 중…' : '로그인'}
        </button>
      </div>
    </main>
  )
}
