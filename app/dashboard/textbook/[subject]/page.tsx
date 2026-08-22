'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  TB_SUBJECT_MAP,
  TB_STATUS_META,
  TB_STATUS_ORDER,
  type TextbookStatus,
} from '@/lib/constants-textbook'

type ProblemRow = { chapter: string; status: TextbookStatus }

// 과목별 단원 대시보드 (kikai / hoki / …) — 단원 정의는 constants-textbook 이 단일 소스
export default function SubjectChapterDashboard() {
  const router = useRouter()
  const params = useParams()
  const subjectSlug = params.subject as string
  const subject = TB_SUBJECT_MAP.get(subjectSlug)

  const [problems, setProblems] = useState<ProblemRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'order' | 'count'>('order')

  const load = useCallback(async () => {
    if (!subject) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('textbook_problems')
      .select('chapter, status')
      .eq('subject', subjectSlug)
    setProblems((data || []) as ProblemRow[])
    setLoading(false)
  }, [subject, subjectSlug])

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

  if (!subject) {
    return (
      <main className="min-h-screen bg-[#050d1a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-3">등록되지 않은 과목이다.</p>
          <Link href="/dashboard/textbook" className="text-blue-400 hover:underline text-sm">← N제 교재</Link>
        </div>
      </main>
    )
  }

  const totalQ = subject.chapters.reduce((s, c) => s + (c.end - c.start + 1), 0)

  // 교재 순서대로 보는 게 기본이지만, 문제수가 큰 단원부터 붙는 게
  // 실제 공부 순서에 가까울 때가 많다. 그래서 정렬만 바꿔 끼운다.
  const sortedChapters = sort === 'count'
    ? [...subject.chapters].sort((a, b) => (b.end - b.start) - (a.end - a.start))
    : subject.chapters

  return (
    <main className="min-h-screen bg-[#050d1a] text-white p-5 md:p-8">
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard/textbook" className="text-gray-500 hover:text-white text-xs transition">← N제 교재</Link>
        <div className="flex items-center gap-3 mb-1 mt-2">
          <span className="text-2xl">{subject.emoji}</span>
          <h1 className="text-2xl font-bold tracking-tight">{subject.name}</h1>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
            style={{ backgroundColor: subject.accent }}>N제</span>
        </div>
        <p className="text-gray-600 text-sm mb-4">전체 {totalQ}문제 · {subject.chapters.length}단원</p>

        <div className="flex gap-1.5 mb-5">
          {([['order', '교재 순서'], ['count', '문제수순']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setSort(k)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                sort === k ? 'bg-blue-600 text-white' : 'bg-gray-800/70 text-gray-500 hover:text-gray-300'
              }`}>{label}</button>
          ))}
        </div>

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
            {sortedChapters.map(ch => {
              const chQ = ch.end - ch.start + 1
              const stats = chapterStats.get(ch.slug) ?? { untouched: 0, correct: 0, wrong: 0, unsure: 0 }
              const solved = stats.correct + stats.wrong + stats.unsure

              return (
                <button key={ch.slug} onClick={() => router.push(`/dashboard/textbook/${subjectSlug}/${ch.slug}`)}
                  className="w-full text-left bg-[#0a1628] hover:bg-[#0f1f35] rounded-2xl p-4 transition border border-white/5 hover:border-white/15 group">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="w-2 h-8 rounded-full shrink-0" style={{ backgroundColor: ch.accent }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white group-hover:text-blue-300 transition">{ch.name}</p>
                      <p className="text-[11px] text-gray-600">
                        {ch.start}~{ch.end}번 · {chQ}문제
                        <span className="text-gray-700"> · 비중 {Math.round((chQ / totalQ) * 1000) / 10}%</span>
                      </p>
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
