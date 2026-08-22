'use client'

// 단원별 비중 표
// -------------------------------------------------------------------
// 세 가지를 한 줄에 나란히 둔다.
//
//   교재 비중  — 그 단원에 배정된 문제 수. 저자가 본 출제 비중의 대리값이다.
//                실제 회차 출제와 같지는 않지만, N제를 푸는 동안은 이게
//                시간 배분의 기준이 된다.
//   기출 비중  — 태깅해 둔 실제 기출에서 그 단원이 나온 비율.
//                機械만 있다(denken_kikai_answers.tag_id). 나머지는 데이터가 없다.
//   내 정답률  — 맞음 ÷ 푼 문제.
//
// 그리고 「우선도 = 비중 × 오답률」. 비중이 커도 이미 맞히면 급하지 않고,
// 많이 틀려도 안 나오는 단원이면 뒤로 미뤄도 된다. 둘을 곱해야 순서가 나온다.

import { useState } from 'react'
import Link from 'next/link'
import {
  TEXTBOOK_SUBJECTS, TB_STATUS_META, type TextbookStatus, type TextbookSubject,
} from '@/lib/constants-textbook'
import { KIKAI_TAGS } from '@/lib/constants-denken-kikai'

export type ChapterProblem = { subject: string; chapter: string; status: TextbookStatus }
export type ExamTagCount = Map<number, number>

type Sort = 'weight' | 'priority' | 'order'

const SORTS: { key: Sort; label: string }[] = [
  { key: 'weight',   label: '교재 비중순' },
  { key: 'priority', label: '우선도순' },
  { key: 'order',    label: '교재 순서' },
]

/** 機械 단원 슬러그 → 기출 태그 id. 이름이 같은 것끼리 묶는다 */
const KIKAI_SLUG_BY_TAG = new Map<string, number>(
  KIKAI_TAGS.map(t => [t.ko, t.id])
)

interface Row {
  slug: string
  name: string
  accent: string
  count: number
  bookPct: number
  examPct: number | null
  correct: number
  wrong: number
  unsure: number
  untouched: number
  solved: number
  accuracy: number | null
  priority: number | null
}

function buildRows(
  subject: TextbookSubject,
  problems: ChapterProblem[],
  examTags: ExamTagCount | null,
): Row[] {
  const total = subject.chapters.reduce((a, c) => a + (c.end - c.start + 1), 0)
  const examTotal = examTags ? [...examTags.values()].reduce((a, n) => a + n, 0) : 0

  return subject.chapters.map(ch => {
    const count = ch.end - ch.start + 1
    const mine = problems.filter(p => p.subject === subject.slug && p.chapter === ch.slug)
    const tally = (st: TextbookStatus) => mine.filter(p => p.status === st).length
    const correct = tally('correct')
    const wrong = tally('wrong')
    const unsure = tally('unsure')
    const solved = correct + wrong + unsure
    const accuracy = solved > 0 ? correct / solved : null

    let examPct: number | null = null
    if (examTags && examTotal > 0) {
      const tagId = KIKAI_SLUG_BY_TAG.get(ch.name)
      if (tagId !== undefined) examPct = ((examTags.get(tagId) ?? 0) / examTotal) * 100
    }

    const bookPct = (count / total) * 100
    return {
      slug: ch.slug, name: ch.name, accent: ch.accent, count, bookPct, examPct,
      correct, wrong, unsure, untouched: count - solved, solved, accuracy,
      // 안 푼 단원은 오답률을 1로 본다 — 모르는 게 가장 위험하다
      priority: bookPct * (1 - (accuracy ?? 0)),
    }
  })
}

function Bar({ pct, color, muted }: { pct: number; color: string; muted?: boolean }) {
  return (
    <div className="h-1.5 bg-gray-900 rounded-full overflow-hidden w-full">
      <div className="h-full rounded-full transition-all"
        style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color, opacity: muted ? 0.45 : 1 }} />
    </div>
  )
}

