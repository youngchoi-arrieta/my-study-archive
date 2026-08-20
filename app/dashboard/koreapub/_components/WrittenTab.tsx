'use client'

import { useState, useMemo, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Company } from '@/lib/constants-koreapub'
import {
  NcsAreaKey, NcsRow, NCS_AREAS, ALL_AREA_KEYS, AREA_PRESETS,
  emptyNcsRow, isOn, cellQ, pickedAreas, areaFrequency,
  ncsQuestions, totalQuestions, totalMinutes, secondsPerQuestion, paceTone,
} from '@/lib/constants-koreapub-ncs'

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

  const rowOf = (id: string): NcsRow =>
    local[id] ?? rows.find(r => r.company_id === id) ?? emptyNcsRow(id)

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

  const applyPreset = (id: string, keys: NcsAreaKey[]) => {
    const r = rowOf(id)
    const areas = Object.fromEntries(
      keys.map(k => [k, { on: true, q: r.areas[k]?.q ?? null }])
    ) as NcsRow['areas']
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
                          const q = cellQ(r, a.key)
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
                                {on ? (q ?? '●') : '·'}
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
              ? '칸을 눌러 켜고 끕니다. 기업 이름 아래 「자세히」에서 영역별 문항수와 시험시간을 넣으세요.'
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
              onPreset={keys => applyPreset(openId, keys)}
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
function CompanyPanel({ c, row, others, onWrite, onPreset, onCopy, onClose, onSaved }: {
  c: Company; row: NcsRow; others: Company[]
  onWrite: (r: NcsRow) => void
  onPreset: (keys: NcsAreaKey[]) => void
  onCopy: (fromId: string) => void
  onClose: () => void
  onSaved: () => void
}) {
  const [d, setD] = useState<NcsRow>(row)
  const [saving, setSaving] = useState(false)
  useEffect(() => { setD(row) }, [row])

  const num = (v: string) => { const n = Number(v.replace(/\D/g, '')); return n > 0 ? n : null }
  const set = (p: Partial<NcsRow>) => setD(x => ({ ...x, ...p }))
  const setQ = (k: NcsAreaKey, v: string) =>
    setD(x => ({ ...x, areas: { ...x.areas, [k]: { on: true, q: num(v) } } }))

  const save = async () => {
    setSaving(true)
    await onWrite(d)
    setSaving(false)
    onSaved()
  }

  const picked = pickedAreas(d)
  const inp = 'w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-xs text-center outline-none transition tabular-nums'
  const lab = 'text-[10px] text-gray-600 mb-1 block'

  return (
    <div className="bg-gray-900 rounded-2xl p-5 mb-6 border border-blue-900/60">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{c.name}</p>
          <p className="text-[11px] text-gray-600">{c.sector || '분야 미입력'}</p>
        </div>
        <button onClick={onClose} className="text-gray-600 hover:text-white text-xs shrink-0">닫기 ✕</button>
      </div>

      {/* 프리셋 · 복사 */}
      <p className={lab}>영역 한 번에 채우기</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {AREA_PRESETS.map(p => (
          <button key={p.label} onClick={() => onPreset(p.keys)} title={p.desc}
            className="text-[10px] px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition">
            {p.label}
          </button>
        ))}
        {others.length > 0 && (
          <select defaultValue="" onChange={e => { if (e.target.value) { onCopy(e.target.value); e.target.value = '' } }}
            className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-400 rounded-lg px-2 py-1 outline-none transition">
            <option value="">다른 기업에서 복사…</option>
            {others.map(o => <option key={o.id} value={o.id}>{o.short || o.name}</option>)}
          </select>
        )}
      </div>
      <p className="text-[10px] text-gray-700 mb-4">
        프리셋은 &quot;영역이 몇 개짜리 시험이냐&quot;는 모양일 뿐입니다. 실제 영역은 공고를 보고 매트릭스에서 고치세요.
      </p>

      {/* 영역별 문항수 */}
      {picked.length > 0 && (
        <>
          <p className={lab}>영역별 문항수 <span className="text-gray-700">(모르면 비워두세요)</span></p>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-4">
            {picked.map(k => {
              const a = NCS_AREAS.find(x => x.key === k)!
              return (
                <div key={k}>
                  <span className="text-[9px] text-gray-500 block mb-0.5 truncate">{a.short}</span>
                  <input inputMode="numeric" placeholder="—" className={inp}
                    value={d.areas[k]?.q ?? ''} onChange={e => setQ(k, e.target.value)} />
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* 과목별 문항 · 시간 */}
      <p className={lab}>과목별 문항수 · 시간(분)</p>
      <div className="space-y-2 mb-3">
        <PartRow label="NCS 직업기초" color="#60a5fa"
          q={d.ncs_q} min={d.ncs_min}
          qPlaceholder={ncsQuestions(d) !== null && d.ncs_q === null ? String(ncsQuestions(d)) : '—'}
          onQ={v => set({ ncs_q: num(v) })} onMin={v => set({ ncs_min: num(v) })} />
        <PartRow label="전공 (직무수행)" color="#34d399"
          q={d.major_q} min={d.major_min}
          onQ={v => set({ major_q: num(v) })} onMin={v => set({ major_min: num(v) })} />
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
          <input value={d.extra_label ?? ''} placeholder="제3과목 (예: 철도관련법령)"
            onChange={e => set({ extra_label: e.target.value || null })}
            className="bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-xs outline-none transition placeholder:text-gray-700" />
          <input inputMode="numeric" placeholder="문항" className={`${inp} w-16`}
            value={d.extra_q ?? ''} onChange={e => set({ extra_q: num(e.target.value) })} />
          <input inputMode="numeric" placeholder="분" className={`${inp} w-16`}
            value={d.extra_min ?? ''} onChange={e => set({ extra_min: num(e.target.value) })} />
        </div>
      </div>

      {/* 통합 시간 */}
      <label className="flex items-center gap-2 mb-3 cursor-pointer">
        <input type="checkbox" checked={d.combined}
          onChange={e => set({ combined: e.target.checked })}
          className="accent-blue-600" />
        <span className="text-[11px] text-gray-400">NCS와 전공을 한 교시에 통합해서 본다</span>
      </label>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <span className={lab}>총 시간(분) <span className="text-gray-700">직접 지정</span></span>
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

      {/* 미리보기 */}
      <div className="bg-gray-950 rounded-xl p-3 mb-4 flex items-baseline justify-between">
        <span className="text-[10px] text-gray-600">
          {totalQuestions(d) ?? '—'}문항 · {totalMinutes(d) ?? '—'}분
        </span>
        <span className={`text-sm font-bold tabular-nums ${paceTone(secondsPerQuestion(d))}`}>
          {secondsPerQuestion(d) ? `${secondsPerQuestion(d)}초 / 문항` : '—'}
        </span>
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-2.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-sm font-bold transition">
        {saving ? '저장 중...' : '저장'}
      </button>
    </div>
  )
}

function PartRow({ label, color, q, min, qPlaceholder, onQ, onMin }: {
  label: string; color: string; q: number | null; min: number | null
  qPlaceholder?: string
  onQ: (v: string) => void; onMin: (v: string) => void
}) {
  const inp = 'w-16 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2 py-1.5 text-xs text-center outline-none transition tabular-nums'
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
      <span className="text-xs" style={{ color }}>{label}</span>
      <input inputMode="numeric" placeholder={qPlaceholder ?? '문항'} className={inp}
        value={q ?? ''} onChange={e => onQ(e.target.value)} />
      <input inputMode="numeric" placeholder="분" className={inp}
        value={min ?? ''} onChange={e => onMin(e.target.value)} />
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
    { label: 'NCS', q: ncsQuestions(row), min: row.ncs_min, color: '#60a5fa' },
    { label: '전공', q: row.major_q, min: row.major_min, color: '#34d399' },
  ]
  if (row.extra_label || row.extra_q || row.extra_min) {
    parts.push({ label: row.extra_label || '기타', q: row.extra_q, min: row.extra_min, color: '#fbbf24' })
  }
  const empty = q === null && m === null

  return (
    <button onClick={onOpen}
      className="w-full text-left bg-gray-900 hover:bg-gray-800/80 rounded-2xl p-4 transition">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate">
            {c.short || c.name}
            {row.combined && <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 font-bold">통합 교시</span>}
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
      {row.memo && <p className="text-[10px] text-gray-700 mt-0.5">📌 {row.memo}</p>}
    </button>
  )
}
