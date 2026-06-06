'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  KIKAI_EXAMS,
  KIKAI_TAGS,
  KIKAI_TAG_MAP,
  Q_TOTAL,
  Q_SELECT_PAIR,
  isQSelectPair,
  scoreForQ,
} from '@/lib/constants-denken-kikai'

// ── 타입 ──────────────────────────────────────────────────────────
type Result = 'correct' | 'wrong' | null

type Answer = {
  q_num: number
  result: Result
  tag_id: number | null
  memo: string
}

type Session = {
  id: string
  exam_id: string
  drive_url: string | null
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

function calcScore(answers: Answer[], selectedQ: number | null): number {
  let total = 0
  for (const a of answers) {
    if (a.result !== 'correct') continue
    // 선택문제: selectedQ 아닌 쪽은 점수 제외
    if (isQSelectPair(a.q_num) && a.q_num !== selectedQ) continue
    total += scoreForQ(a.q_num)
  }
  return total
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
  onTagChange,
  onClick,
}: {
  qNum: number
  answer: Answer
  isSelected: boolean
  isExcluded: boolean
  isActive: boolean
  onResultToggle: () => void
  onTagChange: (id: number | null) => void
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

  const isSelectPair = isQSelectPair(qNum)
  const result = answer.result

  // 배경색
  let cellBg = 'bg-[#0f1c2e]'
  if (isActive) cellBg = 'bg-[#1a2e47] ring-1 ring-blue-500/60'
  if (isExcluded) cellBg = 'bg-[#0a1220] opacity-40'

  return (
    <div
      ref={ref}
      className={`relative flex flex-col items-center rounded-xl pt-1.5 pb-1 px-1 transition cursor-pointer select-none ${cellBg}`}
      style={{ minWidth: 44 }}
    >
      {/* 문제 번호 */}
      <div className="flex items-center gap-0.5 mb-1" onClick={onClick}>
        <span className={`text-[10px] font-bold ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>
          {qNum}
        </span>
        {isSelectPair && (
          <span className="text-[8px] text-yellow-500 font-bold">選</span>
        )}
        {answer.memo && (
          <span className="w-1 h-1 rounded-full bg-blue-400 ml-0.5" />
        )}
      </div>

      {/* O / X 토글 */}
      <button
        onClick={(e) => { e.stopPropagation(); onResultToggle() }}
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-base font-black transition ${
          result === 'correct'
            ? 'bg-emerald-600/80 text-white'
            : result === 'wrong'
            ? 'bg-red-700/80 text-white'
            : 'bg-[#1e3048] text-gray-600 hover:bg-[#253d5c]'
        }`}
        title={result === 'correct' ? '정답' : result === 'wrong' ? '오답' : '미채점'}
      >
        {result === 'correct' ? '○' : result === 'wrong' ? '✕' : '·'}
      </button>

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
      tag_id: null,
      memo: '',
    }))
  )
  const [selectedQ, setSelectedQ] = useState<17 | 18 | null>(null)
  const [driveUrl, setDriveUrl] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [activeQ, setActiveQ] = useState<number>(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [panelWidth, setPanelWidth] = useState(288)  // 기본 w-72 = 288px
  const memoRef = useRef<HTMLTextAreaElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(288)

  // ── 데이터 로드 ────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const { data: sess } = await supabase
      .from('denken_kikai_sessions')
      .select('id, exam_id, drive_url, selected_q')
      .eq('exam_id', examId)
      .maybeSingle()

    if (sess) {
      setSession(sess as Session)
      setDriveUrl(sess.drive_url || '')
      setUrlInput(sess.drive_url || '')
      if (sess.drive_url) setPreviewUrl(toPreviewUrl(sess.drive_url))
      if (sess.selected_q) setSelectedQ(sess.selected_q as 17 | 18)

      const { data: ans } = await supabase
        .from('denken_kikai_answers')
        .select('q_num, result, tag_id, memo')
        .eq('exam_id', examId)

      if (ans && ans.length > 0) {
        setAnswers(prev => prev.map(a => {
          const found = ans.find(x => x.q_num === a.q_num)
          if (!found) return a
          return {
            ...a,
            result: (found.result as Result) ?? null,
            tag_id: found.tag_id ?? null,
            memo: found.memo ?? '',
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
    setSession({ id: data.id, exam_id: examId, drive_url: null, selected_q: null })
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
        tag_id: a.tag_id,
        memo: a.memo || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'exam_id,q_num' }
    )
  }, [ensureSession, examId])

  // ── O/X 토글 ─────────────────────────────────────────────────
  const handleResultToggle = useCallback((qNum: number) => {
    setAnswers(prev => {
      const updated = prev.map(a => {
        if (a.q_num !== qNum) return a
        const next: Result =
          a.result === null ? 'correct' : a.result === 'correct' ? 'wrong' : null
        const newA = { ...a, result: next }
        saveAnswer(newA)
        return newA
      })
      return updated
    })
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
      const next = Math.min(600, Math.max(200, dragStartW.current + delta))
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
  const handleSelectQ = useCallback(async (q: 17 | 18) => {
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
    const preview = url ? toPreviewUrl(url) : null
    setPreviewUrl(preview)
    setDriveUrl(url)
    setSaving(true)
    const sessionId = await ensureSession()
    await supabase.from('denken_kikai_sessions')
      .update({ drive_url: url || null, updated_at: new Date().toISOString() })
      .eq('id', sessionId)
    setSaving(false)
  }, [urlInput, ensureSession])

  // ── 점수 계산 ─────────────────────────────────────────────────
  const score = calcScore(answers, selectedQ)
  const answered = answers.filter(a => {
    if (isQSelectPair(a.q_num) && a.q_num !== selectedQ) return false
    return a.result !== null
  }).length
  const totalQ = selectedQ ? Q_TOTAL - 1 : Q_TOTAL  // 선택문제 하나 제외

  // 태그별 정답률 미니
  const tagStats = KIKAI_TAGS.map(tag => {
    const tagged = answers.filter(a => a.tag_id === tag.id && a.result !== null)
    const correct = tagged.filter(a => a.result === 'correct').length
    return { tag, total: tagged.length, correct }
  }).filter(s => s.total > 0)

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
            </div>
          </div>
        </div>

        {/* 채점 셀 행 */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {answers.map(a => {
            const isPair = isQSelectPair(a.q_num)
            const isExcluded = isPair && selectedQ !== null && a.q_num !== selectedQ
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
                onTagChange={(id) => handleTagChange(a.q_num, id)}
                onClick={() => setActiveQ(a.q_num)}
              />
            )
          })}

          {/* 선택문제 선택 버튼 (17/18 옆) */}
          <div className="flex flex-col justify-center ml-2 shrink-0 gap-1">
            <p className="text-[9px] text-gray-600">선택</p>
            {Q_SELECT_PAIR.map(q => (
              <button
                key={q}
                onClick={() => handleSelectQ(q as 17 | 18)}
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
          {/* URL 입력바 */}
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
              className="bg-blue-700 hover:bg-blue-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
            >
              {saving ? '…' : '불러오기'}
            </button>
          </div>
          {/* PDF 영역 */}
          <div className="flex-1 relative">
            {previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                allow="autoplay"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-700">
                <div className="text-5xl opacity-30">📄</div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">구글 드라이브 PDF URL을 입력하세요</p>
                  <p className="text-xs text-gray-800 mt-1">drive.google.com/file/d/… 형식</p>
                </div>
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
          style={{ width: panelWidth, minWidth: 200, maxWidth: 600 }}
        >
          {/* 패널 헤더 */}
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <span className="text-sm font-bold text-white">
              {activeQ}번 메모
            </span>
            {activeAnswer?.tag_id && (
              <TagBadge tagId={activeAnswer.tag_id} />
            )}
            <span className={`ml-auto text-xs font-bold ${
              activeAnswer?.result === 'correct' ? 'text-emerald-400' :
              activeAnswer?.result === 'wrong' ? 'text-red-400' : 'text-gray-600'
            }`}>
              {activeAnswer?.result === 'correct' ? '○ 정답' :
               activeAnswer?.result === 'wrong' ? '✕ 오답' : '미채점'}
            </span>
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
                      a.result === 'correct' ? 'text-emerald-400' :
                      a.result === 'wrong' ? 'text-red-400' : 'text-gray-600'
                    }`}>
                      Q{a.q_num}
                    </span>
                    <span className="text-[11px] text-gray-400 truncate leading-relaxed">{a.memo}</span>
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
