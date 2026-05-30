'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import type { ChartItem } from './DenkoshiChart'
const DenkoshiChart = dynamic(
  () => import('./DenkoshiChart').then(m => ({ default: m.DenkoshiChart })),
  { ssr: false, loading: () => <div style={{ height: 180, background: '#111827', borderRadius: 12 }} /> }
)
import { SEITO_TOC, SECTION_MAP } from '@/lib/constants-denkoshi'

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
  { id: '20200524', label: '2020 상기', year: 2020, term: '상' as const },
  { id: '20201025', label: '2020 하기', year: 2020, term: '하' as const },
  { id: '20190602', label: '2019 상기', year: 2019, term: '상' as const },
  { id: '20191027', label: '2019 하기', year: 2019, term: '하' as const },
  { id: '20180603', label: '2018 상기', year: 2018, term: '상' as const },
  { id: '20181007', label: '2018 하기', year: 2018, term: '하' as const },
]
const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018]

// ── 타입 ────────────────────────────────────────────────────────
type DenkoshiSession = {
  id: string
  year: number | null
  session: number | null
  my_score: number | null
  comments: string | null
  drive_url: string | null
}

type SectionTagRow = {
  exam_id: string
  q_num: number
  section_code: string
  section_codes?: string[]
  result: 'correct' | 'wrong' | null
}

type CustomExam = {
  id: string
  label: string
  year: number
  term: '상' | '하'
}

