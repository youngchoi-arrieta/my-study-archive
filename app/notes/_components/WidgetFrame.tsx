'use client'

import { useEffect, useState } from 'react'
import { loadWidgetHtml } from '@/lib/notes'

// 인터랙티브 HTML 위젯을 격리된 창에서 실행한다.
// -------------------------------------------------------------------
// sandbox="allow-scripts" 만 준다 (allow-same-origin 없음).
// → 위젯 스크립트는 돌지만, 앱의 로그인 정보·쿠키·DB 에는 손을 못 댄다.
// 위젯은 CDN 스크립트(Chart.js 등)를 불러와도 되는 독립 HTML 파일이어야 한다.

export default function WidgetFrame({ path }: { path: string }) {
  const [html, setHtml] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [tall, setTall] = useState(false)

  useEffect(() => {
    let alive = true
    loadWidgetHtml(path).then(h => {
      if (!alive) return
      if (h == null) setFailed(true)
      else setHtml(h)
    })
    return () => { alive = false }
  }, [path])

  if (failed) return <p className="text-xs text-red-400">위젯을 불러오지 못했어요.</p>
  if (html == null) return <p className="text-xs text-gray-500">위젯 불러오는 중…</p>

  return (
    <div className="space-y-1.5">
      <iframe
        title="인터랙티브 위젯"
        srcDoc={html}
        sandbox="allow-scripts"
        className="w-full rounded-xl border border-gray-800 bg-white"
        style={{ height: tall ? 900 : 560 }}
      />
      <div className="flex justify-end">
        <button onClick={() => setTall(v => !v)} className="text-[11px] text-gray-500 hover:text-gray-300">
          {tall ? '작게 보기' : '크게 보기'}
        </button>
      </div>
    </div>
  )
}
