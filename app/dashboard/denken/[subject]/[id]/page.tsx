'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── 과목 메타 ──────────────────────────────────────────────────────
const SUBJECT_META: Record<string, { color: string; accent: string; label: string }> = {
  '理論': { color: '#2563eb', accent: '#1d4ed8', label: '理論' },
  '電力': { color: '#059669', accent: '#047857', label: '電力' },
  '法規': { color: '#b45309', accent: '#92400e', label: '法規' },
}

// 기출 메타 (denken/page.tsx의 PAST_EXAMS와 동일 포맷)
const PAST_EXAMS: Record<string, { label: string; year: number; term: string }> = {
  'dk_2026_1': { label: '令和8年 上期',  year: 2026, term: '上期' },
  'dk_2025_1': { label: '令和7年 上期',  year: 2025, term: '上期' },
  'dk_2025_2': { label: '令和7年 下期',  year: 2025, term: '下期' },
  'dk_2024_1': { label: '令和6年 上期',  year: 2024, term: '上期' },
  'dk_2024_2': { label: '令和6年 下期',  year: 2024, term: '下期' },
  'dk_2023_1': { label: '令和5年 上期',  year: 2023, term: '上期' },
  'dk_2023_2': { label: '令和5年 下期',  year: 2023, term: '下期' },
  'dk_2022_0': { label: '令和4年',       year: 2022, term: '' },
  'dk_2021_0': { label: '令和3年',       year: 2021, term: '' },
  'dk_2020_0': { label: '令和2年',       year: 2020, term: '' },
  'dk_2019_0': { label: '令和元年',      year: 2019, term: '' },
  'dk_2018_0': { label: '平成30年',      year: 2018, term: '' },
  'dk_2017_0': { label: '平成29年',      year: 2017, term: '' },
  'dk_2016_0': { label: '平成28年',      year: 2016, term: '' },
  'dk_2015_0': { label: '平成27年',      year: 2015, term: '' },
  'dk_2014_0': { label: '平成26年',      year: 2014, term: '' },
}

// 과목별 문제 수 & 선택문제
const SUBJECT_CONFIG: Record<string, {
  totalQ: number
  selectPair: [number, number] | null
  scoreA: number   // A문제 배점
  scoreB: number   // B문제 배점
  splitAt: number  // A/B 경계 (이하 A문제)
}> = {
  '理論': { totalQ: 18, selectPair: [17, 18], scoreA: 5, scoreB: 10, splitAt: 14 },
  '電力': { totalQ: 18, selectPair: [17, 18], scoreA: 5, scoreB: 10, splitAt: 14 },
  '法規': { totalQ: 13, selectPair: [12, 13], scoreA: 6, scoreB: 13, splitAt: 10 },
}

// ── 타입 ──────────────────────────────────────────────────────────
type Result = 'correct' | 'wrong' | null

type Answer = {
  q_num: number
  result: Result
  memo: string
}

type Session = {
  id: string
  exam_id: string
  subject: string
  drive_url: string | null
  selected_q: number | null
  my_score: number | null
}

// ── 유틸 ──────────────────────────────────────────────────────────
function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

function calcScore(answers: Answer[], selectedQ: number | null, cfg: typeof SUBJECT_CONFIG[string]): number {
  let total = 0
  for (const a of answers) {
    if (a.result !== 'correct') continue
    if (cfg.selectPair && cfg.selectPair.includes(a.q_num as never) && a.q_num !== selectedQ) continue
    total += a.q_num <= cfg.splitAt ? cfg.scoreA : cfg.scoreB
  }
  return total
}

