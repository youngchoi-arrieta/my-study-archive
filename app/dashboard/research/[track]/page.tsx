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

type ProblemRow = { subject: string; status: ResearchStatus }

export default function TrackSubjectList() {
  const params = useParams()
  const router = useRouter()
  const trackSlug = params.track as string
  const track = TRACK_MAP.get(trackSlug)

  const [problems, setProblems] = useState<ProblemRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('research_problems')
      .select('subject, status')
      .eq('track', trackSlug)
    setProblems((data || []) as ProblemRow[])
    setLoading(false)
  }, [trackSlug])

  useEffect(() => { load() }, [load])

  // 과목별 상태 카운트
  const subjectStats = useMemo(() => {
    const m = new Map<string, Record<ResearchStatus, number>>()
    problems.forEach(p => {
      if (!m.has(p.subject)) m.set(p.subject, { untouched: 0, studying: 0, understood: 0 })
      const rec = m.get(p.subject)!
      rec[p.status] = (rec[p.status] ?? 0) + 1
    })
    return m
  }, [problems])

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
        <p className="text-gray-600 text-sm mb-6">{track.org} · 과목을 선택하세요</p>

        {loading ? (
          <p className="text-gray-600 text-sm">불러오는 중...</p>
        ) : (
          <div className="space-y-2">
            {track.subjects.map(subject => {
              const stats = subjectStats.get(subject.slug)
              const total = stats ? stats.untouched + stats.studying + stats.understood : 0
              const done = stats?.understood ?? 0
              const studying = stats?.studying ?? 0

              return (
                <button key={subject.slug}
                  onClick={() => router.push(`/dashboard/research/${trackSlug}/${subject.slug}`)}
                  className="w-full text-left bg-[#0a1628] hover:bg-[#0f1f35] rounded-2xl p-4 transition border border-white/5 hover:border-white/15 group">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-bold text-white group-hover:text-blue-300 transition" style={{ color: undefined }}>{subject.name}</p>
                      {total > 0 ? (
                        <p className="text-[11px] text-gray-500 mt-0.5">문제 {total} · <span className="text-emerald-400">이해 {done}</span>{studying > 0 && <span className="text-yellow-400"> · 연구중 {studying}</span>}</p>
                      ) : (
                        <p className="text-[11px] text-gray-700 mt-0.5">아직 등록된 문제 없음</p>
                      )}
                    </div>
                    {/* 미니 진행 바 */}
                    {total > 0 && (
                      <div className="w-24 h-2 bg-gray-800 rounded-full overflow-hidden flex shrink-0">
                        <div className="h-full" style={{ width: `${(done / total) * 100}%`, backgroundColor: STATUS_META.understood.accent }} />
                        <div className="h-full" style={{ width: `${(studying / total) * 100}%`, backgroundColor: STATUS_META.studying.accent }} />
                      </div>
                    )}
                    <span className="text-gray-700 text-xs group-hover:text-gray-500 transition shrink-0">→</span>
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
