'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  PROBLEM_TYPE_META,
  PROBLEM_TYPE_ORDER,
  type TextbookStatus,
  type ProblemType,
} from '@/lib/constants-textbook'

const SUBJECT_SLUG = 'kikai'

type Problem = {
  q_num: number
  status: TextbookStatus
  ptype: ProblemType | null
  topic: string
  memo: string
}

export default function ChapterProblemGrid() {
  const params = useParams()
  const router = useRouter()
  const chapterSlug = params.chapter as string
  const subject = TB_SUBJECT_MAP.get(SUBJECT_SLUG)!
  const chapter = getChapter(subject, chapterSlug)

  const [problems, setProblems] = useState<Map<number, Problem>>(new Map())
  const [activeQ, setActiveQ] = useState<number | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [allStats, setAllStats] = useState<Map<string, Record<TextbookStatus, number>>>(new Map())
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.34) : 440
  )
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(440)

  const qNums = chapter ? chapterQNums(chapter) : []

  // ── 현재 단원 로드 ──────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!chapter) return
    const { data } = await supabase
      .from('textbook_problems')
      .select('q_num, status, ptype, topic, memo')
      .eq('subject', SUBJECT_SLUG)
      .eq('chapter', chapterSlug)
    const m = new Map<number, Problem>()
    for (let q = chapter.start; q <= chapter.end; q++) {
      m.set(q, { q_num: q, status: 'untouched', ptype: null, topic: '', memo: '' })
    }
    ;(data || []).forEach(d => {
      m.set(d.q_num, {
        q_num: d.q_num,
        status: (d.status as TextbookStatus) ?? 'untouched',
        ptype: (d.ptype as ProblemType) ?? null,
        topic: d.topic ?? '',
        memo: d.memo ?? '',
      })
    })
    setProblems(m)
    setActiveQ(chapter.start)
    setLoaded(true)
  }, [chapter, chapterSlug])

  useEffect(() => { loadData() }, [loadData])

  // ── 전체 단원 통계 (사이드바 진행률용) ───────────────────────────
  const loadAllStats = useCallback(async () => {
    const { data } = await supabase
      .from('textbook_problems')
      .select('chapter, status')
      .eq('subject', SUBJECT_SLUG)
    const m = new Map<string, Record<TextbookStatus, number>>()
    ;(data || []).forEach(d => {
      if (!m.has(d.chapter)) m.set(d.chapter, { untouched: 0, correct: 0, wrong: 0, unsure: 0 })
      const rec = m.get(d.chapter)!
      const st = (d.status as TextbookStatus) ?? 'untouched'
      rec[st] = (rec[st] ?? 0) + 1
    })
    setAllStats(m)
  }, [])

  useEffect(() => { loadAllStats() }, [loadAllStats, problems])

  // ── 저장 ─────────────────────────────────────────────────────────
  const saveProblem = useCallback(async (p: Problem) => {
    await supabase.from('textbook_problems').upsert(
      {
        subject: SUBJECT_SLUG, chapter: chapterSlug, q_num: p.q_num,
        status: p.status, ptype: p.ptype, topic: p.topic || null, memo: p.memo || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'subject,chapter,q_num' }
    )
  }, [chapterSlug])

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

  const setStatusDirect = useCallback((q: number, st: TextbookStatus) => {
    setProblems(prev => {
      const next = new Map(prev)
      const cur = next.get(q)
      if (!cur) return prev
      const updated = { ...cur, status: st }
      next.set(q, updated)
      saveProblem(updated)
      return next
    })
  }, [saveProblem])

  const setPtype = useCallback((q: number, ptype: ProblemType) => {
    setProblems(prev => {
      const next = new Map(prev)
      const cur = next.get(q)
      if (!cur) return prev
      const updated = { ...cur, ptype: cur.ptype === ptype ? null : ptype }
      next.set(q, updated)
      saveProblem(updated)
      return next
    })
  }, [saveProblem])

  const setTopic = useCallback((q: number, topic: string) => {
    setProblems(prev => {
      const next = new Map(prev)
      const cur = next.get(q)
      if (!cur) return prev
      next.set(q, { ...cur, topic })
      return next
    })
  }, [])
  const saveTopicNow = useCallback((q: number) => {
    const p = problems.get(q)
    if (p) saveProblem(p)
  }, [problems, saveProblem])

  const setMemo = useCallback((q: number, memo: string) => {
    setProblems(prev => {
      const next = new Map(prev)
      const cur = next.get(q)
      if (!cur) return prev
      next.set(q, { ...cur, memo })
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
      setPanelWidth(Math.min(Math.round(window.innerWidth * 0.6), Math.max(280, dragStartW.current - (e.clientX - dragStartX.current))))
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

      {/* ── 바디: 사이드바 + 그리드 + 노트 ─────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* 단원 사이드바 */}
        <div className="w-40 shrink-0 bg-[#080f1e] border-r border-white/5 overflow-y-auto py-2">
          {subject.chapters.map(ch => {
            const chQ = ch.end - ch.start + 1
            const st = allStats.get(ch.slug) ?? { untouched: 0, correct: 0, wrong: 0, unsure: 0 }
            const solved = st.correct + st.wrong + st.unsure
            const isActive = ch.slug === chapterSlug
            return (
              <button key={ch.slug}
                onClick={() => router.push(`/dashboard/textbook/kikai/${ch.slug}`)}
                className={`w-full text-left px-3 py-2.5 transition ${isActive ? 'bg-[#0f1f35]' : 'hover:bg-[#0c1729]'}`}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: ch.accent }} />
                  <span className={`text-[12px] font-bold truncate ${isActive ? 'text-white' : 'text-gray-400'}`}>{ch.name}</span>
                </div>
                <div className="h-1 bg-gray-800 rounded-full overflow-hidden flex ml-3.5">
                  <div className="h-full" style={{ width: `${(st.correct / chQ) * 100}%`, backgroundColor: TB_STATUS_META.correct.accent }} />
                  <div className="h-full" style={{ width: `${(st.wrong / chQ) * 100}%`, backgroundColor: TB_STATUS_META.wrong.accent }} />
                  <div className="h-full" style={{ width: `${(st.unsure / chQ) * 100}%`, backgroundColor: TB_STATUS_META.unsure.accent }} />
                </div>
                <p className="text-[9px] text-gray-600 ml-3.5 mt-1">{solved}/{chQ}</p>
              </button>
            )
          })}
        </div>

        {/* 문제 타일 그리드 */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4">
          <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
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
                  className={`relative h-24 rounded-2xl p-3 flex flex-col text-left transition ${
                    isActive ? 'ring-2 ring-blue-400' : 'hover:brightness-125'
                  }`}
                  style={{ backgroundColor: p.status === 'untouched' ? '#0f1c2e' : meta.accent + '22' }}
                  title="클릭: 선택 / 더블클릭: 상태 변경"
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-lg font-black" style={{ color: p.status === 'untouched' ? '#9ca3af' : meta.accent }}>{q}</span>
                    <span className="text-base font-black" style={{ color: meta.accent }}>{meta.mark}</span>
                    <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: meta.accent + '33', color: meta.accent }}>{meta.ko}</span>
                  </div>
                  {p.ptype && (
                    <span className="absolute bottom-2 left-3 text-[9px] font-bold px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: PROBLEM_TYPE_META[p.ptype].accent + '33', color: PROBLEM_TYPE_META[p.ptype].accent }}>
                      {PROBLEM_TYPE_META[p.ptype].short}
                    </span>
                  )}
                  {p.topic ? (
                    <p className="text-[11px] text-gray-300 leading-tight line-clamp-2">{p.topic}</p>
                  ) : (
                    <p className="text-[11px] text-gray-700 italic">토픽 미입력</p>
                  )}
                  {p.memo && <span className="absolute bottom-2 right-2 text-[9px] text-blue-400">📝</span>}
                </button>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-700 mt-4">💡 타일 클릭 = 선택 · 더블클릭 = 상태 변경 (미착수→맞음→틀림→모르겠음)</p>
        </div>

        {/* 드래그 핸들 */}
        <div onMouseDown={handleDragStart} className="w-1 shrink-0 bg-white/5 hover:bg-blue-500/60 cursor-col-resize transition-colors" />

        {/* 선택 문제 패널 */}
        <div className="shrink-0 flex flex-col bg-[#080f1e] border-l border-white/5" style={{ width: panelWidth, minWidth: 280 }}>
          {activeProblem ? (
            <>
              <div className="px-4 py-3 border-b border-white/5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg font-black text-white">{activeProblem.q_num}번</span>
                  <div className="ml-auto flex items-center gap-0.5 bg-[#0f1c2e] rounded-lg p-0.5">
                    {TB_STATUS_CYCLE.map(st => (
                      <button key={st}
                        onClick={() => setStatusDirect(activeProblem.q_num, st)}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${activeProblem.status === st ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        style={activeProblem.status === st ? { backgroundColor: TB_STATUS_META[st].accent } : {}}>
                        {TB_STATUS_META[st].ko}
                      </button>
                    ))}
                  </div>
                </div>
                {/* 유형 태그 */}
                <div className="flex items-center gap-1 mb-2">
                  <span className="text-[10px] text-gray-600 mr-1">유형</span>
                  {PROBLEM_TYPE_ORDER.map(pt => (
                    <button key={pt} onClick={() => setPtype(activeProblem.q_num, pt)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${activeProblem.ptype === pt ? 'text-white' : 'text-gray-500 hover:text-gray-300 bg-[#0f1c2e]'}`}
                      style={activeProblem.ptype === pt ? { backgroundColor: PROBLEM_TYPE_META[pt].accent } : {}}>
                      {PROBLEM_TYPE_META[pt].ko}
                    </button>
                  ))}
                </div>
                <input
                  value={activeProblem.topic}
                  onChange={e => setTopic(activeProblem.q_num, e.target.value)}
                  onBlur={() => saveTopicNow(activeProblem.q_num)}
                  placeholder="핵심 토픽 (예: 분권전동기 속도-토크 특성)"
                  className="w-full bg-[#0f1c2e] rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-blue-500/60 placeholder-gray-700"
                />
              </div>
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
