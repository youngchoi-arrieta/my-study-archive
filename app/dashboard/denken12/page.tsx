'use client'

// 電験一種・二種 통합 허브
// -------------------------------------------------------------------
// 1종과 2종을 한 섹션으로 합친 이유: 시험 구조가 사실상 같다.
//   · 둘 다 연 1회 · 一次(8월, 마크시트 4과목) → 二次(11월, 기술식 2과목)
//   · 一次는 A 4題 + B 몇 題, 大問 배점을 小問으로 쪼개 매기는 방식이 동일
//   · 二次는 배점(120+60=180)·선택 규칙·합격 기준이 완전히 동일
// 다른 건 숫자뿐(2종 90점/54점, 1종 80점/48점, B문제 배점·小問 수)이라
// 화면을 두 벌 만들 이유가 없다. 종별은 토글 하나로 갈아 끼운다.

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  GRADES, GRADE_META, PHASE_META,
  ICHIJI_SUBJECTS, NIJI_SUBJECTS, SUBJECT_ACCENT,
  NIJI_STRUCTURE, NIJI_FULL_MARK, NIJI_PASS_MARK,
  ichijiStructure, examsOf, examLabel, scheduleNote,
  scoreIchiji, gradedCount, answerableCount, normalizeSubs, defaultSubCount,
  scoreNiji, nijiPickedCount, round1,
  type Denken12Grade, type Denken12Subject, type IchijiSubject, type NijiSubject,
  type IchijiAnswer, type NijiAnswer, type Result,
} from '@/lib/constants-denken12'
import {
  DENKEN12_RATE_MAP, TIER_META, RATIO_THRESHOLD,
  computeMedians, mergeRate, ratioOf, tierOf,
  type Denken12Rate, type Denken12RateOverride,
} from '@/lib/constants-denken12-rate'
import { REVIEW_META, EMPTY_REVIEW_COUNT, addReview, reviewHeatStyle, type ReviewState, type ReviewCount } from '@/lib/constants-denken-review'

type AnswerRow = {
  exam_id: string
  subject: string
  q_num: number
  sub_count: number | null
  subs: string[] | null
  selected: boolean | null
  score: number | null
  review: string | null
  memo: string | null
}

type SessionRow = {
  exam_id: string
  subject: string
  drive_url: string | null
  selected_q: number | null
  memo: string | null
}

type IchijiAuto = { score: number; graded: number; total: number; pass: boolean }
type NijiAuto   = { score: number; picked: number; pick: number; full: number }

const key = (examId: string, subject: string) => `${examId}__${subject}`

function scoreColor(s: number | null, passMark: number) {
  if (s === null) return 'text-gray-600'
  if (s >= passMark) return 'text-green-400'
  if (s >= passMark * 0.7) return 'text-yellow-400'
  return 'text-red-400'
}

// ── 합격률 배지 ─────────────────────────────────────────────────────
function RatePill({ rate, median, label, extra }: {
  rate: number | null; median: number | null; label: string; extra?: string
}) {
  const t = TIER_META[tierOf(rate, median)]
  const ratio = ratioOf(rate, median)
  const title = rate === null
    ? `${label} 합격률 미발표 · 직접 입력 가능`
    : [`${label} 합격률 ${rate}%`, ratio !== null ? `중앙값 ${median}% 대비 ${ratio}배` : null, extra]
        .filter(Boolean).join(' · ')
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums border whitespace-nowrap"
      style={{ color: t.color, backgroundColor: t.bg, borderColor: t.border }}
      title={title}
    >
      <span className="font-normal opacity-70">{label}</span>
      {rate === null ? '—' : `${rate}%`}
    </span>
  )
}

