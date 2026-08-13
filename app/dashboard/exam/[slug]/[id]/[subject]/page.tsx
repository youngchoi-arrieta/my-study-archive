'use client'

// 범용 시험 풀이 UI — /dashboard/exam/[slug]/[id]/[subject]
// -------------------------------------------------------------------
// 덴켄 1·2종 풀이 UI와 같은 뼈대. 왼쪽 PDF · 위 채점 셀 · 오른쪽 리치 메모(수식·이미지).
//   marksheet 과목 : 블록별 小問 정오 → subs_json 한 행(q_num=0)에 저장
//   essay 과목     : 문제별 선택 + 자기채점 → q_num≥1 행마다 저장

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, notFound } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import DenkenMemoEditor from '@/app/components/DenkenMemoEditor'
import { PastPaperChip } from '@/app/components/PastPaperBar'
import { cycleReview, REVIEW_META, type ReviewState } from '@/lib/constants-denken-review'
import {
  EXAM_MAP, getSubjectSpec, parseExamRound,
  cycleResult, normalizeSubs, round1,
  markGroupScore, markSubjectScore, markGradedCount, markAnswerable,
  cutChecks, isPassed,
  essayScore, essayPicked, clampEssayScore,
  type Result, type EssayAnswer,
} from '@/lib/constants-exams'

