'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { KIKAI_EXAMS, KIKAI_TAGS, KIKAI_TAG_MAP, Q_TOTAL, isQSelectPair, scoreForQ } from '@/lib/constants-denken-kikai'

// ── 타입 ──────────────────────────────────────────────────────────
type Result = 'correct' | 'wrong' | null

type SessionRow = {
  exam_id: string
  drive_url: string | null
  selected_q: number | null
}

type AnswerRow = {
  exam_id: string
  q_num: number
  result: Result
  tag_id: number | null
  memo: string | null
}

function calcScore(answers: AnswerRow[], selectedQ: number | null): number {
  let total = 0
  for (const a of answers) {
    if (a.result !== 'correct') continue
    if (isQSelectPair(a.q_num) && a.q_num !== selectedQ) continue
    total += scoreForQ(a.q_num)
  }
  return total
}

const scoreColor = (s: number | null) => {
  if (s === null) return 'text-gray-600'
  if (s >= 60) return 'text-emerald-400'
  if (s >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

// 연도 그룹
const YEARS = [...new Set(KIKAI_EXAMS.map(e => e.year))].sort((a, b) => b - a)

// ── 메인 ────────────────────────────────────────────────────────
export default function KikaiHub() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'exams' | 'stats'>('exams')

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: sessData }, { data: ansData }] = await Promise.all([
      supabase.from('denken_kikai_sessions').select('exam_id, drive_url, selected_q'),
      supabase.from('denken_kikai_answers').select('exam_id, q_num, result, tag_id, memo'),
    ])
    setSessions((sessData || []) as SessionRow[])
    setAnswers((ansData || []) as AnswerRow[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const sessionMap = useMemo(() => {
    const m = new Map<string, SessionRow>()
    sessions.forEach(s => m.set(s.exam_id, s))
    return m
  }, [sessions])

  const answersByExam = useMemo(() => {
    const m = new Map<string, AnswerRow[]>()
    answers.forEach(a => {
      if (!m.has(a.exam_id)) m.set(a.exam_id, [])
      m.get(a.exam_id)!.push(a)
    })
    return m
  }, [answers])

  // 태그별 통계
  const tagStats = useMemo(() =>
    KIKAI_TAGS.map(tag => {
      const tagged = answers.filter(a => a.tag_id === tag.id && a.result !== null)
      const correct = tagged.filter(a => a.result === 'correct').length
      const rate = tagged.length === 0 ? null : Math.round((correct / tagged.length) * 100)
      return { tag, total: tagged.length, correct, rate }
    }),
    [answers]
  )

  const totalAttempts = sessions.filter(s => {
    const ans = answersByExam.get(s.exam_id) || []
    return ans.some(a => a.result !== null)
  }).length

  const passedCount = sessions.filter(s => {
    const ans = answersByExam.get(s.exam_id) || []
    const score = calcScore(ans, s.selected_q)
    return score >= 60
  }).length

  const allScores = sessions.map(s => {
    const ans = answersByExam.get(s.exam_id) || []
    return calcScore(ans, s.selected_q)
  }).filter(sc => sc > 0)
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : null

  return (
    <main className="min-h-screen bg-[#050d1a] text-white p-5 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* 헤더 */}
        <div className="mb-2">
          <Link href="/dashboard/denken" className="text-gray-500 hover:text-white text-xs transition">
            ← 電験三種
          </Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">⚙️</span>
          <h1 className="text-2xl font-bold tracking-tight">機械</h1>
          <span className="text-xs bg-violet-800/40 text-violet-400 px-2 py-0.5 rounded-full font-bold">
            電験三種
          </span>
        </div>
        <p className="text-gray-600 text-sm mb-5">
          直流機 · 変圧器 · 誘導機 · 同期機 · 電力電子 · 自動制御 · 情報 · 照明 · 電熱 · 電動機応用 · 電気化学
        </p>

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-[#0a1628] rounded-2xl p-4 text-center border border-white/5">
            <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-widest">풀이 완료</p>
            <p className="text-2xl font-black">
              {totalAttempts}
              <span className="text-sm text-gray-600 ml-1">/ {KIKAI_EXAMS.length}</span>
            </p>
          </div>
          <div className="bg-[#0a1628] rounded-2xl p-4 text-center border border-white/5">
            <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-widest">합격권 도달</p>
            <p className={`text-2xl font-black ${passedCount > 0 ? 'text-emerald-400' : 'text-gray-600'}`}>
              {passedCount}회
            </p>
          </div>
          <div className="bg-[#0a1628] rounded-2xl p-4 text-center border border-white/5">
            <p className="text-[10px] text-gray-600 mb-1 uppercase tracking-widest">최고점</p>
            <p className={`text-2xl font-black ${scoreColor(bestScore)}`}>
              {bestScore !== null ? `${bestScore}` : '—'}
              {bestScore !== null && <span className="text-sm text-gray-600 ml-0.5">점</span>}
            </p>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-[#0a1628] rounded-xl p-1 mb-6 border border-white/5">
          {([
            { key: 'exams', label: '📋 기출 목록' },
            { key: 'stats', label: '📊 단원별 정답률' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === key
                  ? 'bg-[#1a2e47] text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 탭: 기출 목록 ── */}
        {activeTab === 'exams' && (
          <div>
            {loading ? (
              <p className="text-gray-600 text-sm">불러오는 중...</p>
            ) : (
              <div className="space-y-2">
                {YEARS.map(year => {
                  const yearExams = KIKAI_EXAMS.filter(e => e.year === year)
                  return (
                    <div key={year}>
                      <p className="text-[10px] text-gray-700 uppercase tracking-widest mb-1.5 px-1">
                        {year}年 ({year >= 2023 ? '연 2회' : '연 1회'})
                      </p>
                      <div className="space-y-1.5">
                        {yearExams.map(exam => {
                          const sess = sessionMap.get(exam.id)
                          const ans = answersByExam.get(exam.id) || []
                          const score = calcScore(ans, sess?.selected_q ?? null)
                          const hasData = ans.some(a => a.result !== null)
                          const hasMemo = ans.some(a => a.memo)
                          const tagCount = ans.filter(a => a.tag_id !== null).length
                          const memoCount = ans.filter(a => a.memo).length

                          return (
                            <button
                              key={exam.id}
                              onClick={() => router.push(`/dashboard/denken/kikai/${exam.id}`)}
                              className="w-full flex items-center gap-3 bg-[#0a1628] hover:bg-[#0f1f35] rounded-2xl px-4 py-3 transition border border-white/5 hover:border-violet-500/30 text-left group"
                            >
                              {/* 라벨 */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white group-hover:text-violet-300 transition">
                                  {exam.label}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {tagCount > 0 && (
                                    <span className="text-[10px] text-violet-500">{tagCount}태그</span>
                                  )}
                                  {memoCount > 0 && (
                                    <span className="text-[10px] text-blue-500">메모 {memoCount}개</span>
                                  )}
                                  {sess?.drive_url && (
                                    <span className="text-[10px] text-gray-600">PDF ✓</span>
                                  )}
                                  {!hasData && !sess?.drive_url && (
                                    <span className="text-[10px] text-gray-800">미풀이</span>
                                  )}
                                </div>
                              </div>

                              {/* 점수 */}
                              <div className="text-right shrink-0">
                                {hasData ? (
                                  <>
                                    <p className={`text-xl font-black tabular-nums ${scoreColor(score)}`}>
                                      {score}
                                    </p>
                                    <p className="text-[10px] text-gray-700">/ 100</p>
                                  </>
                                ) : (
                                  <span className="text-gray-700 text-lg">—</span>
                                )}
                              </div>

                              <span className="text-gray-700 text-xs group-hover:text-gray-500 transition shrink-0">→</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 탭: 단원별 정답률 ── */}
        {activeTab === 'stats' && (
          <div>
            {answers.filter(a => a.result !== null).length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-600 text-sm">아직 채점 데이터가 없어요.</p>
                <p className="text-gray-700 text-xs mt-1">기출을 풀고 O/X를 체크하면 여기에 통계가 쌓여요.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tagStats.filter(s => s.total > 0).map(({ tag, total, correct, rate }) => (
                  <div key={tag.id} className="bg-[#0a1628] rounded-2xl px-4 py-3 border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className="text-xs font-bold text-white px-2 py-0.5 rounded-lg"
                        style={{ backgroundColor: tag.accent }}
                      >
                        {tag.ko}
                      </span>
                      <span className="text-[11px] text-gray-600">{tag.ja}</span>
                      <span className="ml-auto text-[11px] text-gray-600">{correct}/{total}문</span>
                      {rate !== null && (
                        <span className={`text-base font-black tabular-nums ${
                          rate >= 70 ? 'text-emerald-400' : rate >= 50 ? 'text-yellow-400' : 'text-red-400'
                        }`}>
                          {rate}%
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${rate ?? 0}%`,
                          backgroundColor: (rate ?? 0) >= 70 ? '#10b981' : (rate ?? 0) >= 50 ? '#eab308' : '#ef4444',
                        }}
                      />
                    </div>
                  </div>
                ))}

                {tagStats.filter(s => s.total === 0).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <p className="text-[10px] text-gray-700 mb-2">미출제 단원</p>
                    <div className="flex flex-wrap gap-1.5">
                      {tagStats.filter(s => s.total === 0).map(({ tag }) => (
                        <span
                          key={tag.id}
                          className="text-[10px] text-gray-700 px-2 py-0.5 rounded-lg bg-gray-900"
                        >
                          {tag.ko}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  )
}
