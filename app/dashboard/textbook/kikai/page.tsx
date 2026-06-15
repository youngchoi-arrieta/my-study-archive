'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  TB_SUBJECT_MAP,
  TB_STATUS_META,
  TB_STATUS_ORDER,
  type TextbookStatus,
} from '@/lib/constants-textbook'

type ProblemRow = { chapter: string; status: TextbookStatus }

const SUBJECT_SLUG = 'kikai'

export default function KikaiChapterDashboard() {
  const router = useRouter()
  const subject = TB_SUBJECT_MAP.get(SUBJECT_SLUG)!
  const [problems, setProblems] = useState<ProblemRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('textbook_problems')
      .select('chapter, status')
      .eq('subject', SUBJECT_SLUG)
    setProblems((data || []) as ProblemRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const chapterStats = useMemo(() => {
    const m = new Map<string, Record<TextbookStatus, number>>()
    problems.forEach(p => {
      if (!m.has(p.chapter)) m.set(p.chapter, { untouched: 0, correct: 0, wrong: 0, unsure: 0 })
      const rec = m.get(p.chapter)!
      rec[p.status] = (rec[p.status] ?? 0) + 1
    })
    return m
  }, [problems])

  const totalCounts = useMemo(() => {
    const c: Record<TextbookStatus, number> = { untouched: 0, correct: 0, wrong: 0, unsure: 0 }
    problems.forEach(p => { c[p.status] = (c[p.status] ?? 0) + 1 })
    return c
  }, [problems])

  const totalQ = subject.chapters.reduce((s, c) => s + (c.end - c.start + 1), 0)

  return (
    <main className="min-h-screen bg-[#050d1a] text-white p-5 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard/textbook" className="text-gray-500 hover:text-white text-xs transition">← N제 교재</Link>
        <div className="flex items-center gap-3 mb-1 mt-2">
          <span className="text-2xl">{subject.emoji}</span>
          <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
          <span className="text-xs bg-violet-800/40 text-violet-400 px-2 py-0.5 rounded-full font-bold">N제</span>
        </div>
        <p className="text-gray-600 text-sm mb-5">전체 {totalQ}문제 · 7단원</p>

        {/* 상태 요약 */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {TB_STATUS_ORDER.map(st => (
            <div key={st} className="bg-[#0a1628] rounded-2xl p-3 text-center border border-white/5">
              <p className="text-[10px] text-gray-600 mb-1">{TB_STATUS_META[st].ko}</p>
              <p className="text-xl font-black" style={{ color: TB_STATUS_META[st].accent }}>{totalCounts[st]}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-600 text-sm">불러오는 중...</p>
        ) : (
          <div className="space-y-2">
            {subject.chapters.map(ch => {
              const chQ = ch.end - ch.start + 1
              const stats = chapterStats.get(ch.slug) ?? { untouched: 0, correct: 0, wrong: 0, unsure: 0 }
              const solved = stats.correct + stats.wrong + stats.unsure

              return (
                <button key={ch.slug} onClick={() => router.push(`/dashboard/textbook/kikai/${ch.slug}`)}
                  className="w-full text-left bg-[#0a1628] hover:bg-[#0f1f35] rounded-2xl p-4 transition border border-white/5 hover:border-white/15 group">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: ch.accent }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white group-hover:text-blue-300 transition">{ch.name}</p>
                      <p className="text-[11px] text-gray-600">{ch.start}~{ch.end}번 · {chQ}문제</p>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] shrink-0">
                      <span className="text-gray-500">{solved}/{chQ}</span>
                    </div>
                    <span className="text-gray-700 text-xs group-hover:text-gray-500 transition shrink-0">→</span>
                  </div>
                  {/* 진행 바 */}
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden flex ml-5">
                    <div className="h-full" style={{ width: `${(stats.correct / chQ) * 100}%`, backgroundColor: TB_STATUS_META.correct.accent }} />
                    <div className="h-full" style={{ width: `${(stats.wrong / chQ) * 100}%`, backgroundColor: TB_STATUS_META.wrong.accent }} />
                    <div className="h-full" style={{ width: `${(stats.unsure / chQ) * 100}%`, backgroundColor: TB_STATUS_META.unsure.accent }} />
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
