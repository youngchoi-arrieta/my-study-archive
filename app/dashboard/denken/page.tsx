'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── 過去問 메타데이터 (20개년 × 4과목) ─────────────────────────
// 電験三種: 理論 / 電力 / 機械 / 法規 (각 A問題+B問題, 90分, 60点合格)
// 2015~2024년 상기(8월), 하기(3월) 구성 — 연도별 1~2회
// CBT 도입 2023년~

const SUBJECTS = ['理論', '電力', '機械', '法規'] as const
type Subject = typeof SUBJECTS[number]

type DenkenExam = {
  id: string
  year: number
  term: '上期' | '下期' | ''  // 2023~ 상하기 분리
  label: string
}

// 2005~2024년 (20개년)
// 2023년부터 CBT 도입으로 上期(8월)/下期(3월) 분리
const PAST_EXAMS: DenkenExam[] = [
  ...([2024, 2023].flatMap(y => [
    { id: `dk_${y}_1`, year: y, term: '上期' as const, label: `${y}年 上期` },
    { id: `dk_${y}_2`, year: y, term: '下期' as const, label: `${y}年 下期` },
  ])),
  ...[2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015, 2014, 2013, 2012, 2011, 2010, 2009, 2008, 2007].map(y => ({
    id: `dk_${y}_0`, year: y, term: '' as const, label: `${y}年`,
  })),
]

const YEARS_ORDER = [...new Set(PAST_EXAMS.map(e => e.year))].sort((a, b) => b - a)

// ── 타입 ────────────────────────────────────────────────────────
type DenkenSession = {
  exam_id: string
  subject: Subject
  my_score: number | null
  memo: string | null
  updated_at: string
}

const SUBJECT_COLORS: Record<Subject, string> = {
  '理論': '#2563eb',
  '電力': '#059669',
  '機械': '#7c3aed',
  '法規': '#b45309',
}

