'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { scoreDenken, examLabelFromId, denkenHeldKey, DENKEN_EXAMS, type Result } from '@/lib/constants-denken'
import { KIKAI_TAG_MAP, type KikaiTag } from '@/lib/constants-denken-kikai'
import {
  REVIEW_META, reviewHeatStyle, EMPTY_REVIEW_COUNT, addReview,
  type ReviewState, type ReviewCount,
} from '@/lib/constants-denken-review'
import {
  DENKEN_RATE_BASELINE, DENKEN_RATE_MAP, TIER_META,
  RATIO_THRESHOLD, OVERALL_THRESHOLD,
  overallTier, subjectTier, ratioOf, isAdjusted, isAdjustSignal, mergeRate, computeMedians,
  type ExamRate, type RateOverrideRow, type SubjectMedians,
} from '@/lib/constants-denken-rate'

// ── 과거문 메타데이터 (20개년) ───────────────────────────────────
const SUBJECTS = ['理論', '電力', '機械', '法規'] as const
type Subject = typeof SUBJECTS[number]

type DenkenExam = {
  id: string
  year: number
  label: string
}

// 목록은 lib/constants-denken 의 DENKEN_EXAMS 단일 소스에서 그대로 파생한다.
// (여기서 따로 만들면 상세 화면의 목록과 어긋나 "눌러 들어가면 없다"가 된다)
const PAST_EXAMS: DenkenExam[] = DENKEN_EXAMS.map(e => ({
  id: e.id, year: e.year, label: examLabelFromId(e.id),
}))

// 실시일(시행월) 기준 내림차순: 2026.3 → 2025.8 → 2025.3 → 2024.8 → 2024.3 → …
const SORTED_EXAMS = [...PAST_EXAMS].sort((a, b) => denkenHeldKey(b.id) - denkenHeldKey(a.id))

