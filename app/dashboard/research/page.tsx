'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  RESEARCH_TRACKS,
  STATUS_META,
  STATUS_ORDER,
  type ResearchStatus,
} from '@/lib/constants-research'

type SessionRow = {
  track: string
  exam_id: string
  status: ResearchStatus
  drive_url: string | null
  memo: string | null
}

export default function ResearchHub() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('research_sessions')
      .select('track, exam_id, status, drive_url, memo')
    setSessions((data || []) as SessionRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // 트랙별 상태 카운트
  const trackStats = useMemo(() => {
    const m = new Map<string, Record<ResearchStatus, number>>()
    for (const t of RESEARCH_TRACKS) {
      m.set(t.slug, { untouched: 0, studying: 0, understood: 0 })
    }
    for (const s of sessions) {
      const rec = m.get(s.track)
      if (rec && s.status) rec[s.status] = (rec[s.status] ?? 0) + 1
    }
    return m
  }, [sessions])

  return (
    <main className="min-h-screen bg-[#050d1a] text-white p-5 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/dashboard" className="text-gray-500 hover:text-white text-xs transition">← 홈</Link>

        <div className="flex items-center gap-3 mb-1 mt-2">
          <span className="text-2xl">🔬</span>
          <h1 className="text-2xl font-bold tracking-tight">심화 연구</h1>
        </div>
        <p className="text-gray-600 text-sm mb-6">
          電験 1·2종 / 기술고시 — 점수가 아니라 이해도로 추적하는 논술·심화 기출 연구
        </p>

        {/* 상태 범례 */}
        <div className="flex items-center gap-4 mb-5 text-xs">
          {STATUS_ORDER.map(st => (
            <div key={st} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_META[st].dot }} />
              <span className="text-gray-500">{STATUS_META[st].ko}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-600 text-sm">불러오는 중...</p>
        ) : (
          <div className="space-y-3">
            {RESEARCH_TRACKS.map(track => {
              const stats = trackStats.get(track.slug)!
              const total = track.exams.length
              const done = stats.understood
              const studying = stats.studying
              const pct = total > 0 ? Math.round((done / total) * 100) : 0

              return (
                <button
                  key={track.slug}
                  onClick={() => router.push(`/dashboard/research/${track.slug}`)}
                  className="w-full text-left bg-[#0a1628] hover:bg-[#0f1f35] rounded-2xl p-4 transition border border-white/5 hover:border-white/15 group"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">{track.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white group-hover:text-blue-300 transition">{track.name}</p>
                      <p className="text-[11px] text-gray-600">{track.org} · {track.desc}</p>
                    </div>
                    <span className="text-gray-700 text-xs group-hover:text-gray-500 transition shrink-0">→</span>
                  </div>

                  {/* 진행 바 */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden flex">
                      <div className="h-full" style={{ width: `${(done / total) * 100}%`, backgroundColor: STATUS_META.understood.accent }} />
                      <div className="h-full" style={{ width: `${(studying / total) * 100}%`, backgroundColor: STATUS_META.studying.accent }} />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] shrink-0">
                      <span className="text-emerald-400 font-bold">{done}</span>
                      <span className="text-gray-700">/</span>
                      <span className="text-gray-500">{total}</span>
                      {studying > 0 && <span className="text-yellow-400">· 연구중 {studying}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
