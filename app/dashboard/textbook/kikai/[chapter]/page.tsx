'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import DenkenMemoEditor from '@/app/components/DenkenMemoEditor'
import {
  TB_SUBJECT_MAP,
  getChapter,
  chapterQNums,
  TB_STATUS_META,
  TB_STATUS_CYCLE,
  TB_STATUS_ORDER,
  type TextbookStatus,
} from '@/lib/constants-textbook'

const SUBJECT_SLUG = 'kikai'

type Problem = {
  q_num: number
  status: TextbookStatus
  topic: string
  memo: string
}

export default function ChapterProblemGrid() {
  const params = useParams()
  const chapterSlug = params.chapter as string
  const subject = TB_SUBJECT_MAP.get(SUBJECT_SLUG)!
  const chapter = getChapter(subject, chapterSlug)

  const [problems, setProblems] = useState<Map<number, Problem>>(new Map())
  const [activeQ, setActiveQ] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.4) : 500
  )
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(500)

  const qNums = chapter ? chapterQNums(chapter) : []

  // ── 로드 ─────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!chapter) return
    const { data } = await supabase
      .from('textbook_problems')
      .select('q_num, status, topic, memo')
      .eq('subject', SUBJECT_SLUG)
      .eq('chapter', chapterSlug)
    const m = new Map<number, Problem>()
    // 기본값 채우기
    for (let q = chapter.start; q <= chapter.end; q++) {
      m.set(q, { q_num: q, status: 'untouched', topic: '', memo: '' })
    }
    // DB 값 덮어쓰기
    ;(data || []).forEach(d => {
      m.set(d.q_num, {
        q_num: d.q_num,
        status: (d.status as TextbookStatus) ?? 'untouched',
        topic: d.topic ?? '',
        memo: d.memo ?? '',
      })
    })
    setProblems(m)
    setActiveQ(chapter.start)
    setLoaded(true)
  }, [chapter, chapterSlug])

  useEffect(() => { loadData() }, [loadData])

  // ── 저장 ─────────────────────────────────────────────────────────
  const saveProblem = useCallback(async (p: Problem) => {
    await supabase.from('textbook_problems').upsert(
      {
        subject: SUBJECT_SLUG, chapter: chapterSlug, q_num: p.q_num,
        status: p.status, topic: p.topic || null, memo: p.memo || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'subject,chapter,q_num' }
    )
  }, [chapterSlug])

  // ── 상태 토글 ────────────────────────────────────────────────────
  const cycleStatus = useCallback((q: number) => {
    setProblems(prev => {
      const next = new Map(prev)
      const p = next.get(q)
      if (!p) return prev
      const idx = TB_STATUS_CYCLE.indexOf(p.status)
      const newStatus = TB_STATUS_CYCLE[(idx + 1) % TB_STATUS_CYCLE.length]
      const updated = { ...p, status: newStatus }
      next.set(q, updated)
      saveProblem(updated)
      return next
    })
  }, [saveProblem])

  // ── 토픽 변경 ────────────────────────────────────────────────────
  const setTopic = useCallback((q: number, topic: string) => {
    setProblems(prev => {
      const next = new Map(prev)
      const cur = next.get(q); if (!cur) return prev; next.set(q, { ...cur, topic })
      return next
    })
  }, [])
  const saveTopicNow = useCallback((q: number) => {
    const p = problems.get(q)
    if (p) saveProblem(p)
  }, [problems, saveProblem])

  // ── 메모 변경 ────────────────────────────────────────────────────
  const setMemo = useCallback((q: number, memo: string) => {
    setProblems(prev => {
      const next = new Map(prev)
      const cur = next.get(q); if (!cur) return prev; next.set(q, { ...cur, memo })
      return next
    })
  }, [])
  const saveMemoNow = useCallback((q: number) => {
    const p = problems.get(q)
    if (p) saveProblem(p)
  }, [problems, saveProblem])

  // ── 드래그 ─────────────────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true; dragStartX.current = e.clientX; dragStartW.current = panelWidth; e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      setPanelWidth(Math.min(Math.round(window.innerWidth * 0.7), Math.max(280, dragStartW.current - (e.clientX - dragStartX.current))))
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  if (!chapter) {
    return (
      <main className="min-h-screen bg-[#050d1a] text-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-3">단원을 찾을 수 없어요.</p>
          <Link href="/dashboard/textbook/kikai" className="text-blue-400 hover:underline text-sm">← 機械</Link>
        </div>
      </main>
    )
  }

  // 상태 카운트
  const counts: Record<TextbookStatus, number> = { untouched: 0, correct: 0, wrong: 0, unsure: 0 }
  qNums.forEach(q => { const p = problems.get(q); if (p) counts[p.status]++ })

  const activeProblem = activeQ !== null ? problems.get(activeQ) ?? null : null

  return (
    <main className="min-h-screen bg-[#050d1a] text-white flex flex-col" style={{ height: '100dvh' }}>

      {/* ── 헤더 ─────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#0a1628] border-b border-white/5 px-3 py-2 flex items-center gap-3">
        <Link href="/dashboard/textbook/kikai" className="text-gray-500 hover:text-white text-xs transition">← 機械</Link>
        <span className="w-2 h-5 rounded-full" style={{ backgroundColor: chapter.accent }} />
        <span className="text-sm font-bold text-white">{chapter.name}</span>
        <span className="text-xs text-gray-600">{chapter.start}~{chapter.end}번</span>
        <div className="ml-auto flex items-center gap-3 text-[11px]">
          {TB_STATUS_ORDER.map(st => (
            <span key={st} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TB_STATUS_META[st].dot }} />
              <span style={{ color: TB_STATUS_META[st].accent }}>{counts[st]}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── 바디 ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* 문제 그리드 */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4">
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))' }}>
            {qNums.map(q => {
              const p = problems.get(q)
              if (!p) return null
              const meta = TB_STATUS_META[p.status]
              const isActive = activeQ === q
              return (
                <button
                  key={q}
                  onClick={() => setActiveQ(q)}
                  onDoubleClick={() => cycleStatus(q)}
                  className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition ${
                    isActive ? 'ring-2 ring-blue-400' : ''
                  }`}
                  style={{ backgroundColor: p.status === 'untouched' ? '#0f1c2e' : meta.accent + '33' }}
                  title="클릭: 선택 / 더블클릭: 상태 변경"
                >
                  <span className="text-sm font-bold" style={{ color: p.status === 'untouched' ? '#6b7280' : meta.accent }}>{q}</span>
                  <span className="text-xs font-black" style={{ color: meta.accent }}>{meta.mark}</span>
                  {p.memo && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-blue-400" />}
                  {p.topic && <span className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-gray-500" />}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-700 mt-4">💡 칸 클릭 = 선택 · 더블클릭 = 상태 변경 (미착수→맞음→틀림→모르겠음)</p>
        </div>

        {/* 드래그 핸들 */}
        <div onMouseDown={handleDragStart} className="w-1 shrink-0 bg-white/5 hover:bg-blue-500/60 cursor-col-resize transition-colors" />

        {/* 선택 문제 패널 */}
        <div className="shrink-0 flex flex-col bg-[#080f1e] border-l border-white/5" style={{ width: panelWidth, minWidth: 280 }}>
          {activeProblem ? (
            <>
              {/* 헤더: 문제번호 + 상태 토글 */}
              <div className="px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg font-black text-white">{activeProblem.q_num}번</span>
                  <div className="ml-auto flex items-center gap-0.5 bg-[#0f1c2e] rounded-lg p-0.5">
                    {TB_STATUS_CYCLE.map(st => (
                      <button key={st}
                        onClick={() => {
                          setProblems(prev => {
                            const next = new Map(prev)
                            const cur = next.get(activeProblem.q_num); if (!cur) return prev; const updated = { ...cur, status: st }
                            next.set(activeProblem.q_num, updated)
                            saveProblem(updated)
                            return next
                          })
                        }}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${activeProblem.status === st ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        style={activeProblem.status === st ? { backgroundColor: TB_STATUS_META[st].accent } : {}}>
                        {TB_STATUS_META[st].ko}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 핵심 토픽 (한 줄) */}
                <input
                  value={activeProblem.topic}
                  onChange={e => setTopic(activeProblem.q_num, e.target.value)}
                  onBlur={() => saveTopicNow(activeProblem.q_num)}
                  placeholder="핵심 토픽 (예: 분권전동기 속도-토크 특성)"
                  className="w-full bg-[#0f1c2e] rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/60 placeholder-gray-700"
                />
              </div>

              {/* 정리 메모 에디터 */}
              <div className="flex-1 p-3 flex flex-col min-h-0">
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">정리 메모 — 왜 틀렸나 · 일본어 어휘/문형</p>
                {loaded && (
                  <DenkenMemoEditor
                    key={activeProblem.q_num}
                    content={activeProblem.memo}
                    onChange={(val) => setMemo(activeProblem.q_num, val)}
                    onBlur={() => saveMemoNow(activeProblem.q_num)}
                    placeholder="풀이 핵심, 틀린 이유, 모르는 일본어 단어·문형 등 — 수식(Σ)·이미지 가능"
                  />
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-700">
              <p className="text-sm">문제를 선택하세요</p>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