export function RatioTab({ problems, examTags }: {
  problems: ChapterProblem[]
  examTags: ExamTagCount | null
}) {
  const [sort, setSort] = useState<Sort>('weight')

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {SORTS.map(s => (
          <button key={s.key} onClick={() => setSort(s.key)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition ${
              sort === s.key ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}>{s.label}</button>
        ))}
      </div>

      <p className="text-[11px] text-gray-500 leading-relaxed mb-5">
        <b className="text-gray-400">교재 비중</b>은 단원에 배정된 문제 수입니다 — 저자가 본 출제 비중의 대리값이지
        실제 회차 출제율은 아닙니다. <b className="text-gray-400">우선도</b>는 비중 × 오답률로,
        &quot;많이 나오는데 내가 못 맞히는&quot; 순서입니다. 안 푼 문제는 오답으로 셉니다.
      </p>

      {TEXTBOOK_SUBJECTS.map(subject => {
        const isKikai = subject.slug === 'kikai'
        const rows = buildRows(subject, problems, isKikai ? examTags : null)
        const sorted = [...rows].sort(
          sort === 'weight' ? (a, b) => b.bookPct - a.bookPct
          : sort === 'priority' ? (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
          : () => 0
        )
        const totalQ = rows.reduce((a, r) => a + r.count, 0)
        const hasExam = sorted.some(r => r.examPct !== null)

        return (
          <div key={subject.slug} className="mb-8">
            <div className="flex items-baseline gap-2 mb-3">
              <span className="text-lg">{subject.emoji}</span>
              <h2 className="text-base font-bold">{subject.name}</h2>
              <span className="text-[11px] text-gray-600">
                {totalQ}문제 · {rows.length}단원
              </span>
            </div>

            <div className="bg-gray-900/60 rounded-2xl p-3 space-y-2">
              {sorted.map(r => (
                <div key={r.slug} className="grid grid-cols-[9rem_1fr_auto] md:grid-cols-[10rem_1fr_1fr_auto] gap-3 items-center">
                  <Link href={`/dashboard/textbook/${subject.slug}/${r.slug}`}
                    className="min-w-0 group">
                    <p className="text-[12.5px] font-semibold truncate group-hover:text-blue-300 transition">
                      {r.name}
                    </p>
                    <p className="text-[10px] text-gray-600 tabular-nums">
                      {r.count}문제
                      {r.solved > 0 && <span className="text-gray-500"> · {r.solved}풀이</span>}
                    </p>
                  </Link>

                  {/* 교재 비중 (+ 기출 비중) */}
                  <div className="min-w-0">
                    <Bar pct={r.bookPct * 3} color={r.accent} />
                    <p className="text-[10px] text-gray-500 tabular-nums mt-0.5">
                      교재 {r.bookPct.toFixed(1)}%
                      {r.examPct !== null && (
                        <span className={Math.abs(r.examPct - r.bookPct) > 4 ? 'text-amber-400' : 'text-gray-600'}>
                          {' · '}기출 {r.examPct.toFixed(1)}%
                        </span>
                      )}
                    </p>
                    {r.examPct !== null && <Bar pct={r.examPct * 3} color={r.accent} muted />}
                  </div>

                  {/* 진도 · 정답률 */}
                  <div className="hidden md:block min-w-0">
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-900">
                      {(['correct', 'wrong', 'unsure', 'untouched'] as const).map(k => {
                        const n = r[k]
                        return n > 0
                          ? <div key={k} style={{ width: `${(n / r.count) * 100}%`, backgroundColor: TB_STATUS_META[k].dot }} />
                          : null
                      })}
                    </div>
                    <p className="text-[10px] text-gray-500 tabular-nums mt-0.5">
                      {r.accuracy !== null
                        ? <>정답률 <span className={r.accuracy >= 0.8 ? 'text-green-400' : r.accuracy >= 0.6 ? 'text-yellow-400' : 'text-red-400'}>
                            {Math.round(r.accuracy * 100)}%</span></>
                        : <span className="text-gray-700">미착수</span>}
                    </p>
                  </div>

                  <span className="text-right text-[11px] font-bold tabular-nums w-10"
                    style={{ color: r.priority && r.priority > 3 ? '#f59e0b' : '#4b5563' }}>
                    {r.priority !== null ? r.priority.toFixed(1) : '—'}
                  </span>
                </div>
              ))}
            </div>

            {hasExam && (
              <p className="text-[10px] text-gray-600 mt-2 leading-relaxed">
                기출 비중은 태깅해 둔 {subject.name} 기출 문항 기준입니다.
                교재 비중과 4%포인트 넘게 벌어지면 노랗게 표시됩니다.
              </p>
            )}
            {!hasExam && isKikai && (
              <p className="text-[10px] text-gray-600 mt-2">
                기출 태깅이 없어 교재 비중만 보입니다.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
