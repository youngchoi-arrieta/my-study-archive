'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  TRACK_MAP,
  STATUS_META,
  STATUS_ORDER,
  type ResearchStatus,
} from '@/lib/constants-research'

type SessionRow = {
  exam_id: string
  status: ResearchStatus
  drive_url: string | null
  answer_drive_url: string | null
  memo: string | null
}

export default function TrackExamList() {
  const params = useParams()
  const router = useRouter()
  const trackSlug = params.track as string
  const track = TRACK_MAP.get(trackSlug)

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('research_sessions')
      .select('exam_id, status, drive_url, answer_drive_url, memo')
      .eq('track', trackSlug)
    setSessions((data || []) as SessionRow[])
    setLoading(false)
  }, [trackSlug])

  useEffect(() => { load() }, [load])

  const sessionMap = useMemo(() => {
    const m = new Map<string, SessionRow>()
    sessions.forEach(s => m.set(s.exam_id, s))
    return m
  }, [sessions])

  const statusCounts = useMemo(() => {
    const c: Record<ResearchStatus, number> = { untouched: 0, studying: 0, understood: 0 }
    if (!track) return c
    for (const exam of track.exams) {
      const s = sessionMap.get(exam.id)
      const st = s?.status ?? 'untouched'
      c[st] = (c[st] ?? 0) + 1
    }
    return c
  }, [track, sessionMap])

  if (!track) {
    return (
      <main className="min-h-screen bg-[#050d1a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-3">트랙을 찾을 수 없어요.</p>
          <Link href="/dashboard/research" className="text-blue-400 hover:underline text-sm">← 심화 연구</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#050d1a] text-white p-5 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard/research" className="text-gray-500 hover:text-white text-xs transition">← 심화 연구</Link>

        <div className="flex items-center gap-3 mb-1 mt-2">
          <span className="text-2xl">{track.emoji}</span>
          <h1 className="text-2xl font-bold tracking-tight">{track.name}</h1>
        </div>
        <p className="text-gray-600 text-sm mb-5">{track.org} · {track.desc}</p>

        {/* 상태 요약 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {STATUS_ORDER.map(st => (
            <div key={st} className="bg-[#0a1628] rounded-2xl p-3 text-center border border-white/5">
              <p className="text-[10px] text-gray-600 mb-1">{STATUS_META[st].ko}</p>
              <p className="text-xl font-black" style={{ color: STATUS_META[st].accent }}>{statusCounts[st]}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-600 text-sm">불러오는 중...</p>
        ) : (
          <div className="space-y-1.5">
            {track.exams.map(exam => {
              const s = sessionMap.get(exam.id)
              const status = s?.status ?? 'untouched'
              const meta = STATUS_META[status]
              const hasPdf = !!s?.drive_url
              const hasMemo = !!(s?.memo && s.memo.replace(/<[^>]+>/g, '').trim())

              return (
                <button
                  key={exam.id}
                  onClick={() => router.push(`/dashboard/research/${trackSlug}/${exam.id}`)}
                  className="w-full flex items-center gap-3 bg-[#0a1628] hover:bg-[#0f1f35] rounded-2xl px-4 py-3 transition border border-white/5 hover:border-white/15 text-left group"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: meta.dot }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition">{exam.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px]" style={{ color: meta.accent }}>{meta.ko}</span>
                      {hasPdf && <span className="text-[10px] text-gray-600">PDF ✓</span>}
                      {hasMemo && <span className="text-[10px] text-blue-500">솔루션 ✓</span>}
                    </div>
                  </div>
                  <span className="text-gray-700 text-xs group-hover:text-gray-500 transition shrink-0">→</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
