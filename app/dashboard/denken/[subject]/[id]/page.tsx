'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const SUBJECT_META: Record<string, { accent: string; label: string; totalQ: number; selectPair: [number,number]; splitAt: number; scoreA: number; scoreB: number }> = {
  '理論': { accent: '#1d4ed8', label: '理論', totalQ: 18, selectPair: [17,18], splitAt: 14, scoreA: 5, scoreB: 10 },
  '電力': { accent: '#047857', label: '電力', totalQ: 18, selectPair: [17,18], splitAt: 14, scoreA: 5, scoreB: 10 },
  '法規': { accent: '#92400e', label: '法規', totalQ: 13, selectPair: [12,13], splitAt: 10, scoreA: 6, scoreB: 13 },
}

const PAST_EXAMS: Record<string, string> = {
  'dk_2026_1': '2026년도 상반기 (2026.8)',
  'dk_2025_2': '2025년도 하반기 (2026.3)',
  'dk_2025_1': '2025년도 상반기 (2025.8)',
  'dk_2024_2': '2024년도 하반기 (2025.3)',
  'dk_2024_1': '2024년도 상반기 (2024.8)',
  'dk_2023_2': '2023년도 하반기 (2024.3)',
  'dk_2023_1': '2023년도 상반기 (2023.8)',
  'dk_2022_0': '2022년도', 'dk_2021_0': '2021년도', 'dk_2020_0': '2020년도',
  'dk_2019_0': '2019년도', 'dk_2018_0': '2018년도', 'dk_2017_0': '2017년도',
  'dk_2016_0': '2016년도', 'dk_2015_0': '2015년도', 'dk_2014_0': '2014년도',
}

type Result = 'correct' | 'wrong' | null
type Answer = { q_num: number; result: Result; memo: string }
type Session = { id: string; exam_id: string; subject: string; drive_url: string | null; answer_drive_url: string | null; selected_q: number | null }

function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

function ScoreCell({ qNum, answer, isExcluded, isActive, onResultToggle, onClick }: {
  qNum: number; answer: Answer; isExcluded: boolean; isActive: boolean
  onResultToggle: () => void; onClick: () => void
}) {
  let cellBg = 'bg-[#0f1c2e]'
  if (isActive) cellBg = 'bg-[#1a2e47] ring-1 ring-blue-500/60'
  if (isExcluded) cellBg = 'bg-[#0a1220] opacity-40'
  return (
    <div className={`relative flex flex-col items-center rounded-xl pt-1.5 pb-1 px-1 cursor-pointer select-none ${cellBg}`}
      style={{ minWidth: 44 }} onClick={onClick}>
      <div className="flex items-center gap-0.5 mb-1">
        <span className={`text-[10px] font-bold ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>{qNum}</span>
        {answer.memo && <span className="w-1 h-1 rounded-full bg-blue-400 ml-0.5" />}
      </div>
      <button onClick={(e) => { e.stopPropagation(); onResultToggle() }}
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-black transition ${
          answer.result === 'correct' ? 'bg-emerald-600/80 text-white'
          : answer.result === 'wrong' ? 'bg-red-700/80 text-white'
          : 'bg-[#1e3048] text-gray-600 hover:bg-[#253d5c]'}`}>
        {answer.result === 'correct' ? '○' : answer.result === 'wrong' ? '✕' : '·'}
      </button>
    </div>
  )
}

