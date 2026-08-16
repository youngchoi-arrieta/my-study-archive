'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { loadExamDoc, saveExamAnswerUrl } from '@/lib/examDocs'
import { cycleReview, REVIEW_META, type ReviewState } from '@/lib/constants-denken-review'
import {
  DENKEN_STRUCTURE,
  SUBJECT_ACCENT,
  isBArea,
  isSelectQ,
  isDimmedSelect,
  scoreDenken,
  gradedCount,
  answerableCount,
  examLabelFromId,
  type DenkenSubject,
  type Result,
  type Sub,
} from '@/lib/constants-denken'

// 機械는 전용 페이지(kikai)로 라우팅되므로 여기서는 理論/電力/法規만 처리
const FALLBACK: DenkenSubject = '理論'
function asSubject(s: string): DenkenSubject {
  return (['理論', '電力', '機械', '法規'] as const).includes(s as DenkenSubject)
    ? (s as DenkenSubject) : FALLBACK
}

type Answer = { q_num: number; result: Result; result_a: Result; result_b: Result; memo: string; review: ReviewState }

// 문제 단위 정오 (목록/헤더 색상용): B문제는 (a)(b) 합산
function problemStatus(subject: DenkenSubject, a: Answer): Result {
  if (isBArea(subject, a.q_num)) {
    if (a.result_a === null || a.result_b === null) return (a.result_a === 'wrong' || a.result_b === 'wrong') ? 'wrong' : null
    return (a.result_a === 'correct' && a.result_b === 'correct') ? 'correct' : 'wrong'
  }
  return a.result
}
type Session = { id: string; exam_id: string; subject: string; drive_url: string | null; answer_drive_url: string | null; selected_q: number | null }

function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

function ScoreCell({ subject, qNum, answer, isSelectPair, isExcluded, isActive, onResultToggle, onSubToggle, onReviewToggle, onClick }: {
  subject: DenkenSubject; qNum: number; answer: Answer; isSelectPair: boolean; isExcluded: boolean; isActive: boolean
  onResultToggle: () => void; onSubToggle: (sub: Sub) => void; onReviewToggle: () => void; onClick: () => void
}) {
  const isB = isBArea(subject, qNum)
  let cellBg = 'bg-[#0f1c2e]'
  if (answer.review === 'todo') cellBg = 'bg-[#2a2411] ring-1 ring-amber-500/50'
  if (answer.review === 'done') cellBg = 'bg-[#102a20]'
  if (isActive) cellBg = 'bg-[#1a2e47] ring-1 ring-blue-500/60'
  if (isExcluded) cellBg = 'bg-[#0a1220] opacity-40'
  return (
    <div className={`relative flex flex-col items-center rounded-xl pt-1.5 pb-1 px-1 cursor-pointer select-none ${cellBg}`}
      style={{ minWidth: isB ? 52 : 44 }} onClick={onClick}>
      <div className="flex items-center gap-0.5 mb-1">
        <span className={`text-[10px] font-bold ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>{qNum}</span>
        {isB && <span className="text-[8px] text-sky-500 font-bold">B</span>}
        {isSelectPair && <span className="text-[8px] text-yellow-500 font-bold">選</span>}
        {answer.memo && <span className="w-1 h-1 rounded-full bg-blue-400 ml-0.5" />}
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); if (!isExcluded) onReviewToggle() }}
        disabled={isExcluded}
        className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded text-[9px] leading-none transition"
        style={answer.review ? { color: REVIEW_META[answer.review].color, backgroundColor: REVIEW_META[answer.review].bg } : {}}
        title={answer.review ? REVIEW_META[answer.review].label : '복습 표시 (클릭: 필요 → 완료 → 해제)'}>
        {answer.review === 'todo' ? '🔖' : answer.review === 'done' ? '✓'
          : <span className="text-gray-700 hover:text-amber-500 transition">🔖</span>}
      </button>
      {isB ? (
        <div className="flex gap-0.5">
          {(['a', 'b'] as Sub[]).map(sub => {
            const r = sub === 'a' ? answer.result_a : answer.result_b
            return (
              <div key={sub} className="flex flex-col items-center gap-0.5">
                <span className="text-[8px] leading-none text-gray-500">({sub})</span>
                <button onClick={(e) => { e.stopPropagation(); onSubToggle(sub) }}
                  className={`w-6 h-8 rounded-md flex items-center justify-center text-sm font-black transition ${
                    r === 'correct' ? 'bg-emerald-600/80 text-white'
                    : r === 'wrong' ? 'bg-red-700/80 text-white'
                    : 'bg-[#1e3048] text-gray-600 hover:bg-[#253d5c]'}`}
                  title={`(${sub}) ${r === 'correct' ? '정답' : r === 'wrong' ? '오답' : '미채점'}`}>
                  {r === 'correct' ? '○' : r === 'wrong' ? '✕' : '·'}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); onResultToggle() }}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-black transition ${
            answer.result === 'correct' ? 'bg-emerald-600/80 text-white'
            : answer.result === 'wrong' ? 'bg-red-700/80 text-white'
            : 'bg-[#1e3048] text-gray-600 hover:bg-[#253d5c]'}`}>
          {answer.result === 'correct' ? '○' : answer.result === 'wrong' ? '✕' : '·'}
        </button>
      )}
    </div>
  )
}

