'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { DenkoshiChart, type ChartItem } from './DenkoshiChart'

// ── 기출 메타데이터 ──────────────────────────────────────────────
const PAST_EXAMS = [
  { id: '20250525', label: '2025 상기', year: 2025, term: '상' as const },
  { id: '20251026', label: '2025 하기', year: 2025, term: '하' as const },
  { id: '20240526', label: '2024 상기', year: 2024, term: '상' as const },
  { id: '20241027', label: '2024 하기', year: 2024, term: '하' as const },
  { id: '20230528', label: '2023 상기', year: 2023, term: '상' as const },
  { id: '20231029', label: '2023 하기', year: 2023, term: '하' as const },
  { id: '20220529', label: '2022 상기', year: 2022, term: '상' as const },
  { id: '20221030', label: '2022 하기', year: 2022, term: '하' as const },
  { id: '20210530', label: '2021 상기', year: 2021, term: '상' as const },
  { id: '20211024', label: '2021 하기', year: 2021, term: '하' as const },
]
const YEARS = [2025, 2024, 2023, 2022, 2021]


// ── 타입 ────────────────────────────────────────────────────────
type DenkoshiSession = {
  id: string
  year: number | null
  session: number | null
  my_score: number | null
  comments: string | null
  drive_url: string | null
}

