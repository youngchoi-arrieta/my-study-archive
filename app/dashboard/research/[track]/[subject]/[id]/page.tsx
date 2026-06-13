'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import DenkenMemoEditor from '@/app/components/DenkenMemoEditor'
import {
  TRACK_MAP,
  getSubject,
  STATUS_META,
  STATUS_ORDER,
  type ResearchStatus,
} from '@/lib/constants-research'

type Problem = {
  id: string
  title: string
  status: ResearchStatus
  memo: string
  sort_order: number
}

function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

export default function ResearchExamPage() {
  const params = useParams()
  const trackSlug = params.track as string
  const subjectSlug = params.subject as string
  const examId = params.id as string
  const track = TRACK_MAP.get(trackSlug)
  const subject = track ? getSubject(track, subjectSlug) : undefined
  const exam = track?.exams.find(e => e.id === examId)
  const accent = track?.accent ?? '#3b82f6'

  // PDF 세션
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [answerPreviewUrl, setAnswerPreviewUrl] = useState<string | null>(null)
  const [pdfTab, setPdfTab] = useState<'question' | 'answer'>('question')
  const [urlInput, setUrlInput] = useState('')
  const [answerUrl, setAnswerUrl] = useState('')
  const [saving, setSaving] = useState(false)

  // 문제 리스트
  const [problems, setProblems] = useState<Problem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.44) : 560
  )
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(560)

  // ── 로드 ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    // 세션 (PDF)
    const { data: rows } = await supabase
      .from('research_sessions')
      .select('drive_url, answer_drive_url')
      .eq('track', trackSlug).eq('subject', subjectSlug).eq('exam_id', examId)
      .order('created_at', { ascending: false }).limit(1)
    const sess = rows?.[0] ?? null
    if (sess) {
      setUrlInput(sess.drive_url ?? '')
      if (sess.drive_url) setPreviewUrl(toPreviewUrl(sess.drive_url))
      setAnswerUrl(sess.answer_drive_url ?? '')
      if (sess.answer_drive_url) setAnswerPreviewUrl(toPreviewUrl(sess.answer_drive_url))
    }

    // 문제들
    const { data: probs } = await supabase
      .from('research_problems')
      .select('id, title, status, memo, sort_order')
      .eq('track', trackSlug).eq('subject', subjectSlug).eq('exam_id', examId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (probs && probs.length > 0) {
      const mapped = probs.map(p => ({
        id: p.id, title: p.title, status: (p.status as ResearchStatus) ?? 'untouched',
        memo: p.memo ?? '', sort_order: p.sort_order ?? 0,
      }))
      setProblems(mapped)
      setActiveId(mapped[0].id)
    }
    setLoaded(true)
  }, [trackSlug, examId])

  useEffect(() => { loadData() }, [loadData])

  // ── PDF 세션 upsert ──────────────────────────────────────────────
  const upsertSession = useCallback(async (patch: { drive_url?: string | null; answer_drive_url?: string | null }) => {
    await supabase.from('research_sessions').upsert(
      { track: trackSlug, subject: subjectSlug, exam_id: examId, ...patch, updated_at: new Date().toISOString() },
      { onConflict: 'track,subject,exam_id' }
    )
  }, [trackSlug, subjectSlug, examId])

  const handleUrlLoad = useCallback(async () => {
    const url = urlInput.trim()
    setPreviewUrl(url ? toPreviewUrl(url) : null)
    setSaving(true); await upsertSession({ drive_url: url || null }); setSaving(false)
  }, [urlInput, upsertSession])

  const handleAnswerUrlLoad = useCallback(async () => {
    const url = answerUrl.trim()
    setAnswerPreviewUrl(url ? toPreviewUrl(url) : null)
    setSaving(true); await upsertSession({ answer_drive_url: url || null }); setSaving(false)
  }, [answerUrl, upsertSession])

  // ── 문제 추가 ────────────────────────────────────────────────────
  const handleAddProblem = useCallback(async () => {
    const title = newTitle.trim()
    if (!title) return
    const { data, error } = await supabase
      .from('research_problems')
      .insert({ track: trackSlug, subject: subjectSlug, exam_id: examId, title, sort_order: problems.length })
      .select('id, title, status, memo, sort_order')
      .single()
    if (!error && data) {
      const p: Problem = { id: data.id, title: data.title, status: 'untouched', memo: '', sort_order: data.sort_order ?? problems.length }
      setProblems(prev => [...prev, p])
      setActiveId(p.id)
    }
    setNewTitle('')
    setAdding(false)
  }, [newTitle, trackSlug, subjectSlug, examId, problems.length])

  // ── 문제 삭제 ────────────────────────────────────────────────────
  const handleDeleteProblem = useCallback(async (id: string) => {
    await supabase.from('research_problems').delete().eq('id', id)
    setProblems(prev => {
      const next = prev.filter(p => p.id !== id)
      if (activeId === id) setActiveId(next[0]?.id ?? null)
      return next
    })
  }, [activeId])

  // ── 상태 변경 ────────────────────────────────────────────────────
  const handleStatusChange = useCallback(async (id: string, status: ResearchStatus) => {
    setProblems(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    await supabase.from('research_problems').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  }, [])

  // ── 메모 변경 (로컬) + 저장 (blur) ───────────────────────────────
  const handleMemoChange = useCallback((id: string, memo: string) => {
    setProblems(prev => prev.map(p => p.id === id ? { ...p, memo } : p))
  }, [])
  const handleMemoBlur = useCallback(async (id: string) => {
    const p = problems.find(x => x.id === id)
    if (p) await supabase.from('research_problems').update({ memo: p.memo || null, updated_at: new Date().toISOString() }).eq('id', id)
  }, [problems])

  // ── 드래그 ─────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true; dragStartX.current = e.clientX; dragStartW.current = panelWidth; e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      setPanelWidth(Math.min(Math.round(window.innerWidth * 0.75), Math.max(300, dragStartW.current - (e.clientX - dragStartX.current))))
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  if (!track || !subject || !exam) {
    return (
      <main className="min-h-screen bg-[#050d1a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-3">기출 정보를 찾을 수 없어요.</p>
          <Link href="/dashboard/research" className="text-blue-400 hover:underline text-sm">← 심화 연구</Link>
        </div>
      </main>
    )
  }

  const activeProblem = problems.find(p => p.id === activeId) ?? null

  // 상태 카운트
  const counts: Record<ResearchStatus, number> = { untouched: 0, studying: 0, understood: 0 }
  problems.forEach(p => { counts[p.status] = (counts[p.status] ?? 0) + 1 })

  return (
    <main className="min-h-screen bg-[#050d1a] text-white flex flex-col" style={{ height: '100dvh' }}>

      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0a1628] border-b border-white/5 px-3 py-2 flex items-center gap-3">
        <Link href={`/dashboard/research/${trackSlug}/${subjectSlug}`} className="text-gray-500 hover:text-white text-xs transition">← {subject?.name ?? track.name}</Link>
        <span className="text-sm font-bold text-white">{exam.label}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: accent }}>{subject.name}</span>
        <div className="ml-auto flex items-center gap-2 text-[11px]">
          {STATUS_ORDER.map(st => (
            <span key={st} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_META[st].dot }} />
              <span className="text-gray-500">{counts[st]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── 바디 ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* PDF 뷰어 */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#050d1a]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#080f1e] border-b border-white/5 shrink-0">
            <div className="flex bg-[#0f1c2e] rounded-lg p-0.5 shrink-0">
              <button onClick={() => setPdfTab('question')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'question' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                style={pdfTab === 'question' ? { backgroundColor: accent } : {}}>問題</button>
              <button onClick={() => setPdfTab('answer')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'answer' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>解答</button>
            </div>
            {pdfTab === 'question' ? (
              <>
                <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleUrlLoad()}
                  placeholder="문제 PDF URL..." className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/60 placeholder-gray-700 font-mono" />
                <button onClick={handleUrlLoad} disabled={saving} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: accent }}>{saving ? '…' : '불러오기'}</button>
              </>
            ) : (
              <>
                <input value={answerUrl} onChange={e => setAnswerUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAnswerUrlLoad()}
                  placeholder="정답 PDF URL..." className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500/60 placeholder-gray-700 font-mono" />
                <button onClick={handleAnswerUrlLoad} disabled={saving} className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-white">{saving ? '…' : '불러오기'}</button>
              </>
            )}
          </div>
          <div className="flex-1 relative">
            {previewUrl && <iframe src={previewUrl} className="absolute inset-0 w-full h-full border-0" allow="autoplay" style={{ display: pdfTab === 'question' ? 'block' : 'none' }} />}
            {answerPreviewUrl && <iframe src={answerPreviewUrl} className="absolute inset-0 w-full h-full border-0" allow="autoplay" style={{ display: pdfTab === 'answer' ? 'block' : 'none' }} />}
            {pdfTab === 'question' && !previewUrl && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-700"><div className="text-5xl opacity-30">📄</div><p className="text-sm text-gray-600">문제 PDF URL을 입력하세요</p></div>
            )}
            {pdfTab === 'answer' && !answerPreviewUrl && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-700"><div className="text-5xl opacity-30">✅</div><p className="text-sm text-gray-600">정답 PDF URL을 입력하세요</p></div>
            )}
          </div>
        </div>

        {/* 드래그 핸들 */}
        <div onMouseDown={handleDragStart} className="w-1 shrink-0 bg-white/5 hover:bg-blue-500/60 cursor-col-resize transition-colors" />

        {/* 오른쪽: 문제 리스트 + 솔루션 */}
        <div className="shrink-0 flex flex-col bg-[#080f1e] border-l border-white/5" style={{ width: panelWidth, minWidth: 300 }}>

          {/* 문제 탭 리스트 */}
          <div className="border-b border-white/5 px-3 py-2 shrink-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              {problems.map(p => (
                <button key={p.id} onClick={() => setActiveId(p.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
                    activeId === p.id ? 'bg-[#1a2e47] text-white ring-1 ring-blue-500/40' : 'bg-[#0f1c2e] text-gray-400 hover:text-white'
                  }`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_META[p.status].dot }} />
                  {p.title}
                </button>
              ))}
              {/* 추가 버튼 / 입력 */}
              {adding ? (
                <div className="flex items-center gap-1">
                  <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddProblem(); if (e.key === 'Escape') { setAdding(false); setNewTitle('') } }}
                    placeholder="문제 이름 (예: 전력·관리 문1)"
                    className="bg-[#0f1c2e] rounded-lg px-2 py-1 text-[11px] text-white outline-none focus:ring-1 focus:ring-blue-500/60 w-44" />
                  <button onClick={handleAddProblem} className="text-[11px] px-2 py-1 rounded-lg bg-blue-700 hover:bg-blue-600 text-white font-bold">추가</button>
                  <button onClick={() => { setAdding(false); setNewTitle('') }} className="text-[11px] text-gray-500 hover:text-white px-1">✕</button>
                </div>
              ) : (
                <button onClick={() => setAdding(true)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-gray-500 hover:text-white bg-[#0f1c2e] transition">
                  + 문제 추가
                </button>
              )}
            </div>
          </div>

          {/* 선택된 문제: 상태 + 솔루션 */}
          {activeProblem ? (
            <>
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-white truncate">{activeProblem.title}</span>
                {/* 상태 토글 */}
                <div className="ml-auto flex items-center gap-0.5 bg-[#0f1c2e] rounded-lg p-0.5 shrink-0">
                  {STATUS_ORDER.map(st => (
                    <button key={st} onClick={() => handleStatusChange(activeProblem.id, st)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${activeProblem.status === st ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                      style={activeProblem.status === st ? { backgroundColor: STATUS_META[st].accent } : {}}>
                      {STATUS_META[st].ko}
                    </button>
                  ))}
                </div>
                <button onClick={() => handleDeleteProblem(activeProblem.id)}
                  className="text-[11px] text-gray-600 hover:text-red-400 transition shrink-0" title="문제 삭제">🗑</button>
              </div>
              <div className="flex-1 p-3 flex flex-col min-h-0">
                <DenkenMemoEditor
                  key={activeProblem.id}
                  content={activeProblem.memo}
                  onChange={(val) => handleMemoChange(activeProblem.id, val)}
                  onBlur={() => handleMemoBlur(activeProblem.id)}
                  placeholder="풀이 과정, 핵심 개념, 막힌 부분, 참고 페이지 등 — 수식(Σ)·이미지 삽입 가능"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-700">
              <div className="text-4xl opacity-30">📝</div>
              <p className="text-sm text-gray-600">{loaded ? '문제를 추가해서 솔루션을 작성하세요' : '불러오는 중...'}</p>
              {loaded && !adding && (
                <button onClick={() => setAdding(true)} className="text-xs px-3 py-1.5 rounded-lg bg-[#1e3048] hover:bg-[#253d5c] text-blue-400 transition">+ 첫 문제 추가</button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
