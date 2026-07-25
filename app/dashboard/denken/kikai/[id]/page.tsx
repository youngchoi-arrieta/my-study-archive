'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PROBLEM_TYPE_META, PROBLEM_TYPE_ORDER, type ProblemType } from '@/lib/constants-textbook'
import {
  KIKAI_EXAMS,
  KIKAI_TAGS,
  KIKAI_TAG_MAP,
} from '@/lib/constants-denken-kikai'
import {
  cycleReview, REVIEW_META, type ReviewState,
} from '@/lib/constants-denken-review'
import {
  DENKEN_STRUCTURE,
  isBArea,
  isSelectQ,
  isDimmedSelect,
  scoreDenken,
  gradedCount,
  answerableCount,
  type Result,
  type Sub,
} from '@/lib/constants-denken'

const SUBJECT = '機械' as const
const STRUCT = DENKEN_STRUCTURE[SUBJECT]
const Q_TOTAL = STRUCT.totalQ
const SELECT_PAIR = STRUCT.selectPair ?? []

// ── 타입 ──────────────────────────────────────────────────────────
type Answer = {
  q_num: number
  result: Result       // A문제(단일 정오)
  result_a: Result     // B문제 (a) 소문항
  result_b: Result     // B문제 (b) 소문항
  tag_id: number | null
  ptype: ProblemType | null
  memo: string
  review: ReviewState   // 정오와 독립된 축: 다시 볼 문제 표시
}

type Session = {
  id: string
  exam_id: string
  drive_url: string | null
  answer_drive_url: string | null
  selected_q: number | null   // 17 or 18
}

// ── 유틸 ──────────────────────────────────────────────────────────
function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

// 채점은 lib/constants-denken 의 scoreDenken 으로 일원화됨

// 문제 단위 정오 (태그통계·목록 색상용): B문제는 (a)(b) 합산
function problemStatus(a: Answer): Result {
  if (isBArea(SUBJECT, a.q_num)) {
    if (a.result_a === null || a.result_b === null) {
      return (a.result_a === 'wrong' || a.result_b === 'wrong') ? 'wrong' : null
    }
    return (a.result_a === 'correct' && a.result_b === 'correct') ? 'correct' : 'wrong'
  }
  return a.result
}

// ── 태그 배지 ──────────────────────────────────────────────────────
function TagBadge({ tagId, small }: { tagId: number | null; small?: boolean }) {
  if (!tagId) return null
  const tag = KIKAI_TAG_MAP.get(tagId)
  if (!tag) return null
  return (
    <span
      className={`inline-flex items-center rounded font-bold text-white whitespace-nowrap ${
        small ? 'px-1.5 py-0 text-[9px]' : 'px-2 py-0.5 text-[10px]'
      }`}
      style={{ backgroundColor: tag.accent }}
    >
      {tag.ko}
    </span>
  )
}

