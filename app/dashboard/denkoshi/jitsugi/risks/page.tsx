'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { KOUHO_MONDAI, type JitsugiRisk } from '@/lib/constants-denkoshi-jitsugi'

const PROBLEM_NOS = KOUHO_MONDAI.map(p => p.no) // [1..13]
type View = 'matrix' | 'cards'

export default function JitsugiRisksPage() {
  const [risks, setRisks] = useState<JitsugiRisk[]>([])
  const [loading, setLoading] = useState(true)
  const [tableMissing, setTableMissing] = useState(false)
  const [view, setView] = useState<View>('matrix')
  const [filter, setFilter] = useState<number | null>(null) // 선택된 候補問題, null=전체
  const [savingId, setSavingId] = useState<string | null>(null)
  const newCardId = useRef<string | null>(null)

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
          Risk item별 <span className="text-gray-300">치수 · 시공 유의사항 · 해당 候補問題</span> 자유 태깅 · 타임어택 전 리스크 점검
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
              </div>
              <button onClick={addRisk}
                className="ml-auto text-xs px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-semibold transition">
                + 리스크 항목 추가
              </button>
            </div>

            {/* 候補問題 필터 바 */}
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

            {loading ? (
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