// ── 채점 셀 ──────────────────────────────────────────────────────
function ScoreCell({
  qNum,
  answer,
  isExcluded,
  isActive,
  onResultToggle,
  onClick,
  accentColor,
}: {
  qNum: number
  answer: Answer
  isExcluded: boolean
  isActive: boolean
  onResultToggle: () => void
  onClick: () => void
  accentColor: string
}) {
  const result = answer.result
  let cellBg = 'bg-[#0f1c2e]'
  if (isActive) cellBg = 'bg-[#1a2e47]'
  if (isExcluded) cellBg = 'bg-[#0a1220] opacity-40'

  return (
    <div
      className={`relative flex flex-col items-center rounded-xl pt-1.5 pb-1 px-1 transition cursor-pointer select-none ${cellBg} ${isActive ? 'ring-1 ring-blue-500/60' : ''}`}
      style={{ minWidth: 44 }}
      onClick={onClick}
    >
      {/* 문제 번호 */}
      <div className="flex items-center gap-0.5 mb-1">
        <span className={`text-[10px] font-bold ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>
          {qNum}
        </span>
        {answer.memo && <span className="w-1 h-1 rounded-full bg-blue-400 ml-0.5" />}
      </div>

      {/* O / X 토글 */}
      <button
        onClick={(e) => { e.stopPropagation(); onResultToggle() }}
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-black transition ${
          result === 'correct' ? 'bg-emerald-600/80 text-white'
          : result === 'wrong' ? 'bg-red-700/80 text-white'
          : 'bg-[#1e3048] text-gray-600 hover:bg-[#253d5c]'
        }`}
      >
        {result === 'correct' ? '○' : result === 'wrong' ? '✕' : '·'}
      </button>
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────────
export default function GeneralSubjectPage() {
  const params = useParams()
  const router = useRouter()
  const subject = decodeURIComponent(params.subject as string)
  const examId  = params.id as string

  const cfg  = SUBJECT_CONFIG[subject] ?? SUBJECT_CONFIG['理論']
  const meta = SUBJECT_META[subject]  ?? SUBJECT_META['理論']
  const exam = PAST_EXAMS[examId]

  const [session, setSession]     = useState<Session | null>(null)
  const [answers, setAnswers]     = useState<Answer[]>(() =>
    Array.from({ length: cfg.totalQ }, (_, i) => ({ q_num: i + 1, result: null, memo: '' }))
  )
  const [selectedQ, setSelectedQ] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activeQ, setActiveQ]     = useState<number>(1)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [urlInput, setUrlInput]   = useState('')
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.38) : 480
  )
  const memoRef    = useRef<HTMLTextAreaElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(480)

  // ── 데이터 로드 ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: sess } = await supabase
      .from('denken_sessions')
      .select('id, exam_id, subject, drive_url, selected_q, my_score')
      .eq('exam_id', examId)
      .eq('subject', subject)
      .maybeSingle()

    if (sess) {
      setSession(sess as Session)
      setUrlInput(sess.drive_url || '')
      if (sess.drive_url) setPreviewUrl(toPreviewUrl(sess.drive_url))
      if (sess.selected_q) setSelectedQ(sess.selected_q)

      const { data: ans } = await supabase
        .from('denken_answers')
        .select('q_num, result, memo')
        .eq('exam_id', examId)
        .eq('subject', subject)

      if (ans && ans.length > 0) {
        setAnswers(prev => prev.map(a => {
          const found = ans.find(x => x.q_num === a.q_num)
          if (!found) return a
          return { ...a, result: (found.result as Result) ?? null, memo: found.memo ?? '' }
        }))
      }
    }
    setLoading(false)
  }, [examId, subject])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => { memoRef.current?.focus() }, [activeQ])

  // ── 세션 upsert ─────────────────────────────────────────────────
  const ensureSession = useCallback(async (): Promise<string> => {
    if (session?.id) return session.id
    const { data, error } = await supabase
      .from('denken_sessions')
      .upsert(
        { exam_id: examId, subject, updated_at: new Date().toISOString() },
        { onConflict: 'exam_id,subject' }
      )
      .select('id')
      .single()
    if (error || !data) throw new Error('세션 생성 실패')
    setSession({ id: data.id, exam_id: examId, subject, drive_url: null, selected_q: null, my_score: null })
    return data.id
  }, [session, examId, subject])

  // ── 답변 저장 ────────────────────────────────────────────────────
  const saveAnswer = useCallback(async (a: Answer) => {
    await ensureSession()
    await supabase.from('denken_answers').upsert(
      {
        exam_id: examId,
        subject,
        q_num: a.q_num,
        result: a.result,
        memo: a.memo || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'exam_id,subject,q_num' }
    )
  }, [ensureSession, examId, subject])

  // ── O/X 토글 ────────────────────────────────────────────────────
  const handleResultToggle = useCallback((qNum: number) => {
    setAnswers(prev => prev.map(a => {
      if (a.q_num !== qNum) return a
      const next: Result = a.result === null ? 'correct' : a.result === 'correct' ? 'wrong' : null
      const newA = { ...a, result: next }
      saveAnswer(newA)
      return newA
    }))
  }, [saveAnswer])

  // ── 메모 ────────────────────────────────────────────────────────
  const handleMemoChange = useCallback((qNum: number, memo: string) => {
    setAnswers(prev => prev.map(a => a.q_num === qNum ? { ...a, memo } : a))
  }, [])

  const handleMemoBlur = useCallback((qNum: number) => {
    const a = answers.find(x => x.q_num === qNum)
    if (a) saveAnswer(a)
  }, [answers, saveAnswer])

  // ── 선택문제 ────────────────────────────────────────────────────
  const handleSelectQ = useCallback(async (q: number) => {
    const next = selectedQ === q ? null : q
    setSelectedQ(next)
    const sessionId = await ensureSession()
    await supabase.from('denken_sessions')
      .update({ selected_q: next, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  }, [selectedQ, ensureSession])

  // ── PDF URL 저장 ─────────────────────────────────────────────────
  const handleUrlLoad = useCallback(async () => {
    const url = urlInput.trim()
    setPreviewUrl(url ? toPreviewUrl(url) : null)
    setSaving(true)
    const sessionId = await ensureSession()
    await supabase.from('denken_sessions')
      .update({ drive_url: url || null, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
    setSaving(false)
  }, [urlInput, ensureSession])

  // ── 드래그 리사이저 ──────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartW.current = panelWidth
    e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      const delta = dragStartX.current - e.clientX
      const next = Math.min(Math.round(window.innerWidth * 0.7), Math.max(200, dragStartW.current + delta))
      setPanelWidth(next)
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── 점수 계산 ────────────────────────────────────────────────────
  const score    = calcScore(answers, selectedQ, cfg)
  const answered = answers.filter(a => {
    if (cfg.selectPair?.includes(a.q_num as never) && a.q_num !== selectedQ) return false
    return a.result !== null
  }).length
  const totalQ = cfg.selectPair ? cfg.totalQ - 1 : cfg.totalQ

  const activeAnswer = answers.find(a => a.q_num === activeQ)!

  if (!exam || !meta) {
    return (
      <main className="min-h-screen bg-[#050d1a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-3">기출 정보를 찾을 수 없어요.</p>
          <Link href="/dashboard/denken" className="text-blue-400 hover:underline text-sm">← 電験三種</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#050d1a] text-white flex flex-col" style={{ height: '100dvh' }}>

      {/* ── 상단 채점바 ─────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0a1628] border-b border-white/5 px-3 py-2">

        {/* 헤더 행 */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/dashboard/denken" className="text-gray-500 hover:text-white text-xs transition">
            ← 電験三種
          </Link>
          <span className="text-sm font-bold text-white">{exam.label}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
            style={{ backgroundColor: meta.accent }}
          >
            {subject}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-lg font-black tabular-nums ${
              score >= 60 ? 'text-emerald-400' : score >= 40 ? 'text-yellow-400' : 'text-white'
            }`}>
              {score}점
            </span>
            <span className="text-xs text-gray-600">{answered}/{totalQ}문</span>
            {score >= 60 && (
              <span className="text-[10px] bg-emerald-600/30 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">합격</span>
            )}
          </div>
        </div>

        {/* 채점 셀 행 */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {answers.map(a => {
            const isPair    = !!cfg.selectPair?.includes(a.q_num as never)
            const isExcluded = isPair && selectedQ !== null && a.q_num !== selectedQ
            return (
              <ScoreCell
                key={a.q_num}
                qNum={a.q_num}
                answer={a}
                isExcluded={isExcluded}
                isActive={activeQ === a.q_num}
                onResultToggle={() => handleResultToggle(a.q_num)}
                onClick={() => setActiveQ(a.q_num)}
                accentColor={meta.accent}
              />
            )
          })}

          {/* 선택문제 버튼 */}
          {cfg.selectPair && (
            <div className="flex flex-col justify-center ml-2 shrink-0 gap-1">
              <p className="text-[9px] text-gray-600">선택</p>
              {cfg.selectPair.map(q => (
                <button
                  key={q}
                  onClick={() => handleSelectQ(q)}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${
                    selectedQ === q
                      ? 'bg-yellow-500 text-black'
                      : 'bg-[#1e3048] text-gray-500 hover:text-white'
                  }`}
                >
                  {q}번
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── 바디: PDF + 메모패널 ──────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* PDF 뷰어 */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#050d1a]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#080f1e] border-b border-white/5 shrink-0">
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUrlLoad()}
              placeholder="구글 드라이브 PDF URL 붙여넣기..."
              className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/60 placeholder-gray-700 font-mono"
            />
            <button
              onClick={handleUrlLoad}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition text-white"
              style={{ backgroundColor: meta.accent }}
            >
              {saving ? '…' : '불러오기'}
            </button>
          </div>
          <div className="flex-1 relative">
            {previewUrl ? (
              <iframe src={previewUrl} className="w-full h-full border-0" allow="autoplay" />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-700">
                <div className="text-5xl opacity-30">📄</div>
                <p className="text-sm text-gray-600">구글 드라이브 PDF URL을 입력하세요</p>
                <p className="text-xs text-gray-800">drive.google.com/file/d/… 형식</p>
              </div>
            )}
          </div>
        </div>

        {/* 드래그 핸들 */}
        <div
          onMouseDown={handleDragStart}
          className="w-1 shrink-0 bg-white/5 hover:bg-blue-500/60 active:bg-blue-500 cursor-col-resize transition-colors"
        />

        {/* 메모 패널 */}
        <div
          className="shrink-0 flex flex-col bg-[#080f1e] border-l border-white/5"
          style={{ width: panelWidth, minWidth: 200 }}
        >
          {/* 패널 헤더 */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <span className="text-sm font-bold text-white">{activeQ}번 메모</span>
            <span className={`ml-auto text-xs font-bold ${
              activeAnswer?.result === 'correct' ? 'text-emerald-400'
              : activeAnswer?.result === 'wrong' ? 'text-red-400' : 'text-gray-600'
            }`}>
              {activeAnswer?.result === 'correct' ? '○ 정답'
               : activeAnswer?.result === 'wrong' ? '✕ 오답' : '미채점'}
            </span>
          </div>

          {/* 메모 입력 */}
          <div className="flex-1 p-3 flex flex-col min-h-0">
            <textarea
              ref={memoRef}
              key={activeQ}
              value={activeAnswer?.memo ?? ''}
              onChange={e => handleMemoChange(activeQ, e.target.value)}
              onBlur={() => handleMemoBlur(activeQ)}
              placeholder={`Q${activeQ} — 오답 메모, 공식, 단어 등 자유 형식으로...`}
              className="flex-1 bg-[#0f1c2e] rounded-xl px-3 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/40 placeholder-gray-700 resize-none leading-relaxed"
            />
          </div>

          {/* 메모 있는 문제 목록 */}
          <div className="border-t border-white/5 px-3 py-3 overflow-y-auto max-h-60">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">메모 있는 문제</p>
            {answers.filter(a => a.memo.trim()).length === 0 ? (
              <p className="text-[11px] text-gray-700">아직 없음</p>
            ) : (
              <div className="space-y-1.5">
                {answers.filter(a => a.memo.trim()).map(a => (
                  <button
                    key={a.q_num}
                    onClick={() => setActiveQ(a.q_num)}
                    className={`w-full text-left flex items-start gap-2 rounded-lg px-2 py-1.5 transition ${
                      activeQ === a.q_num ? 'bg-blue-900/40' : 'hover:bg-[#0f1c2e]'
                    }`}
                  >
                    <span className={`text-[10px] font-bold mt-0.5 shrink-0 ${
                      a.result === 'correct' ? 'text-emerald-400'
                      : a.result === 'wrong' ? 'text-red-400' : 'text-gray-600'
                    }`}>Q{a.q_num}</span>
                    <span className="text-[11px] text-gray-400 truncate">{a.memo}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 점수 요약 */}
          <div className="border-t border-white/5 px-4 py-3 bg-[#050d1a] shrink-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">채점 결과</p>
                <p className={`text-2xl font-black tabular-nums ${
                  score >= 60 ? 'text-emerald-400' : score >= 40 ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {score}<span className="text-sm font-normal text-gray-600 ml-1">/ 100</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-600 mb-0.5">합격 기준</p>
                <p className="text-sm text-gray-500">60점 이상</p>
                {score >= 60 && <p className="text-xs text-emerald-400 font-bold">✓ 합격</p>}
              </div>
            </div>
            <div className="mt-2 w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${score}%`,
                  backgroundColor: score >= 60 ? '#10b981' : score >= 40 ? '#eab308' : '#6b7280',
                }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-gray-800">0</span>
              <span className="text-[9px] text-gray-700">60</span>
              <span className="text-[9px] text-gray-800">100</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