export default function GeneralSubjectPage() {
  const params  = useParams()
  const subject = asSubject(decodeURIComponent(params.subject as string))
  const examId  = params.id as string
  const struct    = DENKEN_STRUCTURE[subject]
  const accent    = SUBJECT_ACCENT[subject]
  const selectPair = struct.selectPair ?? []
  const examLabel = examLabelFromId(examId)

  const [session, setSession]               = useState<Session | null>(null)
  const [answers, setAnswers]               = useState<Answer[]>(() =>
    Array.from({ length: struct.totalQ }, (_, i) => ({ q_num: i + 1, result: null, result_a: null, result_b: null, memo: '', review: null }))
  )
  const [selectedQ, setSelectedQ]           = useState<number | null>(null)
  const [previewUrl, setPreviewUrl]         = useState<string | null>(null)
  const [answerPreviewUrl, setAnswerPreviewUrl] = useState<string | null>(null)
  const [pdfTab, setPdfTab]                 = useState<'question' | 'answer'>('question')
  const [activeQ, setActiveQ]               = useState<number>(1)
  const [listMode, setListMode]             = useState<'review' | 'memo'>('review')
  const [saving, setSaving]                 = useState(false)
  const [urlInput, setUrlInput]             = useState('')
  const [answerUrl, setAnswerUrl]           = useState('')
  const [panelWidth, setPanelWidth]         = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.38) : 480
  )
  const memoRef    = useRef<HTMLTextAreaElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(480)

  const loadData = useCallback(async () => {
    const { data: rows } = await supabase
      .from('denken_general_sessions')
      .select('id, exam_id, subject, drive_url, answer_drive_url, selected_q')
      .eq('exam_id', examId).eq('subject', subject)
      .order('created_at', { ascending: false }).limit(1)
    const sess = rows?.[0] ?? null

    // 解答은 회차 단위 공유 — 과목별로 저장된 값보다 우선한다
    const doc = await loadExamDoc('denken3', examId, 'all')
    const sharedAns = doc?.answer_url ?? null
    if (sharedAns) {
      setAnswerUrl(sharedAns)
      setAnswerPreviewUrl(toPreviewUrl(sharedAns))
    }

    if (sess) {
      setSession(sess as Session)
      setUrlInput(sess.drive_url || '')
      if (sess.drive_url) setPreviewUrl(toPreviewUrl(sess.drive_url))
      if (!sharedAns) {
        setAnswerUrl(sess.answer_drive_url || '')
        if (sess.answer_drive_url) setAnswerPreviewUrl(toPreviewUrl(sess.answer_drive_url))
      }
      if (sess.selected_q) setSelectedQ(sess.selected_q)
      const { data: ans } = await supabase
        .from('denken_general_answers')
        .select('q_num, result, result_a, result_b, memo, review')
        .eq('exam_id', examId).eq('subject', subject)
      if (ans && ans.length > 0) {
        setAnswers(prev => prev.map(a => {
          const f = ans.find(x => x.q_num === a.q_num)
          return f ? {
            ...a,
            result: (f.result as Result) ?? null,
            result_a: (f.result_a as Result) ?? null,
            result_b: (f.result_b as Result) ?? null,
            memo: f.memo ?? '',
            review: (f.review as ReviewState) ?? null,
          } : a
        }))
      }
    }
  }, [examId, subject])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { memoRef.current?.focus() }, [activeQ])

  const ensureSession = useCallback(async (): Promise<string> => {
    if (session?.id) return session.id
    const { data, error } = await supabase
      .from('denken_general_sessions')
      .upsert({ exam_id: examId, subject }, { onConflict: 'exam_id,subject' })
      .select('id').single()
    if (error || !data) throw new Error('세션 생성 실패')
    setSession({ id: data.id, exam_id: examId, subject, drive_url: null, answer_drive_url: null, selected_q: null })
    return data.id
  }, [session, examId, subject])

  const saveAnswer = useCallback(async (a: Answer) => {
    const sid = await ensureSession()
    await supabase.from('denken_general_answers').upsert(
      { session_id: sid, exam_id: examId, subject, q_num: a.q_num, result: a.result, result_a: a.result_a, result_b: a.result_b, memo: a.memo || null, review: a.review, review_at: a.review ? new Date().toISOString() : null },
      { onConflict: 'exam_id,subject,q_num' }
    )
  }, [ensureSession, examId, subject])

  const cycle = (r: Result): Result => r === null ? 'correct' : r === 'correct' ? 'wrong' : null

  const handleResultToggle = useCallback((qNum: number) => {
    setAnswers(prev => prev.map(a => {
      if (a.q_num !== qNum) return a
      const newA = { ...a, result: cycle(a.result) }
      saveAnswer(newA)
      return newA
    }))
  }, [saveAnswer])

  const handleReviewToggle = useCallback((qNum: number) => {
    setAnswers(prev => prev.map(a => {
      if (a.q_num !== qNum) return a
      const newA = { ...a, review: cycleReview(a.review) }
      saveAnswer(newA)
      return newA
    }))
  }, [saveAnswer])

  const handleSubToggle = useCallback((qNum: number, sub: Sub) => {
    setAnswers(prev => prev.map(a => {
      if (a.q_num !== qNum) return a
      const newA = sub === 'a' ? { ...a, result_a: cycle(a.result_a) } : { ...a, result_b: cycle(a.result_b) }
      saveAnswer(newA)
      return newA
    }))
  }, [saveAnswer])

  const handleMemoChange = useCallback((qNum: number, memo: string) => {
    setAnswers(prev => prev.map(a => a.q_num === qNum ? { ...a, memo } : a))
  }, [])
  const handleMemoBlur = useCallback((qNum: number) => {
    const a = answers.find(x => x.q_num === qNum)
    if (a) saveAnswer(a)
  }, [answers, saveAnswer])

  const handleUrlLoad = useCallback(async () => {
    const url = urlInput.trim()
    setPreviewUrl(url ? toPreviewUrl(url) : null)
    setSaving(true)
    await supabase.from('denken_general_sessions')
      .upsert({ exam_id: examId, subject, drive_url: url || null }, { onConflict: 'exam_id,subject' })
    setSaving(false)
  }, [urlInput, examId, subject])

  const handleAnswerUrlLoad = useCallback(async () => {
    const url = answerUrl.trim()
    setAnswerPreviewUrl(url ? toPreviewUrl(url) : null)
    setSaving(true)
    const err = await saveExamAnswerUrl('denken3', examId, 'all', url)
    if (err) alert(`解答 링크를 저장하지 못했습니다.\n${err}`)
    setSaving(false)
  }, [answerUrl, examId, subject])

  const handleSelectQ = useCallback(async (q: number) => {
    const next = selectedQ === q ? null : q
    setSelectedQ(next)
    const sid = await ensureSession()
    await supabase.from('denken_general_sessions').update({ selected_q: next }).eq('id', sid)
  }, [selectedQ, ensureSession])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true; dragStartX.current = e.clientX; dragStartW.current = panelWidth; e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      setPanelWidth(Math.min(Math.round(window.innerWidth * 0.7), Math.max(200, dragStartW.current - (e.clientX - dragStartX.current))))
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const score     = scoreDenken(subject, answers, selectedQ)
  const answered  = gradedCount(subject, answers, selectedQ)
  const totalQ    = answerableCount(subject, selectedQ)
  const reviewTodo = answers.filter(a => a.review === 'todo')
  const reviewDone = answers.filter(a => a.review === 'done')
  const listRows = listMode === 'review'
    ? answers.filter(a => a.review !== null)
    : answers.filter(a => a.memo.trim())

  const activeAnswer = answers.find(a => a.q_num === activeQ)!

  return (
    <main className="min-h-screen bg-[#050d1a] text-white flex flex-col" style={{ height: '100dvh' }}>
      <div className="shrink-0 bg-[#0a1628] border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/dashboard/denken" className="text-gray-500 hover:text-white text-xs transition">← 電験三種</Link>
          <span className="text-sm font-bold text-white">{examLabel}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: accent }}>{subject}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-lg font-black tabular-nums ${score >= 60 ? 'text-emerald-400' : score >= 40 ? 'text-yellow-400' : 'text-white'}`}>{score}점</span>
            <span className="text-xs text-gray-600">{answered}/{totalQ}문</span>
            {score >= 60 && <span className="text-[10px] bg-emerald-600/30 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">합격</span>}
            {reviewTodo.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold border"
                style={{ color: REVIEW_META.todo.color, backgroundColor: REVIEW_META.todo.bg, borderColor: REVIEW_META.todo.border }}
                title="복습 대기 문항">🔖 {reviewTodo.length}</span>
            )}
            {reviewDone.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                style={{ color: REVIEW_META.done.color, backgroundColor: REVIEW_META.done.bg }}
                title="복습 완료 문항">✓ {reviewDone.length}</span>
            )}
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {answers.map(a => {
            const isPair = isSelectQ(subject, a.q_num)
            const isExcluded = isDimmedSelect(subject, a.q_num, selectedQ)
            return <ScoreCell key={a.q_num} subject={subject} qNum={a.q_num} answer={a} isSelectPair={isPair} isExcluded={isExcluded}
              isActive={activeQ === a.q_num} onResultToggle={() => handleResultToggle(a.q_num)} onSubToggle={(sub) => handleSubToggle(a.q_num, sub)} onReviewToggle={() => handleReviewToggle(a.q_num)} onClick={() => setActiveQ(a.q_num)} />
          })}
          {selectPair.length > 0 && (
            <div className="flex flex-col justify-center ml-2 shrink-0 gap-1">
              <p className="text-[9px] text-gray-600">선택</p>
              {selectPair.map(q => (
                <button key={q} onClick={() => handleSelectQ(q)}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${selectedQ === q ? 'bg-yellow-500 text-black' : 'bg-[#1e3048] text-gray-500 hover:text-white'}`}>
                  {q}번
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0 bg-[#050d1a]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#080f1e] border-b border-white/5 shrink-0">
            <div className="flex bg-[#0f1c2e] rounded-lg p-0.5 shrink-0">
              <button onClick={() => setPdfTab('question')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'question' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                style={pdfTab === 'question' ? { backgroundColor: accent } : {}}>問題</button>
              <button onClick={() => setPdfTab('answer')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'answer' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>解答</button>
            </div>
            {pdfTab === 'question' ? (<>
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUrlLoad()}
                placeholder="문제지 PDF URL..." className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/60 placeholder-gray-700 font-mono" />
              <button onClick={handleUrlLoad} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: accent }}>{saving ? '…' : '불러오기'}</button>
            </>) : (<>
              <input value={answerUrl} onChange={e => setAnswerUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnswerUrlLoad()}
                placeholder="정답지 PDF URL..." className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500/60 placeholder-gray-700 font-mono" />
              <button onClick={handleAnswerUrlLoad} disabled={saving} className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-white">{saving ? '…' : '불러오기'}</button>
            </>)}
          </div>
          <div className="flex-1 relative">
            {/* Both iframes stay mounted; we only toggle visibility so the PDF
                doesn't reload (page & scroll position are preserved) */}
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
            {/* Empty-state placeholders (only when that tab has no URL) */}
            {pdfTab === 'question' && !previewUrl && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-700"><div className="text-5xl opacity-30">📄</div><p className="text-sm">문제지 PDF URL을 입력하세요</p></div>
            )}
            {pdfTab === 'answer' && !answerPreviewUrl && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-700"><div className="text-5xl opacity-30">✅</div><p className="text-sm">정답지 PDF URL을 입력하세요</p></div>
            )}
          </div>
        </div>

        <div onMouseDown={handleDragStart} className="w-1 shrink-0 bg-white/5 hover:bg-blue-500/60 cursor-col-resize transition-colors" />

        <div className="shrink-0 flex flex-col bg-[#080f1e] border-l border-white/5" style={{ width: panelWidth, minWidth: 200 }}>
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <span className="text-sm font-bold text-white">{activeQ}번 메모</span>
            <button
              onClick={() => handleReviewToggle(activeQ)}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold transition border"
              style={activeAnswer?.review ? {
                color: REVIEW_META[activeAnswer.review].color,
                backgroundColor: REVIEW_META[activeAnswer.review].bg,
                borderColor: REVIEW_META[activeAnswer.review].border,
              } : { color: '#4b5563', borderColor: 'rgba(255,255,255,0.08)' }}
              title="정오와 별개로 다시 볼 문제를 표시한다">
              {activeAnswer?.review
                ? `${REVIEW_META[activeAnswer.review].icon} ${REVIEW_META[activeAnswer.review].short}`
                : '🔖 복습'}
            </button>
            {isBArea(subject, activeQ) ? (
              <span className="ml-auto flex items-center gap-2 text-xs font-bold">
                {(['a', 'b'] as Sub[]).map(sub => {
                  const r = sub === 'a' ? activeAnswer?.result_a : activeAnswer?.result_b
                  return (
                    <span key={sub} className={r === 'correct' ? 'text-emerald-400' : r === 'wrong' ? 'text-red-400' : 'text-gray-600'}>
                      ({sub}) {r === 'correct' ? '○' : r === 'wrong' ? '✕' : '·'}
                    </span>
                  )
                })}
              </span>
            ) : (
              <span className={`ml-auto text-xs font-bold ${activeAnswer?.result === 'correct' ? 'text-emerald-400' : activeAnswer?.result === 'wrong' ? 'text-red-400' : 'text-gray-600'}`}>
                {activeAnswer?.result === 'correct' ? '○ 정답' : activeAnswer?.result === 'wrong' ? '✕ 오답' : '미채점'}
              </span>
            )}
          </div>
          <div className="flex-1 p-3 flex flex-col min-h-0">
            <textarea ref={memoRef} key={activeQ} value={activeAnswer?.memo ?? ''}
              onChange={e => handleMemoChange(activeQ, e.target.value)} onBlur={() => handleMemoBlur(activeQ)}
              placeholder={`Q${activeQ} — 오답 메모, 공식, 단어 등...`}
              className="flex-1 bg-[#0f1c2e] rounded-xl px-3 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/40 placeholder-gray-700 resize-none leading-relaxed" />
          </div>
          <div className="border-t border-white/5 px-3 py-3 overflow-y-auto max-h-48">
            <div className="flex items-center gap-1.5 mb-2">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                {listMode === 'review' ? '복습 대상' : '메모 있는 문제'}
              </p>
              <div className="ml-auto flex bg-[#0f1c2e] rounded-md p-0.5">
                {([['review', `🔖 ${reviewTodo.length}`], ['memo', '메모']] as const).map(([k, lab]) => (
                  <button key={k} onClick={() => setListMode(k)}
                    className={`px-2 py-0.5 rounded text-[9px] font-bold transition ${
                      listMode === k ? 'bg-[#1e3048] text-white' : 'text-gray-600 hover:text-gray-400'}`}>{lab}</button>
                ))}
              </div>
            </div>
            {listRows.length === 0
              ? <p className="text-[11px] text-gray-700">{listMode === 'review' ? '복습 표시한 문제 없음' : '아직 없음'}</p>
              : <div className="space-y-1.5">{listRows.map(a => (
                  <button key={a.q_num} onClick={() => setActiveQ(a.q_num)}
                    className={`w-full text-left flex items-start gap-2 rounded-lg px-2 py-1.5 transition ${activeQ === a.q_num ? 'bg-blue-900/40' : 'hover:bg-[#0f1c2e]'}`}>
                    <span className={`text-[10px] font-bold mt-0.5 shrink-0 ${problemStatus(subject, a) === 'correct' ? 'text-emerald-400' : problemStatus(subject, a) === 'wrong' ? 'text-red-400' : 'text-gray-600'}`}>Q{a.q_num}</span>
                    <span className="text-[11px] text-gray-400 truncate">
                      {a.memo.trim() || <span className="text-gray-700">메모 없음</span>}
                    </span>
                    {a.review && (
                      <span className="text-[9px] shrink-0" style={{ color: REVIEW_META[a.review].color }}>
                        {REVIEW_META[a.review].icon}
                      </span>
                    )}
                  </button>
                ))}</div>
            }
          </div>
          <div className="border-t border-white/5 px-4 py-3 bg-[#050d1a] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">채점 결과</p>
                <p className={`text-2xl font-black tabular-nums ${score >= 60 ? 'text-emerald-400' : score >= 40 ? 'text-yellow-400' : 'text-gray-400'}`}>
                  {score}<span className="text-sm font-normal text-gray-600 ml-1">/ 100</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-600 mb-0.5">합격 기준</p>
                <p className="text-sm text-gray-500">60점 이상</p>
                {score >= 60 && <p className="text-xs text-emerald-400 font-bold">✓ 합격</p>}
              </div>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${score}%`, backgroundColor: score >= 60 ? '#10b981' : score >= 40 ? '#eab308' : '#6b7280' }} />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
