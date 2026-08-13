'use client'

// 범용 시험 허브 — /dashboard/exam/[slug]
// -------------------------------------------------------------------
// 에너지관리사·기술사 1차·기술고시를 한 컴포넌트로 그린다. 차이는 전부
// lib/constants-exams.ts 의 ExamSpec 에 들어 있고, 여기서는 spec 을 읽어 렌더한다.
// 화면 구성은 덴켄 1·2종 허브와 동일 계열 (풀이 현황 / 회차 난이도 / 복습).

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter, notFound } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  EXAM_MAP, getSubjectSpec, examRounds,
  markSubjectScore, markGradedCount, markAnswerable, isPassed,
  essayScore, essayPicked, normalizeSubs,
  type SubjectSpec, type Result, type EssayAnswer, type ExamRound,
} from '@/lib/constants-exams'
import {
  buildRate, TIER_META, medianOf, ratioOf, tierOf,
  type ExamRate, type RateOverride,
} from '@/lib/constants-exams-rate'
import {
  REVIEW_META, EMPTY_REVIEW_COUNT, addReview, reviewHeatStyle,
  type ReviewState, type ReviewCount,
} from '@/lib/constants-denken-review'

type AnswerRow = {
  exam_id: string
  subject: string
  q_num: number
  subs_json: Result[][] | null
  selected: boolean | null
  score: number | null
  review: string | null
}
type SessionRow = { exam_id: string; subject: string; drive_url: string | null }

const key = (examId: string, subject: string) => `${examId}__${subject}`

function scoreColor(s: number, pass: number) {
  if (s >= pass) return 'text-green-400'
  if (s >= pass * 0.7) return 'text-yellow-400'
  return 'text-red-400'
}

function RatePill({ rate, median }: { rate: number | null; median: number | null }) {
  const t = TIER_META[tierOf(rate, median)]
  const ratio = ratioOf(rate, median)
  const title = rate === null
    ? '합격률 미발표 · 직접 입력 가능'
    : `합격률 ${rate}%` + (ratio !== null ? ` · 중앙값 ${median}% 대비 ${ratio}배` : '')
  return (
    <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums border"
      style={{ color: t.color, backgroundColor: t.bg, borderColor: t.border }} title={title}>
      {rate === null ? '—' : `${rate}%`}
    </span>
  )
}