function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const m = url.match(/\/file\/d\/([^/]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

// marksheet 상태: 블록별 小問 정오 배열
type MarkState = Result[][]
// essay 상태: 문제별
type EssayRow = { q_num: number; selected: boolean; score: number | null; memo: string; review: ReviewState }

export default function ExamSolvePage() {
  const params = useParams()
  const slug = params.slug as string
  const examId = params.id as string
  const subjectSlug = params.subject as string

  const spec = EXAM_MAP.get(slug)
  const sp = spec ? getSubjectSpec(spec, subjectSlug) : undefined
  const parsed = spec ? parseExamRound(spec, examId) : null
  const year = parsed?.year ?? null
  const roundNo = parsed?.round ?? null
  const isEssay = sp?.mode === 'essay'

  // ── 공통 세션(PDF/메모) ───────────────────────────────────────────
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [answerPreviewUrl, setAnswerPreviewUrl] = useState<string | null>(null)
  const [pdfTab, setPdfTab] = useState<'question' | 'answer'>('question')
  const [urlInput, setUrlInput] = useState('')
  const [answerUrl, setAnswerUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // marksheet
  const [mark, setMark] = useState<MarkState>(() =>
    (sp?.mark ?? []).map(g => Array.from({ length: g.subCount }, () => null as Result)))
  const [markMemo, setMarkMemo] = useState('')
  const [markReview, setMarkReview] = useState<ReviewState>(null)

  // essay
  const [rows, setRows] = useState<EssayRow[]>(() =>
    isEssay && sp?.essay
      ? Array.from({ length: sp.essay.totalQ }, (_, i) => ({
          q_num: i + 1, selected: false, score: null, memo: '', review: null as ReviewState }))
      : [])
  const [activeQ, setActiveQ] = useState(1)

  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.42) : 520)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(520)

  // ── 로드 ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!spec || !sp) return
    const { data: sRows } = await supabase.from('exam_sessions')
      .select('id, drive_url, answer_drive_url')
      .eq('exam_slug', slug).eq('exam_id', examId).eq('subject', subjectSlug).limit(1)
    const sess = sRows?.[0]
    if (sess) {
      setSessionId(sess.id)
      setUrlInput(sess.drive_url ?? '')
      setAnswerUrl(sess.answer_drive_url ?? '')
      if (sess.drive_url) setPreviewUrl(toPreviewUrl(sess.drive_url))
      if (sess.answer_drive_url) setAnswerPreviewUrl(toPreviewUrl(sess.answer_drive_url))
    }
    const { data: ans } = await supabase.from('exam_answers')
      .select('q_num, subs_json, selected, score, memo, review')
      .eq('exam_slug', slug).eq('exam_id', examId).eq('subject', subjectSlug)

    if (!ans) return
    if (sp.mode === 'marksheet') {
      const row = ans.find(a => a.q_num === 0)
      if (row) {
        setMark((sp.mark ?? []).map((g, i) =>
          normalizeSubs(((row.subs_json?.[i] ?? []) as Result[]), g.subCount)))
        setMarkMemo(row.memo ?? '')
        setMarkReview((row.review as ReviewState) ?? null)
      }
    } else {
      setRows(prev => prev.map(r => {
        const f = ans.find(a => a.q_num === r.q_num)
        return f ? {
          ...r, selected: !!f.selected, score: f.score ?? null,
          memo: f.memo ?? '', review: (f.review as ReviewState) ?? null,
        } : r
      }))
    }
  }, [spec, sp, slug, examId, subjectSlug])

  useEffect(() => { load() }, [load])

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionId) return sessionId
    const { data } = await supabase.from('exam_sessions')
      .upsert({ exam_slug: slug, exam_id: examId, subject: subjectSlug }, { onConflict: 'exam_slug,exam_id,subject' })
      .select('id').single()
    const id = data!.id
    setSessionId(id)
    return id
  }, [sessionId, slug, examId, subjectSlug])

  // ── marksheet 저장 ────────────────────────────────────────────────
  const saveMark = useCallback(async (next: MarkState, memo: string, review: ReviewState) => {
    const sid = await ensureSession()
    await supabase.from('exam_answers').upsert({
      session_id: sid, exam_slug: slug, exam_id: examId, subject: subjectSlug, q_num: 0,
      subs_json: next, memo: memo || null, review,
      review_at: review ? new Date().toISOString() : null,
    }, { onConflict: 'exam_slug,exam_id,subject,q_num' })
  }, [ensureSession, slug, examId, subjectSlug])

  const toggleMarkSub = (gi: number, si: number) => {
    setMark(prev => {
      const next = prev.map(a => a.slice())
      next[gi][si] = cycleResult(next[gi][si])
      saveMark(next, markMemo, markReview)
      return next
    })
  }
  const changeMarkMemo = (memo: string) => setMarkMemo(memo)
  const blurMarkMemo = () => saveMark(mark, markMemo, markReview)
  const toggleMarkReview = () => {
    setMarkReview(prev => { const n = cycleReview(prev); saveMark(mark, markMemo, n); return n })
  }

  // ── essay 저장 ────────────────────────────────────────────────────
  const saveEssayRow = useCallback(async (r: EssayRow) => {
    const sid = await ensureSession()
    await supabase.from('exam_answers').upsert({
      session_id: sid, exam_slug: slug, exam_id: examId, subject: subjectSlug, q_num: r.q_num,
      selected: r.selected, score: r.score, memo: r.memo || null, review: r.review,
      review_at: r.review ? new Date().toISOString() : null,
    }, { onConflict: 'exam_slug,exam_id,subject,q_num' })
  }, [ensureSession, slug, examId, subjectSlug])

  const patchRow = (qNum: number, fn: (r: EssayRow) => EssayRow) => {
    setRows(prev => prev.map(r => {
      if (r.q_num !== qNum) return r
      const next = fn(r); saveEssayRow(next); return next
    }))
  }
  const toggleSelected = (q: number) => patchRow(q, r => ({ ...r, selected: !r.selected }))
  const setScore = (q: number, v: string) =>
    setRows(prev => prev.map(r => r.q_num === q
      ? { ...r, score: v === '' ? null : clampEssayScore(Number(v), sp!.essay!) } : r))
  const commitScore = (q: number) => { const r = rows.find(x => x.q_num === q); if (r) saveEssayRow(r) }
  const changeEssayMemo = (q: number, memo: string) =>
    setRows(prev => prev.map(r => r.q_num === q ? { ...r, memo } : r))
  const blurEssayMemo = (q: number) => { const r = rows.find(x => x.q_num === q); if (r) saveEssayRow(r) }
  const toggleEssayReview = (q: number) => patchRow(q, r => ({ ...r, review: cycleReview(r.review) }))

  // ── URL 저장 ──────────────────────────────────────────────────────
  const saveUrlFor = useCallback(async (which: 'question' | 'answer') => {
    setSaving(true)
    const patch = which === 'question'
      ? { drive_url: urlInput.trim() || null }
      : { answer_drive_url: answerUrl.trim() || null }
    if (which === 'question') setPreviewUrl(urlInput.trim() ? toPreviewUrl(urlInput.trim()) : null)
    else setAnswerPreviewUrl(answerUrl.trim() ? toPreviewUrl(answerUrl.trim()) : null)
    await supabase.from('exam_sessions')
      .upsert({ exam_slug: slug, exam_id: examId, subject: subjectSlug, ...patch }, { onConflict: 'exam_slug,exam_id,subject' })
    setSaving(false)
  }, [urlInput, answerUrl, slug, examId, subjectSlug])

  // 드래그
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true; dragStartX.current = e.clientX; dragStartW.current = panelWidth; e.preventDefault()
  }, [panelWidth])
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      setPanelWidth(Math.min(Math.round(window.innerWidth * 0.72), Math.max(240, dragStartW.current - (e.clientX - dragStartX.current))))
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── 집계 ──────────────────────────────────────────────────────────
  const essayGroup = sp?.essay ?? null
  const markScore = useMemo(
    () => (sp && !isEssay ? markSubjectScore(sp, mark) : 0), [sp, isEssay, mark])
  const markGraded = useMemo(
    () => (sp && !isEssay ? markGradedCount(sp, mark) : 0), [sp, isEssay, mark])
  const essayAnswers: EssayAnswer[] = useMemo(
    () => rows.map(r => ({ q_num: r.q_num, selected: r.selected, score: r.score })), [rows])
  const eScore = useMemo(
    () => (essayGroup && isEssay ? essayScore(essayGroup, essayAnswers) : 0),
    [essayGroup, isEssay, essayAnswers])
  const ePicked = useMemo(() => (isEssay ? essayPicked(essayAnswers) : 0), [isEssay, essayAnswers])

  if (!spec || !sp || year === null) { notFound(); return null }

  const score = isEssay ? eScore : markScore
  const cuts = isEssay ? [] : cutChecks(slug, sp, mark)
  const passed = isEssay ? score >= sp.passMark : isPassed(slug, sp, score, mark)
  const accent = sp.accent

  const activeRow = rows.find(r => r.q_num === activeQ)

  return (
    <main className="min-h-screen bg-[#050d1a] text-white flex flex-col" style={{ height: '100dvh' }}>
      {/* 헤더 */}
      <div className="shrink-0 bg-[#0a1628] border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <Link href={`/dashboard/exam/${slug}`} className="text-gray-500 hover:text-white text-xs transition">
            ← {spec.name}
          </Link>
          <span className="text-sm font-bold text-white">
            {spec.yearLabel(year)}{roundNo ? ` 제${roundNo}회` : ''}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full font-bold text-white" style={{ backgroundColor: accent }}>
            {sp.name}
          </span>
          <span className="text-[10px] text-gray-600">{isEssay ? '논술 · 자기채점' : '마크시트'}</span>
          <div className="ml-auto flex items-center gap-3">
            <span className={`text-lg font-black tabular-nums ${passed ? 'text-emerald-400' : score > 0 ? 'text-white' : 'text-gray-600'}`}>
              {score}<span className="text-xs text-gray-600 font-normal"> / {sp.fullMark}</span>
            </span>
            <span className="text-xs text-gray-600">
              {isEssay ? `선택 ${ePicked}/${sp.essay!.pickCount}問` : `${markGraded}/${markAnswerable(sp)}문`}
            </span>
            {passed && <span className="text-[10px] bg-emerald-600/30 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">합격</span>}
          </div>
        </div>

        {/* 채점 셀 */}
        {!isEssay ? (
          <div className="space-y-1.5">
            {(sp.mark ?? []).map((g, gi) => {
              const denom = g.pickCount ?? g.subCount
              const gs = round1(markGroupScore(g, mark[gi] ?? []))
              return (
                <div key={gi} className="flex items-start gap-2">
                  <div className="shrink-0 w-24 pt-1">
                    <p className="text-[11px] font-bold text-gray-300">{g.label}</p>
                    <p className="text-[9px] text-gray-600">
                      {g.pickCount ? `${g.subCount}문중 ${g.pickCount}선택` : `${g.subCount}문`} · {gs}/{g.point}点
                    </p>
                  </div>
                  <div className="flex gap-0.5 flex-wrap">
                    {(mark[gi] ?? []).map((r, si) => (
                      <button key={si} onClick={() => toggleMarkSub(gi, si)}
                        className={`w-6 h-7 rounded flex items-center justify-center text-[11px] font-black transition ${
                          r === 'correct' ? 'bg-emerald-600/80 text-white'
                          : r === 'wrong' ? 'bg-red-700/80 text-white'
                          : 'bg-[#1e3048] text-gray-600 hover:bg-[#253d5c]'}`}
                        title={`${si + 1}번`}>
                        {r === 'correct' ? '○' : r === 'wrong' ? '✕' : si + 1}
                      </button>
                    ))}
                  </div>
                  <span className="text-[9px] text-gray-600 pt-1.5 shrink-0">
                    {(mark[gi] ?? []).filter(x => x === 'correct').length}
                    {g.pickCount ? ` (상위 ${denom} 인정)` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex gap-1.5 overflow-x-auto pb-1 items-start">
            {rows.map(r => (
              <EssayCell key={r.q_num} row={r} perQ={sp.essay!.perQ} isActive={activeQ === r.q_num}
                onSelect={() => toggleSelected(r.q_num)}
                onScore={v => setScore(r.q_num, v)}
                onCommit={() => commitScore(r.q_num)}
                onReview={() => toggleEssayReview(r.q_num)}
                onClick={() => setActiveQ(r.q_num)} />
            ))}
            <div className="shrink-0 pl-2 pt-1 text-[9px] text-gray-600 w-28">
              {sp.essay!.totalQ}問 중 {sp.essay!.pickCount}問 선택 · 각 {sp.essay!.perQ}점
            </div>
          </div>
        )}
      </div>

      {/* 본문 */}
      <div className="flex flex-1 min-h-0">
        {/* PDF */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#050d1a]">
          <div className="flex items-center gap-2 px-3 py-2 bg-[#080f1e] border-b border-white/5 shrink-0">
            <div className="flex bg-[#0f1c2e] rounded-lg p-0.5 shrink-0">
              <button onClick={() => setPdfTab('question')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'question' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                style={pdfTab === 'question' ? { backgroundColor: accent } : {}}>問題</button>
              <button onClick={() => setPdfTab('answer')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'answer' ? 'bg-emerald-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                {isEssay ? '解答例' : '解答'}
              </button>
            </div>
            {pdfTab === 'question' ? (
              <>
                <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveUrlFor('question')}
                  placeholder="문제 PDF URL..."
                  className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/60 placeholder-gray-700 font-mono" />
                <button onClick={() => saveUrlFor('question')} disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: accent }}>
                  {saving ? '…' : '불러오기'}
                </button>
                {spec.pastPapers?.[0] && (
                  <PastPaperChip url={spec.pastPapers[0].url} label="공식 과년도" />
                )}
              </>
            ) : (
              <>
                <input value={answerUrl} onChange={e => setAnswerUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveUrlFor('answer')}
                  placeholder="정답 PDF URL..."
                  className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500/60 placeholder-gray-700 font-mono" />
                <button onClick={() => saveUrlFor('answer')} disabled={saving}
                  className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-white">
                  {saving ? '…' : '불러오기'}
                </button>
                {spec.pastPapers?.[0] && (
                  <PastPaperChip url={spec.pastPapers[0].url} label="공식 과년도" />
                )}
              </>
            )}
          </div>
          <div className="flex-1 relative">
            {previewUrl && <iframe src={previewUrl} className="absolute inset-0 w-full h-full border-0" allow="autoplay"
              style={{ display: pdfTab === 'question' ? 'block' : 'none' }} />}
            {answerPreviewUrl && <iframe src={answerPreviewUrl} className="absolute inset-0 w-full h-full border-0" allow="autoplay"
              style={{ display: pdfTab === 'answer' ? 'block' : 'none' }} />}
            {pdfTab === 'question' && !previewUrl && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-700">
                <div className="text-5xl opacity-30">📄</div><p className="text-sm">문제 PDF URL을 입력하세요</p>
              </div>
            )}
            {pdfTab === 'answer' && !answerPreviewUrl && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-700">
                <div className="text-5xl opacity-30">✅</div><p className="text-sm">{isEssay ? '해답례' : '정답'} PDF URL을 입력하세요</p>
              </div>
            )}
          </div>
        </div>

        <div onMouseDown={handleDragStart} className="w-1 shrink-0 bg-white/5 hover:bg-blue-500/60 cursor-col-resize transition-colors" />

        {/* 오른쪽 메모 */}
        <div className="shrink-0 flex flex-col bg-[#080f1e] border-l border-white/5" style={{ width: panelWidth, minWidth: 240 }}>
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <span className="text-sm font-bold text-white">{isEssay ? `問${activeQ} 메모` : '과목 메모'}</span>
            <button onClick={() => isEssay ? toggleEssayReview(activeQ) : toggleMarkReview()}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold transition border"
              style={(() => {
                const rv = isEssay ? activeRow?.review : markReview
                return rv ? { color: REVIEW_META[rv].color, backgroundColor: REVIEW_META[rv].bg, borderColor: REVIEW_META[rv].border }
                  : { color: '#4b5563', borderColor: 'rgba(255,255,255,0.08)' }
              })()}>
              {(() => { const rv = isEssay ? activeRow?.review : markReview
                return rv ? `${REVIEW_META[rv].icon} ${REVIEW_META[rv].short}` : '🔖 복습' })()}
            </button>
            {isEssay && activeRow && (
              <span className="ml-auto text-xs font-bold tabular-nums">
                <span className={activeRow.selected ? 'text-violet-300' : 'text-gray-600'}>
                  {activeRow.selected ? `${activeRow.score ?? 0} / ${sp.essay!.perQ}点` : '미선택'}
                </span>
              </span>
            )}
          </div>
          <div className="flex-1 p-3 flex flex-col min-h-0">
            {isEssay ? (
              <DenkenMemoEditor key={activeQ} content={activeRow?.memo ?? ''}
                onChange={val => changeEssayMemo(activeQ, val)} onBlur={() => blurEssayMemo(activeQ)}
                placeholder={`問${activeQ} — 풀이 논지·개요·핵심 논점 · 수식(Σ)·이미지 삽입 가능`} />
            ) : (
              <DenkenMemoEditor content={markMemo}
                onChange={changeMarkMemo} onBlur={blurMarkMemo}
                placeholder="틀린 문항 원인·핵심 개념·자주 나오는 함정 · 수식(Σ)·이미지 삽입 가능" />
            )}
          </div>

          {/* 점수 요약 */}
          <div className="border-t border-white/5 px-4 py-3 bg-[#050d1a] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">{isEssay ? '자기채점' : '채점 결과'}</p>
                <p className={`text-2xl font-black tabular-nums ${passed ? 'text-emerald-400' : score > 0 ? 'text-gray-300' : 'text-gray-600'}`}>
                  {score}<span className="text-sm font-normal text-gray-600 ml-1">/ {sp.fullMark}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-600 mb-0.5">합격 기준</p>
                <p className="text-sm text-gray-500">{sp.passMark}点 이상</p>
                {passed && <p className="text-xs text-emerald-400 font-bold">✓ 합격</p>}
              </div>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (score / sp.fullMark) * 100)}%`,
                  backgroundColor: passed ? '#10b981' : score > 0 ? '#eab308' : '#6b7280' }} />
            </div>
            {cuts.length > 0 && (
              <div className="mt-2 space-y-0.5">
                {cuts.map(c => (
                  <p key={c.label} className="text-[10px] flex items-center gap-1">
                    <span className={c.ok ? 'text-emerald-400' : 'text-red-400'}>{c.ok ? '✓' : '✕'}</span>
                    <span className="text-gray-500">{c.label} 足切り {c.got}/{c.need}문</span>
                    {!c.ok && <span className="text-red-400">미달</span>}
                  </p>
                ))}
              </div>
            )}
            {sp.note && <p className="text-[10px] text-gray-700 mt-2">{sp.note}</p>}
          </div>
        </div>
      </div>
    </main>
  )
}

function EssayCell({ row, perQ, isActive, onSelect, onScore, onCommit, onReview, onClick }: {
  row: EssayRow; perQ: number; isActive: boolean
  onSelect: () => void; onScore: (v: string) => void; onCommit: () => void; onReview: () => void; onClick: () => void
}) {
  let bg = 'bg-[#0f1c2e]'
  if (row.review === 'todo') bg = 'bg-[#2a2411] ring-1 ring-amber-500/50'
  if (row.review === 'done') bg = 'bg-[#102a20]'
  if (isActive) bg = 'bg-[#1a2e47] ring-1 ring-blue-500/60'
  if (!row.selected) bg += ' opacity-60'
  const ratio = row.score !== null ? row.score / perQ : 0

  return (
    <div className={`relative flex flex-col items-center rounded-xl pt-1.5 pb-1.5 px-2 cursor-pointer select-none shrink-0 ${bg}`}
      onClick={onClick} style={{ minWidth: 84 }}>
      <div className="flex items-center gap-1 mb-1">
        <span className={`text-[10px] font-bold ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>問{row.q_num}</span>
        {row.memo && <span className="w-1 h-1 rounded-full bg-blue-400" />}
      </div>
      <button onClick={e => { e.stopPropagation(); onReview() }}
        className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded text-[9px] leading-none"
        style={row.review ? { color: REVIEW_META[row.review].color, backgroundColor: REVIEW_META[row.review].bg } : {}}>
        {row.review === 'todo' ? '🔖' : row.review === 'done' ? '✓' : <span className="text-gray-700">🔖</span>}
      </button>
      <button onClick={e => { e.stopPropagation(); onSelect() }}
        className={`w-full px-2 py-0.5 rounded text-[9px] font-bold transition mb-1 ${
          row.selected ? 'bg-violet-600 text-white' : 'bg-[#1e3048] text-gray-500 hover:text-white'}`}>
        {row.selected ? '선택함' : '미선택'}
      </button>
      <div className="flex items-baseline gap-0.5">
        <input type="number" min={0} max={perQ} step={0.5} value={row.score ?? ''} disabled={!row.selected}
          onClick={e => e.stopPropagation()} onChange={e => onScore(e.target.value)} onBlur={onCommit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="–"
          className="w-11 bg-[#1e3048] rounded px-1 py-0.5 text-center text-xs font-bold text-white outline-none focus:ring-1 focus:ring-violet-500/60 disabled:opacity-30 tabular-nums" />
        <span className="text-[9px] text-gray-600">/{perQ}</span>
      </div>
      <div className="w-full bg-[#1e3048] rounded-full h-1 mt-1 overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: ratio >= 0.6 ? '#10b981' : ratio > 0 ? '#a78bfa' : 'transparent' }} />
      </div>
    </div>
  )
}