function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const match = url.match(/\/file\/d\/([^/]+)/)
  if (match) return `https://drive.google.com/file/d/${match[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  return null
}

// ── 타입 ────────────────────────────────────────────────────────
type DenkenSession = {
  exam_id: string
  subject: Subject
  my_score: number | null
  memo: string | null
  drive_url: string | null
  updated_at: string
}

type ReviewRow = {
  examId: string
  subject: Subject
  qNum: number
  review: ReviewState
  tagId: number | null
  memo: string
}

type KikaiSummary = {
  exam_id: string
  score: number
  tagCount: number
  hasDriveUrl: boolean
  memoCount: number
}

const SUBJECT_COLORS: Record<Subject, string> = {
  '理論': '#2563eb',
  '電力': '#059669',
  '機械': '#7c3aed',
  '法規': '#b45309',
}

const scoreColor = (s: number | null) => {
  if (s === null) return 'text-gray-600'
  if (s >= 60) return 'text-green-400'
  if (s >= 40) return 'text-yellow-400'
  return 'text-red-400'
}

// ── 난이도 표시 ──────────────────────────────────────────────────
// 회차 전체 합격률: 절대 기준 (10% 이하 빨강 / 15% 이하 노랑)
// 과목별 합격률: 그 과목의 중앙값 대비 배율 (0.75배 이하 빨강 / 1.15배 초과 초록)
//                단, 합격기준점이 인하된 회차는 무조건 빨강
const pillClass = (size: 'sm' | 'md') =>
  `inline-flex items-center gap-1 rounded-md font-bold tabular-nums border whitespace-nowrap ${
    size === 'md' ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]'
  }`

function OverallPill({ rate, size = 'sm' }: { rate: number | null; size?: 'sm' | 'md' }) {
  const t = TIER_META[overallTier(rate)]
  return (
    <span
      className={pillClass(size)}
      style={{ color: t.color, backgroundColor: t.bg, borderColor: t.border }}
      title={rate === null ? '전체 합격률 미발표 · 직접 입력' : `전체 합격률 ${rate}%`}
    >
      {rate === null ? '—' : `${rate}%`}
    </span>
  )
}

function SubjectPill({ rate, pass, median, nendo, size = 'sm' }: {
  rate: number | null
  pass: number | null
  median: number | null
  nendo?: string
  size?: 'sm' | 'md'
}) {
  const t = TIER_META[subjectTier(rate, pass, median, nendo)]
  const adjusted = isAdjusted(pass)
  const signal = isAdjustSignal(pass, nendo)
  const ratio = ratioOf(rate, median)
  const title = rate === null
    ? '합격률 미발표 · 직접 입력'
    : [
        `합격률 ${rate}%`,
        ratio !== null ? `중앙값 ${median}% 대비 ${ratio}배` : null,
        adjusted ? `합격기준 ${pass}점으로 인하${signal ? ' → 난회차 확정' : ' (당시엔 상시 조정)'}` : null,
      ].filter(Boolean).join(' · ')
  return (
    <span
      className={pillClass(size)}
      style={{ color: t.color, backgroundColor: t.bg, borderColor: t.border }}
      title={title}
    >
      {rate === null ? '—' : `${rate}%`}
      {adjusted && (
        <span className={signal ? 'font-normal opacity-80' : 'font-normal text-gray-500'}>{pass}点</span>
      )}
    </span>
  )
}

function RateLegend({ medians }: { medians?: SubjectMedians }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-gray-500">
        <span className="text-gray-600">과목별</span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: TIER_META.hard.color }} />
          중앙값 ×{RATIO_THRESHOLD.hard} 이하
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: TIER_META.mid.color }} />
          ×{RATIO_THRESHOLD.hard}~{RATIO_THRESHOLD.mid}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: TIER_META.easy.color }} />
          ×{RATIO_THRESHOLD.mid} 초과
        </span>
        <span className="text-gray-700">·</span>
        <span>2020年度 이후 기준점 인하(<span className="text-gray-400">55点</span>)는 난회차 확정</span>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-[10px] text-gray-500">
        <span className="text-gray-600">전체</span>
        <span>절대 기준 ≤{OVERALL_THRESHOLD.hard}% / ≤{OVERALL_THRESHOLD.mid}% / 초과</span>
        {medians && (
          <>
            <span className="text-gray-700">·</span>
            <span className="text-gray-600">
              중앙값 {SUBJECTS.map(x => `${x} ${medians[x] ?? '—'}%`).join(' · ')}
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ── PDF 뷰어 모달 ────────────────────────────────────────────────
function PdfModal({
  examLabel,
  subject,
  driveUrl,
  onClose,
  onSaveUrl,
}: {
  examLabel: string
  subject: Subject
  driveUrl: string | null
  onClose: () => void
  onSaveUrl: (url: string) => Promise<void>
}) {
  const [inputUrl, setInputUrl] = useState(driveUrl || '')
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    driveUrl ? toPreviewUrl(driveUrl) : null
  )
  const [saving, setSaving] = useState(false)

  const handleLoad = async () => {
    const raw = inputUrl.trim()
    const url = toPreviewUrl(raw)
    setPreviewUrl(url)
    if (raw) {
      setSaving(true)
      await onSaveUrl(raw)
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
        <button onClick={onClose} className="text-gray-400 hover:text-white text-sm">← 닫기</button>
        <span className="font-bold text-sm">{examLabel}</span>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
          style={{ backgroundColor: SUBJECT_COLORS[subject] }}
        >
          {subject}
        </span>
        <div className="flex gap-2 ml-auto items-center">
          <input
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            placeholder="구글 드라이브 URL 붙여넣기"
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-xs text-white w-64 outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
          />
          <button
            onClick={handleLoad}
            disabled={!inputUrl.trim() || saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 px-3 py-1.5 rounded-lg text-xs font-semibold transition"
          >
            {saving ? '저장 중…' : '불러오기'}
          </button>
        </div>
      </div>
      {/* PDF 뷰어 */}
      <div className="flex-1 bg-gray-950">
        {previewUrl ? (
          <iframe
            src={previewUrl}
            className="w-full h-full border-0"
            allow="autoplay"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-600">
            <p className="text-4xl">📄</p>
            <p className="text-sm">구글 드라이브 URL을 입력하고 불러오기를 누르세요.</p>
            <p className="text-xs text-gray-700">공유 링크 형식: drive.google.com/file/d/…</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 메인 ────────────────────────────────────────────────────────
export default function DenkenHub() {
  const router = useRouter()
  const [activeTab, setActiveTab]   = useState<'scores' | 'analysis' | 'rates' | 'review'>('scores')
  const [rateOverrides, setRateOverrides] = useState<RateOverrideRow[]>([])
  const [ratesTableMissing, setRatesTableMissing] = useState(false)
  const [rateEditId, setRateEditId] = useState<string | null>(null)
  const [rateForm, setRateForm]     = useState<Record<string, string>>({})
  const [rateSaving, setRateSaving] = useState(false)
  const [sessions, setSessions]     = useState<DenkenSession[]>([])
  const [loading, setLoading]       = useState(true)
  const [editKey, setEditKey]       = useState<string | null>(null)
  const [editScore, setEditScore]   = useState('')
  const [editMemo, setEditMemo]     = useState('')
  const [editDriveUrl, setEditDriveUrl] = useState('')
  const [saving, setSaving]         = useState(false)
  const [filterSubject, setFilterSubject] = useState<Subject | null>(null)
  const [pdfModal, setPdfModal]     = useState<{ examId: string; subject: Subject } | null>(null)
  const [kikaiMap, setKikaiMap]     = useState<Map<string, KikaiSummary>>(new Map())
  const [generalMap, setGeneralMap] = useState<Map<string, boolean>>(new Map())  // key: examId__subject, value: hasPdf
  // 복습 태깅 집계: key = examId__subject
  const [reviewMap, setReviewMap] = useState<Map<string, ReviewCount>>(new Map())
  const [reviewRows, setReviewRows] = useState<ReviewRow[]>([])
  const [reviewTableMissing, setReviewTableMissing] = useState(false)
  const [reviewOnlyTodo, setReviewOnlyTodo] = useState(true)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('denken_sessions')
      .select('exam_id, subject, my_score, memo, drive_url, updated_at')
    setSessions((data || []) as DenkenSession[])
    setLoading(false)
  }, [])

  const fetchKikai = useCallback(async () => {
    const [{ data: sessions }, { data: answers }] = await Promise.all([
      supabase.from('denken_kikai_sessions').select('exam_id, drive_url, selected_q'),
      supabase.from('denken_kikai_answers').select('exam_id, result, result_a, result_b, tag_id, memo, q_num'),
    ])
    const map = new Map<string, KikaiSummary>()
    for (const s of (sessions || [])) {
      const ans = (answers || []).filter((a: {exam_id:string,q_num:number}) => a.exam_id === s.exam_id)
      // 점수 계산 (A문제 5점, B문제 (a)(b) 각 5점, 선택문제 반영) — 공용 로직 사용
      const selectedQ = s.selected_q as number | null
      const score = scoreDenken('機械', (ans as {q_num:number;result:Result;result_a:Result;result_b:Result}[]).map(a => ({
        q_num: a.q_num, result: a.result, result_a: a.result_a, result_b: a.result_b,
      })), selectedQ)
      map.set(s.exam_id, {
        exam_id: s.exam_id,
        score,
        tagCount: ans.filter((a: {tag_id:number|null}) => a.tag_id !== null).length,
        hasDriveUrl: !!s.drive_url,
        memoCount: ans.filter((a: {memo:string|null}) => a.memo).length,
      })
    }
    setKikaiMap(map)
  }, [])

  const fetchGeneral = useCallback(async () => {
    const { data } = await supabase
      .from('denken_general_sessions')
      .select('exam_id, subject, drive_url')
    const map = new Map<string, boolean>()
    for (const s of (data || [])) {
      map.set(`${s.exam_id}__${s.subject}`, !!s.drive_url)
    }
    setGeneralMap(map)
  }, [])

  // 복습 태깅 (機械 전용 테이블 + 나머지 3과목 공용 테이블을 하나로 합친다)
  const fetchReview = useCallback(async () => {
    const [k, g] = await Promise.all([
      supabase.from('denken_kikai_answers').select('exam_id, q_num, review, tag_id, memo').not('review', 'is', null),
      supabase.from('denken_general_answers').select('exam_id, subject, q_num, review, memo').not('review', 'is', null),
    ])
    if (k.error || g.error) { setReviewTableMissing(true); return }
    setReviewTableMissing(false)

    const rows: ReviewRow[] = [
      ...((k.data || []) as { exam_id: string; q_num: number; review: string; tag_id: number | null; memo: string | null }[])
        .map(r => ({
          examId: r.exam_id, subject: '機械' as Subject, qNum: r.q_num,
          review: r.review as ReviewState, tagId: r.tag_id, memo: r.memo ?? '',
        })),
      ...((g.data || []) as { exam_id: string; subject: string; q_num: number; review: string; memo: string | null }[])
        .map(r => ({
          examId: r.exam_id, subject: r.subject as Subject, qNum: r.q_num,
          review: r.review as ReviewState, tagId: null, memo: r.memo ?? '',
        })),
    ]
    setReviewRows(rows)

    const map = new Map<string, ReviewCount>()
    for (const r of rows) {
      const key = `${r.examId}__${r.subject}`
      map.set(key, addReview(map.get(key) ?? EMPTY_REVIEW_COUNT, r.review))
    }
    setReviewMap(map)
  }, [])

  // 난이도 덮어쓰기 값 (테이블이 아직 없어도 기본표로 동작하도록 실패 허용)
  const fetchRates = useCallback(async () => {
    const { data, error } = await supabase
      .from('denken_exam_rates')
      .select('exam_id, overall_rate, applicants, rate_riron, rate_denryoku, rate_kikai, rate_hoki, pass_riron, pass_denryoku, pass_kikai, pass_hoki, note')
    if (error) { setRatesTableMissing(true); return }
    setRatesTableMissing(false)
    setRateOverrides((data || []) as RateOverrideRow[])
  }, [])

  useEffect(() => { fetchSessions(); fetchKikai(); fetchGeneral(); fetchRates(); fetchReview() },
    [fetchSessions, fetchKikai, fetchGeneral, fetchRates, fetchReview])

  const sessionMap = useMemo(() => {
    const map = new Map<string, DenkenSession>()
    sessions.forEach(s => map.set(`${s.exam_id}__${s.subject}`, s))
    return map
  }, [sessions])

  const getSession = (examId: string, subject: Subject) =>
    sessionMap.get(`${examId}__${subject}`) ?? null

  const startEdit = (examId: string, subject: Subject) => {
    const key = `${examId}__${subject}`
    const s   = sessionMap.get(key)
    if (editKey === key) { setEditKey(null); return }
    setEditKey(key)
    setEditScore(s?.my_score?.toString() || '')
    setEditMemo(s?.memo || '')
    setEditDriveUrl(s?.drive_url || '')
  }

  const handleSave = async () => {
    if (!editKey) return
    setSaving(true)
    const [examId, subject] = editKey.split('__') as [string, Subject]
    await supabase.from('denken_sessions').upsert({
      exam_id: examId,
      subject,
      my_score: editScore ? parseFloat(editScore) : null,
      memo: editMemo.trim() || null,
      drive_url: editDriveUrl.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'exam_id,subject' })
    await fetchSessions()
    setEditKey(null)
    setSaving(false)
  }

  // PDF 모달에서 URL 저장 (機械 제외 과목용)
  const handleSaveUrl = useCallback(async (examId: string, subject: Subject, url: string) => {
    await supabase.from('denken_sessions').upsert({
      exam_id: examId,
      subject,
      drive_url: url || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'exam_id,subject' })
    await fetchSessions()
  }, [fetchSessions])

  // 통계
  const totalAttempts  = sessions.filter(s => s.my_score !== null).length
  const passedAttempts = sessions.filter(s => (s.my_score ?? 0) >= 60).length

  const subjectStats = useMemo(() => SUBJECTS.map(sub => {
    const subs   = sessions.filter(s => s.subject === sub && s.my_score !== null)
    const avg    = subs.length === 0 ? null : Math.round(subs.reduce((a, s) => a + (s.my_score ?? 0), 0) / subs.length)
    const best   = subs.length === 0 ? null : Math.max(...subs.map(s => s.my_score ?? 0))
    const passed = subs.filter(s => (s.my_score ?? 0) >= 60).length
    return { sub, count: subs.length, avg, best, passed }
  }), [sessions])

  // ── 회차 난이도 ────────────────────────────────────────────────
  const overrideMap = useMemo(
    () => new Map(rateOverrides.map(o => [o.exam_id, o])),
    [rateOverrides],
  )

  // 기본표 + 덮어쓰기 병합. 기본표에 없는 회차(직접 추가분)도 함께 노출.
  const rateList: ExamRate[] = useMemo(() => {
    const ids = new Set<string>([
      ...DENKEN_RATE_BASELINE.map(e => e.examId),
      ...rateOverrides.map(o => o.exam_id),
    ])
    return [...ids]
      .map(id => mergeRate(DENKEN_RATE_MAP.get(id), overrideMap.get(id), id))
      .sort((a, b) => denkenHeldKey(b.examId) - denkenHeldKey(a.examId))
  }, [rateOverrides, overrideMap])

  const rateMap = useMemo(
    () => new Map(rateList.map(e => [e.examId, e])),
    [rateList],
  )

  // 난이도 판정 기준선 = 과목별 합격률 중앙값 (표를 고치면 기준선도 따라 움직인다)
  const medians = useMemo(() => computeMedians(rateList), [rateList])

  // ── 복습 집계 ──────────────────────────────────────────────────
  const reviewTotals = useMemo(() => {
    let todo = 0, done = 0
    for (const c of reviewMap.values()) { todo += c.todo; done += c.done }
    return { todo, done }
  }, [reviewMap])

  // 대기 문항이 하나라도 있는 회차만 (많은 순)
  const reviewExams = useMemo(() => {
    return SORTED_EXAMS
      .map(e => {
        const per = SUBJECTS.map(sub => ({
          sub, count: reviewMap.get(`${e.id}__${sub}`) ?? EMPTY_REVIEW_COUNT,
        }))
        const todo = per.reduce((n, x) => n + x.count.todo, 0)
        const done = per.reduce((n, x) => n + x.count.done, 0)
        return { exam: e, per, todo, done }
      })
      .filter(r => (reviewOnlyTodo ? r.todo > 0 : r.todo + r.done > 0))
  }, [reviewMap, reviewOnlyTodo])

  // 機械 단원별 복습 대기 (어느 단원이 약한지)
  const reviewByTag = useMemo(() => {
    const m = new Map<number, number>()
    for (const r of reviewRows) {
      if (r.review !== 'todo' || r.tagId === null) continue
      m.set(r.tagId, (m.get(r.tagId) ?? 0) + 1)
    }
    return [...m.entries()]
      .map(([id, n]) => ({ tag: KIKAI_TAG_MAP.get(id), n }))
      .filter((x): x is { tag: KikaiTag; n: number } => !!x.tag)
      .sort((a, b) => b.n - a.n)
  }, [reviewRows])

  const startRateEdit = (e: ExamRate) => {
    if (rateEditId === e.examId) { setRateEditId(null); return }
    const ov = overrideMap.get(e.examId)
    const v = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))
    setRateEditId(e.examId)
    setRateForm({
      overall_rate:  v(e.overall),
      applicants:    v(e.applicants),
      rate_riron:    v(e.subjects['理論'].rate),
      rate_denryoku: v(e.subjects['電力'].rate),
      rate_kikai:    v(e.subjects['機械'].rate),
      rate_hoki:     v(e.subjects['法規'].rate),
      pass_riron:    v(e.subjects['理論'].pass),
      pass_denryoku: v(e.subjects['電力'].pass),
      pass_kikai:    v(e.subjects['機械'].pass),
      pass_hoki:     v(e.subjects['法規'].pass),
      note:          ov?.note ?? '',
    })
  }

  const handleRateSave = async () => {
    if (!rateEditId) return
    setRateSaving(true)
    const num = (k: string) => {
      const raw = (rateForm[k] ?? '').trim()
      if (raw === '') return null
      const n = parseFloat(raw)
      return Number.isFinite(n) ? n : null
    }
    await supabase.from('denken_exam_rates').upsert({
      exam_id: rateEditId,
      overall_rate:  num('overall_rate'),
      applicants:    num('applicants'),
      rate_riron:    num('rate_riron'),
      rate_denryoku: num('rate_denryoku'),
      rate_kikai:    num('rate_kikai'),
      rate_hoki:     num('rate_hoki'),
      pass_riron:    num('pass_riron'),
      pass_denryoku: num('pass_denryoku'),
      pass_kikai:    num('pass_kikai'),
      pass_hoki:     num('pass_hoki'),
      note: (rateForm.note ?? '').trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'exam_id' })
    await fetchRates()
    setRateEditId(null)
    setRateSaving(false)
  }

  // 덮어쓴 값을 지우고 기본표 값으로 되돌린다
  const handleRateReset = async (examId: string) => {
    setRateSaving(true)
    await supabase.from('denken_exam_rates').delete().eq('exam_id', examId)
    await fetchRates()
    setRateEditId(null)
    setRateSaving(false)
  }

  // PDF 모달용 데이터
  const pdfExam = pdfModal ? PAST_EXAMS.find(e => e.id === pdfModal.examId) : null
  const pdfSession = pdfModal ? getSession(pdfModal.examId, pdfModal.subject) : null

  return (
    <>
      {/* PDF 뷰어 모달 */}
      {pdfModal && pdfExam && (
        <PdfModal
          examLabel={pdfExam.label}
          subject={pdfModal.subject}
          driveUrl={pdfSession?.drive_url ?? null}
          onClose={() => setPdfModal(null)}
          onSaveUrl={(url) => handleSaveUrl(pdfModal.examId, pdfModal.subject, url)}
        />
      )}

      <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
        <div className="max-w-3xl mx-auto">

          {/* 헤더 */}
          <div className="mb-2">
            <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
          </div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🏭</span>
            <h1 className="text-2xl font-bold">電験三種</h1>
            <span className="text-xs bg-yellow-600/30 text-yellow-400 px-2 py-0.5 rounded-full">준비 중</span>
          </div>
          <p className="text-gray-500 text-sm mb-5">
            일본 경제산업성 · CBT 전 과목 등록 완료 · 理論 · 電力 · 機械 · 法規
          </p>

          {/* N제 교재 진입 배너 */}
          <Link href="/dashboard/textbook"
            className="flex items-center gap-3 bg-violet-900/20 hover:bg-violet-900/35 border border-violet-500/20 rounded-2xl px-4 py-3 mb-5 transition group">
            <span className="text-xl">📚</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-violet-300">N제 교재</p>
              <p className="text-[11px] text-gray-500">기출과 별개 · 교재 문제별 상태 · 핵심 토픽 · 정리 노트</p>
            </div>
            <span className="text-violet-500 text-sm group-hover:translate-x-0.5 transition">→</span>
          </Link>

          {/* 플래시카드 진입 배너 */}
          <Link href="/flashcard?exam=denken"
            className="flex items-center gap-3 bg-blue-900/20 hover:bg-blue-900/35 border border-blue-500/20 rounded-2xl px-4 py-3 mb-5 transition group">
            <span className="text-xl">🃏</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-blue-300">플래시카드</p>
              <p className="text-[11px] text-gray-500">理論·電力·機械·法規 개념 인출 훈련 · 1회독 대신 능동 복습</p>
            </div>
            <span className="text-blue-500 text-sm group-hover:translate-x-0.5 transition">→</span>
          </Link>

          {/* 탭 */}
          <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6">
            {([
              { key: 'scores',   label: '📋 기출 풀이 현황' },
              { key: 'analysis', label: '📊 과목별 분석' },
              { key: 'rates',    label: '📉 회차 난이도' },
              { key: 'review',   label: '🔖 복습' },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex-1 px-1 py-2 rounded-lg text-[11px] md:text-sm font-medium transition whitespace-nowrap ${
                  activeTab === key ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* ── 기출 풀이 현황 탭 ── */}
          {activeTab === 'scores' && (
            <div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-gray-900 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">풀이 완료 (과목)</p>
                  <p className="text-2xl font-bold">
                    {totalAttempts}
                    <span className="text-sm text-gray-500 ml-1">/ {PAST_EXAMS.length * 4}</span>
                  </p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">합격 과목</p>
                  <p className={`text-2xl font-bold ${passedAttempts > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                    {passedAttempts}
                  </p>
                </div>
                <div className="bg-gray-900 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 mb-1">총 회차</p>
                  <p className="text-2xl font-bold text-blue-400">{PAST_EXAMS.length}</p>
                </div>
              </div>

              {/* 과목 필터 */}
              <div className="flex gap-1.5 flex-wrap mb-4">
                <button
                  onClick={() => setFilterSubject(null)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    filterSubject === null ? 'bg-gray-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  전 과목
                </button>
                {SUBJECTS.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setFilterSubject(filterSubject === sub ? null : sub)}
                    style={filterSubject === sub ? { backgroundColor: SUBJECT_COLORS[sub] } : undefined}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                      filterSubject === sub ? 'text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>

              {/* 난이도 범례 */}
              <div className="mb-4">
                <RateLegend medians={medians} />
              </div>

              {/* 기출 목록 */}
              {loading ? (
                <p className="text-gray-500 text-sm">불러오는 중...</p>
              ) : (
                <div className="space-y-2">
                  {SORTED_EXAMS.map(exam => (
                      <div key={exam.id} className="bg-gray-900 rounded-xl overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                          <p className="text-sm font-semibold text-gray-300">{exam.label}</p>
                          {(() => {
                            const r = rateMap.get(exam.id)
                            if (!r) return null
                            return (
                              <>
                                <span className="text-[10px] text-gray-600">{r.nendo}</span>
                                <span className="ml-auto flex items-center gap-1.5">
                                  <span className="text-[10px] text-gray-600">전체</span>
                                  <OverallPill rate={r.overall} />
                                </span>
                              </>
                            )
                          })()}
                        </div>
                        <div className={`grid gap-px bg-gray-800 ${
                          filterSubject ? 'grid-cols-1' : 'grid-cols-2 md:grid-cols-4'
                        }`}>
                          {(filterSubject ? [filterSubject] : SUBJECTS).map(sub => {
                            const s      = getSession(exam.id, sub)
                            const key    = `${exam.id}__${sub}`
                            const isEdit = editKey === key
                            const hasPdf = sub === '機械'
                              ? !!kikaiMap.get(exam.id)?.hasDriveUrl
                              : (generalMap.get(`${exam.id}__${sub}`) ?? !!s?.drive_url)

                            return (
                              <div key={sub} className="bg-gray-950">
                                {/* 과목 셀 */}
                                <div className="flex items-center gap-1 p-3">
                                  <button
                                    onClick={() => startEdit(exam.id, sub)}
                                    className="flex-1 text-left hover:bg-gray-900 rounded-lg p-1 transition"
                                  >
                                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: SUBJECT_COLORS[sub] }}
                                      />
                                      <span className="text-xs text-gray-500">{sub}</span>
                                      {(() => {
                                        const rc = reviewMap.get(`${exam.id}__${sub}`)
                                        if (!rc || rc.todo === 0) return null
                                        return (
                                          <span className="text-[9px] font-bold px-1 rounded shrink-0"
                                            style={{ color: REVIEW_META.todo.color, backgroundColor: REVIEW_META.todo.bg }}
                                            title={`복습 대기 ${rc.todo}문`}>
                                            🔖{rc.todo}
                                          </span>
                                        )
                                      })()}
                                      {(() => {
                                        const er = rateMap.get(exam.id)
                                        if (!er) return null
                                        const sr = er.subjects[sub]
                                        return (
                                          <span className="ml-auto shrink-0">
                                            <SubjectPill
                                              rate={sr.rate} pass={sr.pass}
                                              median={medians[sub]} nendo={er.nendo}
                                            />
                                          </span>
                                        )
                                      })()}
                                    </div>
                                    <p className={`text-lg font-bold tabular-nums ${scoreColor(s?.my_score ?? null)}`}>
                                      {s?.my_score != null ? `${s.my_score}点` : '—'}
                                    </p>
                                    {s?.memo && (
                                      <p className="text-[10px] text-blue-500 mt-0.5 truncate">메모 있음</p>
                                    )}
                                  </button>
                                  {/* PDF 버튼: 機械는 전용 풀이 UI, 나머지는 모달 */}
                                  {sub === '機械' ? (() => {
                                    const ki = kikaiMap.get(exam.id)
                                    return (
                                      <button
                                        onClick={() => router.push(`/dashboard/denken/kikai/${exam.id}`)}
                                        className="flex flex-col items-end gap-0.5 shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold transition bg-violet-900/20 hover:bg-violet-900/40 text-violet-400"
                                        title="機械 풀이 UI로 이동"
                                      >
                                        <span>풀기 →</span>
                                        {ki && ki.score > 0 && (
                                          <span className={ki.score >= 60 ? 'text-emerald-400' : 'text-yellow-400'}>{ki.score}점</span>
                                        )}
                                        {ki && ki.tagCount > 0 && (
                                          <span className="text-violet-500 font-normal">{ki.tagCount}태그</span>
                                        )}
                                        {ki?.hasDriveUrl && (
                                          <span className="text-gray-600 font-normal">PDF✓</span>
                                        )}
                                      </button>
                                    )
                                  })() : (
                                    <button
                                      onClick={() => router.push(`/dashboard/denken/${encodeURIComponent(sub)}/${exam.id}`)}
                                      className={`flex flex-col items-end gap-0.5 shrink-0 px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                                        hasPdf
                                          ? 'bg-blue-900/20 hover:bg-blue-900/40 text-blue-400'
                                          : 'bg-gray-800 text-gray-600 hover:bg-gray-700 hover:text-gray-400'
                                      }`}
                                      title="풀이 UI로 이동"
                                    >
                                      <span>풀기 →</span>
                                      {hasPdf && <span className="text-gray-600 font-normal">PDF✓</span>}
                                    </button>
                                  )}
                                </div>

                                {/* 인라인 편집 패널 */}
                                {isEdit && (
                                  <div className="border-t border-gray-800 p-3 bg-gray-900 space-y-2">
                                    <input
                                      type="number" min="0" max="100"
                                      value={editScore}
                                      onChange={e => setEditScore(e.target.value)}
                                      placeholder="점수 (0~100)"
                                      className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-sm outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <textarea
                                      rows={2}
                                      value={editMemo}
                                      onChange={e => setEditMemo(e.target.value)}
                                      placeholder="오답 메모..."
                                      className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                                    />
                                    <input
                                      type="text"
                                      value={editDriveUrl}
                                      onChange={e => setEditDriveUrl(e.target.value)}
                                      placeholder="구글 드라이브 URL (선택)"
                                      className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={handleSave} disabled={saving}
                                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-1 rounded-lg text-xs font-semibold transition"
                                      >
                                        {saving ? '…' : '저장'}
                                      </button>
                                      <button
                                        onClick={() => setEditKey(null)}
                                        className="flex-1 bg-gray-700 hover:bg-gray-600 py-1 rounded-lg text-xs transition"
                                      >
                                        닫기
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── 과목별 분석 탭 ── */}
          {activeTab === 'analysis' && (
            <div className="space-y-3">
              {subjectStats.map(({ sub, count, avg, best, passed }) => (
                <div key={sub} className="bg-gray-900 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: SUBJECT_COLORS[sub] }} />
                    <h3 className="font-bold">{sub}</h3>
                    <span className="text-xs text-gray-600 ml-auto">{count}회 풀이</span>
                  </div>
                  {count === 0 ? (
                    <p className="text-xs text-gray-700">아직 풀이 기록이 없어요.</p>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-3">
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">평균</p>
                          <p className={`text-xl font-bold ${scoreColor(avg)}`}>{avg}点</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">최고</p>
                          <p className={`text-xl font-bold ${scoreColor(best)}`}>{best}点</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-gray-500 mb-1">합격 횟수</p>
                          <p className={`text-xl font-bold ${passed > 0 ? 'text-green-400' : 'text-gray-600'}`}>{passed}</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${avg}%`,
                            backgroundColor: (avg ?? 0) >= 60 ? '#22c55e' : (avg ?? 0) >= 40 ? '#eab308' : '#ef4444',
                          }}
                        />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-gray-700">0</span>
                        <span className="text-[10px] text-gray-600">합격 60点</span>
                        <span className="text-[10px] text-gray-700">100</span>
                      </div>
                    </>
                  )}
                  {sessions.filter(s => s.subject === sub && s.memo).length > 0 && (
                    <div className="mt-3 border-t border-gray-800 pt-3 space-y-1.5">
                      <p className="text-[10px] text-gray-600 uppercase tracking-widest">오답 메모</p>
                      {sessions
                        .filter(s => s.subject === sub && s.memo)
                        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
                        .map(s => {
                          const exam = PAST_EXAMS.find(e => e.id === s.exam_id)
                          return (
                            <div key={s.exam_id} className="flex gap-2">
                              <span className="text-[10px] text-gray-700 shrink-0 w-14">{exam?.label.replace('年', '')}</span>
                              <p className="text-xs text-gray-400 leading-relaxed">{s.memo}</p>
                            </div>
                          )
                        })
                      }
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── 회차 난이도 탭 ── */}
          {activeTab === 'rates' && (
            <div>
              {/* 과목별 중앙값 = 판정 기준선 */}
              <div className="grid grid-cols-4 gap-2 mb-4">
                {SUBJECTS.map(sub => (
                  <div key={sub} className="bg-gray-900 rounded-xl p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: SUBJECT_COLORS[sub] }} />
                      <span className="text-[10px] text-gray-500">{sub}</span>
                    </div>
                    <p className="text-lg font-bold tabular-nums text-gray-200">
                      {medians[sub] === null ? '—' : `${medians[sub]}%`}
                    </p>
                    <p className="text-[9px] text-gray-700 mt-0.5">중앙값 · 기준선</p>
                  </div>
                ))}
              </div>

              <div className="mb-4 space-y-2">
                <RateLegend medians={medians} />
                <p className="text-[10px] text-gray-600 leading-relaxed">
                  출처: 電気技術者試験センター 발표치 · 왼쪽은 실시 연월(앱 표기), 오른쪽 회색은 일본식 年度 표기.
                  과목 색은 절대 합격률이 아니라 그 과목 중앙값 대비 배율로 매긴다 — 과목끼리 비교되는 색이다.
                  값을 누르면 직접 고칠 수 있고, 비우면 기본값으로 되돌아간다.
                </p>
                {ratesTableMissing && (
                  <p className="text-[11px] text-yellow-500/90 bg-yellow-900/15 border border-yellow-700/25 rounded-lg px-3 py-2 leading-relaxed">
                    수정 기능이 꺼져 있다. Supabase에서 <span className="font-mono">supabase/denken_exam_rates_migration.sql</span> 을 한 번 실행하면 켜진다.
                    (그 전까지는 기본표 값만 표시)
                  </p>
                )}
              </div>

              {/* 회차 목록 */}
              <div className="space-y-2">
                {rateList.map(e => {
                  const isEdit   = rateEditId === e.examId
                  const hasPast  = PAST_EXAMS.some(p => p.id === e.examId)
                  const label    = examLabelFromId(e.examId)
                  const field = (key: string, ph: string) => (
                    <input
                      type="number" step="0.01"
                      value={rateForm[key] ?? ''}
                      onChange={ev => setRateForm(f => ({ ...f, [key]: ev.target.value }))}
                      placeholder={ph}
                      className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-xs tabular-nums outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  )

                  return (
                    <div key={e.examId} className="bg-gray-900 rounded-xl overflow-hidden">
                      <button
                        onClick={() => startRateEdit(e)}
                        disabled={ratesTableMissing}
                        className="w-full text-left px-4 py-3 hover:bg-gray-800/60 disabled:hover:bg-transparent transition"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-semibold text-gray-300">{label}</span>
                          <span className="text-[10px] text-gray-600">{e.nendo}</span>
                          {!hasPast && (
                            <span className="text-[9px] text-gray-700 border border-gray-800 rounded px-1">기출 미등록</span>
                          )}
                          {e.source === 'override' && (
                            <span className="text-[9px] text-blue-500/80 border border-blue-900/60 rounded px-1">직접 입력</span>
                          )}
                          <span className="ml-auto flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-600">전체</span>
                            <OverallPill rate={e.overall} size="md" />
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {SUBJECTS.map(sub => (
                            <div key={sub} className="flex flex-col items-center gap-1 bg-gray-950 rounded-lg py-2">
                              <span className="text-[10px] text-gray-600">{sub}</span>
                              <SubjectPill
                                rate={e.subjects[sub].rate} pass={e.subjects[sub].pass}
                                median={medians[sub]} nendo={e.nendo}
                              />
                            </div>
                          ))}
                        </div>
                        {e.note && (
                          <p className="text-[10px] text-gray-500 mt-2 leading-relaxed">{e.note}</p>
                        )}
                      </button>

                      {/* 편집 패널 */}
                      {isEdit && (
                        <div className="border-t border-gray-800 p-3 bg-gray-950/60 space-y-3">
                          <div>
                            <p className="text-[10px] text-gray-600 mb-1.5">전체 합격률 (%) · 수험자 수</p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {field('overall_rate', '12.9')}
                              {field('applicants', '24766')}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-600 mb-1.5">과목별 합격률 (%) — 理 · 電 · 機 · 法</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {field('rate_riron', '理')}
                              {field('rate_denryoku', '電')}
                              {field('rate_kikai', '機')}
                              {field('rate_hoki', '法')}
                            </div>
                          </div>
                          <div>
                            <p className="text-[10px] text-gray-600 mb-1.5">합격기준점 (원칙 60, 인하 시 그 값)</p>
                            <div className="grid grid-cols-4 gap-1.5">
                              {field('pass_riron', '60')}
                              {field('pass_denryoku', '60')}
                              {field('pass_kikai', '60')}
                              {field('pass_hoki', '60')}
                            </div>
                          </div>
                          <input
                            type="text"
                            value={rateForm.note ?? ''}
                            onChange={ev => setRateForm(f => ({ ...f, note: ev.target.value }))}
                            placeholder="메모 (출처·조정 사유 등)"
                            className="w-full bg-gray-800 rounded-lg px-2 py-1.5 text-white text-xs outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={handleRateSave} disabled={rateSaving}
                              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-1.5 rounded-lg text-xs font-semibold transition"
                            >
                              {rateSaving ? '…' : '저장'}
                            </button>
                            <button
                              onClick={() => handleRateReset(e.examId)} disabled={rateSaving}
                              className="px-3 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 py-1.5 rounded-lg text-xs transition"
                              title="직접 입력한 값을 지우고 기본표 값으로 되돌린다"
                            >
                              기본값
                            </button>
                            <button
                              onClick={() => setRateEditId(null)}
                              className="px-3 bg-gray-800 hover:bg-gray-700 py-1.5 rounded-lg text-xs transition"
                            >
                              닫기
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 복습 탭 ── */}
          {activeTab === 'review' && (
            <div>
              {/* 요약 */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-900 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black tabular-nums" style={{ color: REVIEW_META.todo.color }}>
                    {reviewTotals.todo}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">복습 대기</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black tabular-nums" style={{ color: REVIEW_META.done.color }}>
                    {reviewTotals.done}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-0.5">복습 완료</p>
                </div>
                <div className="bg-gray-900 rounded-xl p-3 text-center">
                  <p className="text-2xl font-black tabular-nums text-gray-300">{reviewExams.length}</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">해당 회차</p>
                </div>
              </div>

              {reviewTableMissing && (
                <p className="text-[11px] text-yellow-500/90 bg-yellow-900/15 border border-yellow-700/25 rounded-lg px-3 py-2 leading-relaxed mb-4">
                  복습 태깅이 아직 꺼져 있다. Supabase에서 <span className="font-mono">supabase/denken_review_migration.sql</span> 을 한 번 실행하면 켜진다.
                </p>
              )}

              {/* 機械 단원별 대기 */}
              {reviewByTag.length > 0 && (
                <div className="bg-gray-900 rounded-xl p-3 mb-4">
                  <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">機械 단원별 대기</p>
                  <div className="space-y-1.5">
                    {reviewByTag.map(({ tag, n }) => (
                      <div key={tag.id} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-white px-1.5 py-0.5 rounded shrink-0 w-16 text-center"
                          style={{ backgroundColor: tag.accent }}>{tag.ko}</span>
                        <div className="flex-1 h-2 bg-gray-950 rounded-full overflow-hidden">
                          <div className="h-full rounded-full"
                            style={{
                              width: `${(n / Math.max(...reviewByTag.map(x => x.n))) * 100}%`,
                              backgroundColor: tag.accent,
                            }} />
                        </div>
                        <span className="text-[10px] text-gray-500 tabular-nums w-6 text-right">{n}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 필터 */}
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[10px] text-gray-600">
                  회차 × 과목 — 진할수록 대기가 많다. 셀을 누르면 그 과목 풀이 화면으로 간다.
                </p>
                <button
                  onClick={() => setReviewOnlyTodo(v => !v)}
                  className={`ml-auto px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                    reviewOnlyTodo ? 'bg-amber-600/25 text-amber-400' : 'bg-gray-800 text-gray-500'
                  }`}>
                  {reviewOnlyTodo ? '대기만' : '완료 포함'}
                </button>
              </div>

              {/* 히트맵 */}
              {reviewExams.length === 0 ? (
                <div className="bg-gray-900 rounded-xl p-8 text-center">
                  <p className="text-3xl opacity-25 mb-2">🔖</p>
                  <p className="text-sm text-gray-500">복습 표시한 문제가 없다.</p>
                  <p className="text-[11px] text-gray-700 mt-1 leading-relaxed">
                    풀이 화면에서 문제 칸 오른쪽 위 북마크를 누르면 여기에 쌓인다.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* 헤더 행 */}
                  <div className="flex items-center gap-1.5 px-1">
                    <span className="w-16 shrink-0" />
                    {SUBJECTS.map(sub => (
                      <span key={sub} className="flex-1 text-center text-[10px] text-gray-600">{sub}</span>
                    ))}
                  </div>
                  {reviewExams.map(({ exam, per, todo, done }) => {
                    const nendo = rateMap.get(exam.id)?.nendo
                    return (
                      <div key={exam.id} className="flex items-center gap-1.5">
                        <div className="w-16 shrink-0">
                          <p className="text-xs font-bold text-gray-300 leading-tight">{examLabelFromId(exam.id)}</p>
                          {nendo && <p className="text-[8px] text-gray-700 leading-tight">{nendo}</p>}
                        </div>
                        {per.map(({ sub, count }) => {
                          const href = sub === '機械'
                            ? `/dashboard/denken/kikai/${exam.id}`
                            : `/dashboard/denken/${encodeURIComponent(sub)}/${exam.id}`
                          return (
                            <Link key={sub} href={href}
                              className="flex-1 rounded-lg border py-2 flex flex-col items-center justify-center transition hover:brightness-125"
                              style={reviewHeatStyle(count.todo)}
                              title={`${sub} — 대기 ${count.todo} · 완료 ${count.done}`}>
                              <span className="text-sm font-black tabular-nums"
                                style={{ color: count.todo > 0 ? REVIEW_META.todo.color : '#374151' }}>
                                {count.todo > 0 ? count.todo : '·'}
                              </span>
                              {count.done > 0 && (
                                <span className="text-[8px] tabular-nums" style={{ color: REVIEW_META.done.color }}>
                                  ✓{count.done}
                                </span>
                              )}
                            </Link>
                          )
                        })}
                        <div className="w-10 shrink-0 text-right">
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: REVIEW_META.todo.color }}>
                            {todo}
                          </span>
                          {done > 0 && (
                            <span className="text-[9px] text-gray-700 tabular-nums ml-1">/{todo + done}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </>
  )
}
