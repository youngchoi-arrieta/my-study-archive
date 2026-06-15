'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  TEXTBOOK_SUBJECTS,
  TB_STATUS_META,
  TB_STATUS_ORDER,
  type TextbookStatus,
} from '@/lib/constants-textbook'

type ProblemRow = { subject: string; status: TextbookStatus }

export default function TextbookHub() {
  const router = useRouter()
  const [problems, setProblems] = useState<ProblemRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('textbook_problems').select('subject, status')
    setProblems((data || []) as ProblemRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const subjectStats = useMemo(() => {
    const m = new Map<string, Record<TextbookStatus, number>>()
    for (const s of TEXTBOOK_SUBJECTS) m.set(s.slug, { untouched: 0, correct: 0, wrong: 0, unsure: 0 })
    for (const p of problems) {
      const rec = m.get(p.subject)
      if (rec && p.status) rec[p.status] = (rec[p.status] ?? 0) + 1
    }
    return m
  }, [problems])

  return (
    <main className="min-h-screen bg-[#050d1a] text-white p-5 md:p-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-gray-500 hover:text-white text-xs transition">← 홈</Link>
        <div className="flex items-center gap-3 mb-1 mt-2">
          <span className="text-2xl">📚</span>
          <h1 className="text-2xl font-bold tracking-tight">N제 교재</h1>
        </div>
        <p className="text-gray-600 text-sm mb-6">기출과 별개 · 교재 문제별 학습 상태 + 핵심 토픽 + 정리 노트</p>

        {/* 상태 범례 */}
        <div className="flex items-center gap-4 mb-5 text-xs">
          {TB_STATUS_ORDER.map(st => (
            <div key={st} className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TB_STATUS_META[st].dot }} />
              <span className="text-gray-500">{TB_STATUS_META[st].ko}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-600 text-sm">불러오는 중...</p>
        ) : (
          <div className="space-y-3">
            {TEXTBOOK_SUBJECTS.map(subject => {
              const stats = subjectStats.get(subject.slug)!
              const totalQ = subject.chapters.reduce((sum, c) => sum + (c.end - c.start + 1), 0)
              const correct = stats.correct
              const solved = stats.correct + stats.wrong + stats.unsure

              return (
                <button key={subject.slug} onClick={() => router.push(`/dashboard/textbook/${subject.slug}`)}
                  className="w-full text-left bg-[#0a1628] hover:bg-[#0f1f35] rounded-2xl p-4 transition border border-white/5 hover:border-white/15 group">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl">{subject.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white group-hover:text-blue-300 transition">{subject.name}</p>
                      <p className="text-[11px] text-gray-600">{subject.desc}</p>
                    </div>
                    <span className="text-gray-700 text-xs group-hover:text-gray-500 transition shrink-0">→</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden flex">
                      <div className="h-full" style={{ width: `${(stats.correct / totalQ) * 100}%`, backgroundColor: TB_STATUS_META.correct.accent }} />
                      <div className="h-full" style={{ width: `${(stats.wrong / totalQ) * 100}%`, backgroundColor: TB_STATUS_META.wrong.accent }} />
                      <div className="h-full" style={{ width: `${(stats.unsure / totalQ) * 100}%`, backgroundColor: TB_STATUS_META.unsure.accent }} />
                    </div>
                    <div className="flex items-center gap-2 text-[11px] shrink-0">
                      <span className="text-gray-500">{solved}/{totalQ}</span>
                      {correct > 0 && <span className="text-emerald-400">맞음 {correct}</span>}
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
