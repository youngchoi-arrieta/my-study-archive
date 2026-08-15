'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Level, Area, AREAS, AREA_LABELS, AREA_JA, AREA_COLORS,
  LEVELS, levelSpec, MockRow, areaScore, pct, verdict,
} from '@/lib/constants-jlpt-mocks'

// ───────────────────────────────────────────────────────────────
//  JLPT 모의고사 기록
//  시험지도 메모도 없이 채점 결과만. 영역별 정답률과 得点区分
//  기준점 통과 여부만 보이면 되는 화면.
// ───────────────────────────────────────────────────────────────

type Draft = {
  title: string
  taken_on: string
  nums: Record<Area, { got: string; total: string }>
}

function emptyDraft(level: Level): Draft {
  const d = levelSpec(level).defaults
  return {
    title: '',
    taken_on: new Date().toISOString().slice(0, 10),
    nums: Object.fromEntries(
      AREAS.map(a => [a, { got: '', total: String(d[a]) }]),
    ) as Draft['nums'],
  }
}

export default function JlptMocksPage() {
  const [level, setLevel] = useState<Level>('n5')
  const [rows, setRows] = useState<MockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft('n5'))
  const [saving, setSaving] = useState(false)

  const spec = levelSpec(level)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('jlpt_mocks').select('*')
      .eq('level', level)
      .order('taken_on', { ascending: false })
      .order('created_at', { ascending: false })
    setRows((data as MockRow[]) || [])
    setLoading(false)
  }, [level])

  useEffect(() => { fetchRows() }, [fetchRows])
  useEffect(() => { setDraft(emptyDraft(level)); setAdding(false) }, [level])

  // ── 요약 ──
  const summary = useMemo(() => {
    if (!rows.length) return null
    const avg = Object.fromEntries(AREAS.map(a => {
      const vals = rows.map(r => pct(areaScore(r, a).got, areaScore(r, a).total))
      return [a, vals.reduce((x, y) => x + y, 0) / vals.length]
    })) as Record<Area, number>
    const weakest = AREAS.reduce((w, a) => (avg[a] < avg[w] ? a : w), AREAS[0])
    const latest = verdict(rows[0], spec)
    return { avg, weakest, latest }
  }, [rows, spec])

  // ── 저장 ──
  const canSave = draft.title.trim().length > 0
    && AREAS.every(a => {
      const g = Number(draft.nums[a].got), t = Number(draft.nums[a].total)
      return draft.nums[a].got !== '' && t > 0 && g >= 0 && g <= t
    })

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const payload: Record<string, unknown> = {
      level, title: draft.title.trim(), taken_on: draft.taken_on,
    }
    AREAS.forEach(a => {
      payload[a] = Number(draft.nums[a].got)
      payload[`${a}_total`] = Number(draft.nums[a].total)
    })
    const { error } = await supabase.from('jlpt_mocks').insert(payload)
    setSaving(false)
    if (!error) { setDraft(emptyDraft(level)); setAdding(false); fetchRows() }
  }

  const remove = async (id: string, title: string) => {
    if (!confirm(`"${title}" 기록을 지울까요?`)) return
    await supabase.from('jlpt_mocks').delete().eq('id', id)
    fetchRows()
  }

  const setNum = (a: Area, k: 'got' | 'total', v: string) =>
    setDraft(d => ({ ...d, nums: { ...d.nums, [a]: { ...d.nums[a], [k]: v.replace(/\D/g, '') } } }))

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-2xl mx-auto">

        <div className="mb-4">
          <Link href="/dashboard/jlpt-n4" className="text-gray-400 hover:text-white text-sm">← JLPT</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">📊</span>
          <h1 className="text-2xl font-bold">모의고사 기록</h1>
        </div>
        <p className="text-gray-500 text-sm mb-5">채점 결과만 남기는 곳 · 영역별 정답률과 기준점 통과 여부</p>

        {/* 레벨 */}
        <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-5">
          {LEVELS.map(l => (
            <button key={l.level} onClick={() => setLevel(l.level)}
              className={`flex-1 py-2 rounded-lg text-sm font-bold transition ${
                level === l.level ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}>
              {l.label}
            </button>
          ))}
        </div>

        {/* 요약 */}
        {summary && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-4">
            <div className="flex items-baseline justify-between mb-4">
              <span className="text-xs text-gray-500 uppercase tracking-widest">
                {spec.label} · {rows.length}회 · 평균 정답률
              </span>
              <span className={`text-sm font-bold ${summary.latest.passed ? 'text-green-400' : 'text-amber-400'}`}>
                최근 {summary.latest.total} / 180
              </span>
            </div>
            <div className="space-y-2.5">
              {AREAS.map(a => (
                <div key={a} className="flex items-center gap-3">
                  <span className={`w-16 text-[11px] shrink-0 ${a === summary.weakest ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                    {AREA_LABELS[a]}
                  </span>
                  <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${summary.avg[a]}%`, backgroundColor: AREA_COLORS[a] }} />
                  </div>
                  <span className="w-10 text-right text-[11px] text-gray-400 shrink-0">
                    {Math.round(summary.avg[a])}%
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-600 mt-3">
              가장 약한 영역은 <span className="text-red-400 font-bold">{AREA_JA[summary.weakest]}</span>.
              합격선 {spec.passTotal}/180 · 각 구분 기준점을 하나라도 못 넘으면 총점과 무관하게 불합격입니다.
            </p>
          </div>
        )}

        {/* 추가 */}
        {!adding ? (
          <button onClick={() => setAdding(true)}
            className="w-full border border-dashed border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-xl py-3.5 text-sm font-semibold transition mb-5">
            + {spec.label} 채점 결과 추가
          </button>
        ) : (
          <div className="bg-gray-900 rounded-2xl p-5 mb-5">
            <div className="flex gap-2 mb-4">
              <input
                value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="교재명 + 회차 (예: 해커스 N5 1회)"
                className="flex-1 min-w-0 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-gray-700"
              />
              <input
                type="date" value={draft.taken_on}
                onChange={e => setDraft(d => ({ ...d, taken_on: e.target.value }))}
                className="bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-2 text-sm outline-none transition shrink-0"
              />
            </div>

            <div className="space-y-2 mb-4">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 text-[10px] text-gray-600 font-bold px-1">
                <span>영역</span><span className="w-14 text-center">정답</span>
                <span className="w-14 text-center">문항</span><span className="w-10 text-right">%</span>
              </div>
              {AREAS.map(a => {
                const g = Number(draft.nums[a].got || 0), t = Number(draft.nums[a].total || 0)
                const bad = draft.nums[a].got !== '' && (t === 0 || g > t)
                return (
                  <div key={a} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
                    <span className="text-xs" style={{ color: AREA_COLORS[a] }}>
                      {AREA_LABELS[a]} <span className="text-gray-600">{AREA_JA[a]}</span>
                    </span>
                    <input
                      inputMode="numeric" value={draft.nums[a].got}
                      onChange={e => setNum(a, 'got', e.target.value)} placeholder="0"
                      className={`w-14 bg-gray-950 border rounded-lg px-2 py-1.5 text-sm text-center outline-none transition ${bad ? 'border-red-800' : 'border-gray-800 focus:border-gray-600'}`}
                    />
                    <input
                      inputMode="numeric" value={draft.nums[a].total}
                      onChange={e => setNum(a, 'total', e.target.value)}
                      className="w-14 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center outline-none transition text-gray-400"
                    />
                    <span className="w-10 text-right text-xs text-gray-500">
                      {t > 0 && draft.nums[a].got !== '' ? `${Math.round(pct(g, t))}%` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setAdding(false); setDraft(emptyDraft(level)) }}
                className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition">
                취소
              </button>
              <button onClick={save} disabled={!canSave || saving}
                className="flex-1 py-2.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-sm font-bold transition">
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {/* 기록 */}
        {loading ? (
          <p className="text-gray-500 text-sm">불러오는 중...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-10">
            아직 {spec.label} 기록이 없어요.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map(r => {
              const v = verdict(r, spec)
              return (
                <div key={r.id} className="bg-gray-900 rounded-2xl p-5">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{r.title}</p>
                      <p className="text-[11px] text-gray-600 mt-0.5">{r.taken_on}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${
                        v.passed ? 'bg-green-900/60 text-green-300'
                          : !v.allMin ? 'bg-red-900/60 text-red-300'
                            : 'bg-amber-900/60 text-amber-300'
                      }`}>
                        {v.passed ? '합격권' : !v.allMin ? '기준점 미달' : '총점 부족'}
                      </span>
                      <button onClick={() => remove(r.id, r.title)}
                        className="text-gray-700 hover:text-red-400 text-xs transition">✕</button>
                    </div>
                  </div>

                  {/* 영역별 */}
                  <div className="space-y-1.5 mb-3">
                    {AREAS.map(a => {
                      const { got, total } = areaScore(r, a)
                      const p = pct(got, total)
                      return (
                        <div key={a} className="flex items-center gap-2">
                          <span className="w-14 text-[10px] text-gray-500 shrink-0">{AREA_LABELS[a]}</span>
                          <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${p}%`, backgroundColor: AREA_COLORS[a] }} />
                          </div>
                          <span className="w-16 text-right text-[10px] text-gray-500 shrink-0">
                            {got}/{total} · {Math.round(p)}%
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* 得点区分 */}
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-800">
                    {v.secs.map(s => (
                      <div key={s.label} className="flex items-baseline gap-1.5">
                        <span className="text-[10px] text-gray-600">{s.label}</span>
                        <span className={`text-xs font-bold ${s.passed ? 'text-gray-200' : 'text-red-400'}`}>
                          {s.score}
                        </span>
                        <span className="text-[10px] text-gray-700">/{s.max}</span>
                        {!s.passed && <span className="text-[9px] text-red-500">기준 {s.min}</span>}
                      </div>
                    ))}
                    <div className="ml-auto flex items-baseline gap-1">
                      <span className="text-[10px] text-gray-600">합계</span>
                      <span className={`text-sm font-bold ${v.total >= spec.passTotal ? 'text-green-400' : 'text-amber-400'}`}>
                        {v.total}
                      </span>
                      <span className="text-[10px] text-gray-700">/180 (합격 {spec.passTotal})</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-[10px] text-gray-700 mt-6 leading-relaxed">
          실제 JLPT는 원점수가 아니라 등화 처리된 尺度得点으로 채점됩니다.
          여기 180점 환산은 정답률 × 배점의 추정치라 실제 성적표와는 어긋날 수 있어요.
          회차 간 추이를 보는 용도로 쓰세요.
        </p>

      </div>
    </main>
  )
}