export default function Denken12Hub() {
  const router = useRouter()

  const [grade, setGrade]         = useState<Denken12Grade>('second')
  const [activeTab, setActiveTab] = useState<'scores' | 'rates' | 'review'>('scores')
  const [answers, setAnswers]     = useState<AnswerRow[]>([])
  const [sessions, setSessions]   = useState<SessionRow[]>([])
  const [overrides, setOverrides] = useState<Denken12RateOverride[]>([])
  const [loading, setLoading]     = useState(true)
  const [reviewMissing, setReviewMissing] = useState(false)

  const exams  = useMemo(() => examsOf(grade), [grade])
  const examIds = useMemo(() => exams.map(e => e.id), [exams])

  // ── 로드 ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: ans }, { data: sess }, { data: ov }] = await Promise.all([
      supabase.from('denken12_answers')
        .select('exam_id, subject, q_num, sub_count, subs, selected, score, review, memo')
        .in('exam_id', examIds),
      supabase.from('denken12_sessions')
        .select('exam_id, subject, drive_url, selected_q, memo')
        .in('exam_id', examIds),
      supabase.from('denken12_rates').select('*'),
    ])
    setAnswers((ans as AnswerRow[]) ?? [])
    setSessions((sess as SessionRow[]) ?? [])
    setOverrides((ov as Denken12RateOverride[]) ?? [])
    setReviewMissing(ans === null)
    setLoading(false)
  }, [examIds])

  useEffect(() => { load() }, [load])

  // ── 난이도 ────────────────────────────────────────────────────────
  const ovMap = useMemo(
    () => new Map(overrides.map(o => [o.exam_id, o])),
    [overrides],
  )

  const rates: Denken12Rate[] = useMemo(
    () => exams.map(e => mergeRate(DENKEN12_RATE_MAP.get(e.id), ovMap.get(e.id), e.id, e.grade, e.nendo)),
    [exams, ovMap],
  )
  const rateMap = useMemo(() => new Map(rates.map(r => [r.examId, r])), [rates])
  // 중앙값은 같은 종 안에서만 낸다 (1종 二次 14%와 2종 一次 24%를 같은 자로 재면 안 된다)
  const medians = useMemo(() => computeMedians(rates), [rates])

  // ── 세션 맵 ───────────────────────────────────────────────────────
  const sessionMap = useMemo(
    () => new Map(sessions.map(s => [key(s.exam_id, s.subject), s])),
    [sessions],
  )

  // ── 채점 집계 ─────────────────────────────────────────────────────
  // 풀이 UI에서 찍은 정오가 곧 허브 점수다. 허브에 따로 입력할 일은 없다.
  const { ichijiMap, nijiMap, reviewMap, reviewQMap } = useMemo(() => {
    const grouped = new Map<string, AnswerRow[]>()
    for (const a of answers) {
      const k = key(a.exam_id, a.subject)
      const arr = grouped.get(k)
      if (arr) arr.push(a); else grouped.set(k, [a])
    }

    const ichijiMap = new Map<string, IchijiAuto>()
    const nijiMap   = new Map<string, NijiAuto>()
    const reviewMap = new Map<string, ReviewCount>()
    const reviewQMap = new Map<string, number[]>()

    for (const [k, rows] of grouped) {
      let rc = EMPTY_REVIEW_COUNT
      const qs: number[] = []
      for (const r of rows) {
        rc = addReview(rc, (r.review as ReviewState) ?? null)
        if (r.review === 'todo') qs.push(r.q_num)
      }
      reviewMap.set(k, rc)
      reviewQMap.set(k, qs.sort((a, b) => a - b))

      const subject = rows[0].subject as Denken12Subject
      if ((NIJI_SUBJECTS as string[]).includes(subject)) {
        const st = NIJI_STRUCTURE[subject as NijiSubject]
        const na: NijiAnswer[] = rows.map(r => ({
          q_num: r.q_num, selected: !!r.selected, score: r.score, memo: r.memo ?? '',
        }))
        nijiMap.set(k, {
          score: scoreNiji(st, na),
          picked: nijiPickedCount(na),
          pick: st.pickCount,
          full: st.fullMark,
        })
      } else {
        const [examId] = k.split('__')
        const st = ichijiStructure(grade, subject as IchijiSubject)
        const selectedQ = sessionMap.get(k)?.selected_q ?? null
        const ia: IchijiAnswer[] = rows.map(r => {
          const sc = r.sub_count ?? defaultSubCount(st, r.q_num)
          return {
            q_num: r.q_num,
            subCount: sc,
            subs: normalizeSubs((r.subs ?? []) as Result[], sc),
            memo: r.memo ?? '',
          }
        })
        const score = scoreIchiji(st, ia, selectedQ)
        ichijiMap.set(k, {
          score,
          graded: gradedCount(st, ia, selectedQ),
          total: answerableCount(st, selectedQ),
          pass: score >= st.passMark,
        })
        void examId
      }
    }
    return { ichijiMap, nijiMap, reviewMap, reviewQMap }
  }, [answers, grade, sessionMap])

  // ── 요약 ──────────────────────────────────────────────────────────
  const ichijiAttempts = [...ichijiMap.values()].filter(a => a.graded > 0)
  const ichijiPassed   = ichijiAttempts.filter(a => a.pass).length
  const nijiAttempts   = [...nijiMap.values()].filter(a => a.picked > 0)

  // 二次는 과목 단독 합격이 없다. 두 과목 합산 180점 기준이라 회차 단위로 묶어 본다.
  const nijiByExam = useMemo(() => {
    const m = new Map<string, { score: number; full: number; picked: number }>()
    for (const e of exams) {
      let score = 0, full = 0, picked = 0
      for (const sub of NIJI_SUBJECTS) {
        const a = nijiMap.get(key(e.id, sub))
        if (!a) continue
        score += a.score; full += a.full; picked += a.picked
      }
      if (picked > 0) m.set(e.id, { score: round1(score), full, picked })
    }
    return m
  }, [exams, nijiMap])

  const totalReviewTodo = [...reviewMap.values()].reduce((s, c) => s + c.todo, 0)
  const totalReviewDone = [...reviewMap.values()].reduce((s, c) => s + c.done, 0)

  const ichijiStructRef = ichijiStructure(grade, '理論')

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* 헤더 */}
        <div className="mb-2">
          <Link href="/dashboard" className="text-gray-400 hover:text-white text-sm">← 대시보드</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🗼</span>
          <h1 className="text-2xl font-bold">電験一種・二種</h1>
          <span className="text-xs bg-gray-700/50 text-gray-400 px-2 py-0.5 rounded-full">장기</span>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          연 1회 · 一次({scheduleNote('ichiji')}) → 二次({scheduleNote('niji')}) · 一次 합격 시 다음 해 一次 면제
        </p>

        {/* 종별 토글 */}
        <div className="flex gap-2 mb-5">
          {GRADES.map(g => {
            const meta = GRADE_META[g]
            const on = grade === g
            return (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`flex-1 rounded-2xl px-4 py-3 text-left transition border ${
                  on ? 'bg-gray-900' : 'bg-gray-950 border-gray-800 hover:bg-gray-900/60'
                }`}
                style={on ? { borderColor: meta.accent, boxShadow: `inset 0 0 0 1px ${meta.accent}55` } : {}}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: meta.accent }} />
                  <span className={`text-sm font-bold ${on ? 'text-white' : 'text-gray-500'}`}>{meta.ja}</span>
                </div>
                <p className="text-[11px] text-gray-600 mt-1">
                  {g === 'second'
                    ? '一次 90点·합격 54点 / A15点·B10点'
                    : '一次 80点·합격 48点 / A10点·B20点'}
                </p>
              </button>
            )
          })}
        </div>

        {/* 구조 요약 */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-900 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">一次試験 · 마크시트</p>
            <p className="text-sm text-gray-300 leading-relaxed">
              理論 · 電力 · 機械 · 法規<br />
              <span className="text-gray-500 text-xs">
                A問題 4題({ichijiStructRef.aPoint}点) + B問題({ichijiStructRef.bPoint}点) ·
                {' '}{ichijiStructRef.fullMark}点 만점 / 합격 {ichijiStructRef.passMark}点
              </span>
            </p>
            <p className="text-[11px] text-gray-600 mt-2">
              理論·機械는 B에 선택문제 1쌍 · 과목합격 3년 유보
            </p>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-2">二次試験 · 記述式</p>
            <p className="text-sm text-gray-300 leading-relaxed">
              電力・管理 · 機械・制御<br />
              <span className="text-gray-500 text-xs">
                6問中4問 / 4問中2問 선택 · 각 30点 · 합계 {NIJI_FULL_MARK}点
              </span>
            </p>
            <p className="text-[11px] text-gray-600 mt-2">
              합격 {NIJI_PASS_MARK}点 + 각 과목 평균점 이상(足切り) · 난회차엔 3点씩 인하
            </p>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6">
          {([
            { k: 'scores', label: '📋 기출 풀이 현황' },
            { k: 'rates',  label: '📉 회차 난이도' },
            { k: 'review', label: '🔖 복습' },
          ] as const).map(({ k, label }) => (
            <button
              key={k}
              onClick={() => setActiveTab(k)}
              className={`flex-1 px-1 py-2 rounded-lg text-[11px] md:text-sm font-medium transition whitespace-nowrap ${
                activeTab === k ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 기출 풀이 현황 ── */}
        {activeTab === 'scores' && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">一次 풀이 (과목)</p>
                <p className="text-2xl font-bold">
                  {ichijiAttempts.length}
                  <span className="text-sm text-gray-500 ml-1">/ {exams.length * 4}</span>
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">一次 합격 과목</p>
                <p className={`text-2xl font-bold ${ichijiPassed > 0 ? 'text-green-400' : 'text-gray-500'}`}>
                  {ichijiPassed}
                </p>
              </div>
              <div className="bg-gray-900 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-500 mb-1">二次 풀이 (과목)</p>
                <p className="text-2xl font-bold text-violet-400">{nijiAttempts.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap text-[10px] text-gray-500 mb-4">
              <span className="text-gray-600">회차 난이도</span>
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
              <span>과목별 합격률은 1·2종에선 미공표 — 단계별 전체 합격률로 판정</span>
            </div>

            {loading ? (
              <p className="text-gray-500 text-sm">불러오는 중...</p>
            ) : (
              <div className="space-y-3">
                {exams.map(exam => {
                  const r  = rateMap.get(exam.id)
                  const nj = nijiByExam.get(exam.id)
                  return (
                    <div key={exam.id} className="bg-gray-900 rounded-xl overflow-hidden">
                      {/* 회차 헤더 */}
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 flex-wrap">
                        <p className="text-sm font-semibold text-gray-300">{examLabel(exam.id)}</p>
                        <span className="text-[10px] text-gray-600">{r?.nendoLabel}</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          <RatePill rate={r?.ichiji.rate ?? null} median={medians.ichiji} label="一次"
                            extra={r?.ichiji.takers ? `수험 ${r.ichiji.takers.toLocaleString()}명` : undefined} />
                          <RatePill rate={r?.niji.rate ?? null} median={medians.niji} label="二次"
                            extra={r?.niji.takers ? `수험 ${r.niji.takers.toLocaleString()}명` : undefined} />
                        </span>
                      </div>

                      {/* 一次 4과목 */}
                      <div className="px-4 pt-3 pb-1">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">
                          一次 · {PHASE_META.ichiji.desc}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-gray-800">
                        {ICHIJI_SUBJECTS.map(sub => {
                          const k    = key(exam.id, sub)
                          const auto = ichijiMap.get(k)
                          const st   = ichijiStructure(grade, sub)
                          const sess = sessionMap.get(k)
                          const rc   = reviewMap.get(k)
                          const qs   = reviewQMap.get(k) ?? []
                          return (
                            <button
                              key={sub}
                              onClick={() => router.push(`/dashboard/denken12/${exam.id}/${encodeURIComponent(sub)}`)}
                              className="bg-gray-950 hover:bg-gray-900 p-3 text-left transition"
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: SUBJECT_ACCENT[sub] }} />
                                <span className="text-xs text-gray-500">{sub}</span>
                                {rc && rc.todo > 0 && (
                                  <span className="text-[9px] font-bold px-1 rounded shrink-0"
                                    style={{ color: REVIEW_META.todo.color, backgroundColor: REVIEW_META.todo.bg }}
                                    title={`복습 대기: ${qs.map(q => `Q${q}`).join(', ')}`}>
                                    🔖{rc.todo}
                                  </span>
                                )}
                                {sess?.drive_url && (
                                  <span className="ml-auto text-[9px] text-gray-600">PDF✓</span>
                                )}
                              </div>
                              <p className={`text-lg font-bold tabular-nums ${
                                auto && auto.graded > 0 ? scoreColor(auto.score, st.passMark) : 'text-gray-600'
                              }`}>
                                {auto && auto.graded > 0 ? `${auto.score}点` : '—'}
                              </p>
                              {auto && auto.graded > 0 && (
                                <p className="text-[9px] text-gray-600 -mt-0.5">
                                  {auto.graded < auto.total
                                    ? `채점중 ${auto.graded}/${auto.total}문`
                                    : `${auto.total}문 · ${st.fullMark}点 만점`}
                                  {auto.pass && <span className="text-emerald-500 ml-1">합격</span>}
                                </p>
                              )}
                              {(!auto || auto.graded === 0) && (
                                <p className="text-[9px] text-gray-700 -mt-0.5">풀기 →</p>
                              )}
                            </button>
                          )
                        })}
                      </div>

                      {/* 二次 2과목 */}
                      <div className="px-4 pt-3 pb-1 flex items-center gap-2">
                        <p className="text-[10px] text-gray-600 uppercase tracking-widest">
                          二次 · 기술식
                        </p>
                        {nj && (
                          <span className="ml-auto text-[11px] tabular-nums">
                            <span className={nj.score >= NIJI_PASS_MARK ? 'text-emerald-400 font-bold' : 'text-gray-400'}>
                              {nj.score}
                            </span>
                            <span className="text-gray-600"> / {NIJI_FULL_MARK}点</span>
                            {nj.score >= NIJI_PASS_MARK && <span className="text-emerald-500 ml-1">✓</span>}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-px bg-gray-800">
                        {NIJI_SUBJECTS.map(sub => {
                          const k    = key(exam.id, sub)
                          const auto = nijiMap.get(k)
                          const st   = NIJI_STRUCTURE[sub]
                          const rc   = reviewMap.get(k)
                          return (
                            <button
                              key={sub}
                              onClick={() => router.push(`/dashboard/denken12/${exam.id}/${encodeURIComponent(sub)}`)}
                              className="bg-gray-950 hover:bg-gray-900 p-3 text-left transition"
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: SUBJECT_ACCENT[sub] }} />
                                <span className="text-xs text-gray-500">{sub}</span>
                                <span className="text-[9px] text-gray-700">{st.totalQ}問中{st.pickCount}問</span>
                                {rc && rc.todo > 0 && (
                                  <span className="text-[9px] font-bold px-1 rounded shrink-0"
                                    style={{ color: REVIEW_META.todo.color, backgroundColor: REVIEW_META.todo.bg }}>
                                    🔖{rc.todo}
                                  </span>
                                )}
                              </div>
                              <p className={`text-lg font-bold tabular-nums ${
                                auto && auto.picked > 0 ? 'text-gray-200' : 'text-gray-600'
                              }`}>
                                {auto && auto.picked > 0 ? `${auto.score}点` : '—'}
                                {auto && auto.picked > 0 && (
                                  <span className="text-xs text-gray-600 font-normal"> / {st.fullMark}</span>
                                )}
                              </p>
                              {auto && auto.picked > 0 ? (
                                <p className="text-[9px] text-gray-600 -mt-0.5">
                                  선택 {auto.picked}/{auto.pick}問 · 자기채점
                                </p>
                              ) : (
                                <p className="text-[9px] text-gray-700 -mt-0.5">풀기 →</p>
                              )}
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
        {activeTab === 'rates' && (
          <div>
            <div className="bg-gray-900 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-400 leading-relaxed">
                1·2종은 <span className="text-gray-200">과목별 합격률을 공표하지 않는다</span>.
                시험센터가 내놓는 건 一次·二次 각각의 수험자/합격자 수뿐이다.
                그래서 三種처럼 과목 칸을 색칠하는 대신 단계별 전체 합격률로 회차를 가른다.
              </p>
              <p className="text-[11px] text-gray-600 mt-2">
                二次 합격률의 분모는 一次를 뚫은 사람들이다. 三種 합격률과 같은 자로 재면 안 된다 —
                그래서 一次·二次 각각 자기 중앙값 대비 배율로 판정한다.
              </p>
              <div className="flex gap-4 mt-3 text-[11px]">
                <span className="text-gray-500">중앙값 · 一次 <span className="text-gray-300">{medians.ichiji ?? '—'}%</span></span>
                <span className="text-gray-500">二次 <span className="text-gray-300">{medians.niji ?? '—'}%</span></span>
              </div>
            </div>

            <div className="bg-gray-900 rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_repeat(4,minmax(0,1fr))] gap-px bg-gray-800 text-[10px] text-gray-500">
                {['年度', '一次 수험', '一次 합격률', '二次 수험', '二次 합격률'].map(h => (
                  <div key={h} className="bg-gray-900 px-2 py-2 font-bold">{h}</div>
                ))}
              </div>
              {rates.map(r => (
                <div key={r.examId}
                  className="grid grid-cols-[1fr_repeat(4,minmax(0,1fr))] gap-px bg-gray-800 text-xs">
                  <div className="bg-gray-950 px-2 py-2">
                    <p className="text-gray-300 font-semibold">{r.nendo}</p>
                    <p className="text-[9px] text-gray-600">{r.nendoLabel}</p>
                  </div>
                  <div className="bg-gray-950 px-2 py-2 text-gray-500 tabular-nums">
                    {r.ichiji.takers?.toLocaleString() ?? '—'}
                    {r.ichiji.passers !== null && (
                      <span className="text-[9px] text-gray-700 block">합격 {r.ichiji.passers.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="bg-gray-950 px-2 py-2">
                    <RatePill rate={r.ichiji.rate} median={medians.ichiji} label="" />
                  </div>
                  <div className="bg-gray-950 px-2 py-2 text-gray-500 tabular-nums">
                    {r.niji.takers?.toLocaleString() ?? '—'}
                    {r.niji.passers !== null && (
                      <span className="text-[9px] text-gray-700 block">합격 {r.niji.passers.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="bg-gray-950 px-2 py-2">
                    <RatePill rate={r.niji.rate} median={medians.niji} label="" />
                    {r.passMarkNiji !== null && (
                      <span className="text-[9px] text-red-400 block mt-0.5">기준 {r.passMarkNiji}点</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-700 mt-3">
              출처: 電気技術者試験センター 試験結果と推移 · 미발표 회차는 Supabase{' '}
              <span className="font-mono">denken12_rates</span> 에 직접 넣으면 이 표를 덮어쓴다.
            </p>
          </div>
        )}

        {/* ── 복습 ── */}
        {activeTab === 'review' && (
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
                  테이블이 아직 없다. Supabase에서{' '}
                  <span className="font-mono">supabase/denken12_migration.sql</span> 을 한 번 실행하면 켜진다.
                </p>
              </div>
            )}

            {/* 회차 × 과목 히트맵 */}
            <div className="bg-gray-900 rounded-xl p-4 overflow-x-auto">
              <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">복습 대기 히트맵</p>
              <div className="inline-block min-w-full">
                <div className="grid gap-1"
                  style={{ gridTemplateColumns: `52px repeat(${ICHIJI_SUBJECTS.length + NIJI_SUBJECTS.length}, minmax(56px, 1fr))` }}>
                  <div />
                  {[...ICHIJI_SUBJECTS, ...NIJI_SUBJECTS].map(s => (
                    <div key={s} className="text-[9px] text-gray-500 text-center pb-1 truncate" title={s}>{s}</div>
                  ))}
                  {exams.map(e => (
                    <FragmentRow key={e.id} examId={e.id} label={examLabel(e.id)} reviewMap={reviewMap} />
                  ))}
                </div>
              </div>
            </div>

            {totalReviewTodo === 0 && !reviewMissing && (
              <p className="text-sm text-gray-500 mt-4">복습 표시한 문제가 없다.</p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}

// 히트맵 한 줄 (会次 × 6과목)
function FragmentRow({ examId, label, reviewMap }: {
  examId: string; label: string; reviewMap: Map<string, ReviewCount>
}) {
  return (
    <>
      <div className="text-[10px] text-gray-500 flex items-center tabular-nums">{label}</div>
      {[...ICHIJI_SUBJECTS, ...NIJI_SUBJECTS].map(sub => {
        const rc = reviewMap.get(key(examId, sub)) ?? EMPTY_REVIEW_COUNT
        return (
          <div key={sub}
            className="h-7 rounded border flex items-center justify-center text-[10px] font-bold tabular-nums"
            style={reviewHeatStyle(rc.todo)}
            title={`${label} ${sub} — 대기 ${rc.todo} · 완료 ${rc.done}`}>
            {rc.todo > 0 ? rc.todo : <span className="text-gray-800">·</span>}
          </div>
        )
      })}
    </>
  )
}