export default function ExamHub() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const spec = EXAM_MAP.get(slug)

  const [tab, setTab] = useState<'scores' | 'rates' | 'review'>('scores')
  const [answers, setAnswers] = useState<AnswerRow[]>([])
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [overrides, setOverrides] = useState<RateOverride[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewMissing, setReviewMissing] = useState(false)

  const rounds: ExamRound[] = useMemo(() => (spec ? examRounds(spec) : []), [spec])
  const examIds = useMemo(() => rounds.map(r => r.id), [rounds])

  const load = useCallback(async () => {
    if (!spec) return
    setLoading(true)
    const [{ data: ans }, { data: sess }, { data: ov }] = await Promise.all([
      supabase.from('exam_answers')
        .select('exam_id, subject, q_num, subs_json, selected, score, review')
        .eq('exam_slug', slug).in('exam_id', examIds),
      supabase.from('exam_sessions')
        .select('exam_id, subject, drive_url')
        .eq('exam_slug', slug).in('exam_id', examIds),
      supabase.from('exam_rates').select('exam_id, rate, note').eq('exam_slug', slug),
    ])
    setAnswers((ans as AnswerRow[]) ?? [])
    setSessions((sess as SessionRow[]) ?? [])
    setOverrides((ov as RateOverride[]) ?? [])
    setReviewMissing(ans === null)
    setLoading(false)
  }, [spec, slug, examIds])

  useEffect(() => { load() }, [load])

  const ovMap = useMemo(() => new Map(overrides.map(o => [o.exam_id, o])), [overrides])
  const rates: ExamRate[] = useMemo(() => {
    if (!spec) return []
    return rounds.map(r => buildRate(spec.examIdPrefix, r.id, r.year, ovMap.get(r.id)))
  }, [spec, rounds, ovMap])
  const rateMap = useMemo(() => new Map(rates.map(r => [r.examId, r])), [rates])
  const median = useMemo(() => medianOf(rates.map(r => r.rate)), [rates])

  const sessionMap = useMemo(
    () => new Map(sessions.map(s => [key(s.exam_id, s.subject), s])),
    [sessions],
  )

  // ── 채점 집계 ─────────────────────────────────────────────────────
  const { subjScore, reviewMap } = useMemo(() => {
    const subjScore = new Map<string, { score: number; graded: number; total: number; pass: boolean; started: boolean }>()
    const reviewMap = new Map<string, ReviewCount>()
    if (!spec) return { subjScore, reviewMap }

    const grouped = new Map<string, AnswerRow[]>()
    for (const a of answers) {
      const k = key(a.exam_id, a.subject)
      const arr = grouped.get(k); if (arr) arr.push(a); else grouped.set(k, [a])
    }

    for (const [k, rows] of grouped) {
      let rc = EMPTY_REVIEW_COUNT
      for (const r of rows) rc = addReview(rc, (r.review as ReviewState) ?? null)
      reviewMap.set(k, rc)

      const subject = k.split('__')[1]
      const sp = getSubjectSpec(spec, subject)
      if (!sp) continue

      if (sp.mode === 'marksheet') {
        const row = rows.find(r => r.q_num === 0)
        const groups = (sp.mark ?? []).map((g, i) =>
          normalizeSubs((row?.subs_json?.[i] ?? []) as Result[], g.subCount))
        const score = markSubjectScore(sp, groups)
        const graded = markGradedCount(sp, groups)
        subjScore.set(k, {
          score, graded, total: markAnswerable(sp),
          pass: isPassed(slug, sp, score, groups), started: graded > 0,
        })
      } else {
        const ea: EssayAnswer[] = rows.filter(r => r.q_num >= 1)
          .map(r => ({ q_num: r.q_num, selected: !!r.selected, score: r.score }))
        const score = essayScore(sp.essay!, ea)
        const picked = essayPicked(ea)
        subjScore.set(k, {
          score, graded: picked, total: sp.essay!.pickCount,
          pass: score >= sp.passMark, started: picked > 0,
        })
      }
    }
    return { subjScore, reviewMap }
  }, [answers, spec, slug])

  if (!spec) { notFound(); return null }

  const started = [...subjScore.values()].filter(s => s.started)
  const passedCnt = started.filter(s => s.pass).length
  const totalReviewTodo = [...reviewMap.values()].reduce((s, c) => s + c.todo, 0)
  const totalReviewDone = [...reviewMap.values()].reduce((s, c) => s + c.done, 0)

  const cols = spec.subjects.length <= 4 ? spec.subjects.length : 4

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{spec.emoji}</span>
          <h1 className="text-2xl font-bold">{spec.name}</h1>
        </div>
        <p className="text-gray-500 text-sm mb-2">{spec.org} · {spec.scheduleNote}</p>
        <p className="text-gray-600 text-xs mb-5">{spec.intro}</p>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6">
          {([
            { k: 'scores', label: '📋 기출 풀이 현황' },
            { k: 'rates',  label: '📉 회차 난이도' },
            { k: 'review', label: '🔖 복습' },
          ] as const).map(({ k, label }) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex-1 px-1 py-2 rounded-lg text-[11px] md:text-sm font-medium transition ${
                tab === k ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* ── 풀이 현황 ── */}
        {tab === 'scores' && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">풀이 (과목)</p>
                <p className="text-2xl font-bold">{started.length}
                  <span className="text-sm text-gray-500 ml-1">/ {rounds.length * spec.subjects.length}</span></p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">합격 기준 도달</p>
                <p className={`text-2xl font-bold ${passedCnt > 0 ? 'text-green-400' : 'text-gray-500'}`}>{passedCnt}</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">복습 대기</p>
                <p className="text-2xl font-bold" style={{ color: totalReviewTodo > 0 ? REVIEW_META.todo.color : '#6b7280' }}>{totalReviewTodo}</p>
              </div>
            </div>

            <p className="text-[11px] text-gray-600 mb-4">{spec.cutNote}</p>

            {loading ? <p className="text-gray-500 text-sm">불러오는 중...</p> : (
              <div className="space-y-3">
                {rounds.map(rd => {
                  const examId = rd.id
                  const r = rateMap.get(examId)
                  return (
                    <div key={examId} className="bg-gray-900 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
                        <p className="text-sm font-semibold text-gray-300">{rd.label}</p>
                        <span className="ml-auto"><RatePill rate={r?.rate ?? null} median={median} /></span>
                      </div>
                      <div className="grid gap-px bg-gray-800"
                        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
                        {spec.subjects.map(sub => {
                          const k = key(examId, sub.slug)
                          const sc = subjScore.get(k)
                          const rc = reviewMap.get(k)
                          const sess = sessionMap.get(k)
                          return (
                            <button key={sub.slug}
                              onClick={() => router.push(`/dashboard/exam/${slug}/${examId}/${sub.slug}`)}
                              className="bg-gray-950 hover:bg-gray-900 p-3 text-left transition">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: sub.accent }} />
                                <span className="text-[11px] text-gray-500 truncate" title={sub.name}>{sub.short}</span>
                                {rc && rc.todo > 0 && (
                                  <span className="text-[9px] font-bold px-1 rounded shrink-0"
                                    style={{ color: REVIEW_META.todo.color, backgroundColor: REVIEW_META.todo.bg }}>🔖{rc.todo}</span>
                                )}
                                {sess?.drive_url && <span className="ml-auto text-[9px] text-gray-600">PDF✓</span>}
                              </div>
                              <p className={`text-lg font-bold tabular-nums ${
                                sc && sc.started ? scoreColor(sc.score, sub.passMark) : 'text-gray-600'}`}>
                                {sc && sc.started ? `${sc.score}` : '—'}
                                {sc && sc.started && <span className="text-xs text-gray-600 font-normal">/{sub.fullMark}</span>}
                              </p>
                              {sc && sc.started ? (
                                <p className="text-[9px] text-gray-600 -mt-0.5">
                                  {sub.mode === 'essay' ? `${sc.graded}/${sc.total}問 자기채점` : `${sc.graded}/${sc.total}문`}
                                  {sc.pass && <span className="text-emerald-500 ml-1">합격</span>}
                                </p>
                              ) : <p className="text-[9px] text-gray-700 -mt-0.5">풀기 →</p>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 회차 난이도 ── */}
        {tab === 'rates' && (
          <div>
            <div className="bg-gray-900 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                이 시험은 과목별 합격률이 안정적으로 공표되지 않는다. 회차 전체 합격률만 배지로 쓰고,
                판정은 확보된 회차들의 중앙값 대비 배율로 한다. 비어 있는 회차는 Supabase{' '}
                <span className="font-mono">exam_rates</span> 에 직접 넣으면 채워진다.
              </p>
              <p className="text-[11px] text-gray-600 mt-2">중앙값 <span className="text-gray-300">{median ?? '—'}%</span></p>
            </div>
            <div className="bg-gray-900 rounded-xl overflow-hidden">
              {rates.map(r => (
                <div key={r.examId} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-800 last:border-0">
                  <span className="text-sm text-gray-300 tabular-nums w-40">
                    {rounds.find(x => x.id === r.examId)?.label ?? spec.yearLabel(r.year)}
                  </span>
                  <RatePill rate={r.rate} median={median} />
                  {r.note && <span className="text-[10px] text-gray-600">{r.note}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── 복습 ── */}
        {tab === 'review' && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold" style={{ color: REVIEW_META.todo.color }}>{totalReviewTodo}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">복습 대기</p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold" style={{ color: REVIEW_META.done.color }}>{totalReviewDone}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">복습 완료</p>
              </div>
            </div>
            {reviewMissing && (
              <div className="bg-amber-900/20 border border-amber-500/25 rounded-xl p-4 mb-4">
                <p className="text-xs text-amber-300">
                  테이블이 아직 없다. Supabase에서 <span className="font-mono">supabase/exams_migration.sql</span> 을 실행하면 켜진다.
                </p>
              </div>
            )}
            <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">복습 대기 히트맵</p>
              <div className="inline-block min-w-full">
                <div className="grid gap-1"
                  style={{ gridTemplateColumns: `72px repeat(${spec.subjects.length}, minmax(52px, 1fr))` }}>
                  <div />
                  {spec.subjects.map(s => (
                    <div key={s.slug} className="text-[9px] text-gray-500 text-center pb-1 truncate" title={s.name}>{s.short}</div>
                  ))}
                  {rounds.map(rd => (
                    <FragmentRow key={rd.id} examId={rd.id}
                      label={rd.round ? `${rd.year}-${rd.round}` : String(rd.year)}
                      subjects={spec.subjects} reviewMap={reviewMap} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function FragmentRow({ examId, label, subjects, reviewMap }: {
  examId: string; label: string; subjects: SubjectSpec[]; reviewMap: Map<string, ReviewCount>
}) {
  return (
    <>
      <div className="text-[10px] text-gray-500 flex items-center tabular-nums">{label}</div>
      {subjects.map(sub => {
        const rc = reviewMap.get(key(examId, sub.slug)) ?? EMPTY_REVIEW_COUNT
        return (
          <div key={sub.slug}
            className="h-7 rounded border flex items-center justify-center text-[10px] font-bold tabular-nums"
            style={reviewHeatStyle(rc.todo)} title={`${label} ${sub.name} — 대기 ${rc.todo} · 완료 ${rc.done}`}>
            {rc.todo > 0 ? rc.todo : <span className="text-gray-800">·</span>}
          </div>
        )
      })}
    </>
  )
}
