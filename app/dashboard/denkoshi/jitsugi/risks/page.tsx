'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { KOUHO_MONDAI, PRACTICE_PRIORITY, type JitsugiRisk, type JitsugiWire } from '@/lib/constants-denkoshi-jitsugi'

const PROBLEM_NOS = KOUHO_MONDAI.map(p => p.no) // [1..13]
type View = 'matrix' | 'cards' | 'wires' | 'priority'

export default function JitsugiRisksPage() {
  const [risks, setRisks] = useState<JitsugiRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [view, setView] = useState<View>('matrix')
  const [filter, setFilter] = useState<number | null>(null) // 선택된 候補問題, null=전체
  const [savingId, setSavingId] = useState<string | null>(null)
  const newCardId = useRef<string | null>(null)

  // ── 전선 소요량(wires) 상태 ─────────────────────────────────────
  const [wires, setWires] = useState<JitsugiWire[]>([])
  const [wiresMissing, setWiresMissing] = useState(false)

  // ── 로드 ───────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('denkoshi_jitsugi_risks')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) {
      // 테이블이 아직 없을 때(마이그레이션 미적용) 안내
      if (error.code === '42P01' || /relation .* does not exist/i.test(error.message)) {
        setTableMissing(true)
      }
    } else {
      setRisks((data ?? []) as JitsugiRisk[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── 전선 소요량 로드 ────────────────────────────────────────────
  const loadWires = useCallback(async () => {
    const { data, error } = await supabase
      .from('denkoshi_jitsugi_wires')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    if (error) {
      if (error.code === '42P01' || /relation .* does not exist/i.test(error.message)) {
        setWiresMissing(true)
      }
    } else {
      // amounts 가 null 이면 빈 객체로 정규화
      setWires((data ?? []).map((w) => ({ ...(w as JitsugiWire), amounts: (w as JitsugiWire).amounts ?? {} })))
    }
  }, [])

  useEffect(() => { loadWires() }, [loadWires])

  // ── 전선 CRUD (매트릭스: 행=전선 종류, 셀=amounts[問題no]) ─────────
  const patchWireLocal = (id: string, patch: Partial<JitsugiWire>) =>
    setWires(prev => prev.map(w => (w.id === id ? { ...w, ...patch } : w)))

  const persistWire = async (id: string, patch: Partial<JitsugiWire>) => {
    setSavingId(id)
    await supabase.from('denkoshi_jitsugi_wires')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    setSavingId(null)
  }

  // 행 라벨(전선 종류) 저장
  const saveWireType = (id: string, value: string) => {
    const cur = wires.find(w => w.id === id)
    if (!cur || cur.wire_type === value) return
    persistWire(id, { wire_type: value })
  }

  // 셀(특정 問題의 소요량) 저장
  const saveWireCell = (id: string, no: number, value: string) => {
    const cur = wires.find(w => w.id === id)
    if (!cur) return
    const v = value.trim()
    const nextAmounts = { ...cur.amounts }
    if (v === '') delete nextAmounts[String(no)]
    else nextAmounts[String(no)] = v
    patchWireLocal(id, { amounts: nextAmounts })
    persistWire(id, { amounts: nextAmounts })
  }

  const addWire = async () => {
    const maxOrder = wires.reduce((m, w) => Math.max(m, w.sort_order), 0)
    const payload = { wire_type: '', amounts: {}, sort_order: maxOrder + 10 }
    const { data, error } = await supabase.from('denkoshi_jitsugi_wires').insert(payload).select().single()
    if (!error && data) {
      newCardId.current = data.id
      setWires(prev => [...prev, { ...(data as JitsugiWire), amounts: (data as JitsugiWire).amounts ?? {} }])
    }
  }

  const deleteWire = async (id: string) => {
    const w = wires.find(x => x.id === id)
    if (!confirm(`전선 '${w?.wire_type || '빈 행'}' 행을 삭제할까요?`)) return
    setWires(prev => prev.filter(x => x.id !== id))
    await supabase.from('denkoshi_jitsugi_wires').delete().eq('id', id)
  }

  const moveWire = async (id: string, dir: -1 | 1) => {
    const sorted = [...wires].sort((a, b) => a.sort_order - b.sort_order)
    const idx = sorted.findIndex(w => w.id === id)
    const swap = idx + dir
    if (swap < 0 || swap >= sorted.length) return
    const a = sorted[idx], b = sorted[swap]
    const ao = a.sort_order, bo = b.sort_order
    patchWireLocal(a.id, { sort_order: bo })
    patchWireLocal(b.id, { sort_order: ao })
    setWires(prev => [...prev].sort((x, y) => x.sort_order - y.sort_order))
    await Promise.all([
      supabase.from('denkoshi_jitsugi_wires').update({ sort_order: bo }).eq('id', a.id),
      supabase.from('denkoshi_jitsugi_wires').update({ sort_order: ao }).eq('id', b.id),
    ])
  }

  // ── 로컬 패치 + 영속 ────────────────────────────────────────────
  const patchLocal = (id: string, patch: Partial<JitsugiRisk>) =>
    setRisks(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)))

  const persist = async (id: string, patch: Partial<JitsugiRisk>) => {
    setSavingId(id)
    await supabase.from('denkoshi_jitsugi_risks')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
    setSavingId(null)
  }

  const saveField = (id: string, field: 'item' | 'dimension' | 'caution', value: string) => {
    const cur = risks.find(r => r.id === id)
    if (!cur || cur[field] === value) return
    const patch: Partial<JitsugiRisk> =
      field === 'item' ? { item: value } : field === 'dimension' ? { dimension: value } : { caution: value }
    persist(id, patch)
  }

  const toggleProblem = (id: string, no: number) => {
    const cur = risks.find(r => r.id === id)
    if (!cur) return
    const has = cur.problem_nos.includes(no)
    const next = has
      ? cur.problem_nos.filter(n => n !== no)
      : [...cur.problem_nos, no].sort((a, b) => a - b)
    patchLocal(id, { problem_nos: next })
    persist(id, { problem_nos: next })
  }

  const addRisk = async () => {
    const maxOrder = risks.reduce((m, r) => Math.max(m, r.sort_order), 0)
    const payload = {
      item: '', dimension: '', caution: '',
      problem_nos: filter != null ? [filter] : [],
      sort_order: maxOrder + 10,
    }
    const { data, error } = await supabase.from('denkoshi_jitsugi_risks').insert(payload).select().single()
    if (!error && data) {
      newCardId.current = data.id
      setRisks(prev => [...prev, data as JitsugiRisk])
      setView('cards') // 새 항목은 카드(편집) 화면이 자연스러움
    }
  }

  const deleteRisk = async (id: string) => {
    const r = risks.find(x => x.id === id)
    if (!confirm(`'${r?.item || '빈 항목'}' 을(를) 삭제할까요?`)) return
    setRisks(prev => prev.filter(x => x.id !== id))
    await supabase.from('denkoshi_jitsugi_risks').delete().eq('id', id)
  }

  const moveRisk = async (id: string, dir: -1 | 1) => {
    const sorted = [...risks]
    const idx = sorted.findIndex(r => r.id === id)
    const swap = idx + dir
    if (swap < 0 || swap >= sorted.length) return
    const a = sorted[idx], b = sorted[swap]
    const ao = a.sort_order, bo = b.sort_order
    patchLocal(a.id, { sort_order: bo })
    patchLocal(b.id, { sort_order: ao })
    setRisks(prev => [...prev].sort((x, y) => x.sort_order - y.sort_order))
    await Promise.all([
      supabase.from('denkoshi_jitsugi_risks').update({ sort_order: bo }).eq('id', a.id),
      supabase.from('denkoshi_jitsugi_risks').update({ sort_order: ao }).eq('id', b.id),
    ])
  }

  // ── 파생값 ─────────────────────────────────────────────────────
  const countByProblem = useMemo(() => {
    const m = new Map<number, number>()
    for (const no of PROBLEM_NOS) m.set(no, 0)
    for (const r of risks) for (const no of r.problem_nos) m.set(no, (m.get(no) ?? 0) + 1)
    return m
  }, [risks])

  const visible = useMemo(
    () => (filter == null ? risks : risks.filter(r => r.problem_nos.includes(filter))),
    [risks, filter],
  )

  const filterMeta = filter != null ? KOUHO_MONDAI.find(p => p.no === filter) : null

  // ── 렌더 ───────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* 상단 */}
        <div className="mb-2 flex items-center gap-2">
          <Link href="/dashboard/denkoshi/jitsugi" className="text-gray-400 hover:text-white text-sm">← 실기 허브</Link>
          {savingId && <span className="text-[11px] text-gray-600 ml-1">저장 중…</span>}
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">⚠️</span>
          <h1 className="text-2xl font-bold">시공 리스크 관리</h1>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          Risk item별 <span className="text-gray-300">치수 · 시공 유의사항 · 해당 候補問題</span> 자유 태깅 · 후보문제별 <span className="text-gray-300">전선 소요량</span> · 타임어택 전 점검
        </p>

        {tableMissing ? (
          <MissingTable />
        ) : (
          <>
            {/* 뷰 토글 + 항목 추가 */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex bg-gray-900 rounded-xl p-1">
                <button onClick={() => setView('matrix')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === 'matrix' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  ▦ 매트릭스
                </button>
                <button onClick={() => setView('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  ✎ 카드 편집
                </button>
                <button onClick={() => setView('wires')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === 'wires' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  🧵 전선 소요량
                </button>
                <button onClick={() => setView('priority')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${view === 'priority' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  🎯 우선순위
                </button>
              </div>
              {(view === 'matrix' || view === 'cards') && (
                <button onClick={addRisk}
                  className="ml-auto text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold transition">
                  + 리스크 항목 추가
                </button>
              )}
            </div>

            {/* 候補問題 필터 바 (리스크 매트릭스·카드 전용) */}
            {(view === 'matrix' || view === 'cards') && (<>
            <div className="flex flex-wrap gap-1.5 mb-4">
              <button onClick={() => setFilter(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${filter == null ? 'bg-white text-gray-900' : 'bg-gray-900 text-gray-300 hover:bg-gray-800'}`}>
                전체 <span className="opacity-60">{risks.length}</span>
              </button>
              {PROBLEM_NOS.map(no => {
                const c = countByProblem.get(no) ?? 0
                const active = filter === no
                return (
                  <button key={no} onClick={() => setFilter(active ? null : no)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${active ? 'bg-blue-600 text-white' : c > 0 ? 'bg-gray-900 text-gray-200 hover:bg-gray-800' : 'bg-gray-900/50 text-gray-600 hover:bg-gray-800'}`}>
                    {no}<span className="ml-1 opacity-60">{c}</span>
                  </button>
                )
              })}
            </div>

            {/* 선택된 문제 컨텍스트 배너 */}
            {filterMeta && (
              <div className="bg-gray-900 rounded-xl px-4 py-3 mb-4 flex items-start gap-3">
                <span className="text-sm font-bold text-blue-400 shrink-0">No.{filterMeta.no}</span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 leading-snug">{filterMeta.feature}</p>
                  <p className="text-[11px] text-gray-600">{filterMeta.featureJa}</p>
                </div>
                <Link href={`/dashboard/denkoshi/jitsugi/${filterMeta.no}`}
                  className="ml-auto shrink-0 text-[11px] px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 transition self-center">
                  문제 열기 →
                </Link>
              </div>
            )}
            </>)}

            {view === 'priority' ? (
              <PriorityView riskCount={countByProblem} />
            ) : view === 'wires' ? (
              <WiresView
                wires={wires} wiresMissing={wiresMissing}
                autoFocusId={newCardId.current}
                onAdd={addWire} onType={saveWireType} onCell={saveWireCell}
                onPatchLocal={patchWireLocal} onDelete={deleteWire} onMove={moveWire}
              />
            ) : loading ? (
              <p className="text-gray-600 text-sm py-10 text-center">불러오는 중…</p>
            ) : risks.length === 0 ? (
              <div className="text-gray-600 text-sm py-16 text-center border border-dashed border-gray-800 rounded-2xl">
                아직 항목이 없어요. [+ 리스크 항목 추가]로 시작하세요.
              </div>
            ) : view === 'matrix' ? (
              <MatrixView
                rows={visible} filter={filter}
                onToggle={toggleProblem}
                onOpen={(id) => { newCardId.current = id; setView('cards') }}
              />
            ) : (
              <div className="space-y-3">
                {visible.map(r => (
                  <RiskCard
                    key={r.id} risk={r}
                    autoFocus={newCardId.current === r.id}
                    onField={saveField} onPatchLocal={patchLocal}
                    onToggle={toggleProblem} onDelete={deleteRisk} onMove={moveRisk}
                  />
                ))}
                {visible.length === 0 && (
                  <p className="text-gray-600 text-sm py-10 text-center">이 문제에 태깅된 리스크가 없어요.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

// ── 매트릭스(표) 뷰 ───────────────────────────────────────────────
function MatrixView({
  rows, filter, onToggle, onOpen,
}: {
  rows: JitsugiRisk[]
  filter: number | null
  onToggle: (id: string, no: number) => void
  onOpen: (id: string) => void
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-800">
      <table className="border-collapse text-sm min-w-max">
        <thead>
          <tr className="bg-gray-900">
            <th className="sticky left-0 z-10 bg-gray-900 text-left px-3 py-2.5 text-xs font-semibold text-gray-400 border-b border-gray-800 min-w-[180px]">
              Risk item
            </th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-gray-400 border-b border-gray-800 min-w-[200px]">치수</th>
            {PROBLEM_NOS.map(no => (
              <th key={no}
                className={`px-0 py-2.5 text-xs font-semibold border-b border-gray-800 w-9 text-center ${filter === no ? 'text-blue-400 bg-blue-600/10' : 'text-gray-500'}`}>
                {no}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-gray-900/40">
              <td className="sticky left-0 z-10 bg-gray-950 px-3 py-2.5 border-b border-gray-800/70 align-top">
                <button onClick={() => onOpen(r.id)}
                  className="text-left text-gray-100 leading-snug hover:text-blue-400 transition">
                  {r.item || <span className="text-gray-600">(이름 없음)</span>}
                </button>
                {r.caution && <p className="text-[11px] text-amber-400/80 mt-1 leading-snug whitespace-pre-wrap">{r.caution}</p>}
              </td>
              <td className="px-3 py-2.5 border-b border-gray-800/70 text-gray-400 text-xs leading-snug align-top whitespace-pre-wrap">
                {r.dimension || <span className="text-gray-700">–</span>}
              </td>
              {PROBLEM_NOS.map(no => {
                const on = r.problem_nos.includes(no)
                const col = filter === no
                return (
                  <td key={no}
                    className={`border-b border-gray-800/70 text-center align-middle ${col ? 'bg-blue-600/10' : ''}`}>
                    <button onClick={() => onToggle(r.id, no)}
                      aria-label={`No.${no} 태깅 토글`}
                      className="w-9 h-9 inline-flex items-center justify-center group">
                      <span className={`w-4 h-4 rounded-full transition ${on ? 'bg-blue-500' : 'border border-gray-700 group-hover:border-blue-500'}`} />
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-900/60">
            <td className="sticky left-0 z-10 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-400 border-t border-gray-800">
              문제별 리스크 합계
            </td>
            <td className="border-t border-gray-800" />
            {PROBLEM_NOS.map(no => {
              const c = rows.filter(r => r.problem_nos.includes(no)).length
              return (
                <td key={no} className={`text-center px-0 py-2 border-t border-gray-800 text-xs font-semibold tabular-nums ${filter === no ? 'bg-blue-600/10 text-blue-300' : c > 0 ? 'text-gray-300' : 'text-gray-700'}`}>
                  {c > 0 ? c : '–'}
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── 카드(편집) 뷰 ─────────────────────────────────────────────────
function RiskCard({
  risk, autoFocus, onField, onPatchLocal, onToggle, onDelete, onMove,
}: {
  risk: JitsugiRisk
  autoFocus: boolean
  onField: (id: string, f: 'item' | 'dimension' | 'caution', v: string) => void
  onPatchLocal: (id: string, p: Partial<JitsugiRisk>) => void
  onToggle: (id: string, no: number) => void
  onDelete: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}) {
  const itemRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => { if (autoFocus) itemRef.current?.focus() }, [autoFocus])

  return (
    <div className="bg-gray-900 rounded-2xl p-4">
      {/* 헤더: 항목명 + 정렬/삭제 */}
      <div className="flex items-center gap-2 mb-3">
        <input
          ref={itemRef}
          value={risk.item}
          onChange={e => onPatchLocal(risk.id, { item: e.target.value })}
          onBlur={e => onField(risk.id, 'item', e.target.value)}
          placeholder="Risk item (예: 引掛シーリング 각형)"
          className="flex-1 bg-transparent text-base font-semibold text-white outline-none border-b border-transparent focus:border-blue-500 transition pb-0.5"
        />
        <button onClick={() => onMove(risk.id, -1)} className="text-gray-600 hover:text-white text-xs px-1.5 py-1" aria-label="위로">▲</button>
        <button onClick={() => onMove(risk.id, 1)} className="text-gray-600 hover:text-white text-xs px-1.5 py-1" aria-label="아래로">▼</button>
        <button onClick={() => onDelete(risk.id)} className="text-gray-600 hover:text-red-400 text-xs px-1.5 py-1">삭제</button>
      </div>

      {/* 치수 */}
      <div className="mb-3">
        <label className="block text-[11px] text-gray-500 mb-1">📏 치수</label>
        <textarea
          value={risk.dimension}
          onChange={e => onPatchLocal(risk.id, { dimension: e.target.value })}
          onBlur={e => onField(risk.id, 'dimension', e.target.value)}
          placeholder="피복 50mm + 심선 20mm …"
          rows={2}
          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 resize-y leading-relaxed"
        />
      </div>

      {/* 시공 유의사항 */}
      <div className="mb-3">
        <label className="block text-[11px] text-gray-500 mb-1">⚠️ 시공상 유의사항 · 주의할 결함</label>
        <textarea
          value={risk.caution}
          onChange={e => onPatchLocal(risk.id, { caution: e.target.value })}
          onBlur={e => onField(risk.id, 'caution', e.target.value)}
          placeholder="자주 내는 실수 / 欠陥 포인트 / 체크할 것 …"
          rows={3}
          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 resize-y leading-relaxed"
        />
      </div>

      {/* 候補問題 토글 */}
      <div>
        <label className="block text-[11px] text-gray-500 mb-1.5">해당 候補問題 (탭하여 토글)</label>
        <div className="flex flex-wrap gap-1.5">
          {PROBLEM_NOS.map(no => {
            const on = risk.problem_nos.includes(no)
            return (
              <button key={no} onClick={() => onToggle(risk.id, no)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition ${on ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700 hover:text-gray-300'}`}>
                {no}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── 전선 소요량(wires) 뷰: 행=전선 종류, 열=候補問題, 셀=소요량 ────────
// 셀 문자열 → mm 로 환산(숫자에 m/cm/mm 접미사 인식, 없으면 mm로 간주)
function amountToMm(raw: string | undefined): number {
  if (!raw) return 0
  const s = raw.trim().toLowerCase().replace(/\s+/g, '')
  const m = s.match(/^([\d.]+)(mm|cm|m)?$/)
  if (!m) return 0
  const n = parseFloat(m[1])
  if (isNaN(n)) return 0
  const unit = m[2] || 'mm'
  return unit === 'm' ? n * 1000 : unit === 'cm' ? n * 10 : n
}
// mm → 'X.XXm' (0이면 '–')
function fmtMeters(mm: number): string {
  if (mm <= 0) return '–'
  return `${(mm / 1000).toFixed(2)}m`
}

function WiresView({
  wires, wiresMissing, autoFocusId,
  onAdd, onType, onCell, onPatchLocal, onDelete, onMove,
}: {
  wires: JitsugiWire[]
  wiresMissing: boolean
  autoFocusId: string | null
  onAdd: () => void
  onType: (id: string, v: string) => void
  onCell: (id: string, no: number, v: string) => void
  onPatchLocal: (id: string, p: Partial<JitsugiWire>) => void
  onDelete: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}) {
  const rows = useMemo(() => [...wires].sort((a, b) => a.sort_order - b.sort_order), [wires])

  // 열(問題)별 합계 mm + 전체 총합
  const colTotals = useMemo(() => {
    const m = new Map<number, number>()
    for (const no of PROBLEM_NOS) m.set(no, 0)
    for (const w of wires) for (const no of PROBLEM_NOS) {
      m.set(no, (m.get(no) ?? 0) + amountToMm(w.amounts[String(no)]))
    }
    return m
  }, [wires])
  const grandTotalMm = useMemo(
    () => Array.from(colTotals.values()).reduce((s, v) => s + v, 0),
    [colTotals],
  )

  if (wiresMissing) {
    return (
      <div className="bg-gray-900 rounded-2xl p-5 text-sm text-gray-300 leading-relaxed">
        <p className="font-semibold text-amber-400 mb-2">전선 소요량 테이블이 아직 없어요</p>
        <p className="text-gray-400 mb-3">Supabase SQL Editor에서 아래 마이그레이션을 한 번 실행하면 기본 전선 목록과 함께 활성화됩니다.</p>
        <code className="block bg-gray-950 rounded-lg px-3 py-2 text-xs text-gray-300">
          supabase/denkoshi_jitsugi_wires_migration.sql
        </code>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[11px] text-gray-500">
          셀 = 소요량 <span className="text-gray-600">(mm 기준 · <span className="text-gray-500">m·cm</span> 접미사 인식)</span> · 우측 <span className="text-gray-400">합계(m)</span> = 전선 종류별 총합
        </p>
        <button onClick={onAdd}
          className="ml-auto text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold transition">
          + 전선 종류 추가
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="text-gray-600 text-sm py-16 text-center border border-dashed border-gray-800 rounded-2xl">
          아직 전선 행이 없어요. [+ 전선 종류 추가]로 시작하거나 마이그레이션 시드로 기본 목록을 넣으세요.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-800">
          <table className="border-collapse text-sm min-w-max">
            <thead>
              <tr className="bg-gray-900">
                <th className="sticky left-0 z-10 bg-gray-900 text-left px-3 py-2.5 text-xs font-semibold text-gray-400 border-b border-gray-800 min-w-[150px]">
                  전선 종류
                </th>
                {PROBLEM_NOS.map(no => (
                  <th key={no} className="px-0 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-800 w-14 text-center">
                    {no}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-xs font-semibold text-blue-300 border-b border-gray-800 border-l border-gray-800 text-right min-w-[80px]">
                  합계(m)
                </th>
                <th className="px-2 py-2.5 text-xs font-semibold text-gray-500 border-b border-gray-800 text-center w-16">정렬</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(w => {
                const rowMm = PROBLEM_NOS.reduce((s, no) => s + amountToMm(w.amounts[String(no)]), 0)
                return (
                  <tr key={w.id} className="hover:bg-gray-900/40">
                    {/* 전선 종류(행 라벨) — sticky */}
                    <td className="sticky left-0 z-10 bg-gray-950 px-2 py-1.5 border-b border-gray-800/70">
                      <WireTypeInput wire={w} autoFocus={autoFocusId === w.id} onType={onType} onPatchLocal={onPatchLocal} />
                    </td>
                    {/* 각 問題 셀 */}
                    {PROBLEM_NOS.map(no => (
                      <td key={no} className="border-b border-gray-800/70 text-center px-0.5 py-1">
                        <WireCell
                          value={w.amounts[String(no)] ?? ''}
                          onCommit={v => onCell(w.id, no, v)}
                        />
                      </td>
                    ))}
                    {/* 행 합계(m) */}
                    <td className="border-b border-gray-800/70 border-l border-gray-800 text-right px-3 py-1.5">
                      <span className={rowMm > 0 ? 'text-blue-300 font-semibold tabular-nums' : 'text-gray-700'}>
                        {fmtMeters(rowMm)}
                      </span>
                    </td>
                    {/* 정렬/삭제 */}
                    <td className="border-b border-gray-800/70 text-center px-1 py-1 whitespace-nowrap">
                      <button onClick={() => onMove(w.id, -1)} className="text-gray-600 hover:text-white text-xs px-1" aria-label="위로">▲</button>
                      <button onClick={() => onMove(w.id, 1)} className="text-gray-600 hover:text-white text-xs px-1" aria-label="아래로">▼</button>
                      <button onClick={() => onDelete(w.id)} className="text-gray-600 hover:text-red-400 text-xs px-1" aria-label="삭제">✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {/* 열(問題)별 합계 + 전체 총합 */}
            <tfoot>
              <tr className="bg-gray-900/60">
                <td className="sticky left-0 z-10 bg-gray-900 px-3 py-2 text-xs font-semibold text-gray-400 border-t border-gray-800">
                  문제별 합계(m)
                </td>
                {PROBLEM_NOS.map(no => {
                  const mm = colTotals.get(no) ?? 0
                  return (
                    <td key={no} className="text-center px-0.5 py-2 border-t border-gray-800 text-[11px] tabular-nums">
                      <span className={mm > 0 ? 'text-gray-300' : 'text-gray-700'}>{mm > 0 ? (mm / 1000).toFixed(1) : '–'}</span>
                    </td>
                  )
                })}
                <td className="text-right px-3 py-2 border-t border-l border-gray-800 text-blue-300 font-bold tabular-nums">
                  {fmtMeters(grandTotalMm)}
                </td>
                <td className="border-t border-gray-800" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

// 전선 종류(행 라벨) 입력 — 부모 state controlled
function WireTypeInput({
  wire, autoFocus, onType, onPatchLocal,
}: {
  wire: JitsugiWire
  autoFocus: boolean
  onType: (id: string, v: string) => void
  onPatchLocal: (id: string, p: Partial<JitsugiWire>) => void
}) {
  const ref = useRef<HTMLInputElement | null>(null)
  useEffect(() => { if (autoFocus) ref.current?.focus() }, [autoFocus])
  return (
    <input
      ref={ref}
      value={wire.wire_type}
      onChange={e => onPatchLocal(wire.id, { wire_type: e.target.value })}
      onBlur={e => onType(wire.id, e.target.value)}
      placeholder="전선 종류 (예: VVF 1.6mm 2심)"
      className="w-full bg-transparent text-sm text-gray-100 outline-none border-b border-transparent focus:border-blue-500 transition py-1"
    />
  )
}

// 셀(소요량) 입력 — 로컬 draft, blur 시 commit
function WireCell({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value)
  useEffect(() => { setV(value) }, [value])
  return (
    <input
      value={v}
      onChange={e => setV(e.target.value)}
      onBlur={() => { if (v.trim() !== value.trim()) onCommit(v) }}
      inputMode="decimal"
      placeholder="–"
      className={`w-12 text-center rounded px-1 py-1 text-sm outline-none transition ${
        v.trim() ? 'bg-gray-800 text-gray-100 focus:ring-1 focus:ring-blue-500'
                 : 'bg-transparent text-gray-500 hover:bg-gray-800/60 focus:bg-gray-800 focus:ring-1 focus:ring-blue-500'
      }`}
    />
  )
}

// ── 연습 우선순위 뷰 ──────────────────────────────────────────────
function PriorityView({ riskCount }: { riskCount: Map<number, number> }) {
  return (
    <div className="space-y-5">
      {/* 방법론 */}
      <p className="text-xs text-gray-500 leading-relaxed bg-gray-900/60 rounded-xl px-4 py-3">
        {PRACTICE_PRIORITY.intro}
      </p>

      {/* 티어 */}
      {PRACTICE_PRIORITY.tiers.map(tier => (
        <div key={tier.key}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tier.color, boxShadow: `0 0 6px 1px ${tier.color}` }} />
            <span className="text-sm font-bold" style={{ color: tier.color }}>{tier.label}</span>
            <span className="text-[11px] text-gray-500">{tier.desc}</span>
          </div>
          <div className="space-y-2">
            {tier.problems.map(({ no, why }) => {
              const meta = KOUHO_MONDAI.find(p => p.no === no)
              const rc = riskCount.get(no) ?? 0
              return (
                <Link key={no} href={`/dashboard/denkoshi/jitsugi/${no}`}
                  className="flex items-start gap-3 bg-gray-900 hover:bg-gray-800 rounded-xl px-4 py-3 transition group">
                  <span className="shrink-0 w-11 text-center">
                    <span className="text-sm font-bold text-blue-400 group-hover:text-blue-300">No.{no}</span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-100 font-medium">{meta?.feature}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-800 text-gray-400 shrink-0">
                        리스크 {rc}
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-400 leading-snug mt-1">{why}</p>
                  </div>
                  <span className="text-gray-600 text-xs shrink-0 self-center group-hover:text-gray-400">→</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}

      {/* 베이스라인 추천 */}
      <div className="bg-blue-600/10 border border-blue-600/30 rounded-xl px-4 py-3">
        <p className="text-xs font-semibold text-blue-300 mb-1">🏁 오늘 첫 실전 베이스라인</p>
        <p className="text-[13px] text-gray-200 leading-relaxed">{PRACTICE_PRIORITY.baseline}</p>
      </div>

      {/* 메모 */}
      <div>
        <p className="text-[11px] text-gray-600 uppercase tracking-widest mb-2">메모</p>
        <ul className="space-y-1.5">
          {PRACTICE_PRIORITY.notes.map((n, i) => (
            <li key={i} className="text-[12px] text-gray-400 leading-snug flex gap-2">
              <span className="text-gray-600 shrink-0">·</span>
              <span>{n}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ── 테이블 미적용 안내 ─────────────────────────────────────────────
function MissingTable() {
  return (
    <div className="bg-gray-900 rounded-2xl p-5 text-sm text-gray-300 leading-relaxed">
      <p className="font-semibold text-amber-400 mb-2">테이블이 아직 없어요</p>
      <p className="text-gray-400 mb-3">
        Supabase SQL Editor에서 아래 마이그레이션을 한 번 실행하면 시드 데이터와 함께 활성화됩니다.
      </p>
      <code className="block bg-gray-950 rounded-lg px-3 py-2 text-xs text-gray-300">
        supabase/denkoshi_jitsugi_risks_migration.sql
      </code>
    </div>
  )
}
