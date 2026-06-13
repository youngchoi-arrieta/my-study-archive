'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  TRACK_MAP,
  getSubject,
  STATUS_META,
  STATUS_ORDER,
  type ResearchStatus,
} from '@/lib/constants-research'

type SessionRow = { exam_id: string; drive_url: string | null }
type ProblemRow = { exam_id: string; status: ResearchStatus }

export default function SubjectExamList() {
  const params = useParams()
  const router = useRouter()
  const trackSlug = params.track as string
  const subjectSlug = params.subject as string
  const track = TRACK_MAP.get(trackSlug)
  const subject = track ? getSubject(track, subjectSlug) : undefined

  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [problems, setProblems] = useState<ProblemRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: sess }, { data: probs }] = await Promise.all([
      supabase.from('research_sessions').select('exam_id, drive_url').eq('track', trackSlug).eq('subject', subjectSlug),
      supabase.from('research_problems').select('exam_id, status').eq('track', trackSlug).eq('subject', subjectSlug),
    ])
    setSessions((sess || []) as SessionRow[])
    setProblems((probs || []) as ProblemRow[])
    setLoading(false)
  }, [trackSlug, subjectSlug])

  useEffect(() => { load() }, [load])

  const sessionMap = useMemo(() => {
    const m = new Map<string, SessionRow>()
    sessions.forEach(s => m.set(s.exam_id, s))
    return m
  }, [sessions])

  const examStats = useMemo(() => {
    const m = new Map<string, Record<ResearchStatus, number>>()
    problems.forEach(p => {
      if (!m.has(p.exam_id)) m.set(p.exam_id, { untouched: 0, studying: 0, understood: 0 })
      const rec = m.get(p.exam_id)!
      rec[p.status] = (rec[p.status] ?? 0) + 1
    })
    return m
  }, [problems])

  const totalCounts = useMemo(() => {
    const c: Record<ResearchStatus, number> = { untouched: 0, studying: 0, understood: 0 }
    problems.forEach(p => { c[p.status] = (c[p.status] ?? 0) + 1 })
    return c
  }, [problems])

  if (!track || !subject) {
    return (
      <main className="min-h-screen bg-[#050d1a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-3">과목을 찾을 수 없어요.</p>
          <Link href={`/dashboard/research/${trackSlug}`} className="text-blue-400 hover:underline text-sm">← 뒤로</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#050d1a] text-white p-5 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href={`/dashboard/research/${trackSlug}`} className="text-gray-500 hover:text-white text-xs transition">← {track.name}</Link>
        <div className="flex items-center gap-3 mb-1 mt-2">
          <span className="text-2xl">{track.emoji}</span>
          <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: track.accent }}>{track.name}</span>
        </div>
        <p className="text-gray-600 text-sm mb-5">회차를 선택하세요</p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {STATUS_ORDER.map(st => (
            <div key={st} className="bg-[#0a1628] rounded-2xl p-3 text-center border border-white/5">
              <p className="text-[10px] text-gray-600 mb-1">{STATUS_META[st].ko}</p>
              <p className="text-xl font-black" style={{ color: STATUS_META[st].accent }}>{totalCounts[st]}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-600 text-sm">불러오는 중...</p>
        ) : (
          <div className="space-y-1.5">
            {track.exams.map(exam => {
              const s = sessionMap.get(exam.id)
              const hasPdf = !!s?.drive_url
              const stats = examStats.get(exam.id)
              const probTotal = stats ? stats.untouched + stats.studying + stats.understood : 0
              const done = stats?.understood ?? 0

              return (
                <button key={exam.id}
                  onClick={() => router.push(`/dashboard/research/${trackSlug}/${subjectSlug}/${exam.id}`)}
                  className="w-full flex items-center gap-3 bg-[#0a1628] hover:bg-[#0f1f35] rounded-2xl px-4 py-3 transition border border-white/5 hover:border-white/15 text-left group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition">{exam.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {probTotal > 0
                        ? <span className="text-[10px] text-gray-500">문제 {probTotal} · <span className="text-emerald-400">이해 {done}</span></span>
                        : <span className="text-[10px] text-gray-700">문제 없음</span>}
                      {hasPdf && <span className="text-[10px] text-gray-600">PDF ✓</span>}
                    </div>
                  </div>
                  {stats && probTotal > 0 && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      {STATUS_ORDER.map(st => stats[st] > 0 && (
                        <span key={st} className="flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_META[st].dot }} />
                          <span className="text-[9px] text-gray-500">{stats[st]}</span>
                        </span>
                      ))}
                    </div>
                  )}
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