export default function GeneralSubjectPage() {
  const params  = useParams()
  const subject = decodeURIComponent(params.subject as string)
  const examId  = params.id as string
  const cfg       = SUBJECT_META[subject] ?? SUBJECT_META['理論']
  const examLabel = PAST_EXAMS[examId] ?? examId

  const [session, setSession]               = useState<Session | null>(null)
  const [answers, setAnswers]               = useState<Answer[]>(() =>
    Array.from({ length: cfg.totalQ }, (_, i) => ({ q_num: i + 1, result: null, memo: '' }))
  )
  const [selectedQ, setSelectedQ]           = useState<number | null>(null)
  const [previewUrl, setPreviewUrl]         = useState<string | null>(null)
  const [answerPreviewUrl, setAnswerPreviewUrl] = useState<string | null>(null)
  const [pdfTab, setPdfTab]                 = useState<'question' | 'answer'>('question')
  const [activeQ, setActiveQ]               = useState<number>(1)
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
    if (sess) {
      setSession(sess as Session)
      setUrlInput(sess.drive_url || '')
      if (sess.drive_url) setPreviewUrl(toPreviewUrl(sess.drive_url))
      setAnswerUrl(sess.answer_drive_url || '')
      if (sess.answer_drive_url) setAnswerPreviewUrl(toPreviewUrl(sess.answer_drive_url))
      if (sess.selected_q) setSelectedQ(sess.selected_q)
      const { data: ans } = await supabase
        .from('denken_general_answers')
        .select('q_num, result, memo')
        .eq('exam_id', examId).eq('subject', subject)
      if (ans && ans.length > 0) {
        setAnswers(prev => prev.map(a => {
          const f = ans.find(x => x.q_num === a.q_num)
          return f ? { ...a, result: (f.result as Result) ?? null, memo: f.memo ?? '' } : a
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
      { session_id: sid, exam_id: examId, subject, q_num: a.q_num, result: a.result, memo: a.memo || null },
      { onConflict: 'exam_id,subject,q_num' }
    )
  }, [ensureSession, examId, subject])

  const handleResultToggle = useCallback((qNum: number) => {
    setAnswers(prev => prev.map(a => {
      if (a.q_num !== qNum) return a
      const next: Result = a.result === null ? 'correct' : a.result === 'correct' ? 'wrong' : null
      const newA = { ...a, result: next }
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
    await supabase.from('denken_general_sessions')
      .upsert({ exam_id: examId, subject, answer_drive_url: url || null }, { onConflict: 'exam_id,subject' })
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

  const score = answers.reduce((sum, a) => {
    if (a.result !== 'correct') return sum
    if ((cfg.selectPair as number[]).includes(a.q_num) && a.q_num !== selectedQ) return sum
    return sum + (a.q_num <= cfg.splitAt ? cfg.scoreA : cfg.scoreB)
  }, 0)
  const activeAnswer = answers.find(a => a.q_num === activeQ)!

  return (
    <main className="min-h-screen bg-[#050d1a] text-white flex flex-col" style={{ height: '100dvh' }}>
      <div className="shrink-0 bg-[#0a1628] border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/dashboard/denken" className="text-gray-500 hover:text-white text-xs transition">← 電験三種</Link>
          <span className="text-sm font-bold text-white">{examLabel}</span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: cfg.accent }}>{subject}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-lg font-black tabular-nums ${score >= 60 ? 'text-emerald-400' : score >= 40 ? 'text-yellow-400' : 'text-white'}`}>{score}점</span>
            {score >= 60 && <span className="text-[10px] bg-emerald-600/30 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">합격</span>}
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {answers.map(a => {
            const isPair = (cfg.selectPair as number[]).includes(a.q_num)
            const isExcluded = isPair && selectedQ !== null && a.q_num !== selectedQ
            return <ScoreCell key={a.q_num} qNum={a.q_num} answer={a} isExcluded={isExcluded}
              isActive={activeQ === a.q_num} onResultToggle={() => handleResultToggle(a.q_num)} onClick={() => setActiveQ(a.q_num)} />
          })}
          <div className="flex flex-col justify-center ml-2 shrink-0 gap-1">
            <p className="text-[9px] text-gray-600">선택</p>
            {cfg.selectPair.map(q => (
              <button key={q} onClick={() => handleSelectQ(q)}
                className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${selectedQ === q ? 'bg-yellow-500 text-black' : 'bg-[#1e3048] text-gray-500 hover:text-white'}`}>
                {q}번
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0 bg-[#050d1a]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#080f1e] border-b border-white/5 shrink-0">
            <div className="flex bg-[#0f1c2e] rounded-lg p-0.5 shrink-0">
              <button onClick={() => setPdfTab('question')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'question' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                style={pdfTab === 'question' ? { backgroundColor: cfg.accent } : {}}>問題</button>
              <button onClick={() => setPdfTab('answer')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'answer' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>解答</button>
            </div>
            {pdfTab === 'question' ? (<>
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUrlLoad()}
                placeholder="문제지 PDF URL..." className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/60 placeholder-gray-700 font-mono" />
              <button onClick={handleUrlLoad} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                style={{ backgroundColor: cfg.accent }}>{saving ? '…' : '불러오기'}</button>
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
            <span className={`ml-auto text-xs font-bold ${activeAnswer?.result === 'correct' ? 'text-emerald-400' : activeAnswer?.result === 'wrong' ? 'text-red-400' : 'text-gray-600'}`}>
              {activeAnswer?.result === 'correct' ? '○ 정답' : activeAnswer?.result === 'wrong' ? '✕ 오답' : '미채점'}
            </span>
          </div>
          <div className="flex-1 p-3 flex flex-col min-h-0">
            <textarea ref={memoRef} key={activeQ} value={activeAnswer?.memo ?? ''}
              onChange={e => handleMemoChange(activeQ, e.target.value)} onBlur={() => handleMemoBlur(activeQ)}
              placeholder={`Q${activeQ} — 오답 메모, 공식, 단어 등...`}
              className="flex-1 bg-[#0f1c2e] rounded-xl px-3 py-3 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/40 placeholder-gray-700 resize-none leading-relaxed" />
          </div>
          <div className="border-t border-white/5 px-3 py-3 overflow-y-auto max-h-48">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">메모 있는 문제</p>
            {answers.filter(a => a.memo.trim()).length === 0
              ? <p className="text-[11px] text-gray-700">아직 없음</p>
              : <div className="space-y-1.5">{answers.filter(a => a.memo.trim()).map(a => (
                  <button key={a.q_num} onClick={() => setActiveQ(a.q_num)}
                    className={`w-full text-left flex items-start gap-2 rounded-lg px-2 py-1.5 transition ${activeQ === a.q_num ? 'bg-blue-900/40' : 'hover:bg-[#0f1c2e]'}`}>
                    <span className={`text-[10px] font-bold mt-0.5 shrink-0 ${a.result === 'correct' ? 'text-emerald-400' : a.result === 'wrong' ? 'text-red-400' : 'text-gray-600'}`}>Q{a.q_num}</span>
                    <span className="text-[11px] text-gray-400 truncate">{a.memo}</span>
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