const scoreColor = (s: number | null) => {
  if (s === null) return 'text-gray-500'
  if (s >= 60) return 'text-green-400'
  if (s >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

// 장번호 → 색상 (tailwind inline style 대신 hex 사용)
const CH_COLORS: Record<number, string> = {
  1: '#0284c7', // sky
  2: '#059669', // emerald
  3: '#7c3aed', // violet
  4: '#b45309', // amber
  5: '#be123c', // rose
  6: '#c2410c', // orange
  7: '#0f766e', // teal
}

function heatColor(count: number, max: number): string {
  if (count === 0) return 'bg-gray-800'
  const ratio = count / Math.max(max, 1)
  if (ratio >= 0.8) return 'bg-blue-500'
  if (ratio >= 0.6) return 'bg-blue-600/80'
  if (ratio >= 0.4) return 'bg-blue-700/60'
  if (ratio >= 0.2) return 'bg-blue-800/50'
  return 'bg-blue-900/40'
}

// ── 빈도 히트맵 컴포넌트 ─────────────────────────────────────────
function FrequencyMatrix({ allTags }: { allTags: SectionTagRow[] }) {
  const [filterCh, setFilterCh] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'bar' | 'heatmap'>('bar')
  const [sortMode, setSortMode] = useState<'freq' | 'section'>('freq')
  const [qRange, setQRange] = useState<'all' | 'general' | 'wiring'>('all')

  // qRange 필터 적용 태그
  const filteredTags = useMemo(() => {
    if (qRange === 'general') return allTags.filter(t => t.q_num <= 30)
    if (qRange === 'wiring')  return allTags.filter(t => t.q_num >= 31)
    return allTags
  }, [allTags, qRange])

  // 섹션별 총 출제 횟수
  const sectionCounts = useMemo(() => {
    const map = new Map<string, number>()
    filteredTags.forEach(t => {
      map.set(t.section_code, (map.get(t.section_code) || 0) + 1)
    })
    return map
  }, [filteredTags])

  // 섹션 × 회차 매트릭스
  const matrix = useMemo(() => {
    const map = new Map<string, Map<string, number>>()
    filteredTags.forEach(t => {
      if (!map.has(t.section_code)) map.set(t.section_code, new Map())
      const examMap = map.get(t.section_code)!
      examMap.set(t.exam_id, (examMap.get(t.exam_id) || 0) + 1)
    })
    return map
  }, [filteredTags])

  const taggedExamIds = useMemo(() =>
    [...new Set(allTags.map(t => t.exam_id))]
      .sort((a, b) => b.localeCompare(a)),
    [allTags]
  )

  const chapters = filterCh !== null
    ? SEITO_TOC.filter(c => c.ch === filterCh)
    : SEITO_TOC

  const visibleSections = useMemo(() => {
    const base = chapters.flatMap(ch =>
      ch.sections.filter(s => sectionCounts.has(s.code))
    )
    if (sortMode === 'freq') {
      return base.sort((a, b) => (sectionCounts.get(b.code) || 0) - (sectionCounts.get(a.code) || 0))
    } else {
      return base.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    }
  }, [chapters, sectionCounts, sortMode])

  const maxCount = Math.max(...[...sectionCounts.values()], 1)

  if (allTags.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-600 text-sm">아직 태그된 문제가 없어요.</p>
        <p className="text-gray-700 text-xs mt-1">기출 회차를 열어 소단원을 태그하면 여기에 빈도가 집계됩니다.</p>
      </div>
    )
  }

  return (
    <div>
      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">태그된 문제</p>
          <p className="text-2xl font-bold">{allTags.length}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">출제된 소단원</p>
          <p className="text-2xl font-bold text-blue-400">{sectionCounts.size}</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 text-center">
          <p className="text-xs text-gray-500 mb-1">분석된 회차</p>
          <p className="text-2xl font-bold text-purple-400">{taggedExamIds.length}</p>
        </div>
      </div>

      {/* 문제 구분 탭 */}
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-3">
        {([
          { key: 'all',     label: '전체 (1~50번)' },
          { key: 'general', label: '一般問題 (1~30번)' },
          { key: 'wiring',  label: '配線図問題 (31~50번)' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setQRange(key)}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition ${
              qRange === key ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 장 필터 + 뷰 전환 */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterCh(null)}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
              filterCh === null ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            전체
          </button>
          {SEITO_TOC.filter(ch => ch.sections.some(s => sectionCounts.has(s.code))).map(ch => (
            <button
              key={ch.ch}
              onClick={() => setFilterCh(filterCh === ch.ch ? null : ch.ch)}
              style={{ backgroundColor: filterCh === ch.ch ? CH_COLORS[ch.ch] : undefined }}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition ${
                filterCh === ch.ch ? 'text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {ch.ch}장
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
            {(['freq', 'section'] as const).map(s => (
              <button key={s} onClick={() => setSortMode(s)}
                className={`px-2.5 py-1 rounded-md text-xs transition ${
                  sortMode === s ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {s === 'freq' ? '빈도순' : '단원순'}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
            {(['bar', 'heatmap'] as const).map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                className={`px-2.5 py-1 rounded-md text-xs transition ${
                  viewMode === m ? 'bg-gray-600 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}>
                {m === 'bar' ? '바 차트' : '히트맵'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 바 차트 뷰 ── */}
      {viewMode === 'bar' && (
        <div className="space-y-1.5">
          {visibleSections.map(s => {
            const count = sectionCounts.get(s.code) || 0
            const chNum = parseInt(s.code.split('-')[0])
            const color = CH_COLORS[chNum]
            const pct = (count / maxCount) * 100
            return (
              <div key={s.code} className="flex items-center gap-2 group">
                <span className="text-xs text-gray-600 w-8 text-right shrink-0 font-mono">{s.code}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-5 overflow-hidden">
                  <div
                    className="h-full rounded-full flex items-center px-2 transition-all duration-300"
                    style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }}
                  >
                    <span className="text-white text-[10px] font-bold whitespace-nowrap">{count}문</span>
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-32 truncate shrink-0 hidden md:block">{s.ko}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 히트맵 뷰 ── */}
      {viewMode === 'heatmap' && taggedExamIds.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-gray-600 font-normal pb-2 pr-3 w-20">소단원</th>
                {taggedExamIds.map(eid => {
                  const ex = PAST_EXAMS.find(e => e.id === eid)
                  return (
                    <th key={eid} className="text-gray-600 font-normal pb-2 px-1 text-center min-w-[36px]">
                      {ex ? `${String(ex.year).slice(2)}${ex.term}` : eid.slice(2, 6)}
                    </th>
                  )
                })}
                <th className="text-gray-400 font-bold pb-2 pl-2 text-center">계</th>
              </tr>
            </thead>
            <tbody>
              {visibleSections.map(s => {
                const total = sectionCounts.get(s.code) || 0
                const examMap = matrix.get(s.code)
                return (
                  <tr key={s.code} className="group hover:bg-gray-900/50">
                    <td className="pr-3 py-0.5">
                      <div>
                        <span className="font-mono text-gray-400">{s.code}</span>
                        <span className="text-gray-600 ml-1 hidden md:inline truncate max-w-[120px]">{s.ko}</span>
                      </div>
                    </td>
                    {taggedExamIds.map(eid => {
                      const cnt = examMap?.get(eid) || 0
                      return (
                        <td key={eid} className="px-1 py-0.5 text-center">
                          {cnt > 0 ? (
                            <span className={`inline-block w-7 h-5 rounded text-[10px] font-bold leading-5 text-white ${heatColor(cnt, 5)}`}>
                              {cnt}
                            </span>
                          ) : (
                            <span className="inline-block w-7 h-5 rounded bg-gray-800/30" />
                          )}
                        </td>
                      )
                    })}
                    <td className="pl-2 py-0.5 text-center font-bold text-blue-400">{total}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────
export default function DenkoshiHub() {
  const [activeTab, setActiveTab] = useState<'scores' | 'frequency' | 'tools'>('scores')
  const [sessions, setSessions] = useState<DenkoshiSession[]>([])
  const [allTags, setAllTags] = useState<SectionTagRow[]>([])
  const [customExams, setCustomExams] = useState<CustomExam[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const [editScore, setEditScore] = useState('')
  const [saving, setSaving] = useState(false)
  // 기출 추가 폼
  const [addYear, setAddYear] = useState('')
  const [addTerm, setAddTerm] = useState<'상' | '하'>('상')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState('')

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('exam_sessions')
      .select('id, year, session, my_score, comments, drive_url')
      .eq('exam_type', 'denkoshi')
    setSessions(data || [])
    setLoading(false)
  }, [])

  const fetchAllTags = useCallback(async () => {
    const { data } = await supabase
      .from('denkoshi_section_tags')
      .select('exam_id, q_num, section_code, section_codes, result')
    setAllTags((data || []) as SectionTagRow[])
  }, [])

  const fetchCustomExams = useCallback(async () => {
    const { data } = await supabase
      .from('denkoshi_custom_exams')
      .select('id, label, year, term')
      .order('year', { ascending: false })
    setCustomExams((data || []) as CustomExam[])
  }, [])

  useEffect(() => {
    fetchSessions()
    fetchAllTags()
    fetchCustomExams()
  }, [fetchSessions, fetchAllTags, fetchCustomExams])

  // 커스텀 기출 추가 핸들러
  const handleAddCustomExam = async () => {
    setAddError('')
    const y = parseInt(addYear)
    if (!addYear || isNaN(y) || y < 2010 || y > 2030) {
      setAddError('연도를 올바르게 입력하세요 (2010~2030)')
      return
    }
    const isInPast = PAST_EXAMS.some(e => e.year === y && e.term === addTerm)
    if (isInPast) {
      setAddError(`${y} ${addTerm}기는 이미 기본 목록에 있어요`)
      return
    }
    const isInCustom = customExams.some(e => e.year === y && e.term === addTerm)
    if (isInCustom) {
      setAddError(`${y} ${addTerm}기는 이미 추가됐어요`)
      return
    }
    setAddBusy(true)
    const id    = `cx_${y}_${addTerm === '상' ? 1 : 2}`
    const label = `${y} ${addTerm}기 (추가)`
    const { error } = await supabase
      .from('denkoshi_custom_exams')
      .insert({ id, label, year: y, term: addTerm })
    if (error) {
      setAddError('저장 실패: ' + error.message)
    } else {
      setAddYear('')
      await fetchCustomExams()
    }
    setAddBusy(false)
  }

  const handleDeleteCustomExam = async (id: string) => {
    if (!confirm('이 기출을 목록에서 삭제할까요? (풀이 기록은 유지됩니다)')) return
    await supabase.from('denkoshi_custom_exams').delete().eq('id', id)
    await fetchCustomExams()
  }

  // PAST_EXAMS + customExams 병합
  const allExams = useMemo(() => [
    ...PAST_EXAMS,
    ...customExams.map(c => ({ id: c.id, label: c.label, year: c.year, term: c.term })),
  ], [customExams])

  const allYears = useMemo(() =>
    [...new Set(allExams.map(e => e.year))].sort((a, b) => b - a),
    [allExams]
  )

  const getSession = (year: number, term: '상' | '하') =>
    sessions.find(s => s.year === year && s.session === (term === '상' ? 1 : 2)) ?? null

  const getExamId = (year: number, term: '상' | '하') =>
    allExams.find(e => e.year === year && e.term === term)?.id ?? ''

  const startEdit = (s: DenkoshiSession) => {
    setEditing(s.id)
    setExpanded(s.id)
    setEditScore(s.my_score?.toString() || '')
  }

  const handleSave = async (s: DenkoshiSession) => {
    setSaving(true)
    await supabase.from('exam_sessions').update({
      my_score: editScore ? parseFloat(editScore) : null,
      // comments는 [id] 상세 페이지에서만 수정 (JSON groupMemos 보존)
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
  const bestScore = scored.length > 0
    ? Math.max(...scored.map(s => s.my_score ?? 0))
    : null

  // 오답 분석 — result 있는 태그만
  const resultTags = allTags.filter(t => t.result !== null)
  const generalTags = resultTags.filter(t => t.q_num <= 30)
  const wiringTags  = resultTags.filter(t => t.q_num >= 31)

  const correctRate = (tags: SectionTagRow[]) =>
    tags.length === 0 ? null : Math.round(tags.filter(t => t.result === 'correct').length / tags.length * 100)

  // 단원별 정답률 (1~7장)
  const chapterStats = Array.from({ length: 7 }, (_, i) => {
    const ch = i + 1
    const chTags = resultTags.filter(t => {
      const codes = t.section_codes?.length ? t.section_codes : (t.section_code ? [t.section_code] : [])
      return codes.some(c => parseInt(c.split('-')[0]) === ch)
    })
    const genTags = chTags.filter(t => t.q_num <= 30)
    const wirTags = chTags.filter(t => t.q_num >= 31)
    return {
      ch,
      total: chTags.length,
      rate: correctRate(chTags),
      genRate: correctRate(genTags),
      wirRate: correctRate(wirTags),
    }
  }).filter(c => c.total > 0)

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
          <span className="text-xs bg-green-600/30 text-green-400 px-2 py-0.5 rounded-full">취득</span>
        </div>
        <p className="text-gray-500 text-sm mb-5">일본 경제산업성 · 2025.5.28 CBT 시험</p>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6">
          {([
            { key: 'scores', label: '📋 기출 현황' },
            { key: 'frequency', label: '📊 출제 빈도' },
            { key: 'tools', label: '🔧 도구·편집' },
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

        {/* ── 탭: 기출풀이현황 ── */}
        {activeTab === 'scores' && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">풀이 완료</p>
                <p className="text-2xl font-bold">{scored.length}<span className="text-sm text-gray-500 ml-1">/ {allExams.length}</span></p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">합격권 도달</p>
                <p className={`text-2xl font-bold ${passed.length > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                  {passed.length}회
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">최고 점수</p>
                <p className={`text-2xl font-bold ${scoreColor(bestScore)}`}>
                  {bestScore !== null ? `${bestScore}점` : '—'}
                </p>
              </div>
            </div>

            {chartData.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-4 mb-5">
                <p className="text-xs text-gray-500 mb-3">점수 추이</p>
                <DenkoshiChart data={chartData} />
              </div>
            )}

            {/* 오답 분석 */}
            {resultTags.length > 0 && (
              <div className="bg-gray-900 rounded-xl p-4 mb-5 space-y-4">
                <p className="text-xs text-gray-500 uppercase tracking-widest">오답 분석</p>

                {/* 一般 vs 配線 */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '一般問題 (1~30번)', tags: generalTags, color: 'bg-blue-500' },
                    { label: '配線図問題 (31~50번)', tags: wiringTags, color: 'bg-orange-500' },
                  ].map(({ label, tags, color }) => {
                    const rate = correctRate(tags)
                    const correct = tags.filter(t => t.result === 'correct').length
                    return (
                      <div key={label} className="bg-gray-800 rounded-xl p-3">
                        <p className="text-xs text-gray-500 mb-2">{label}</p>
                        {rate === null ? (
                          <p className="text-xs text-gray-600">데이터 없음</p>
                        ) : (
                          <>
                            <p className={`text-2xl font-bold mb-1 ${rate >= 60 ? 'text-green-400' : rate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                              {rate}%
                            </p>
                            <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
                              <div className={`${color} h-1.5 rounded-full`} style={{ width: `${rate}%` }} />
                            </div>
                            <p className="text-xs text-gray-600">{correct} / {tags.length}문제</p>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* 단원별 정답률 — 一般/配線 분리 바 */}
                {chapterStats.length > 0 && (
                  <div>
                    <div className="flex items-center gap-4 mb-3">
                      <p className="text-xs text-gray-600">단원별 정답률</p>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] text-blue-400">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />一般 1~30
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-orange-400">
                          <span className="w-2 h-2 rounded-full bg-orange-500 inline-block" />配線 31~50
                        </span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      {chapterStats.map(({ ch, genRate, wirRate }) => {
                        const chData = SEITO_TOC.find(c => c.ch === ch)
                        const barColor = (rate: number) =>
                          rate >= 70 ? 'bg-green-500' : rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        return (
                          <div key={ch} className="flex items-start gap-3">
                            <span className="text-xs text-gray-500 w-4 text-right shrink-0 mt-1">{ch}장</span>
                            <div className="flex-1 space-y-1.5">
                              <span className="text-xs text-gray-400">{chData?.ko}</span>
                              {/* 一般 바 */}
                              {genRate !== null ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-blue-400 w-16 shrink-0">一般 {genRate}%</span>
                                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                                    <div className={`${barColor(genRate)} h-1.5 rounded-full`} style={{ width: `${genRate}%` }} />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-700 w-16 shrink-0">一般 —</span>
                                  <div className="flex-1 bg-gray-800/40 rounded-full h-1.5" />
                                </div>
                              )}
                              {/* 配線 바 */}
                              {wirRate !== null ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-orange-400 w-16 shrink-0">配線 {wirRate}%</span>
                                  <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                                    <div className={`${barColor(wirRate)} h-1.5 rounded-full`} style={{ width: `${wirRate}%` }} />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-700 w-16 shrink-0">配線 —</span>
                                  <div className="flex-1 bg-gray-800/40 rounded-full h-1.5" />
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <p className="text-gray-500 text-sm">불러오는 중...</p>
            ) : (
              <div>
                <div className="grid grid-cols-[40px_1fr_1fr] gap-x-2 gap-y-1.5 items-start">
                  <div />
                  <div className="text-xs text-gray-600 text-center pb-1">상기</div>
                  <div className="text-xs text-gray-600 text-center pb-1">하기</div>

                  {allYears.map(year => {
                    const termS = getSession(year, '상')
                    const termH = getSession(year, '하')
                    return [
                      <div key={`${year}-label`} className="text-xs text-gray-600 text-right pt-2.5 pr-1">
                        {year}
                      </div>,
                      ...(['상', '하'] as const).map(term => {
                        const s = term === '상' ? termS : termH
                        const examId = getExamId(year, term)
                        // 해당 회차에 태그된 문제 수
                        const tagCount = allTags.filter(t => t.exam_id === examId).length
                        return (
                          <button
                            key={`${year}-${term}`}
                            onClick={() => window.location.href = `/dashboard/denkoshi/${examId}`}
                            className="rounded-xl px-3 py-2 text-left transition w-full bg-gray-900 hover:bg-gray-800 hover:ring-1 hover:ring-blue-500/40 group"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{year} {term}기</span>
                              <div className="flex items-center gap-2">
                                {tagCount > 0 && (
                                  <span className="text-[10px] text-blue-500">{tagCount}태그</span>
                                )}
                                {s?.my_score != null && (
                                  <span className={`text-xs font-bold tabular-nums ${scoreColor(s.my_score)}`}>
                                    {s.my_score}점
                                  </span>
                                )}
                              </div>
                            </div>
                            {s?.comments && (() => {
                              try {
                                const parsed = JSON.parse(s.comments!)
                                const gm = parsed?.groupMemos as Record<string, string> | undefined
                                const count = gm ? Object.values(gm).filter(Boolean).length : 0
                                if (count > 0) return <p className="text-xs text-blue-600 mt-0.5">메모 {count}개</p>
                                return null
                              } catch {
                                return <p className="text-xs text-gray-600 truncate mt-0.5">{s.comments}</p>
                              }
                            })()}
                            {!s && tagCount === 0 && (
                              <p className="text-xs text-gray-700 mt-0.5">미풀이</p>
                            )}
                          </button>
                        )
                      })
                    ]
                  })}
                </div>

                <p className="text-gray-600 text-xs mt-3">클릭하면 PDF 뷰어 + 소단원 매핑으로 이동합니다.</p>
              </div>
            )}
          </div>
        )}

        {/* ── 탭: 소단원 출제 빈도 ── */}
        {activeTab === 'frequency' && (
          <FrequencyMatrix allTags={allTags} />
        )}

        {/* ── 탭: 도구·편집 ── */}
        {activeTab === 'tools' && (
          <div className="space-y-6">

            {/* 기출 추가 폼 */}
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">기출 추가</p>
              <div className="bg-gray-900 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-500">
                  기본 목록(2018~2025)에 없는 연도를 추가해요. 추가하면 기출현황 탭에 바로 나타납니다.
                </p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={addYear}
                    onChange={e => setAddYear(e.target.value)}
                    placeholder="연도 (예: 2017)"
                    className="flex-1 bg-gray-800 rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                  />
                  <div className="flex bg-gray-800 rounded-lg overflow-hidden">
                    {(['상', '하'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setAddTerm(t)}
                        className={`px-4 py-2 text-sm font-bold transition ${
                          addTerm === t ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'
                        }`}
                      >
                        {t}기
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleAddCustomExam}
                    disabled={addBusy || !addYear}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 disabled:text-gray-600 px-4 py-2 rounded-lg text-sm font-bold transition"
                  >
                    {addBusy ? '…' : '추가'}
                  </button>
                </div>
                {addError && <p className="text-xs text-red-400">{addError}</p>}

                {customExams.length > 0 && (
                  <div className="border-t border-gray-800 pt-3 space-y-1.5">
                    <p className="text-xs text-gray-600 mb-2">추가된 기출</p>
                    {customExams.map(ce => (
                      <div key={ce.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-300">{ce.label}</span>
                        <button
                          onClick={() => handleDeleteCustomExam(ce.id)}
                          className="text-xs text-gray-600 hover:text-red-400 transition"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 분석 도구 */}
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-widest mb-3">분석 도구</p>
              <div className="space-y-2">
                <Link
                  href="/dashboard/denkoshi/wiring"
                  className="flex items-center justify-between bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-3 transition"
                >
                  <div>
                    <p className="text-sm font-semibold">📐 배선도 분석</p>
                    <p className="text-xs text-gray-500 mt-0.5">배선도 이미지 + 자문자답 Q&A 세션</p>
                  </div>
                  <span className="text-gray-600 text-xs">→</span>
                </Link>
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
            </div>

            {/* 풀이 기록 편집 */}
            {sessions.length > 0 && (
              <div>
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
                                  <p className="text-xs text-gray-700">영역별 메모는 기출 상세 페이지에서 편집할 수 있습니다.</p>
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
                                  {s.comments && (() => {
                                    try {
                                      const parsed = JSON.parse(s.comments)
                                      const gm = parsed?.groupMemos as Record<string, string> | undefined
                                      const entries = gm ? Object.entries(gm).filter(([, v]) => v) : []
                                      if (entries.length === 0) return null
                                      return (
                                        <div className="mb-3 space-y-1.5 bg-gray-800 rounded-xl p-3">
                                          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">영역별 메모</p>
                                          {entries.map(([k, v]) => (
                                            <p key={k} className="text-xs text-gray-300">
                                              <span className="text-gray-500 mr-1">{k}번</span>{String(v)}
                                            </p>
                                          ))}
                                        </div>
                                      )
                                    } catch {
                                      return <p className="text-sm text-gray-400 mb-3 leading-relaxed">{s.comments}</p>
                                    }
                                  })()}
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
    </main>
  )
}