const scoreColor = (s: number | null) => {
  if (s === null) return 'text-gray-500'
  if (s >= 60) return 'text-green-400'
  if (s >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

// ── 메인 ────────────────────────────────────────────────────────
export default function DenkoshiHub() {
  const tab = 'scores'
  const [sessions, setSessions] = useState<DenkoshiSession[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editScore, setEditScore] = useState('')
  const [editComment, setEditComment] = useState('')
  const [saving, setSaving] = useState(false)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('exam_sessions')
      .select('id, year, session, my_score, comments, drive_url')
      .eq('exam_type', 'denkoshi')
    setSessions(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const getSession = (year: number, term: '상' | '하') =>
    sessions.find(s => s.year === year && s.session === (term === '상' ? 1 : 2)) ?? null

  const getExamId = (year: number, term: '상' | '하') =>
    PAST_EXAMS.find(e => e.year === year && e.term === term)?.id ?? ''

  const startEdit = (s: DenkoshiSession) => {
    setEditing(s.id)
    setExpanded(s.id)
    setEditScore(s.my_score?.toString() || '')
    setEditComment(s.comments || '')
  }

  const handleSave = async (s: DenkoshiSession) => {
    setSaving(true)
    await supabase.from('exam_sessions').update({
      my_score: editScore ? parseFloat(editScore) : null,
      comments: editComment || null,
    }).eq('id', s.id)
    await fetchSessions()
    setEditing(null)
    setSaving(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 기록을 삭제할까요?')) return
    await supabase.from('exam_sessions').delete().eq('id', id)
    await fetchSessions()
  }

  const scored = sessions.filter(s => s.my_score !== null)
  const passed = scored.filter(s => (s.my_score ?? 0) >= 60)
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((a, s) => a + (s.my_score ?? 0), 0) / scored.length)
    : null

  const chartData: ChartItem[] = [...sessions]
    .filter((s): s is DenkoshiSession & { my_score: number } => s.my_score !== null)
    .sort((a, b) => a.year !== b.year ? (a.year ?? 0) - (b.year ?? 0) : (a.session ?? 0) - (b.session ?? 0))
    .map(s => ({
      name: `${String(s.year).slice(2)}-${s.session === 1 ? '상' : '하'}`,
      score: s.my_score,
      fullName: `${s.year}년 ${s.session === 1 ? '상기' : '하기'}`,
    }))

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">
        {/* 헤더 */}
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🗾</span>
          <h1 className="text-2xl font-bold">第二種電気工事士 학과시험</h1>
          <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full">준비 중</span>
        </div>
        <p className="text-gray-500 text-sm mb-6">일본 경제산업성 · 2025.5.28 CBT 시험</p>

        {/* ── 탭: 기출풀이현황 ── */}
        {tab === 'scores' && (
          <div>
            {/* 요약 통계 */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">풀이 완료</p>
                <p className="text-2xl font-bold">{scored.length}<span className="text-sm text-gray-500 ml-1">/ 10</span></p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">60점 이상</p>
                <p className={`text-2xl font-bold ${passed.length > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                  {passed.length}회
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">평균 점수</p>
                <p className={`text-2xl font-bold ${scoreColor(avgScore)}`}>
                  {avgScore !== null ? `${avgScore}점` : '—'}
                </p>
              </div>
            </div>

            {/* 점수 추이 차트 */}
            {chartData.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-4 mb-5">
                <p className="text-xs text-gray-500 mb-3">점수 추이</p>
                <DenkoshiChart data={chartData} />
              </div>
            )}

            {/* 연도별 기출 그리드 — 풀이현황 통합 */}
            {loading ? (
              <p className="text-gray-500 text-sm">불러오는 중...</p>
            ) : (
              <div>
                <div className="grid grid-cols-[40px_1fr_1fr] gap-x-2 gap-y-1.5 items-start">
                  {/* 헤더 */}
                  <div />
                  <div className="text-xs text-gray-600 text-center pb-1">상기</div>
                  <div className="text-xs text-gray-600 text-center pb-1">하기</div>

                  {YEARS.map(year => {
                    const termS = getSession(year, '상')
                    const termH = getSession(year, '하')
                    return [
                      <div key={`${year}-label`} className="text-xs text-gray-600 text-right pt-2.5 pr-1">
                        {year}
                      </div>,
                      ...(['상', '하'] as const).map(term => {
                        const s = term === '상' ? termS : termH
                        const examId = getExamId(year, term)
                        return (
                          <button
                            key={`${year}-${term}`}
                            onClick={() => window.location.href = `/dashboard/denkoshi/${examId}`}
                            className="rounded-xl px-3 py-2 text-left transition w-full bg-gray-900 hover:bg-gray-800 hover:ring-1 hover:ring-blue-500/40 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{year} {term}기</span>
                              {s?.my_score != null && (
                                <span className={`text-xs font-bold tabular-nums ${scoreColor(s.my_score)}`}>
                                  {s.my_score}점
                                </span>
                              )}
                            </div>
                            {s?.comments && (
                              <p className="text-xs text-gray-600 truncate mt-0.5">{s.comments}</p>
                            )}
                            {!s && (
                              <p className="text-xs text-gray-700 mt-0.5">미풀이</p>
                            )}
                          </button>
                        )
                      })
                    ]
                  })}
                </div>

                <p className="text-gray-600 text-xs mt-3">클릭하면 PDF 뷰어 + 점수 기록으로 이동합니다.</p>

                {/* 플래시카드 섹션 */}
                <div className="mt-6 pt-6 border-t border-gray-800">
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">플래시카드</p>
                  <Link
                    href="/flashcard?exam=denkoshi"
                    className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-3 transition"
                  >
                    <div>
                      <p className="text-sm font-semibold">🃏 第二種 전용 덱</p>
                      <p className="text-xs text-gray-500 mt-0.5">법령·공사방법·배선재료·도기호·용어·패턴</p>
                    </div>
                    <span className="text-gray-600 text-xs">→</span>
                  </Link>
                </div>

                {/* 풀이 기록 상세 편집 */}
                {sessions.length > 0 && (
                  <div className="mt-6">
                    <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">풀이 기록 편집</p>
                    <div className="space-y-1.5">
                      {[...sessions]
                        .sort((a, b) => {
                          if (a.year !== b.year) return (b.year ?? 0) - (a.year ?? 0)
                          return (b.session ?? 0) - (a.session ?? 0)
                        })
                        .map(s => {
                          const isExpanded = expanded === s.id
                          const isEditing  = editing === s.id
                          const label = `${s.year}년 ${s.session === 1 ? '상기' : '하기'}`
                          return (
                            <div key={s.id} className="bg-gray-900 rounded-xl overflow-hidden">
                              <div
                                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-800 transition"
                                onClick={() => setExpanded(isExpanded ? null : s.id)}
                              >
                                <span className="font-semibold text-sm">{label}</span>
                                <div className="flex items-center gap-3">
                                  <span className={`text-sm font-bold ${scoreColor(s.my_score)}`}>
                                    {s.my_score !== null ? `${s.my_score}점` : '—'}
                                  </span>
                                  <span className="text-gray-600 text-xs">{isExpanded ? '▲' : '▼'}</span>
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="border-t border-gray-800 p-4">
                                  {isEditing ? (
                                    <div className="space-y-3">
                                      <div>
                                        <label className="text-xs text-gray-400 mb-1 block">점수 / 100</label>
                                        <input type="number" min="0" max="100"
                                          className="bg-gray-800 rounded-lg px-3 py-2 text-white w-28 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                          value={editScore}
                                          onChange={e => setEditScore(e.target.value)}
                                          placeholder="점수 입력"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-gray-400 mb-1 block">메모</label>
                                        <textarea
                                          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-white text-sm h-20 resize-none outline-none focus:ring-1 focus:ring-blue-500"
                                          placeholder="취약 영역, 오답 패턴 등..."
                                          value={editComment}
                                          onChange={e => setEditComment(e.target.value)}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <button onClick={() => handleSave(s)} disabled={saving}
                                          className="bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-lg text-xs font-semibold transition disabled:opacity-50">
                                          {saving ? '저장 중...' : '저장'}
                                        </button>
                                        <button onClick={() => setEditing(null)}
                                          className="bg-gray-700 hover:bg-gray-600 px-4 py-1.5 rounded-lg text-xs transition">
                                          취소
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      {s.comments && (
                                        <p className="text-sm text-gray-400 mb-3 leading-relaxed">{s.comments}</p>
                                      )}
                                      <div className="flex gap-2">
                                        <button onClick={() => startEdit(s)}
                                          className="bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg text-xs transition">
                                          편집
                                        </button>
                                        <button onClick={() => handleDelete(s.id)}
                                          className="text-gray-600 hover:text-red-400 px-3 py-1.5 rounded-lg text-xs transition">
                                          삭제
                                        </button>
                                        <Link
                                          href={`/dashboard/denkoshi/${getExamId(s.year ?? 0, s.session === 1 ? '상' : '하')}`}
                                          className="text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded-lg text-xs transition"
                                        >
                                          → 기출 보기
                                        </Link>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
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
