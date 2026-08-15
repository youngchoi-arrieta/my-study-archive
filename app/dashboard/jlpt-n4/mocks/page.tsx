'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Level, Area, AREAS, AREA_LABELS, AREA_JA, AREA_COLORS,
  LEVELS, levelSpec, MockRow, areaScore, hasSure, pct, corrected, verdict,
} from '@/lib/constants-jlpt-mocks'

// ───────────────────────────────────────────────────────────────
//  JLPT 모의고사 기록
//
//  「정답수」와 별개로 「확신 정답수」를 선택 입력할 수 있다.
//  4지선다는 완전히 찍어도 25%가 나오기 때문에, 특히 청해에서는
//  표면 정답률이 실력을 과대평가한다. 둘의 차이가 곧 찍맞이다.
// ───────────────────────────────────────────────────────────────

type Cell = { got: string; total: string; sure: string }
type Draft = { title: string; taken_on: string; nums: Record<Area, Cell> }

function emptyDraft(level: Level): Draft {
  const d = levelSpec(level).defaults
  return {
    title: '',
    taken_on: new Date().toISOString().slice(0, 10),
    nums: Object.fromEntries(
      AREAS.map(a => [a, { got: '', total: String(d[a]), sure: '' }]),
    ) as Record<Area, Cell>,
  }
}

function draftFrom(r: MockRow): Draft {
  return {
    title: r.title,
    taken_on: r.taken_on,
    nums: Object.fromEntries(AREAS.map(a => {
      const v = areaScore(r, a)
      return [a, { got: String(v.got), total: String(v.total), sure: v.sure === null ? '' : String(v.sure) }]
    })) as Record<Area, Cell>,
  }
}

