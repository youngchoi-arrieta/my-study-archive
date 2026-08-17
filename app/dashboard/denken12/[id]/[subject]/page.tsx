'use client'

// 電験一種・二種 풀이 UI (1·2종 · 一次/二次 공용)
// -------------------------------------------------------------------
// 화면 뼈대는 三種 풀이 UI와 같다 — 왼쪽 PDF, 오른쪽 메모, 위쪽 채점 셀.
// 다른 건 채점 모델뿐이라 한 페이지에서 두 모드로 갈라 쓴다.
//
//   一次 : 大問마다 小問이 5~10개. 大問 배점을 小問 수로 나눠 배분한다.
//          1종 B문제는 회차마다 小問 수가 달라져서 ± 버튼으로 그 자리에서 고친다.
//   二次 : 記述式이라 정오 개념이 없다. 문제를 골랐는가 + 30점 만점 자기채점.
//          선택 개수를 넘겨 입력해도 상위 N개만 인정한다(실제 채점과 동일).

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { loadExamDoc, saveExamAnswerUrl, phaseOfSubject } from '@/lib/examDocs'
import DenkenMemoEditor from '@/app/components/DenkenMemoEditor'
import { PastPaperChip } from '@/app/components/PastPaperBar'
import { cycleReview, REVIEW_META, type ReviewState } from '@/lib/constants-denken-review'
import {
  GRADE_META, SUBJECT_ACCENT,
  ICHIJI_SUBJECTS, NIJI_SUBJECTS, NIJI_STRUCTURE, NIJI_PASS_MARK, NIJI_FULL_MARK,
  ichijiStructure, parseExamId, examLabel, wareki,
  isBArea, isSelectQ, isDimmedSelect, isExcludedSelect, pointOf, defaultSubCount,
  PAST_PAPER_URL,
  clampSubCount, SUB_COUNT_MIN, SUB_COUNT_MAX,
  normalizeSubs, cycleResult, questionScore, questionStatus,
  scoreIchiji, gradedCount, answerableCount,
  scoreNiji, nijiPickedCount, clampNijiScore, round1,
  type Denken12Grade, type IchijiSubject, type NijiSubject,
  type IchijiAnswer, type NijiAnswer, type Result,
} from '@/lib/constants-denken12'

// ── 출제 주제 · 키워드 ─────────────────────────────────────────────
// 三種의 태그와 달리 자유 입력이다. 1·2종은 출제 범위가 넓어
// 미리 정해둔 태그 목록으로는 담기지 않기 때문.
// 여기 넣은 것들이 /dashboard/denken12/topics 에 모여 경향이 된다.
function TopicBox({ topic, keywords, onTopic, onTopicBlur, onAdd, onRemove }: {
  topic: string
  keywords: string[]
  onTopic: (v: string) => void
  onTopicBlur: () => void
  onAdd: (kw: string) => void
  onRemove: (kw: string) => void
}) {
  const [draft, setDraft] = useState('')
  const commit = () => { onAdd(draft); setDraft('') }
  return (
    <div className="bg-[#0f1c2e] rounded-lg p-2.5 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-8">주제</span>
        <input value={topic} onChange={e => onTopic(e.target.value)} onBlur={onTopicBlur}
          placeholder="예: 同期電動機 負荷角 過渡現象"
          className="flex-1 bg-[#0a1628] rounded px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/60 placeholder-gray-700" />
      </div>
      <div className="flex items-start gap-2">
        <span className="text-[10px] text-gray-500 shrink-0 w-8 pt-1">키워드</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1 mb-1">
            {keywords.map(k => (
              <button key={k} onClick={() => onRemove(k)}
                className="text-[10px] px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-200 hover:bg-red-900/60 hover:text-red-200 transition"
                title="클릭하면 삭제">
                {k} ✕
              </button>
            ))}
          </div>
          <input value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit() } }}
            onBlur={commit}
            placeholder="Enter로 추가 · 微分方程式, 脱調, 過渡…"
            className="w-full bg-[#0a1628] rounded px-2 py-1 text-xs text-white outline-none focus:ring-1 focus:ring-violet-500/60 placeholder-gray-700" />
        </div>
      </div>
    </div>
  )
}