const scoreColor = (s: number | null) => {
  if (s === null) return 'text-gray-600'
  if (s >= 60) return 'text-green-400'
  if (s >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

// ── 메인 ────────────────────────────────────────────────────────
export default function DenkenHub() {
  const [activeTab, setActiveTab]   = useState<'scores' | 'analysis'>('scores')
  const [sessions, setSessions]     = useState<DenkenSession[]>([])
  const [loading, setLoading]       = useState(true)
  const [editKey, setEditKey]       = useState<string | null>(null)  // `${exam_id}__${subject}`
  const [editScore, setEditScore]   = useState('')
  const [editMemo, setEditMemo]     = useState('')
  const [saving, setSaving]         = useState(false)
  const [filterSubject, setFilterSubject] = useState<Subject | null>(null)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('denken_sessions')
      .select('exam_id, subject, my_score, memo, updated_at')
    setSessions((data || []) as DenkenSession[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  const sessionMap = useMemo(() => {
    const map = new Map<string, DenkenSession>()
    sessions.forEach(s => map.set(`${s.exam_id}__${s.subject}`, s))
    return map
  }, [sessions])

  const getSession = (examId: string, subject: Subject) =>
    sessionMap.get(`${examId}__${subject}`) ?? null

  const startEdit = (examId: string, subject: Subject) => {
    const key = `${examId}__${subject}`
    const s   = sessionMap.get(key)
    setEditKey(editKey === key ? null : key)
    setEditScore(s?.my_score?.toString() || '')
    setEditMemo(s?.memo || '')
  }

  const handleSave = async () => {
    if (!editKey) return
    setSaving(true)
    const [examId, subject] = editKey.split('__') as [string, Subject]
    const payload = {
      exam_id: examId,
      subject,
      my_score: editScore ? parseFloat(editScore) : null,
      memo: editMemo.trim() || null,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('denken_sessions').upsert(payload, { onConflict: 'exam_id,subject' })
    await fetchSessions()
    setEditKey(null)
    setSaving(false)
  }

  // ── 통계 ─────────────────────────────────────────────────────
  const totalAttempts  = sessions.filter(s => s.my_score !== null).length
  const passedAttempts = sessions.filter(s => (s.my_score ?? 0) >= 60).length

  const subjectStats = useMemo(() => SUBJECTS.map(sub => {
    const subs = sessions.filter(s => s.subject === sub && s.my_score !== null)
    const avg  = subs.length === 0 ? null
      : Math.round(subs.reduce((a, s) => a + (s.my_score ?? 0), 0) / subs.length)
    const best = subs.length === 0 ? null : Math.max(...subs.map(s => s.my_score ?? 0))
    const passed = subs.filter(s => (s.my_score ?? 0) >= 60).length
    return { sub, count: subs.length, avg, best, passed }
  }), [sessions])

  const visibleExams = filterSubject ? PAST_EXAMS : PAST_EXAMS

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-3xl mx-auto">

        {/* 헤더 */}
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🏭</span>
          <h1 className="text-2xl font-bold">電験三種</h1>
          <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full">준비 중</span>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          일본 경제산업성 · CBT 전 과목 등록 완료 · 理論 · 電力 · 機械 · 法規
        </p>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6">
          {([
            { key: 'scores',   label: '📋 기출 풀이 현황' },
            { key: 'analysis', label: '📊 과목별 분석' },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                activeTab === key
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 기출 풀이 현황 탭 ── */}
        {activeTab === 'scores' && (
          <div>
            {/* 요약 카드 */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">풀이 완료 (과목)</p>
                <p className="text-2xl font-bold">
                  {totalAttempts}
                  <span className="text-sm text-gray-500 ml-1">/ {PAST_EXAMS.length * 4}</span>
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">합격 과목</p>
                <p className={`text-2xl font-bold ${passedAttempts > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                  {passedAttempts}
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">총 회차</p>
                <p className="text-2xl font-bold text-blue-400">{PAST_EXAMS.length}</p>
              </div>
            </div>

            {/* 과목 필터 */}
            <div className="flex gap-1.5 flex-wrap mb-4">
              <button
                onClick={() => setFilterSubject(null)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                  filterSubject === null ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                전 과목
              </button>
              {SUBJECTS.map(sub => (
                <button
                  key={sub}
                  onClick={() => setFilterSubject(filterSubject === sub ? null : sub)}
                  style={filterSubject === sub ? { backgroundColor: SUBJECT_COLORS[sub] } : undefined}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    filterSubject === sub ? 'text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {sub}
                </button>
              ))}
            </div>

            {/* 기출 목록 */}
            {loading ? (
              <p className="text-gray-500 text-sm">불러오는 중...</p>
            ) : (
              <div className="space-y-2">
                {YEARS_ORDER.map(year => {
                  const examsForYear = PAST_EXAMS.filter(e => e.year === year)
                  return examsForYear.map(exam => (
                    <div key={exam.id} className="bg-gray-900 rounded-xl overflow-hidden">
                      {/* 회차 헤더 */}
                      <div className="px-4 py-3 border-b border-gray-800">
                        <p className="text-sm font-semibold text-gray-300">{exam.label}</p>
                      </div>
                      {/* 과목 그리드 */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-800">
                        {(filterSubject ? [filterSubject] : SUBJECTS).map(sub => {
                          const s   = getSession(exam.id, sub)
                          const key = `${exam.id}__${sub}`
                          const isEdit = editKey === key
                          return (
                            <div key={sub} className="bg-gray-950">
                              <button
                                onClick={() => startEdit(exam.id, sub)}
                                className="w-full p-3 text-left hover:bg-gray-900 transition"
                              >
                                <div className="flex items-center gap-1.5 mb-1">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: SUBJECT_COLORS[sub] }}
                                  />
                                  <span className="text-xs text-gray-500">{sub}</span>
                                </div>
                                <p className={`text-lg font-bold tabular-nums ${scoreColor(s?.my_score ?? null)}`}>
                                  {s?.my_score != null ? `${s.my_score}点` : '—'}
                                </p>
                                {s?.memo && (
                                  <p className="text-[10px] text-blue-500 mt-0.5 truncate">메모 있음</p>
                                )}
                              </button>
                              {/* 인라인 편집 패널 */}
                              {isEdit && (
                                <div className="border-t border-gray-800 p-3 bg-gray-900 space-y-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    value={editScore}
                                    onChange={e => setEditScore(e.target.value)}
                                    placeholder="점수"
                                    className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                  />
                                  <textarea
                                    rows={2}
                                    value={editMemo}
                                    onChange={e => setEditMemo(e.target.value)}
                                    placeholder="오답 메모..."
                                    className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                                  />
                                  <div className="flex gap-1.5">
                                    <button
                                      onClick={handleSave}
                                      disabled={saving}
                                      className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-1 rounded-lg text-xs font-semibold transition"
                                    >
                                      {saving ? '…' : '저장'}
                                    </button>
                                    <button
                                      onClick={() => setEditKey(null)}
                                      className="flex-1 bg-gray-700 hover:bg-gray-600 py-1 rounded-lg text-xs transition"
                                    >
                                      닫기
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 과목별 분석 탭 ── */}
        {activeTab === 'analysis' && (
          <div className="space-y-3">
            {subjectStats.map(({ sub, count, avg, best, passed }) => (
              <div key={sub} className="bg-gray-900 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: SUBJECT_COLORS[sub] }}
                  />
                  <h3 className="font-bold">{sub}</h3>
                  <span className="text-xs text-gray-600 ml-auto">{count}회 풀이</span>
                </div>
                {count === 0 ? (
                  <p className="text-xs text-gray-700">아직 풀이 기록이 없어요.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">평균</p>
                      <p className={`text-xl font-bold ${scoreColor(avg)}`}>{avg}点</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">최고</p>
                      <p className={`text-xl font-bold ${scoreColor(best)}`}>{best}点</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-500 mb-1">합격 횟수</p>
                      <p className={`text-xl font-bold ${passed > 0 ? 'text-green-400' : 'text-gray-600'}`}>
                        {passed}
                      </p>
                    </div>
                  </div>
                )}
                {/* 평균 점수 바 */}
                {avg !== null && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-800 rounded-full h-2">
                      <div
                        className="h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${avg}%`,
                          backgroundColor: avg >= 60 ? '#22c55e' : avg >= 40 ? '#eab308' : '#ef4444',
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-gray-700">0</span>
                      <span className="text-[10px] text-gray-600">합격 60点</span>
                      <span className="text-[10px] text-gray-700">100</span>
                    </div>
                  </div>
                )}
                {/* 오답 메모 목록 */}
                {sessions.filter(s => s.subject === sub && s.memo).length > 0 && (
                  <div className="mt-3 border-t border-gray-800 pt-3 space-y-1.5">
                    <p className="text-[10px] text-gray-600 uppercase tracking-widest">오답 메모</p>
                    {sessions
                      .filter(s => s.subject === sub && s.memo)
                      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                      .map(s => {
                        const exam = PAST_EXAMS.find(e => e.id === s.exam_id)
                        return (
                          <div key={s.exam_id} className="flex gap-2">
                            <span className="text-[10px] text-gray-700 shrink-0 w-16">{exam?.label.replace('年', '')}</span>
                            <p className="text-xs text-gray-400 leading-relaxed">{s.memo}</p>
                          </div>
                        )
                      })
                    }
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </main>
  )
}