export default function JlptMocksPage() {
  const [level, setLevel] = useState<Level>('n5')
  const [rows, setRows] = useState<MockRow[]>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(() => emptyDraft('n5'))
  const [showSure, setShowSure] = useState(false)
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
  useEffect(() => { closeForm() }, [level]) // eslint-disable-line react-hooks/exhaustive-deps

  const closeForm = () => {
    setFormOpen(false); setEditingId(null)
    setDraft(emptyDraft(level)); setShowSure(false)
  }
  const openAdd = () => {
    setDraft(emptyDraft(level)); setEditingId(null)
    setShowSure(false); setFormOpen(true)
  }
  const openEdit = (r: MockRow) => {
    setDraft(draftFrom(r)); setEditingId(r.id)
    setShowSure(hasSure(r)); setFormOpen(true)
  }

  // ── 요약 ──
  const summary = useMemo(() => {
    if (!rows.length) return null
    const avg = {} as Record<Area, number>
    const avgSure = {} as Record<Area, number | null>
    AREAS.forEach(a => {
      const vs = rows.map(r => areaScore(r, a))
      avg[a] = vs.reduce((x, v) => x + pct(v.got, v.total), 0) / vs.length
      const withSure = vs.filter(v => v.sure !== null)
      avgSure[a] = withSure.length
        ? withSure.reduce((x, v) => x + pct(v.sure!, v.total), 0) / withSure.length
        : null
    })
    const weakest = AREAS.reduce((w, a) => {
      const cur = avgSure[a] ?? avg[a], best = avgSure[w] ?? avg[w]
      return cur < best ? a : w
    }, AREAS[0])
    return { avg, avgSure, weakest, latest: verdict(rows[0], spec), anySure: rows.some(hasSure) }
  }, [rows, spec])

  // ── 저장 ──
  const cellBad = (c: Cell) => {
    const g = Number(c.got), t = Number(c.total), s = c.sure === '' ? null : Number(c.sure)
    if (c.got === '' || !(t > 0) || g < 0 || g > t) return true
    if (s !== null && (s < 0 || s > g)) return true
    return false
  }
  const canSave = draft.title.trim().length > 0 && AREAS.every(a => !cellBad(draft.nums[a]))

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    const payload: Record<string, unknown> = {
      level, title: draft.title.trim(), taken_on: draft.taken_on,
    }
    AREAS.forEach(a => {
      const c = draft.nums[a]
      payload[a] = Number(c.got)
      payload[`${a}_total`] = Number(c.total)
      payload[`${a}_sure`] = c.sure === '' ? null : Number(c.sure)
    })
    const { error } = editingId
      ? await supabase.from('jlpt_mocks')
        .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId)
      : await supabase.from('jlpt_mocks').insert(payload)
    setSaving(false)
    if (!error) { closeForm(); fetchRows() }
  }

  const remove = async (id: string, title: string) => {
    if (!confirm(`"${title}" 기록을 지울까요?`)) return
    await supabase.from('jlpt_mocks').delete().eq('id', id)
    if (editingId === id) closeForm()
    fetchRows()
  }

  const setNum = (a: Area, k: keyof Cell, v: string) =>
    setDraft(d => ({ ...d, nums: { ...d.nums, [a]: { ...d.nums[a], [k]: v.replace(/\D/g, '') } } }))

  // ── 영역 막대 ──
  const AreaBar = ({ a, got, total, sure, wide }: {
    a: Area; got: number; total: number; sure: number | null; wide?: boolean
  }) => {
    const p = pct(got, total)
    const ps = sure === null ? null : pct(sure, total)
    return (
      <div className="flex items-center gap-2">
        <span className={`${wide ? 'w-16 text-[11px]' : 'w-14 text-[10px]'} shrink-0 ${
          summary?.weakest === a ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
          {AREA_LABELS[a]}
        </span>
        <div className={`flex-1 ${wide ? 'h-2' : 'h-1.5'} bg-gray-800 rounded-full overflow-hidden relative`}>
          <div className="absolute inset-y-0 left-0 rounded-full"
            style={{ width: `${p}%`, backgroundColor: AREA_COLORS[a], opacity: ps === null ? 1 : 0.32 }} />
          {ps !== null && (
            <div className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${ps}%`, backgroundColor: AREA_COLORS[a] }} />
          )}
        </div>
        <span className={`${wide ? 'w-24' : 'w-24'} text-right text-[10px] shrink-0`}>
          <span className="text-gray-400">{total > 0 ? `${got}/${total}` : '—'} · {Math.round(p)}%</span>
          {ps !== null && <span className="text-gray-600"> ({Math.round(ps)}%)</span>}
        </span>
      </div>
    )
  }

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
              {AREAS.map(a => {
                const p = summary.avg[a], ps = summary.avgSure[a]
                return (
                  <div key={a} className="flex items-center gap-3">
                    <span className={`w-16 text-[11px] shrink-0 ${a === summary.weakest ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                      {AREA_LABELS[a]}
                    </span>
                    <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden relative">
                      <div className="absolute inset-y-0 left-0 rounded-full"
                        style={{ width: `${p}%`, backgroundColor: AREA_COLORS[a], opacity: ps === null ? 1 : 0.32 }} />
                      {ps !== null && (
                        <div className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${ps}%`, backgroundColor: AREA_COLORS[a] }} />
                      )}
                    </div>
                    <span className="w-20 text-right text-[11px] shrink-0">
                      <span className="text-gray-400">{Math.round(p)}%</span>
                      {ps !== null && <span className="text-gray-600"> ({Math.round(ps)}%)</span>}
                    </span>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] text-gray-600 mt-3 leading-relaxed">
              가장 약한 영역은 <span className="text-red-400 font-bold">{AREA_JA[summary.weakest]}</span>.
              합격선 {spec.passTotal}/180 · 각 구분 기준점을 하나라도 못 넘으면 총점과 무관하게 불합격입니다.
              {summary.anySure
                ? ' 진한 막대와 괄호 안 숫자가 찍맞을 뺀 확신 정답률입니다.'
                : ` 참고로 완전히 찍어도 문자·어휘/문법/독해는 25%, 청해는 약 29%가 나옵니다 — 지금 청해 ${Math.round(summary.avg.choukai)}%는 우연 보정하면 ${Math.round(corrected(summary.avg.choukai, 'choukai'))}% 수준입니다.`}
            </p>
          </div>
        )}

        {/* 폼 */}
        {!formOpen ? (
          <button onClick={openAdd}
            className="w-full border border-dashed border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-xl py-3.5 text-sm font-semibold transition mb-5">
            + {spec.label} 채점 결과 추가
          </button>
        ) : (
          <div className="bg-gray-900 rounded-2xl p-5 mb-5 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
              {editingId ? '기록 수정' : `${spec.label} 채점 결과 추가`}
            </p>

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

            <button onClick={() => setShowSure(v => !v)}
              className={`w-full rounded-lg px-3 py-2 mb-3 text-left transition border ${
                showSure ? 'bg-gray-950 border-gray-700' : 'bg-gray-950/50 border-gray-800 hover:border-gray-700'
              }`}>
              <span className="text-xs font-bold">{showSure ? '✓ ' : '+ '}확신 정답수도 입력</span>
              <span className="text-[10px] text-gray-600 block mt-0.5">
                찍어서 맞은 걸 빼고 실력만 보고 싶을 때. 비워두면 그냥 무시됩니다.
              </span>
            </button>

            <div className="space-y-2 mb-4">
              <div className={`grid ${showSure ? 'grid-cols-[1fr_auto_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto_auto]'} gap-2 text-[10px] text-gray-600 font-bold px-1`}>
                <span>영역</span>
                <span className="w-14 text-center">정답</span>
                {showSure && <span className="w-14 text-center text-amber-600">확신</span>}
                <span className="w-14 text-center">문항</span>
                <span className="w-10 text-right">%</span>
              </div>
              {AREAS.map(a => {
                const c = draft.nums[a]
                const g = Number(c.got || 0), t = Number(c.total || 0)
                const bad = c.got !== '' && cellBad(c)
                const sureBad = c.sure !== '' && Number(c.sure) > g
                return (
                  <div key={a} className={`grid ${showSure ? 'grid-cols-[1fr_auto_auto_auto_auto]' : 'grid-cols-[1fr_auto_auto_auto]'} gap-2 items-center`}>
                    <span className="text-xs truncate" style={{ color: AREA_COLORS[a] }}>
                      {AREA_LABELS[a]} <span className="text-gray-600">{AREA_JA[a]}</span>
                    </span>
                    <input inputMode="numeric" value={c.got} placeholder="0"
                      onChange={e => setNum(a, 'got', e.target.value)}
                      className={`w-14 bg-gray-950 border rounded-lg px-2 py-1.5 text-sm text-center outline-none transition ${bad && !sureBad ? 'border-red-800' : 'border-gray-800 focus:border-gray-600'}`} />
                    {showSure && (
                      <input inputMode="numeric" value={c.sure} placeholder="—"
                        onChange={e => setNum(a, 'sure', e.target.value)}
                        className={`w-14 bg-gray-950 border rounded-lg px-2 py-1.5 text-sm text-center outline-none transition text-amber-300 ${sureBad ? 'border-red-800' : 'border-gray-800 focus:border-gray-600'}`} />
                    )}
                    <input inputMode="numeric" value={c.total}
                      onChange={e => setNum(a, 'total', e.target.value)}
                      className="w-14 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-sm text-center outline-none transition text-gray-400" />
                    <span className="w-10 text-right text-xs text-gray-500">
                      {t > 0 && c.got !== '' ? `${Math.round(pct(g, t))}%` : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            <div className="flex gap-2">
              <button onClick={closeForm}
                className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition">
                취소
              </button>
              <button onClick={save} disabled={!canSave || saving}
                className="flex-1 py-2.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-sm font-bold transition">
                {saving ? '저장 중...' : editingId ? '수정 저장' : '저장'}
              </button>
            </div>
          </div>
        )}

        {/* 기록 */}
        {loading ? (
          <p className="text-gray-500 text-sm">불러오는 중...</p>
        ) : rows.length === 0 ? (
          <p className="text-gray-600 text-sm text-center py-10">아직 {spec.label} 기록이 없어요.</p>
        ) : (
          <div className="space-y-3">
            {rows.map(r => {
              const v = verdict(r, spec)
              const vs = hasSure(r) ? verdict(r, spec, true) : null
              return (
                <div key={r.id}
                  className={`bg-gray-900 rounded-2xl p-5 transition ${editingId === r.id ? 'ring-1 ring-blue-700' : ''}`}>
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
                      <button onClick={() => openEdit(r)}
                        className="text-gray-600 hover:text-blue-400 text-xs transition">✎</button>
                      <button onClick={() => remove(r.id, r.title)}
                        className="text-gray-700 hover:text-red-400 text-xs transition">✕</button>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {AREAS.map(a => {
                      const { got, total, sure } = areaScore(r, a)
                      return <AreaBar key={a} a={a} got={got} total={total} sure={sure} />
                    })}
                  </div>

                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-3 border-t border-gray-800">
                    {v.secs.map(s => (
                      <div key={s.label} className="flex items-baseline gap-1.5">
                        <span className="text-[10px] text-gray-600">{s.label}</span>
                        <span className={`text-xs font-bold ${s.passed ? 'text-gray-200' : 'text-red-400'}`}>{s.score}</span>
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

                  {vs && (
                    <div className="flex items-baseline justify-between mt-2 pt-2 border-t border-gray-800">
                      <span className="text-[10px] text-amber-600/80">찍맞 제외 (확신 정답만)</span>
                      <span className="text-[11px]">
                        <span className={`font-bold ${vs.total >= spec.passTotal ? 'text-green-400' : 'text-amber-500'}`}>
                          {vs.total}
                        </span>
                        <span className="text-gray-700">/180 · 차이 {v.total - vs.total}점</span>
                      </span>
                    </div>
                  )}
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
