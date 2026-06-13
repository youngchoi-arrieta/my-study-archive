'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import DenkenMemoEditor from '@/app/components/DenkenMemoEditor'
import {
  TRACK_MAP,
  STATUS_META,
  STATUS_ORDER,
  type ResearchStatus,
} from '@/lib/constants-research'

type Session = {
  id: string
  track: string
  exam_id: string
  status: ResearchStatus
  drive_url: string | null
  answer_drive_url: string | null
  memo: string | null
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
  const examId = params.id as string
  const track = TRACK_MAP.get(trackSlug)
  const exam = track?.exams.find(e => e.id === examId)

  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<ResearchStatus>('untouched')
  const [memo, setMemo] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [answerPreviewUrl, setAnswerPreviewUrl] = useState<string | null>(null)
  const [pdfTab, setPdfTab] = useState<'question' | 'answer'>('question')
  const [urlInput, setUrlInput] = useState('')
  const [answerUrl, setAnswerUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.42) : 520
  )
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(520)
  const [memoLoaded, setMemoLoaded] = useState(false)

  const accent = track?.accent ?? '#3b82f6'

  // ── 로드 ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const { data: rows } = await supabase
      .from('research_sessions')
      .select('id, track, exam_id, status, drive_url, answer_drive_url, memo')
      .eq('track', trackSlug)
      .eq('exam_id', examId)
      .order('created_at', { ascending: false })
      .limit(1)
    const sess = rows?.[0] ?? null
    if (sess) {
      setSession(sess as Session)
      setStatus((sess.status as ResearchStatus) ?? 'untouched')
      setMemo(sess.memo ?? '')
      setUrlInput(sess.drive_url ?? '')
      if (sess.drive_url) setPreviewUrl(toPreviewUrl(sess.drive_url))
      setAnswerUrl(sess.answer_drive_url ?? '')
      if (sess.answer_drive_url) setAnswerPreviewUrl(toPreviewUrl(sess.answer_drive_url))
    }
    setMemoLoaded(true)
  }, [trackSlug, examId])

  useEffect(() => { loadData() }, [loadData])

  // ── 세션 upsert ──────────────────────────────────────────────────
  const upsertSession = useCallback(async (patch: Partial<Session>) => {
    await supabase.from('research_sessions').upsert(
      {
        track: trackSlug,
        exam_id: examId,
        ...patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'track,exam_id' }
    )
  }, [trackSlug, examId])

  // ── 상태 변경 ────────────────────────────────────────────────────
  const handleStatusChange = useCallback((next: ResearchStatus) => {
    setStatus(next)
    upsertSession({ status: next })
  }, [upsertSession])

  // ── 메모 저장 (blur 시) ──────────────────────────────────────────
  const handleMemoBlur = useCallback(() => {
    upsertSession({ memo: memo || null })
  }, [memo, upsertSession])

  // ── PDF URL ────────────────────────────────────────────────────
  const handleUrlLoad = useCallback(async () => {
    const url = urlInput.trim()
    setPreviewUrl(url ? toPreviewUrl(url) : null)
    setSaving(true)
    await upsertSession({ drive_url: url || null })
    setSaving(false)
  }, [urlInput, upsertSession])

  const handleAnswerUrlLoad = useCallback(async () => {
    const url = answerUrl.trim()
    setAnswerPreviewUrl(url ? toPreviewUrl(url) : null)
    setSaving(true)
    await upsertSession({ answer_drive_url: url || null })
    setSaving(false)
  }, [answerUrl, upsertSession])

  // ── 드래그 ─────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true; dragStartX.current = e.clientX; dragStartW.current = panelWidth; e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      setPanelWidth(Math.min(Math.round(window.innerWidth * 0.75), Math.max(280, dragStartW.current - (e.clientX - dragStartX.current))))
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  if (!track || !exam) {
    return (
      <main className="min-h-screen bg-[#050d1a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-3">기출 정보를 찾을 수 없어요.</p>
          <Link href="/dashboard/research" className="text-blue-400 hover:underline text-sm">← 심화 연구</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#050d1a] text-white flex flex-col" style={{ height: '100dvh' }}>

      {/* ── 헤더 + 상태 토글 ─────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0a1628] border-b border-white/5 px-3 py-2 flex items-center gap-3">
        <Link href={`/dashboard/research/${trackSlug}`} className="text-gray-500 hover:text-white text-xs transition">← {track.name}</Link>
        <span className="text-sm font-bold text-white">{exam.label}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: accent }}>{track.name}</span>

        {/* 상태 토글 */}
        <div className="ml-auto flex items-center gap-1 bg-[#0f1c2e] rounded-lg p-0.5">
          {STATUS_ORDER.map(st => (
            <button
              key={st}
              onClick={() => handleStatusChange(st)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold transition ${
                status === st ? 'text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
              style={status === st ? { backgroundColor: STATUS_META[st].accent } : {}}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: status === st ? '#fff' : STATUS_META[st].dot }} />
              {STATUS_META[st].ko}
            </button>
          ))}
        </div>
      </div>

      {/* ── 바디: PDF + 솔루션 에디터 ──────────────────────────────── */}
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

        {/* 솔루션 에디터 패널 */}
        <div className="shrink-0 flex flex-col bg-[#080f1e] border-l border-white/5" style={{ width: panelWidth, minWidth: 280 }}>
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <span className="text-sm font-bold text-white">나의 솔루션 · 연구 노트</span>
            <span className="ml-auto text-xs font-bold" style={{ color: STATUS_META[status].accent }}>
              {STATUS_META[status].ko}
            </span>
          </div>
          <div className="flex-1 p-3 flex flex-col min-h-0">
            {memoLoaded && (
              <DenkenMemoEditor
                content={memo}
                onChange={setMemo}
                onBlur={handleMemoBlur}
                placeholder="풀이 과정, 핵심 개념, 막힌 부분, 참고 페이지 등 — 수식(Σ)·이미지 삽입 가능"
              />
            )}
          </div>
        </div>
      </div>
    </main>
  )
}
