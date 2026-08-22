'use client'

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Company } from '@/lib/constants-koreapub'
import {
  NcsAreaKey, NcsRow, ExtraSubject, NCS_AREAS, ALL_AREA_KEYS,
  emptyNcsRow, isOn, pickedAreas, areaFrequency,
  ncsQuestions, totalQuestions, totalMinutes, secondsPerQuestion, paceTone,
  ncsLabel, majorLabel, NCS_LABEL_DEFAULT, MAJOR_LABEL_DEFAULT,
  subjectWeights, weightDiverges,
} from '@/lib/constants-koreapub-ncs'
import { presetFor, applyPreset as presetToRow, isUnverified } from '@/lib/constants-koreapub-presets'

// ───────────────────────────────────────────────────────────────
//  필기 한눈에
//    ① 매트릭스  지원 기업 × NCS 10영역 — 어디가 뭘 내는지 한 장
//    ② 시험시간  NCS+전공 문항수·시간·문항당 초
//
//  전부 손으로 넣는다. 공고를 열어보고 그 자리에서 칠하는 화면이지,
//  어딘가에서 긁어온 값을 보여주는 화면이 아니다.
// ───────────────────────────────────────────────────────────────

type Scope = 'target' | 'all'

export default function WrittenTab({ companies, rows, onSaved }: {
  companies: Company[]; rows: NcsRow[]; onSaved: () => void
}) {
  const [edit, setEdit] = useState(false)
  const [scope, setScope] = useState<Scope>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [local, setLocal] = useState<Record<string, NcsRow>>({})
  const [err, setErr] = useState<string | null>(null)

  // 서버 값이 새로 오면 로컬 덮어쓰기를 버린다 (저장이 끝난 뒤라 안전)
  useEffect(() => { setLocal({}) }, [rows])

  // 저장된 행이 없으면 조사표 프리셋을 기본값으로 쓴다.
  // DB에 쓰지는 않는다 — 화면에만 채워두고, 공고 보고 고쳐서 저장하면 그때 행이 생긴다.
  // 프리셋에서 온 값은 memo 의 ⚠ 표시로 구분된다.
  const presetRow = (id: string): NcsRow | null => {
    const c = companies.find(x => x.id === id)
    const p = presetFor(id, c?.name)
    return p ? presetToRow(id, p) : null
  }

  const rowOf = (id: string): NcsRow =>
    local[id] ?? rows.find(r => r.company_id === id) ?? presetRow(id) ?? emptyNcsRow(id)

  const shown = useMemo(
    () => (scope === 'target' ? companies.filter(c => c.target) : companies),
    [companies, scope]
  )

  // ── 저장 ──────────────────────────────────────────────────────
  const write = async (row: NcsRow) => {
    setLocal(p => ({ ...p, [row.company_id]: row }))
    const { error } = await supabase.from('kp_ncs').upsert({
      ...row, updated_at: new Date().toISOString(),
    })
    if (error) { setErr(error.message); return }
    setErr(null)
  }

  const toggle = (id: string, k: NcsAreaKey) => {
    const r = rowOf(id)
    const cur = r.areas[k]
    const areas = { ...r.areas }
    if (cur?.on) delete areas[k]
    else areas[k] = { on: true, q: cur?.q ?? null }
    write({ ...r, areas })
  }

  const copyFrom = (to: string, from: string) => {
    const src = rowOf(from)
    write({ ...rowOf(to), areas: JSON.parse(JSON.stringify(src.areas)) })
  }

  const freq = useMemo(() => areaFrequency(shown.map(c => rowOf(c.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, rows, local])

  const maxFreq = Math.max(1, ...ALL_AREA_KEYS.map(k => freq[k]))

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold">
          🧩 NCS 영역 매트릭스
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex gap-0.5 bg-gray-900 rounded-lg p-0.5">
            {([['target', '주 타깃'], ['all', '전체']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setScope(k)}
                className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                  scope === k ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-400'
                }`}>{l}</button>
            ))}
          </div>
          <button onClick={() => setEdit(v => !v)}
            className={`text-[10px] px-2.5 py-1.5 rounded-lg font-bold transition ${
              edit ? 'bg-blue-600 text-white' : 'bg-gray-900 text-gray-500 hover:text-gray-300'
            }`}>
            {edit ? '편집 완료' : '✎ 편집'}
          </button>
        </div>
      </div>

      {err && (
        <div className="bg-red-950/50 border border-red-900 rounded-xl p-4 mb-4">
          <p className="text-sm font-bold text-red-300 mb-1">저장하지 못했습니다</p>
          <p className="text-[11px] text-red-200/70 leading-relaxed">
            supabase/koreapub_ncs_books_migration.sql 의 <span className="font-mono">kp_ncs</span> 를
            실행했는지 확인하세요.
            <br /><span className="text-red-400/60">{err}</span>
          </p>
        </div>
      )}

      {shown.length === 0 ? (
        <p className="text-gray-600 text-sm py-8 text-center">표시할 기업이 없습니다.</p>
      ) : (
        <>
          {/* ── 매트릭스 ── */}
          <div className="bg-gray-900 rounded-2xl overflow-hidden mb-2">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-gray-900 text-left px-3 py-2 min-w-[104px]">
                      <span className="text-[10px] text-gray-600 font-semibold uppercase tracking-widest">기업</span>
                    </th>
                    {NCS_AREAS.map(a => (
                      <th key={a.key} title={a.label}
                        className={`px-1 py-2 w-[42px] text-[9px] font-bold leading-tight ${
                          a.core ? 'text-gray-300' : 'text-gray-600'
                        }`}>
                        {a.head[0]}<br />{a.head[1] || '\u00A0'}
                      </th>
                    ))}
                    <th className="px-2 py-2 text-[9px] text-gray-600 font-bold">계</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(c => {
                    const r = rowOf(c.id)
                    const n = pickedAreas(r).length
                    return (
                      <tr key={c.id} className="border-t border-gray-800/70">
                        <td className="sticky left-0 z-10 bg-gray-900 px-3 py-2">
                          <button onClick={() => setOpenId(openId === c.id ? null : c.id)}
                            className="text-left group">
                            <span className={`text-[11px] font-bold leading-tight block truncate max-w-[92px] ${
                              c.target ? 'text-white' : 'text-gray-500'
                            }`}>{c.short || c.name}</span>
                            <span className="text-[9px] text-gray-700 group-hover:text-blue-400 transition">
                              {openId === c.id ? '닫기 ▲' : '자세히 ▼'}
                            </span>
                          </button>
                        </td>
                        {NCS_AREAS.map(a => {
                          const on = isOn(r, a.key)
                          return (
                            <td key={a.key} className="px-1 py-2 text-center">
                              <button
                                disabled={!edit}
                                onClick={() => toggle(c.id, a.key)}
                                className={`w-full h-7 rounded-md text-[10px] font-bold tabular-nums transition ${
                                  on
                                    ? a.core ? 'bg-blue-600/80 text-white' : 'bg-blue-800/60 text-blue-200'
                                    : edit ? 'bg-gray-950 text-gray-800 hover:bg-gray-800' : 'text-gray-800'
                                }`}>
                                {on ? '●' : '·'}
                              </button>
                            </td>
                          )
                        })}
                        <td className="px-2 py-2 text-center">
                          <span className={`text-[11px] font-bold tabular-nums ${n ? 'text-gray-300' : 'text-gray-700'}`}>
                            {n || '—'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}

                  {/* 빈도 — 어느 영역이 가장 자주 나오는가 */}
                  <tr className="border-t border-gray-700 bg-gray-950/60">
                    <td className="sticky left-0 z-10 bg-gray-950 px-3 py-2">
                      <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">빈도</span>
                    </td>
                    {NCS_AREAS.map(a => (
                      <td key={a.key} className="px-1 py-2 text-center">
                        <div className="h-6 flex items-end justify-center">
                          <div className="w-4 rounded-t-sm bg-blue-700/70"
                            style={{ height: `${(freq[a.key] / maxFreq) * 100}%` }} />
                        </div>
                        <span className={`text-[9px] tabular-nums ${freq[a.key] ? 'text-gray-400' : 'text-gray-800'}`}>
                          {freq[a.key] || ''}
                        </span>
                      </td>
                    ))}
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[10px] text-gray-700 leading-relaxed mb-6">
            {edit
              ? '칸을 눌러 켜고 끕니다. 기업 이름 아래 「자세히」에서 과목별 문항수와 시험시간을 넣으세요.'
              : '맨 아래 막대는 지금 목록에서 그 영역을 내는 기업 수입니다 — 높은 쪽이 먼저 볼 영역.'}
            {' '}칸 안 숫자는 그 영역의 문항수(넣었을 때만).
          </p>

          {/* ── 기업별 상세 ── */}
          {openId && (
            <CompanyPanel
              key={openId}
              c={shown.find(x => x.id === openId)!}
              row={rowOf(openId)}
              others={shown.filter(x => x.id !== openId)}
              onWrite={write}
              onCopy={from => copyFrom(openId, from)}
              onClose={() => setOpenId(null)}
              onSaved={onSaved}
            />
          )}

          {/* ── 시험시간 ── */}
          <p className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3 mt-6">
            ⏱ 필기 시험시간
          </p>
          <div className="space-y-2">
            {shown.map(c => (
              <TimeRow key={c.id} c={c} row={rowOf(c.id)}
                onOpen={() => setOpenId(openId === c.id ? null : c.id)} />
            ))}
          </div>
          <p className="text-[10px] text-gray-700 leading-relaxed mt-3">
            문항당 초 = 총 시간 ÷ 총 문항. 50초 미만이면 사실상 속도 시험이라
            <span className="text-red-400"> 빨강</span>,
            65초를 넘으면 <span className="text-green-400">초록</span>으로 칠합니다.
          </p>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  기업별 상세 — 영역 문항수 · 시험시간
// ═══════════════════════════════════════════════════════════════
function CompanyPanel({ c, row, others, onWrite, onCopy, onClose, onSaved }: {
  c: Company; row: NcsRow; others: Company[]
  onWrite: (r: NcsRow) => void
  onCopy: (fromId: string) => void
  onClose: () => void
  onSaved: () => void
}) {
  const [d, setD] = useState<NcsRow>(row)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setD(row) }, [row])

  const num = (v: string) => { const n = Number(v.replace(/\D/g, '')); return n > 0 ? n : null }
  const set = (p: Partial<NcsRow>) => setD(x => ({ ...x, ...p }))
  const toggleArea = (k: NcsAreaKey) => setD(x => {
    const areas = { ...x.areas }
    if (areas[k]?.on) delete areas[k]
    else areas[k] = { on: true, q: null }
    return { ...x, areas }
  })
  const setExtra = (i: number, patch: Partial<ExtraSubject>) =>
    setD(x => ({ ...x, extras: x.extras.map((e, k) => k === i ? { ...e, ...patch } : e) }))

  const save = async () => {
    setSaving(true)
    await onWrite(d)
    setSaving(false)
    onSaved()
  }

  const weights = subjectWeights(d)
  const ratioSum = (d.ncs_score ?? 0) + (d.major_score ?? 0) + d.extras.reduce((a, e) => a + (e.score ?? 0), 0)
  const inp = 'w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-xs text-center outline-none transition tabular-nums'
  const lab = 'text-[11px] text-gray-400 mb-1.5 block font-medium'

  return (
    <div className="bg-gray-900 rounded-2xl p-5 mb-6 border border-blue-900/60">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{c.name}</p>
          <p className="text-[11px] text-gray-600">{c.sector || '분야 미입력'}</p>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white text-xs shrink-0">닫기 ✕</button>
      </div>

      {isUnverified(d) && (
        <p className="text-[11px] text-amber-300/90 bg-amber-950/30 border border-amber-900/40 rounded-lg px-3 py-2 mb-4 leading-relaxed">
          ⚠ 조사표에서 미리 채운 값입니다. 공고와 대조해 고친 뒤 저장하고,
          맨 아래 메모의 <span className="font-mono">⚠</span> 문구를 지우면 이 표시가 사라집니다.
        </p>
      )}

      {/* 다른 기업에서 복사 — 계열사처럼 시험이 같은 곳끼리는 쓸모가 있다.
          「3영역/5영역/6영역」 같은 개수 프리셋은 뺐다. 같은 6영역이어도
          어느 6개인지가 기업마다 달라서, 개수만 맞춰봐야 결국 다시 고쳐야 한다. */}
      {others.length > 0 && (
        <div className="mb-5">
          <p className={lab}>다른 기업에서 영역 복사</p>
          <select defaultValue="" onChange={e => { if (e.target.value) { onCopy(e.target.value); e.target.value = '' } }}
            className="text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-2.5 py-1.5 outline-none transition">
            <option value="">기업 선택…</option>
            {others.map(o => <option key={o.id} value={o.id}>{o.short || o.name}</option>)}
          </select>
        </div>
      )}

      {/* 출제 영역 — 눌러서 켜고 끈다.
          영역별 문항수 칸은 없앴다. PSAT형·피듈형은 공고가 영역별 문항수를
          아예 안 밝히고, 안다 해도 결국 전 영역을 다 공부해야 해서
          빈칸만 남는 자리였다. 여기서 필요한 건 "무엇이 나오는가"뿐이다. */}
      <p className={lab}>출제 영역 <span className="text-gray-500">공고에 적힌 것만 켜세요</span></p>
      <div className="flex flex-wrap gap-1.5 mb-5">
        {NCS_AREAS.map(a => {
          const on = !!d.areas[a.key]?.on
          return (
            <button key={a.key} onClick={() => toggleArea(a.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                on
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-950 border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700'
              }`}>
              {a.short}
            </button>
          )
        })}
      </div>

      {/* 과목별 문항 · 시간 */}
      {/* 과목 이름은 기업마다 다르다 — 한전은 「직무능력검사」, 코레일은
          「직업기초능력평가」. 그래서 이름 칸도 전부 고칠 수 있게 열어둔다. */}
      <p className={lab}>
        과목별 <span className="text-gray-500">이름 · 문항 · 분 · 반영비율</span>
      </p>
      <div className="space-y-2 mb-2">
        <PartRow color="#60a5fa"
          label={d.ncs_label ?? ''} labelPlaceholder={NCS_LABEL_DEFAULT}
          onLabel={v => set({ ncs_label: v || null })}
          q={d.ncs_q} min={d.ncs_min} score={d.ncs_score}
          qPlaceholder={ncsQuestions(d) !== null && d.ncs_q === null ? String(ncsQuestions(d)) : '—'}
          onQ={v => set({ ncs_q: num(v) })} onMin={v => set({ ncs_min: num(v) })}
          onScore={v => set({ ncs_score: num(v) })} />
        <PartRow color="#34d399"
          label={d.major_label ?? ''} labelPlaceholder={MAJOR_LABEL_DEFAULT}
          onLabel={v => set({ major_label: v || null })}
          q={d.major_q} min={d.major_min} score={d.major_score}
          onQ={v => set({ major_q: num(v) })} onMin={v => set({ major_min: num(v) })}
          onScore={v => set({ major_score: num(v) })} />

        {d.extras.map((ex, i) => (
          <PartRow key={i} color="#fbbf24"
            label={ex.label} labelPlaceholder="추가 과목 (예: 한국사, 철도관련법령)"
            onLabel={v => setExtra(i, { label: v })}
            q={ex.q} min={ex.min} score={ex.score}
            onQ={v => setExtra(i, { q: num(v) })} onMin={v => setExtra(i, { min: num(v) })}
            onScore={v => setExtra(i, { score: num(v) })}
            onRemove={() => set({ extras: d.extras.filter((_, k) => k !== i) })} />
        ))}
      </div>
      <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
        반영비율은 공고에 적힌 대로 넣으세요 — <span className="text-gray-400">40 / 60</span> 처럼 %로 넣어도 되고,
        <span className="text-gray-400"> 100 / 50</span> 처럼 배점 그대로 넣어도 알아서 비율로 환산합니다.
        {ratioSum > 0 && <span className="text-gray-400"> (지금 합계 {ratioSum})</span>}
      </p>

      <button onClick={() => set({ extras: [...d.extras, { label: '', q: null, min: null, score: null }] })}
        className="text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg px-3 py-1.5 mb-4 transition">
        + 과목 추가
      </button>

      {/* 통합 시간 */}
      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input type="checkbox" checked={d.combined}
          onChange={e => set({ combined: e.target.checked })}
          className="accent-blue-600" />
        <span className="text-[11px] text-gray-400">NCS와 전공을 한 교시에 통합해서 본다</span>
      </label>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <span className={lab}>총 시간(분) <span className="text-gray-500">직접 지정</span></span>
          <input inputMode="numeric" placeholder={String(totalMinutes(d) ?? '—')} className={inp}
            value={d.total_min ?? ''} onChange={e => set({ total_min: num(e.target.value) })} />
        </div>
        <div>
          <span className={lab}>과락</span>
          <input value={d.cutoff ?? ''} placeholder="예: 각 과목 40% 미만"
            onChange={e => set({ cutoff: e.target.value || null })}
            className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-xs outline-none transition placeholder:text-gray-700" />
        </div>
      </div>

      <span className={lab}>메모 <span className="text-gray-700">회차·공고 출처</span></span>
      <input value={d.memo ?? ''} placeholder="예: 2026 하반기 공고 p.4"
        onChange={e => set({ memo: e.target.value || null })}
        className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-xs outline-none transition placeholder:text-gray-700 mb-4" />

      {/* 미리보기 — 문항수 비율과 배점 비율을 나란히 둔다.
          둘이 갈리면(예: 한전KPS 문항 1:1 / 배점 2:1) 시간을 어디에 쓸지가
          달라지므로 경고를 띄운다. */}
      <div className="bg-gray-950 rounded-xl p-3 mb-4">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-[11px] text-gray-400">
            {totalQuestions(d) ?? '—'}문항 · {totalMinutes(d) ?? '—'}분

          </span>
          <span className={`text-sm font-bold tabular-nums ${paceTone(secondsPerQuestion(d))}`}>
            {secondsPerQuestion(d) ? `${secondsPerQuestion(d)}초 / 문항` : '—'}
          </span>
        </div>

        {weights.length > 0 && (
          <div className="space-y-1 mt-2 pt-2 border-t border-gray-900">
            {weights.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className="w-28 shrink-0 truncate text-gray-400">{w.label}</span>
                <span className="w-24 shrink-0 tabular-nums text-gray-600">
                  문항 {w.qPct !== null ? `${w.qPct}%` : '—'}
                </span>
                <span className="w-24 shrink-0 tabular-nums text-blue-300">
                  반영 {w.sharePct !== null ? `${w.sharePct}%` : '—'}
                </span>
                <span className="tabular-nums text-gray-500">
                  {w.qPct !== null && w.sharePct !== null && w.qPct > 0
                    ? `문항 하나의 값 ×${Math.round((w.sharePct / w.qPct) * 100) / 100}`
                    : ''}
                </span>
              </div>
            ))}
          </div>
        )}

        {weightDiverges(d) && (
          <p className="text-[11px] text-amber-300 mt-2 leading-relaxed">
            ⚠ 문항수 비율과 반영비율이 다릅니다. 시간 배분은 문항수가 아니라
            반영비율을 따라가는 게 유리합니다.
          </p>
        )}
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-2.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-sm font-bold transition">
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}