// ── 복습 배지 ──────────────────────────────────────────────────────
function ReviewBadge({ review, small }: { review: ReviewState; small?: boolean }) {
  if (!review) return null
  const m = REVIEW_META[review]
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded font-bold whitespace-nowrap border ${
        small ? 'px-1 py-0 text-[9px]' : 'px-1.5 py-0.5 text-[10px]'
      }`}
      style={{ color: m.color, backgroundColor: m.bg, borderColor: m.border }}
      title={m.label}
    >
      {m.icon}{!small && m.short}
    </span>
  )
}

// ── 태그 팔레트 팝업 ────────────────────────────────────────────────
function TagPalette({
  selected,
  onSelect,
  onClose,
}: {
  selected: number | null
  onSelect: (id: number | null) => void
  onClose: () => void
}) {
  return (
    <div className="absolute z-20 top-full left-0 mt-1 bg-[#0f1c2e] border border-white/10 rounded-xl p-3 shadow-2xl w-64">
      <div className="flex flex-wrap gap-1.5">
        {KIKAI_TAGS.map(tag => (
          <button
            key={tag.id}
            onClick={() => { onSelect(selected === tag.id ? null : tag.id); onClose() }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-white transition hover:opacity-80"
            style={{ backgroundColor: selected === tag.id ? tag.accent : '#1e3048' }}
          >
            {selected === tag.id && <span>✓</span>}
            {tag.ko}
          </button>
        ))}
        {selected && (
          <button
            onClick={() => { onSelect(null); onClose() }}
            className="px-2 py-1 rounded-lg text-[11px] text-gray-400 hover:text-white transition bg-gray-800"
          >
            태그 제거
          </button>
        )}
      </div>
    </div>
  )
}

// ── 채점바 셀 ──────────────────────────────────────────────────────
function ScoreCell({
  qNum,
  answer,
  isSelected,       // 선택문제 중 실제 선택된 것
  isExcluded,       // 선택문제 중 제외된 것
  isActive,         // 현재 메모 포커스
  onResultToggle,
  onSubToggle,
  onTagChange,
  onReviewToggle,
  onClick,
}: {
  qNum: number
  answer: Answer
  isSelected: boolean
  isExcluded: boolean
  isActive: boolean
  onResultToggle: () => void
  onSubToggle: (sub: Sub) => void
  onTagChange: (id: number | null) => void
  onReviewToggle: () => void
  onClick: () => void
}) {
  const [tagOpen, setTagOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 외부 클릭 시 태그팔레트 닫기
  useEffect(() => {
    if (!tagOpen) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setTagOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [tagOpen])

  const isSelectPair = isSelectQ(SUBJECT, qNum)
  const isB = isBArea(SUBJECT, qNum)

  // 배경색
  let cellBg = 'bg-[#0f1c2e]'
  if (answer.review === 'todo') cellBg = 'bg-[#2a2411] ring-1 ring-amber-500/50'
  if (answer.review === 'done') cellBg = 'bg-[#102a20]'
  if (isActive) cellBg = 'bg-[#1a2e47] ring-1 ring-blue-500/60'
  if (isExcluded) cellBg = 'bg-[#0a1220] opacity-40'

  return (
    <div
      ref={ref}
      className={`relative flex flex-col items-center rounded-xl pt-1.5 pb-1 px-1 transition cursor-pointer select-none ${cellBg}`}
      style={{ minWidth: isB ? 52 : 44 }}
    >
      {/* 문제 번호 */}
      <div className="flex items-center gap-0.5 mb-1" onClick={onClick}>
        <span className={`text-[10px] font-bold ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>
          {qNum}
        </span>
        {isB && <span className="text-[8px] text-sky-500 font-bold">B</span>}
        {isSelectPair && (
          <span className="text-[8px] text-yellow-500 font-bold">選</span>
        )}
        {answer.memo && (
          <span className="w-1 h-1 rounded-full bg-blue-400 ml-0.5" />
        )}
      </div>

      {/* 복습 플래그 (정오와 독립) */}
      <button
        onClick={(e) => { e.stopPropagation(); if (!isExcluded) onReviewToggle() }}
        disabled={isExcluded}
        className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded text-[9px] leading-none transition"
        style={answer.review ? {
          color: REVIEW_META[answer.review].color,
          backgroundColor: REVIEW_META[answer.review].bg,
        } : {}}
        title={answer.review ? REVIEW_META[answer.review].label : '복습 표시 (클릭: 필요 → 완료 → 해제)'}
      >
        {answer.review === 'todo' ? '🔖' : answer.review === 'done' ? '✓' : (
          <span className="text-gray-700 hover:text-amber-500 transition">🔖</span>
        )}
      </button>

      {/* O / X 토글: B문제는 (a)(b) 소문항, A문제는 단일 */}
      {isB ? (
        <div className="flex gap-0.5">
          {(['a', 'b'] as Sub[]).map(sub => {
            const r = sub === 'a' ? answer.result_a : answer.result_b
            return (
              <div key={sub} className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] leading-none text-gray-500">({sub})</span>
                <button
                  onClick={(e) => { e.stopPropagation(); onSubToggle(sub) }}
                  className={`w-6 h-8 rounded-md flex items-center justify-center text-sm font-black transition ${
                    r === 'correct'
                      ? 'bg-emerald-600/80 text-white'
                      : r === 'wrong'
                      ? 'bg-red-700/80 text-white'
                      : 'bg-[#1e3048] text-gray-600 hover:bg-[#253d5c]'
                  }`}
                  title={`(${sub}) ${r === 'correct' ? '정답' : r === 'wrong' ? '오답' : '미채점'}`}
                >
                  {r === 'correct' ? '○' : r === 'wrong' ? '✕' : '·'}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onResultToggle() }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-black transition ${
            answer.result === 'correct'
              ? 'bg-emerald-600/80 text-white'
              : answer.result === 'wrong'
              ? 'bg-red-700/80 text-white'
              : 'bg-[#1e3048] text-gray-600 hover:bg-[#253d5c]'
          }`}
          title={answer.result === 'correct' ? '정답' : answer.result === 'wrong' ? '오답' : '미채점'}
        >
          {answer.result === 'correct' ? '○' : answer.result === 'wrong' ? '✕' : '·'}
        </button>
      )}

      {/* 태그 */}
      <div className="relative mt-1" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => !isExcluded && setTagOpen(p => !p)}
          className="max-w-[44px] overflow-hidden"
          title="단원 태그"
          disabled={isExcluded}
        >
          {answer.tag_id ? (
            <TagBadge tagId={answer.tag_id} small />
          ) : (
            <span className="text-[9px] text-gray-700 hover:text-gray-500 transition">태그</span>
          )}
        </button>
        {answer.ptype && (
          <span className="absolute -top-1 -right-1 text-[8px] font-bold px-1 rounded"
            style={{ backgroundColor: PROBLEM_TYPE_META[answer.ptype].accent, color: '#fff' }}>
            {PROBLEM_TYPE_META[answer.ptype].short}
          </span>
        )}
        {tagOpen && (
          <TagPalette
            selected={answer.tag_id}
            onSelect={onTagChange}
            onClose={() => setTagOpen(false)}
          />
        )}
      </div>
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────────
export default function KikaiExamPage() {
  const params = useParams()
  const router = useRouter()
  const examId = params.id as string

  const exam = KIKAI_EXAMS.find(e => e.id === examId)

  const [session, setSession] = useState<Session | null>(null)
  const [answers, setAnswers] = useState<Answer[]>(() =>
    Array.from({ length: Q_TOTAL }, (_, i) => ({
      q_num: i + 1,
      result: null,
      result_a: null,
      result_b: null,
      tag_id: null,
      ptype: null,
      memo: '',
      review: null,
    }))
  )
  const [selectedQ, setSelectedQ] = useState<number | null>(null)
  const [driveUrl, setDriveUrl] = useState('')
  const [previewUrl, setPreviewUrl]       = useState<string | null>(null)
  const [answerUrl, setAnswerUrl]         = useState('')
  const [answerPreviewUrl, setAnswerPreviewUrl] = useState<string | null>(null)
  const [pdfTab, setPdfTab]               = useState<'question' | 'answer'>('question')
  const [activeQ, setActiveQ] = useState<number>(1)
  const [listMode, setListMode] = useState<'review' | 'memo'>('review')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.38) : 480
  )
  const memoRef = useRef<HTMLTextAreaElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(480)

  // ── 데이터 로드 ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: sessRows } = await supabase
      .from('denken_kikai_sessions')
      .select('id, exam_id, drive_url, answer_drive_url, selected_q')
      .eq('exam_id', examId)
      .order('created_at', { ascending: false })
      .limit(1)
    const sess = sessRows?.[0] ?? null

    if (sess) {
      setSession(sess as Session)
      setDriveUrl(sess.drive_url || '')
      setUrlInput(sess.drive_url || '')
      if (sess.drive_url) setPreviewUrl(toPreviewUrl(sess.drive_url))
      setAnswerUrl(sess.answer_drive_url || '')
      if (sess.answer_drive_url) setAnswerPreviewUrl(toPreviewUrl(sess.answer_drive_url))
      if (sess.selected_q) setSelectedQ(sess.selected_q)

      const { data: ans } = await supabase
        .from('denken_kikai_answers')
        .select('q_num, result, result_a, result_b, tag_id, ptype, memo, review')
        .eq('exam_id', examId)

      if (ans && ans.length > 0) {
        setAnswers(prev => prev.map(a => {
          const found = ans.find(x => x.q_num === a.q_num)
          if (!found) return a
          return {
            ...a,
            result: (found.result as Result) ?? null,
            result_a: (found.result_a as Result) ?? null,
            result_b: (found.result_b as Result) ?? null,
            tag_id: found.tag_id ?? null,
            ptype: (found.ptype as ProblemType) ?? null,
            memo: found.memo ?? '',
            review: (found.review as ReviewState) ?? null,
          }
        }))
      }
    }
    setLoading(false)
  }, [examId])

  useEffect(() => { loadData() }, [loadData])

  // 메모 포커스 이동
  useEffect(() => {
    if (memoRef.current) {
      memoRef.current.focus()
    }
  }, [activeQ])

  // ── 세션 upsert ────────────────────────────────────────────────
  const ensureSession = useCallback(async (): Promise<string> => {
    if (session?.id) return session.id
    const { data, error } = await supabase
      .from('denken_kikai_sessions')
      .upsert({ exam_id: examId }, { onConflict: 'exam_id' })
      .select('id')
      .single()
    if (error || !data) throw new Error('세션 생성 실패')
    setSession({ id: data.id, exam_id: examId, drive_url: null, answer_drive_url: null, selected_q: null })
    return data.id
  }, [session, examId])

  // ── 답변 저장 ─────────────────────────────────────────────────
  const saveAnswer = useCallback(async (a: Answer) => {
    const sessionId = await ensureSession()
    await supabase.from('denken_kikai_answers').upsert(
      {
        session_id: sessionId,
        exam_id: examId,
        q_num: a.q_num,
        result: a.result,
        result_a: a.result_a,
        result_b: a.result_b,
        tag_id: a.tag_id,
        ptype: a.ptype,
        memo: a.memo || null,
        review: a.review,
        review_at: a.review ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'exam_id,q_num' }
    )
  }, [ensureSession, examId])

  // ── O/X 토글 (A문제 단일) ─────────────────────────────────────
  const cycle = (r: Result): Result =>
    r === null ? 'correct' : r === 'correct' ? 'wrong' : null

  const handleResultToggle = useCallback((qNum: number) => {
    setAnswers(prev => prev.map(a => {
      if (a.q_num !== qNum) return a
      const newA = { ...a, result: cycle(a.result) }
      saveAnswer(newA)
      return newA
    }))
  }, [saveAnswer])

  // ── O/X 토글 (B문제 소문항 (a)/(b)) ───────────────────────────
  const handleSubToggle = useCallback((qNum: number, sub: Sub) => {
    setAnswers(prev => prev.map(a => {
      if (a.q_num !== qNum) return a
      const newA = sub === 'a'
        ? { ...a, result_a: cycle(a.result_a) }
        : { ...a, result_b: cycle(a.result_b) }
      saveAnswer(newA)
      return newA
    }))
  }, [saveAnswer])

  // ── 태그 변경 ─────────────────────────────────────────────────
  const handleTagChange = useCallback((qNum: number, tagId: number | null) => {
    setAnswers(prev => {
      const updated = prev.map(a => {
        if (a.q_num !== qNum) return a
        const newA = { ...a, tag_id: tagId }
        saveAnswer(newA)
        return newA
      })
      return updated
    })
  }, [saveAnswer])

  const handlePtypeChange = useCallback((qNum: number, ptype: ProblemType) => {
    setAnswers(prev => prev.map(a => {
      if (a.q_num !== qNum) return a
      const newA = { ...a, ptype: a.ptype === ptype ? null : ptype }
      saveAnswer(newA)
      return newA
    }))
  }, [saveAnswer])

  // ── 복습 플래그 토글 (없음 → 필요 → 완료 → 없음) ──────────────
  const handleReviewToggle = useCallback((qNum: number) => {
    setAnswers(prev => prev.map(a => {
      if (a.q_num !== qNum) return a
      const newA = { ...a, review: cycleReview(a.review) }
      saveAnswer(newA)
      return newA
    }))
  }, [saveAnswer])

  // ── 메모 변경 (로컬만, blur 시 저장) ─────────────────────────
  const handleMemoChange = useCallback((qNum: number, memo: string) => {
    setAnswers(prev => prev.map(a => a.q_num === qNum ? { ...a, memo } : a))
  }, [])

  const handleMemoBlur = useCallback((qNum: number) => {
    const a = answers.find(x => x.q_num === qNum)
    if (a) saveAnswer(a)
  }, [answers, saveAnswer])

  // ── 드래그 리사이저 ────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true
    dragStartX.current = e.clientX
    dragStartW.current = panelWidth
    e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      // 패널이 오른쪽에 있으므로 왼쪽으로 드래그 = 패널 넓어짐
      const delta = dragStartX.current - e.clientX
      const next = Math.min(Math.round(window.innerWidth * 0.7), Math.max(200, dragStartW.current + delta))
      setPanelWidth(next)
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  // ── 선택문제 설정 ─────────────────────────────────────────────
  const handleSelectQ = useCallback(async (q: number) => {
    const next = selectedQ === q ? null : q
    setSelectedQ(next)
    const sessionId = await ensureSession()
    await supabase.from('denken_kikai_sessions')
      .update({ selected_q: next, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
  }, [selectedQ, ensureSession])

  // ── PDF URL 저장 ──────────────────────────────────────────────
  const handleUrlLoad = useCallback(async () => {
    const url = urlInput.trim()
    setPreviewUrl(url ? toPreviewUrl(url) : null)
    setDriveUrl(url)
    setSaving(true)
    await supabase.from('denken_kikai_sessions').upsert(
      { exam_id: examId, drive_url: url || null, updated_at: new Date().toISOString() },
      { onConflict: 'exam_id' }
    )
    setSaving(false)
  }, [urlInput, examId])

  const handleAnswerUrlLoad = useCallback(async () => {
    const url = answerUrl.trim()
    setAnswerPreviewUrl(url ? toPreviewUrl(url) : null)
    setSaving(true)
    await supabase.from('denken_kikai_sessions').upsert(
      { exam_id: examId, answer_drive_url: url || null, updated_at: new Date().toISOString() },
      { onConflict: 'exam_id' }
    )
    setSaving(false)
  }, [answerUrl, examId])

  // ── 점수 계산 ─────────────────────────────────────────────────
  const score = scoreDenken(SUBJECT, answers, selectedQ)
  const answered = gradedCount(SUBJECT, answers, selectedQ)
  const totalQ = answerableCount(SUBJECT, selectedQ)

  // 태그별 정답률 미니
  const tagStats = KIKAI_TAGS.map(tag => {
    const tagged = answers.filter(a => a.tag_id === tag.id && problemStatus(a) !== null)
    const correct = tagged.filter(a => problemStatus(a) === 'correct').length
    return { tag, total: tagged.length, correct }
  }).filter(s => s.total > 0)

  const reviewTodo = answers.filter(a => a.review === 'todo')
  const reviewDone = answers.filter(a => a.review === 'done')
  const listRows = listMode === 'review'
    ? answers.filter(a => a.review !== null)
    : answers.filter(a => a.memo.trim())

  const activeAnswer = answers.find(a => a.q_num === activeQ)!

  if (!exam) {
    return (
      <main className="min-h-screen bg-[#050d1a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-3">기출 정보를 찾을 수 없어요.</p>
          <Link href="/dashboard/denken" className="text-blue-400 hover:underline text-sm">
            ← 목록으로
          </Link>
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
          <span className="text-xs text-violet-400 font-bold px-2 py-0.5 rounded-full bg-violet-900/40">機械</span>
          <div className="ml-auto flex items-center gap-3">
            {/* 점수 표시 */}
            <div className="flex items-center gap-2">
              <span className={`text-lg font-black tabular-nums ${
                score >= 60 ? 'text-emerald-400' : score >= 40 ? 'text-yellow-400' : 'text-white'
              }`}>
                {score}점
              </span>
              <span className="text-xs text-gray-600">
                {answered}/{totalQ}문
              </span>
              {score >= 60 && (
                <span className="text-[10px] bg-emerald-600/30 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">합격</span>
              )}
              {reviewTodo.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold border"
                  style={{ color: REVIEW_META.todo.color, backgroundColor: REVIEW_META.todo.bg, borderColor: REVIEW_META.todo.border }}
                  title="복습 대기 문항">
                  🔖 {reviewTodo.length}
                </span>
              )}
              {reviewDone.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ color: REVIEW_META.done.color, backgroundColor: REVIEW_META.done.bg }}
                  title="복습 완료 문항">
                  ✓ {reviewDone.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 채점 셀 행 */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {answers.map(a => {
            const isPair = isSelectQ(SUBJECT, a.q_num)
            const isExcluded = isDimmedSelect(SUBJECT, a.q_num, selectedQ)
            const isSelected = isPair && a.q_num === selectedQ
            return (
              <ScoreCell
                key={a.q_num}
                qNum={a.q_num}
                answer={a}
                isSelected={isSelected}
                isExcluded={isExcluded}
                isActive={activeQ === a.q_num}
                onResultToggle={() => handleResultToggle(a.q_num)}
                onSubToggle={(sub) => handleSubToggle(a.q_num, sub)}
                onTagChange={(id) => handleTagChange(a.q_num, id)}
                onReviewToggle={() => handleReviewToggle(a.q_num)}
                onClick={() => setActiveQ(a.q_num)}
              />
            )
          })}

          {/* 선택문제 선택 버튼 (17/18 옆) */}
          {SELECT_PAIR.length > 0 && (
            <div className="flex flex-col justify-center ml-2 shrink-0 gap-1">
              <p className="text-[9px] text-gray-600">선택</p>
              {SELECT_PAIR.map(q => (
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

        {/* 태그별 정답률 미니 바 */}
        {tagStats.length > 0 && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-none">
            {tagStats.map(({ tag, total, correct }) => (
              <div key={tag.id} className="flex items-center gap-1 shrink-0">
                <span
                  className="text-[9px] font-bold text-white px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: tag.accent }}
                >
                  {tag.ko}
                </span>
                <span className="text-[9px] text-gray-400">
                  {correct}/{total}
                </span>
                <div className="w-12 h-1 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(correct / total) * 100}%`,
                      backgroundColor: tag.accent,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 바디: PDF + 메모패널 ──────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* PDF 뷰어 */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#050d1a]">
          {/* 탭 + URL 입력바 */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#080f1e] border-b border-white/5 shrink-0">
            {/* 문제지/정답지 탭 */}
            <div className="flex bg-[#0f1c2e] rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setPdfTab('question')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'question' ? 'bg-violet-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >問題</button>
              <button
                onClick={() => setPdfTab('answer')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'answer' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
              >解答</button>
            </div>
            {/* URL 입력 */}
            {pdfTab === 'question' ? (
              <>
                <input
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleUrlLoad()}
                  placeholder="문제지 PDF URL..."
                  className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-violet-500/60 placeholder-gray-700 font-mono"
                />
                <button onClick={handleUrlLoad} disabled={saving}
                  className="bg-violet-700 hover:bg-violet-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                  {saving ? '…' : '불러오기'}
                </button>
              </>
            ) : (
              <>
                <input
                  value={answerUrl}
                  onChange={e => setAnswerUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAnswerUrlLoad()}
                  placeholder="정답지 PDF URL..."
                  className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500/60 placeholder-gray-700 font-mono"
                />
                <button onClick={handleAnswerUrlLoad} disabled={saving}
                  className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition">
                  {saving ? '…' : '불러오기'}
                </button>
              </>
            )}
          </div>
          {/* PDF 영역 */}
          <div className="flex-1 relative">
            {/* Both iframes stay mounted; toggle visibility so PDF state persists */}
            {previewUrl && (
              <iframe src={previewUrl} className="absolute inset-0 w-full h-full border-0"
                allow="autoplay"
                style={{ display: pdfTab === 'question' ? 'block' : 'none' }} />
            )}
            {answerPreviewUrl && (
              <iframe src={answerPreviewUrl} className="absolute inset-0 w-full h-full border-0"
                allow="autoplay"
                style={{ display: pdfTab === 'answer' ? 'block' : 'none' }} />
            )}
            {pdfTab === 'question' && !previewUrl && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-700">
                <div className="text-5xl opacity-30">📄</div>
                <p className="text-sm text-gray-600">문제지 PDF URL을 입력하세요</p>
              </div>
            )}
            {pdfTab === 'answer' && !answerPreviewUrl && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-700">
                <div className="text-5xl opacity-30">✅</div>
                <p className="text-sm text-gray-600">정답지 PDF URL을 입력하세요</p>
              </div>
            )}
          </div>
        </div>

        {/* 드래그 핸들 */}
        <div
          onMouseDown={handleDragStart}
          className="w-1 shrink-0 bg-white/5 hover:bg-violet-500/60 active:bg-violet-500 cursor-col-resize transition-colors"
          title="드래그해서 크기 조절"
        />

        {/* 메모 패널 */}
        <div
          className="shrink-0 flex flex-col bg-[#080f1e] border-l border-white/5"
          style={{ width: panelWidth, minWidth: 200 }}
        >
          {/* 패널 헤더 */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              {activeQ}번 메모
            </span>
            {activeAnswer?.tag_id && (
              <TagBadge tagId={activeAnswer.tag_id} />
            )}
            {isBArea(SUBJECT, activeQ) ? (
              <span className="ml-auto flex items-center gap-2 text-xs font-bold">
                {(['a', 'b'] as Sub[]).map(sub => {
                  const r = sub === 'a' ? activeAnswer?.result_a : activeAnswer?.result_b
                  return (
                    <span key={sub} className={
                      r === 'correct' ? 'text-emerald-400' :
                      r === 'wrong' ? 'text-red-400' : 'text-gray-600'
                    }>
                      ({sub}) {r === 'correct' ? '○' : r === 'wrong' ? '✕' : '·'}
                    </span>
                  )
                })}
              </span>
            ) : (
              <span className={`ml-auto text-xs font-bold ${
                activeAnswer?.result === 'correct' ? 'text-emerald-400' :
                activeAnswer?.result === 'wrong' ? 'text-red-400' : 'text-gray-600'
              }`}>
                {activeAnswer?.result === 'correct' ? '○ 정답' :
                 activeAnswer?.result === 'wrong' ? '✕ 오답' : '미채점'}
              </span>
            )}
          </div>

          {/* 유형 태그 + 복습 플래그 */}
          <div className="px-4 py-2 border-b border-white/5 flex items-center gap-1">
            <span className="text-[10px] text-gray-600 mr-1">유형</span>
            {PROBLEM_TYPE_ORDER.map(pt => (
              <button key={pt} onClick={() => handlePtypeChange(activeQ, pt)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${activeAnswer?.ptype === pt ? 'text-white' : 'text-gray-500 hover:text-gray-300 bg-[#0f1c2e]'}`}
                style={activeAnswer?.ptype === pt ? { backgroundColor: PROBLEM_TYPE_META[pt].accent } : {}}>
                {PROBLEM_TYPE_META[pt].ko}
              </button>
            ))}
            <button
              onClick={() => handleReviewToggle(activeQ)}
              className="ml-auto px-2 py-1 rounded-md text-[10px] font-bold transition border"
              style={activeAnswer?.review ? {
                color: REVIEW_META[activeAnswer.review].color,
                backgroundColor: REVIEW_META[activeAnswer.review].bg,
                borderColor: REVIEW_META[activeAnswer.review].border,
              } : { color: '#4b5563', borderColor: 'rgba(255,255,255,0.08)' }}
              title="정오와 별개로 다시 볼 문제를 표시한다"
            >
              {activeAnswer?.review
                ? `${REVIEW_META[activeAnswer.review].icon} ${REVIEW_META[activeAnswer.review].label}`
                : '🔖 복습 표시'}
            </button>
          </div>

          {/* 메모 입력 */}
          <div className="flex-1 p-3 flex flex-col gap-3 min-h-0">
            <textarea
              ref={memoRef}
              key={activeQ}
              value={activeAnswer?.memo ?? ''}
              onChange={e => handleMemoChange(activeQ, e.target.value)}
              onBlur={() => handleMemoBlur(activeQ)}
              placeholder={`Q${activeQ} — 오답 메모, 일본어 단어, 공식 등 자유 형식으로...`}
              className="flex-1 bg-[#0f1c2e] rounded-xl px-3 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/40 placeholder-gray-700 resize-none leading-relaxed"
            />
          </div>

          {/* 복습 · 메모 목록 */}
          <div className="border-t border-white/5 px-3 py-3 overflow-y-auto max-h-60">
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                {listMode === 'review' ? '복습 대상' : '메모 있는 문제'}
              </p>
              <div className="ml-auto flex bg-[#0f1c2e] rounded-md p-0.5">
                {([['review', `🔖 ${reviewTodo.length}`], ['memo', '메모']] as const).map(([k, lab]) => (
                  <button key={k} onClick={() => setListMode(k)}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${
                      listMode === k ? 'bg-[#1e3048] text-white' : 'text-gray-600 hover:text-gray-400'
                    }`}>{lab}</button>
                ))}
              </div>
            </div>
            {listRows.length === 0 ? (
              <p className="text-[11px] text-gray-700">
                {listMode === 'review' ? '복습 표시한 문제 없음' : '아직 없음'}
              </p>
            ) : (
              <div className="space-y-1.5">
                {listRows.map(a => (
                  <button
                    key={a.q_num}
                    onClick={() => setActiveQ(a.q_num)}
                    className={`w-full text-left flex items-start gap-2 rounded-lg px-2 py-1.5 transition ${
                      activeQ === a.q_num ? 'bg-blue-900/40' : 'hover:bg-[#0f1c2e]'
                    }`}
                  >
                    <span className={`text-[10px] font-bold mt-0.5 shrink-0 ${
                      problemStatus(a) === 'correct' ? 'text-emerald-400' :
                      problemStatus(a) === 'wrong' ? 'text-red-400' : 'text-gray-600'
                    }`}>
                      Q{a.q_num}
                    </span>
                    <span className="text-[11px] text-gray-400 truncate leading-relaxed">
                      {a.memo.trim() || <span className="text-gray-700">메모 없음</span>}
                    </span>
                    {a.review && <ReviewBadge review={a.review} small />}
                    {a.tag_id && <TagBadge tagId={a.tag_id} small />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 전체 점수 요약 */}
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
                {score >= 60 && (
                  <p className="text-xs text-emerald-400 font-bold">✓ 합격</p>
                )}
              </div>
            </div>
            {/* 점수 바 */}
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
