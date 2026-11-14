'use client'

import { useEffect, useState } from 'react'
import { loadHtml } from '@/lib/armory'

// 실행 HTML 을 격리된 창에서 돌린다.
// -------------------------------------------------------------------
// sandbox 에 allow-same-origin 을 주지 않는다 → Lab 스크립트는 돌지만
// 앱의 로그인 정보·쿠키·DB 에는 손을 못 댄다. (그래서 Lab 안 localStorage 는 막힘)
// allow-downloads 는 준다 → Lab 의 'CSV 내보내기' 같은 버튼이 동작한다.

const SANDBOX = 'allow-scripts allow-downloads allow-popups allow-modals allow-forms'

export default function LabFrame({ path, title }: { path: string; title: string }) {
  const [loaded, setLoaded] = useState<{ path: string; html: string | null } | null>(null)
  const [full, setFull] = useState(false)
  const [tall, setTall] = useState(false)

  useEffect(() => {
    let alive = true
    loadHtml(path).then(h => { if (alive) setLoaded({ path, html: h }) })
    return () => { alive = false }
  }, [path])

  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFull(false) }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [full])

  const cur = loaded && loaded.path === path ? loaded : null
  if (!cur) return <p className="text-xs text-gray-500 py-10 text-center">격납고에서 꺼내는 중…</p>
  if (cur.html == null) return <p className="text-xs text-red-400 py-10 text-center">실행 HTML 을 불러오지 못했어요.</p>

  const frame = (
    <iframe title={title} srcDoc={cur.html} sandbox={SANDBOX}
      className={full ? 'w-full h-full bg-white' : 'w-full rounded-xl border border-gray-800 bg-white'}
      style={full ? undefined : { height: tall ? 1000 : 640 }} />
  )

  if (full) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
        <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-950 border-b border-gray-800 shrink-0">
          <span className="flex-1 text-xs text-gray-400 truncate">▶ {title}</span>
          <button onClick={() => setFull(false)} className="text-xs text-gray-300 hover:text-white px-2" title="닫기 (Esc)">✕ 닫기</button>
        </div>
        <div className="flex-1 min-h-0">{frame}</div>
      </div>
    )
  }
  return (
    <div className="space-y-1.5">
      {frame}
      <div className="flex justify-end gap-3">
        <button onClick={() => setTall(v => !v)} className="text-[11px] text-gray-500 hover:text-gray-300">
          {tall ? '작게' : '길게'}
        </button>
        <button onClick={() => setFull(true)} className="text-[11px] text-blue-300 hover:text-blue-200">⛶ 전체 화면</button>
      </div>
    </div>
  )
}