function PartRow({
  label, labelPlaceholder, onLabel, color, q, min, score, qPlaceholder, onQ, onMin, onScore, onRemove,
}: {
  label: string
  labelPlaceholder?: string
  onLabel?: (v: string) => void
  color: string
  q: number | null
  min: number | null
  score: number | null
  qPlaceholder?: string
  onQ: (v: string) => void
  onMin: (v: string) => void
  onScore: (v: string) => void
  onRemove?: () => void
}) {
  const inp = 'bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-xs outline-none transition placeholder:text-gray-700 w-full'
  return (
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center">
      <div className="flex items-center gap-1.5 min-w-0">
        <i className="shrink-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        {onLabel ? (
          <input value={label} placeholder={labelPlaceholder}
            onChange={e => onLabel(e.target.value)}
            className={`${inp} font-semibold`} style={{ color }} />
        ) : (
          <span className="text-xs font-semibold truncate" style={{ color }}>{label}</span>
        )}
      </div>
      <input inputMode="numeric" placeholder={qPlaceholder ?? '문항'} className={`${inp} w-16`}
        value={q ?? ''} onChange={e => onQ(e.target.value)} />
      <input inputMode="numeric" placeholder="분" className={`${inp} w-16`}
        value={min ?? ''} onChange={e => onMin(e.target.value)} />
      <input inputMode="numeric" placeholder="비율" className={`${inp} w-16`}
        value={score ?? ''} onChange={e => onScore(e.target.value)} />
      {onRemove ? (
        <button onClick={onRemove} title="이 과목 지우기"
          className="w-6 h-6 rounded-md text-[11px] text-gray-700 hover:text-red-400 hover:bg-gray-800 transition">×</button>
      ) : <span className="w-6" />}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//  시험시간 한 줄