// ── 과목 전환 ──────────────────────────────────────────────────────
// 같은 회차 안에서 一次 4과목 ↔ 二次 2과목을 바로 오간다.
// 解答 PDF가 회차 단위로 공유되므로, 과목을 옮겨도 해답 탭은 그대로 열린다.
function SubjectSwitch({ examId, current }: { examId: string; current: string }) {
  const router = useRouter()
  const go = (sub: string) => {
    if (sub === current) return
    router.push(`/dashboard/denken12/${examId}/${encodeURIComponent(sub)}`)
  }
  const Chip = ({ sub }: { sub: string }) => {
    const on = sub === current
    return (
      <button onClick={() => go(sub)}
        className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition whitespace-nowrap ${
          on ? 'text-white' : 'text-gray-500 hover:text-gray-200'
        }`}
        style={on ? { backgroundColor: SUBJECT_ACCENT[sub as IchijiSubject | NijiSubject] } : {}}>
        {sub}
      </button>
    )
  }
  return (
    <div className="flex items-center gap-0.5 bg-[#0f1c2e] rounded-lg p-0.5">
      {ICHIJI_SUBJECTS.map(sub => <Chip key={sub} sub={sub} />)}
      <span className="w-px h-4 bg-white/10 mx-1 shrink-0" />
      {NIJI_SUBJECTS.map(sub => <Chip key={sub} sub={sub} />)}
    </div>
  )
}

type Row = {
  q_num: number
  sub_count: number
  subs: Result[]
  selected: boolean
  score: number | null
  memo: string
  topic: string
  keywords: string[]
  review: ReviewState
}

type Session = {
  id: string
  drive_url: string | null
  answer_drive_url: string | null
  solution_url: string | null
  selected_q: number | null
}

function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const m = url.match(/\/file\/d\/([^/]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

const ALL = [...ICHIJI_SUBJECTS, ...NIJI_SUBJECTS] as string[]

// 리치 에디터 메모는 HTML로 저장된다 → 목록 미리보기용으로 태그를 벗겨 한 줄 텍스트만 뽑는다
function stripHtml(html: string): string {
  if (!html) return ''
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').trim()
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return (tmp.textContent || tmp.innerText || '').replace(/\s+/g, ' ').trim()
}

export default function Denken12SolvePage() {
  const params  = useParams()
  const examId  = params.id as string
  const rawSub  = decodeURIComponent(params.subject as string)
  const subject = (ALL.includes(rawSub) ? rawSub : '理論') as IchijiSubject | NijiSubject
  const niji    = (NIJI_SUBJECTS as string[]).includes(subject)

  const parsed = parseExamId(examId)
  const grade: Denken12Grade = parsed?.grade ?? 'second'
  const gm = GRADE_META[grade]
  const accent = SUBJECT_ACCENT[subject]

  const ist = !niji ? ichijiStructure(grade, subject as IchijiSubject) : null
  const nst = niji ? NIJI_STRUCTURE[subject as NijiSubject] : null
  const totalQ = niji ? nst!.totalQ : ist!.totalQ

  const [session, setSession]   = useState<Session | null>(null)
  const [rows, setRows]         = useState<Row[]>(() =>
    Array.from({ length: totalQ }, (_, i) => {
      const q = i + 1
      const sc = niji ? 0 : defaultSubCount(ist!, q)
      return {
        q_num: q, sub_count: sc,
        subs: Array.from({ length: sc }, () => null as Result),
        selected: false, score: null, memo: '', topic: '', keywords: [], review: null,
      }
    })
  )
  const [selectedQ, setSelectedQ] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [answerPreviewUrl, setAnswerPreviewUrl] = useState<string | null>(null)
  const [pdfTab, setPdfTab]     = useState<'question' | 'answer' | 'solution'>('question')
  const [solutionUrl, setSolutionUrl] = useState('')
  const [solutionPreviewUrl, setSolutionPreviewUrl] = useState<string | null>(null)
  const [activeQ, setActiveQ]   = useState(1)
  const [urlInput, setUrlInput] = useState('')
  const [answerUrl, setAnswerUrl] = useState('')
  const [sharedAnswer, setSharedAnswer] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [panelWidth, setPanelWidth] = useState(() =>
    typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.38) : 480
  )

  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const dragStartW = useRef(480)

  // ── 로드 ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    const { data: sRows } = await supabase
      .from('denken12_sessions')
      .select('id, drive_url, answer_drive_url, solution_url, selected_q')
      .eq('exam_id', examId).eq('subject', subject).limit(1)
    const sess = sRows?.[0] as Session | undefined
    if (sess) {
      setSession(sess)
      setUrlInput(sess.drive_url ?? '')
      setAnswerUrl(sess.answer_drive_url ?? '')
      if (sess.drive_url) setPreviewUrl(toPreviewUrl(sess.drive_url))
      setSolutionUrl(sess.solution_url ?? '')
      if (sess.solution_url) setSolutionPreviewUrl(toPreviewUrl(sess.solution_url))
      if (sess.answer_drive_url) setAnswerPreviewUrl(toPreviewUrl(sess.answer_drive_url))
      if (sess.selected_q) setSelectedQ(sess.selected_q)
    }
    // 解答은 회차·차수 단위로 공유된다 — 과목별 값보다 우선
    const doc = await loadExamDoc('denken12', examId, phaseOfSubject(subject))
    if (doc?.answer_url) {
      setAnswerUrl(doc.answer_url)
      setAnswerPreviewUrl(toPreviewUrl(doc.answer_url))
      setSharedAnswer(true)
    } else {
      setSharedAnswer(false)
    }

    const { data: ans } = await supabase
      .from('denken12_answers')
      .select('q_num, sub_count, subs, selected, score, memo, topic, keywords, review')
      .eq('exam_id', examId).eq('subject', subject)
    if (ans && ans.length > 0) {
      setRows(prev => prev.map(r => {
        const f = ans.find(x => x.q_num === r.q_num)
        if (!f) return r
        const sc = f.sub_count ?? r.sub_count
        return {
          ...r,
          sub_count: sc,
          subs: normalizeSubs(((f.subs ?? []) as Result[]), sc),
          selected: !!f.selected,
          score: f.score ?? null,
          memo: f.memo ?? '',
          topic: f.topic ?? '',
          keywords: f.keywords ?? [],
          review: (f.review as ReviewState) ?? null,
        }
      }))
    }
  }, [examId, subject])

  useEffect(() => { load() }, [load])

  const ensureSession = useCallback(async (): Promise<string> => {
    if (session?.id) return session.id
    const { data, error } = await supabase
      .from('denken12_sessions')
      .upsert({ exam_id: examId, subject }, { onConflict: 'exam_id,subject' })
      .select('id').single()
    if (error || !data) throw new Error('세션 생성 실패')
    setSession({ id: data.id, drive_url: null, answer_drive_url: null, selected_q: null })
    return data.id
  }, [session, examId, subject])

  const saveRow = useCallback(async (r: Row) => {
    const sid = await ensureSession()
    await supabase.from('denken12_answers').upsert({
      session_id: sid, exam_id: examId, subject, q_num: r.q_num,
      sub_count: niji ? null : r.sub_count,
      subs: niji ? null : r.subs,
      selected: niji ? r.selected : null,
      score: niji ? r.score : null,
      memo: r.memo || null,
      topic: r.topic || null,
      keywords: r.keywords.length ? r.keywords : null,
      review: r.review,
      review_at: r.review ? new Date().toISOString() : null,
    }, { onConflict: 'exam_id,subject,q_num' })
  }, [ensureSession, examId, subject, niji])

  const patch = useCallback((qNum: number, fn: (r: Row) => Row) => {
    setRows(prev => prev.map(r => {
      if (r.q_num !== qNum) return r
      const next = fn(r)
      saveRow(next)
      return next
    }))
  }, [saveRow])

  // ── 조작 ──────────────────────────────────────────────────────────
  const toggleSub = (qNum: number, i: number) =>
    patch(qNum, r => {
      const subs = r.subs.slice()
      subs[i] = cycleResult(subs[i])
      return { ...r, subs }
    })

  const changeSubCount = (qNum: number, delta: number) =>
    patch(qNum, r => {
      const sc = clampSubCount(r.sub_count + delta)
      return { ...r, sub_count: sc, subs: normalizeSubs(r.subs, sc) }
    })

  const toggleReview = (qNum: number) =>
    patch(qNum, r => ({ ...r, review: cycleReview(r.review) }))

  const toggleSelected = (qNum: number) =>
    patch(qNum, r => ({ ...r, selected: !r.selected }))

  const setNijiScore = (qNum: number, v: string) =>
    setRows(prev => prev.map(r => r.q_num === qNum
      ? { ...r, score: v === '' ? null : clampNijiScore(Number(v), nst!) }
      : r))

  const commitNijiScore = (qNum: number) => {
    const r = rows.find(x => x.q_num === qNum)
    if (r) saveRow(r)
  }

  const setTopic = (qNum: number, topic: string) =>
    setRows(prev => prev.map(r => r.q_num === qNum ? { ...r, topic } : r))
  const commitTopic = (qNum: number) => {
    const r = rows.find(x => x.q_num === qNum); if (r) saveRow(r)
  }
  const addKeyword = (qNum: number, kw: string) => {
    const v = kw.trim()
    if (!v) return
    patch(qNum, r => r.keywords.includes(v) ? r : { ...r, keywords: [...r.keywords, v] })
  }
  const removeKeyword = (qNum: number, kw: string) =>
    patch(qNum, r => ({ ...r, keywords: r.keywords.filter(k => k !== kw) }))

  const changeMemo = (qNum: number, memo: string) =>
    setRows(prev => prev.map(r => r.q_num === qNum ? { ...r, memo } : r))

  const blurMemo = (qNum: number) => {
    const r = rows.find(x => x.q_num === qNum)
    if (r) saveRow(r)
  }

  const handleSelectQ = useCallback(async (q: number) => {
    const next = selectedQ === q ? null : q
    setSelectedQ(next)
    const sid = await ensureSession()
    await supabase.from('denken12_sessions').update({ selected_q: next }).eq('id', sid)
  }, [selectedQ, ensureSession])

  const saveUrl = useCallback(async (which: 'question' | 'answer' | 'solution') => {
    setSaving(true)
    if (which === 'solution') {
      const url = solutionUrl.trim()
      setSolutionPreviewUrl(url ? toPreviewUrl(url) : null)
      const { error } = await supabase.from('denken12_sessions')
        .upsert({ exam_id: examId, subject, solution_url: url || null }, { onConflict: 'exam_id,subject' })
      if (error) alert(`내 풀이 링크를 저장하지 못했습니다.\n${error.message}`)
    } else if (which === 'question') {
      const url = urlInput.trim()
      setPreviewUrl(url ? toPreviewUrl(url) : null)
      await supabase.from('denken12_sessions')
        .upsert({ exam_id: examId, subject, drive_url: url || null }, { onConflict: 'exam_id,subject' })
    } else {
      const url = answerUrl.trim()
      setAnswerPreviewUrl(url ? toPreviewUrl(url) : null)
      const err = await saveExamAnswerUrl('denken12', examId, phaseOfSubject(subject), url)
      if (err) alert(`解答 링크를 저장하지 못했습니다.\n${err}`)
      else setSharedAnswer(!!url)
    }
    setSaving(false)
  }, [urlInput, answerUrl, solutionUrl, examId, subject])

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true; dragStartX.current = e.clientX; dragStartW.current = panelWidth; e.preventDefault()
  }, [panelWidth])

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return
      setPanelWidth(Math.min(Math.round(window.innerWidth * 0.7),
        Math.max(200, dragStartW.current - (e.clientX - dragStartX.current))))
    }
    const onUp = () => { isDragging.current = false }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── 집계 ──────────────────────────────────────────────────────────
  const ichijiAnswers: IchijiAnswer[] = useMemo(
    () => rows.map(r => ({ q_num: r.q_num, subCount: r.sub_count, subs: r.subs, memo: r.memo })),
    [rows],
  )
  const nijiAnswers: NijiAnswer[] = useMemo(
    () => rows.map(r => ({ q_num: r.q_num, selected: r.selected, score: r.score, memo: r.memo })),
    [rows],
  )

  const score    = niji ? scoreNiji(nst!, nijiAnswers) : scoreIchiji(ist!, ichijiAnswers, selectedQ)
  const fullMark = niji ? nst!.fullMark : ist!.fullMark
  const passMark = niji ? null : ist!.passMark
  const answered = niji ? nijiPickedCount(nijiAnswers) : gradedCount(ist!, ichijiAnswers, selectedQ)
  const answerable = niji ? nst!.pickCount : answerableCount(ist!, selectedQ)
  const passed = passMark !== null && score >= passMark

  const reviewTodo = rows.filter(r => r.review === 'todo')
  const active = rows.find(r => r.q_num === activeQ)!

  const overPicked = niji && nijiPickedCount(nijiAnswers) > nst!.pickCount

  return (
    <main className="min-h-screen bg-[#050d1a] text-white flex flex-col" style={{ height: '100dvh' }}>
      {/* 헤더 */}
      <div className="shrink-0 bg-[#0a1628] border-b border-white/5 px-3 py-2">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <Link href="/dashboard/denken12" className="text-gray-500 hover:text-white text-xs transition">
            ← 電験一種・二種
          </Link>
          <span className="text-xs px-1.5 py-0.5 rounded font-bold text-white" style={{ backgroundColor: gm.accent }}>
            {gm.label}
          </span>
          <span className="text-sm font-bold text-white">{examLabel(examId)}</span>
          <span className="text-[10px] text-gray-600">{parsed ? wareki(parsed.nendo) : ''}</span>
          <SubjectSwitch examId={examId} current={subject} />
          <span className="text-[10px] text-gray-600">{niji ? '二次 · 記述式' : '一次 · 마크시트'}</span>

          <div className="ml-auto flex items-center gap-3">
            <span className={`text-lg font-black tabular-nums ${
              passed ? 'text-emerald-400' : score > 0 ? 'text-white' : 'text-gray-600'
            }`}>
              {score}<span className="text-xs text-gray-600 font-normal"> / {fullMark}点</span>
            </span>
            <span className="text-xs text-gray-600">
              {niji ? `선택 ${answered}/${answerable}問` : `${answered}/${answerable}문`}
            </span>
            {passed && (
              <span className="text-[10px] bg-emerald-600/30 text-emerald-400 px-1.5 py-0.5 rounded-full font-bold">합격</span>
            )}
            {reviewTodo.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold border"
                style={{ color: REVIEW_META.todo.color, backgroundColor: REVIEW_META.todo.bg, borderColor: REVIEW_META.todo.border }}>
                🔖 {reviewTodo.length}
              </span>
            )}
          </div>
        </div>

        {/* 채점 셀 */}
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none items-start">
          {rows.map(r => niji
            ? <NijiCell key={r.q_num} row={r} perQ={nst!.perQ} isActive={activeQ === r.q_num}
                onSelect={() => toggleSelected(r.q_num)}
                onScore={v => setNijiScore(r.q_num, v)}
                onScoreCommit={() => commitNijiScore(r.q_num)}
                onReview={() => toggleReview(r.q_num)}
                onClick={() => setActiveQ(r.q_num)} />
            : <IchijiCell key={r.q_num} row={r} st={ist!} selectedQ={selectedQ} isActive={activeQ === r.q_num}
                onSub={i => toggleSub(r.q_num, i)}
                onSubCount={d => changeSubCount(r.q_num, d)}
                onReview={() => toggleReview(r.q_num)}
                onClick={() => setActiveQ(r.q_num)} />
          )}

          {/* 一次 선택문제 스위치 */}
          {!niji && ist!.selectPair && (
            <div className="flex flex-col justify-center ml-2 shrink-0 gap-1">
              <p className="text-[9px] text-gray-600">선택</p>
              {ist!.selectPair!.map(q => (
                <button key={q} onClick={() => handleSelectQ(q)}
                  className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${
                    selectedQ === q ? 'bg-yellow-500 text-black' : 'bg-[#1e3048] text-gray-500 hover:text-white'}`}>
                  {q}번
                </button>
              ))}
            </div>
          )}
        </div>

        {overPicked && (
          <p className="text-[10px] text-amber-400 mt-1">
            선택 문제가 {nst!.pickCount}問을 넘었다 — 점수가 높은 {nst!.pickCount}問만 합산된다.
          </p>
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
                {niji ? '解答例' : '解答'}
              </button>
              {niji && (
                <button onClick={() => setPdfTab('solution')}
                  className={`px-3 py-1 rounded-md text-xs font-bold transition ${pdfTab === 'solution' ? 'bg-amber-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                  title="내가 만든 풀이 PDF">내 풀이</button>
              )}
            </div>
            {pdfTab === 'solution' ? (<>
              <input value={solutionUrl} onChange={e => setSolutionUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveUrl('solution')}
                placeholder="내가 만든 풀이 PDF URL — 이 과목 전용"
                className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-amber-500/60 placeholder-gray-700 font-mono" />
              <button onClick={() => saveUrl('solution')} disabled={saving}
                className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-white">
                {saving ? '…' : '불러오기'}
              </button>
              {solutionPreviewUrl && (
                <span className="text-[10px] px-2 py-1 rounded bg-amber-900/60 text-amber-300 font-bold shrink-0">저장됨 ✓</span>
              )}
            </>) : pdfTab === 'question' ? (<>
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveUrl('question')}
                placeholder="문제지 PDF URL..."
                className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-blue-500/60 placeholder-gray-700 font-mono" />
              <button onClick={() => saveUrl('question')} disabled={saving}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: accent }}>
                {saving ? '…' : '불러오기'}
              </button>
              {previewUrl && (
                <span className="text-[10px] px-2 py-1 rounded bg-blue-900/60 text-blue-300 font-bold shrink-0">
                  저장됨 ✓
                </span>
              )}
              <PastPaperChip url={PAST_PAPER_URL[grade]} label="공식 과년도" />
            </>) : (<>
              <input value={answerUrl} onChange={e => setAnswerUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveUrl('answer')}
                placeholder={`${niji ? '二次' : '一次'} 解答 PDF URL — 이 회차 전 과목이 함께 씁니다`}
                className="flex-1 bg-[#0f1c2e] rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:ring-1 focus:ring-emerald-500/60 placeholder-gray-700 font-mono" />
              <button onClick={() => saveUrl('answer')} disabled={saving}
                className="bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 px-3 py-1.5 rounded-lg text-xs font-semibold text-white">
                {saving ? '…' : '불러오기'}
              </button>
              {sharedAnswer && (
                <span className="text-[10px] px-2 py-1 rounded bg-emerald-900/60 text-emerald-300 font-bold shrink-0"
                  title={`${niji ? '二次' : '一次'} 전 과목 공유`}>
                  회차 공유 ✓
                </span>
              )}
              <PastPaperChip url={PAST_PAPER_URL[grade]} label="공식 과년도" />
            </>)}
          </div>
          <div className="flex-1 relative">
            {previewUrl && (
              <iframe src={previewUrl} className="absolute inset-0 w-full h-full border-0" allow="autoplay"
                style={{ display: pdfTab === 'question' ? 'block' : 'none' }} />
            )}
            {answerPreviewUrl && (
              <iframe src={answerPreviewUrl} className="absolute inset-0 w-full h-full border-0" allow="autoplay"
                style={{ display: pdfTab === 'answer' ? 'block' : 'none' }} />
            )}
            {solutionPreviewUrl && (
              <iframe src={solutionPreviewUrl} className="absolute inset-0 w-full h-full border-0" allow="autoplay"
                style={{ display: pdfTab === 'solution' ? 'block' : 'none' }} />
            )}
            {pdfTab === 'solution' && !solutionPreviewUrl && (
              <EmptyPane icon="✍️" text="내가 만든 풀이 PDF URL을 입력하세요"
                hint="記述式은 標準解答만으로 부족하니 직접 만든 답안을 여기에" />
            )}
            {pdfTab === 'question' && !previewUrl && (
              <EmptyPane icon="📄" text="문제지 PDF URL을 입력하세요"
                hint="shiken.or.jp → 電気主任技術者 → 問題と解答" />
            )}
            {pdfTab === 'answer' && !answerPreviewUrl && (
              <EmptyPane icon="✅" text={`${niji ? '二次 標準解答' : '一次 解答'} PDF URL을 입력하세요`}
                hint={`한 번 넣으면 이 회차 ${niji ? '二次 2과목' : '一次 4과목'} 전부에서 열립니다`} />
            )}
          </div>
        </div>

        <div onMouseDown={handleDragStart}
          className="w-1 shrink-0 bg-white/5 hover:bg-blue-500/60 cursor-col-resize transition-colors" />

        {/* 오른쪽 패널 */}
        <div className="shrink-0 flex flex-col bg-[#080f1e] border-l border-white/5"
          style={{ width: panelWidth, minWidth: 200 }}>
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <span className="text-sm font-bold text-white">問{activeQ} 메모</span>
            <button onClick={() => toggleReview(activeQ)}
              className="px-2 py-0.5 rounded-md text-[10px] font-bold transition border"
              style={active?.review ? {
                color: REVIEW_META[active.review].color,
                backgroundColor: REVIEW_META[active.review].bg,
                borderColor: REVIEW_META[active.review].border,
              } : { color: '#4b5563', borderColor: 'rgba(255,255,255,0.08)' }}>
              {active?.review ? `${REVIEW_META[active.review].icon} ${REVIEW_META[active.review].short}` : '🔖 복습'}
            </button>
            <span className="ml-auto text-xs font-bold tabular-nums">
              {niji
                ? <span className={active.selected ? 'text-violet-300' : 'text-gray-600'}>
                    {active.selected ? `${active.score ?? 0} / ${nst!.perQ}点` : '미선택'}
                  </span>
                : <span className={
                    questionStatus(toIchiji(active)) === 'correct' ? 'text-emerald-400'
                    : questionStatus(toIchiji(active)) === 'wrong' ? 'text-red-400' : 'text-gray-600'}>
                    {round1(questionScore(ist!, toIchiji(active)))} / {pointOf(ist!, activeQ)}点
                  </span>}
            </span>
          </div>

          <div className="px-3 pt-3">
            <TopicBox
              key={`t-${activeQ}`}
              topic={active?.topic ?? ''}
              keywords={active?.keywords ?? []}
              onTopic={v => setTopic(activeQ, v)}
              onTopicBlur={() => commitTopic(activeQ)}
              onAdd={kw => addKeyword(activeQ, kw)}
              onRemove={kw => removeKeyword(activeQ, kw)}
            />
          </div>

          <div className="flex-1 p-3 flex flex-col min-h-0">
            <DenkenMemoEditor
              key={activeQ}
              content={active?.memo ?? ''}
              onChange={val => changeMemo(activeQ, val)}
              onBlur={() => blurMemo(activeQ)}
              placeholder={`問${activeQ} — 풀이 과정·논점·막힌 부분 · 수식(Σ)·이미지 삽입 가능`}
            />
          </div>

          {/* 복습 목록 */}
          <div className="border-t border-white/5 px-3 py-3 overflow-y-auto max-h-40">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">
              복습 대상 {reviewTodo.length > 0 && `(${reviewTodo.length})`}
            </p>
            {rows.filter(r => r.review !== null).length === 0
              ? <p className="text-[11px] text-gray-700">복습 표시한 문제 없음</p>
              : <div className="space-y-1.5">
                  {rows.filter(r => r.review !== null).map(r => (
                    <button key={r.q_num} onClick={() => setActiveQ(r.q_num)}
                      className={`w-full text-left flex items-start gap-2 rounded-lg px-2 py-1.5 transition ${
                        activeQ === r.q_num ? 'bg-blue-900/40' : 'hover:bg-[#0f1c2e]'}`}>
                      <span className="text-[10px] font-bold mt-0.5 shrink-0 text-gray-400">問{r.q_num}</span>
                      <span className="text-[11px] text-gray-400 truncate">
                        {stripHtml(r.memo) || <span className="text-gray-700">메모 없음</span>}
                      </span>
                      <span className="text-[9px] shrink-0 ml-auto" style={{ color: REVIEW_META[r.review!].color }}>
                        {REVIEW_META[r.review!].icon}
                      </span>
                    </button>
                  ))}
                </div>}
          </div>

          {/* 점수 요약 */}
          <div className="border-t border-white/5 px-4 py-3 bg-[#050d1a] shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[10px] text-gray-600 mb-0.5">{niji ? '자기채점' : '채점 결과'}</p>
                <p className={`text-2xl font-black tabular-nums ${
                  passed ? 'text-emerald-400' : score > 0 ? 'text-gray-300' : 'text-gray-600'}`}>
                  {score}<span className="text-sm font-normal text-gray-600 ml-1">/ {fullMark}</span>
                </p>
              </div>
              <div className="text-right">
                {niji ? (<>
                  <p className="text-[10px] text-gray-600 mb-0.5">二次 합격 기준</p>
                  <p className="text-sm text-gray-500">2과목 합산 {NIJI_PASS_MARK} / {NIJI_FULL_MARK}点</p>
                  <p className="text-[10px] text-gray-700">+ 각 과목 평균점 이상</p>
                </>) : (<>
                  <p className="text-[10px] text-gray-600 mb-0.5">합격 기준</p>
                  <p className="text-sm text-gray-500">{passMark}点 이상</p>
                  {passed && <p className="text-xs text-emerald-400 font-bold">✓ 합격</p>}
                </>)}
              </div>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (score / fullMark) * 100)}%`,
                  backgroundColor: passed ? '#10b981' : score > 0 ? '#eab308' : '#6b7280',
                }} />
            </div>
            {!niji && ist!.bSubVariable && (
              <p className="text-[10px] text-gray-700 mt-2">
                1종 B문제는 小問 수가 회차마다 다르다 — 셀의 ± 로 맞춰야 배점이 정확해진다.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  )
}

// ── 부품 ────────────────────────────────────────────────────────────
function toIchiji(r: Row): IchijiAnswer {
  return { q_num: r.q_num, subCount: r.sub_count, subs: r.subs, memo: r.memo }
}

function EmptyPane({ icon, text, hint }: { icon: string; text: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-700">
      <div className="text-5xl opacity-30">{icon}</div>
      <p className="text-sm">{text}</p>
      {hint && <p className="text-[11px] text-gray-800">{hint}</p>}
    </div>
  )
}

function ReviewBadge({ review, onClick, disabled }: {
  review: ReviewState; onClick: () => void; disabled?: boolean
}) {
  return (
    <button
      onClick={e => { e.stopPropagation(); if (!disabled) onClick() }}
      disabled={disabled}
      className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded text-[9px] leading-none transition"
      style={review ? { color: REVIEW_META[review].color, backgroundColor: REVIEW_META[review].bg } : {}}
      title={review ? REVIEW_META[review].label : '복습 표시 (필요 → 완료 → 해제)'}>
      {review === 'todo' ? '🔖' : review === 'done' ? '✓'
        : <span className="text-gray-700 hover:text-amber-500 transition">🔖</span>}
    </button>
  )
}

// 一次 — 大問 하나. 小問 버튼을 눌러 정오를 찍고, ± 로 小問 수를 회차에 맞춘다.
function IchijiCell({ row, st, selectedQ, isActive, onSub, onSubCount, onReview, onClick }: {
  row: Row
  st: ReturnType<typeof ichijiStructure>
  selectedQ: number | null
  isActive: boolean
  onSub: (i: number) => void
  onSubCount: (delta: number) => void
  onReview: () => void
  onClick: () => void
}) {
  const isB       = isBArea(st, row.q_num)
  const isPair    = isSelectQ(st, row.q_num)
  const excluded  = isDimmedSelect(st, row.q_num, selectedQ)
  const notCounted = isExcludedSelect(st, row.q_num, selectedQ)
  const canEditCount = isB && st.bSubVariable

  let bg = 'bg-[#0f1c2e]'
  if (row.review === 'todo') bg = 'bg-[#2a2411] ring-1 ring-amber-500/50'
  if (row.review === 'done') bg = 'bg-[#102a20]'
  if (isActive) bg = 'bg-[#1a2e47] ring-1 ring-blue-500/60'
  if (excluded) bg = 'bg-[#0a1220] opacity-40'

  return (
    <div className={`relative flex flex-col items-center rounded-xl pt-1.5 pb-1 px-1.5 cursor-pointer select-none shrink-0 ${bg}`}
      onClick={onClick}>
      <div className="flex items-center gap-0.5 mb-1">
        <span className={`text-[10px] font-bold ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>{row.q_num}</span>
        {isB && <span className="text-[8px] text-sky-500 font-bold">B</span>}
        {isPair && <span className="text-[8px] text-yellow-500 font-bold">選</span>}
        {row.memo && <span className="w-1 h-1 rounded-full bg-blue-400 ml-0.5" />}
      </div>
      <ReviewBadge review={row.review} onClick={onReview} disabled={notCounted} />

      <div className="flex gap-0.5">
        {row.subs.map((r, i) => (
          <button key={i}
            onClick={e => { e.stopPropagation(); onSub(i) }}
            className={`w-5 h-7 rounded flex items-center justify-center text-xs font-black transition ${
              r === 'correct' ? 'bg-emerald-600/80 text-white'
              : r === 'wrong' ? 'bg-red-700/80 text-white'
              : 'bg-[#1e3048] text-gray-600 hover:bg-[#253d5c]'}`}
            title={`(${i + 1}) ${r === 'correct' ? '정답' : r === 'wrong' ? '오답' : '미채점'}`}>
            {r === 'correct' ? '○' : r === 'wrong' ? '✕' : '·'}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-[8px] text-gray-600 tabular-nums">{pointOf(st, row.q_num)}点</span>
        {canEditCount && (
          <span className="flex items-center gap-0.5">
            <button onClick={e => { e.stopPropagation(); onSubCount(-1) }}
              disabled={row.sub_count <= SUB_COUNT_MIN}
              className="w-3.5 h-3.5 rounded bg-[#1e3048] text-gray-500 hover:text-white disabled:opacity-30 text-[9px] leading-none"
              title="小問 수 −1">−</button>
            <button onClick={e => { e.stopPropagation(); onSubCount(1) }}
              disabled={row.sub_count >= SUB_COUNT_MAX}
              className="w-3.5 h-3.5 rounded bg-[#1e3048] text-gray-500 hover:text-white disabled:opacity-30 text-[9px] leading-none"
              title="小問 수 +1">+</button>
          </span>
        )}
      </div>
    </div>
  )
}

// 二次 — 記述式. 골랐는지 여부 + 30점 만점 자기채점.
function NijiCell({ row, perQ, isActive, onSelect, onScore, onScoreCommit, onReview, onClick }: {
  row: Row
  perQ: number
  isActive: boolean
  onSelect: () => void
  onScore: (v: string) => void
  onScoreCommit: () => void
  onReview: () => void
  onClick: () => void
}) {
  let bg = 'bg-[#0f1c2e]'
  if (row.review === 'todo') bg = 'bg-[#2a2411] ring-1 ring-amber-500/50'
  if (row.review === 'done') bg = 'bg-[#102a20]'
  if (isActive) bg = 'bg-[#1a2e47] ring-1 ring-blue-500/60'
  if (!row.selected) bg += ' opacity-60'

  const ratio = row.score !== null ? row.score / perQ : 0

  return (
    <div className={`relative flex flex-col items-center rounded-xl pt-1.5 pb-1.5 px-2 cursor-pointer select-none shrink-0 ${bg}`}
      onClick={onClick} style={{ minWidth: 86 }}>
      <div className="flex items-center gap-1 mb-1">
        <span className={`text-[10px] font-bold ${isActive ? 'text-blue-400' : 'text-gray-500'}`}>問{row.q_num}</span>
        {row.memo && <span className="w-1 h-1 rounded-full bg-blue-400" />}
      </div>
      <ReviewBadge review={row.review} onClick={onReview} />

      <button onClick={e => { e.stopPropagation(); onSelect() }}
        className={`w-full px-2 py-0.5 rounded text-[9px] font-bold transition mb-1 ${
          row.selected ? 'bg-violet-600 text-white' : 'bg-[#1e3048] text-gray-500 hover:text-white'}`}
        title="이 문제를 골라 풀었는가">
        {row.selected ? '선택함' : '미선택'}
      </button>

      <div className="flex items-baseline gap-0.5">
        <input
          type="number" min={0} max={perQ} step={0.5}
          value={row.score ?? ''}
          disabled={!row.selected}
          onClick={e => e.stopPropagation()}
          onChange={e => onScore(e.target.value)}
          onBlur={onScoreCommit}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          placeholder="–"
          className="w-10 bg-[#1e3048] rounded px-1 py-0.5 text-center text-xs font-bold text-white outline-none focus:ring-1 focus:ring-violet-500/60 disabled:opacity-30 tabular-nums" />
        <span className="text-[9px] text-gray-600">/{perQ}</span>
      </div>

      <div className="w-full bg-[#1e3048] rounded-full h-1 mt-1 overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, ratio * 100)}%`,
            backgroundColor: ratio >= 0.6 ? '#10b981' : ratio > 0 ? '#a78bfa' : 'transparent',
          }} />
      </div>
    </div>
  )
}