// ═══════════════════════════════════════════════════════════════
function TimeRow({ c, row, onOpen }: { c: Company; row: NcsRow; onOpen: () => void }) {
  const q = totalQuestions(row), m = totalMinutes(row)
  const sec = secondsPerQuestion(row)
  const parts: { label: string; q: number | null; min: number | null; color: string }[] = [
    { label: ncsLabel(row), q: ncsQuestions(row), min: row.ncs_min, color: '#60a5fa' },
    { label: majorLabel(row), q: row.major_q, min: row.major_min, color: '#34d399' },
    ...row.extras
      .filter(e => e.label || e.q || e.min)
      .map(e => ({ label: e.label || '기타', q: e.q, min: e.min, color: '#fbbf24' })),
  ]
  const empty = q === null && m === null

  return (
    <button onClick={onOpen}
      className="w-full text-left bg-gray-900 hover:bg-gray-800/80 rounded-2xl p-4 transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">
            {c.short || c.name}
            {row.combined && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-bold">통합 교시</span>}
            {weightDiverges(row) && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-300 font-bold" title="문항수 비율과 반영비율이 다릅니다">비율≠문항</span>}
            {isUnverified(row) && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-400 font-bold" title="참고 프리셋 값입니다. 공고로 확인한 뒤 메모의 ⚠ 표시를 지우세요">⚠ 미확인</span>}
          </p>
          <p className="text-[10px] text-gray-600 mt-0.5">
            {empty ? '아직 입력 안 함 — 눌러서 채우세요' : `${q ?? '—'}문항 · ${m ?? '—'}분`}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-base font-bold leading-none tabular-nums ${paceTone(sec)}`}>
            {sec ? sec : '—'}<span className="text-[10px] text-gray-600 ml-0.5">초/문항</span>
          </p>
        </div>
      </div>

      {!empty && (
        <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-gray-800">
          {parts.filter(p => p.min || p.q).map(p => (
            <div key={p.label} className="h-full rounded-full"
              style={{
                width: `${((p.min ?? p.q ?? 0) / (parts.reduce((a, x) => a + (x.min ?? x.q ?? 0), 0) || 1)) * 100}%`,
                backgroundColor: p.color,
              }} />
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
        {parts.filter(p => p.q || p.min).map(p => (
          <span key={p.label} className="text-[10px] text-gray-500">
            <span style={{ color: p.color }}>■</span> {p.label} {p.q ? `${p.q}문항` : ''}{p.q && p.min ? ' · ' : ''}{p.min ? `${p.min}분` : ''}
          </span>
        ))}
      </div>
      {row.cutoff && <p className="text-[10px] text-red-400/70 mt-1.5">과락 {row.cutoff}</p>}
      {row.memo && <p className="text-[10px] text-gray-500 mt-0.5">📌 {row.memo}</p>}
    </button>
  )
}
