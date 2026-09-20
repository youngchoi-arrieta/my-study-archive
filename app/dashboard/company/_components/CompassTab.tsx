'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  RESUME_SECTIONS, RESUME_STATUS, RESUME_STATUS_CYCLE, RESUME_TAGS,
  type ResumeStatus,
} from '@/lib/constants-company'

type Inner = 'resume' | 'venn' | 'quadrant'

interface Resume { id: string; section: string; label: string; status: ResumeStatus; tag: string | null; link: string | null; sort_order: number }
interface Venn { id: string; side: string; label: string; sort_order: number }
interface Quad { id: string; label: string; important: boolean; uncontested: boolean; growth: boolean; sort_order: number }

const now = () => new Date().toISOString()

export default function CompassTab() {
  const [inner, setInner] = useState<Inner>('resume')
  return (
    <div>
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-4 w-fit">
        {([['resume', '목표 이력서'], ['venn', '이해관계 벤'], ['quadrant', '일의 사분면']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setInner(k)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${inner === k ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{l}</button>
        ))}
      </div>
      {inner === 'resume' && <ResumeView />}
      {inner === 'venn' && <VennView />}
      {inner === 'quadrant' && <QuadrantView />}
    </div>
  )
}

// ── 목표 이력서 ─────────────────────────────────────────
function ResumeView() {
  const [rows, setRows] = useState<Resume[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [onlyGap, setOnlyGap] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('co_resume').select('*').order('sort_order')
    setRows((data as Resume[]) || []); setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const cycle = async (r: Resume) => {
    const next = RESUME_STATUS_CYCLE[(RESUME_STATUS_CYCLE.indexOf(r.status) + 1) % RESUME_STATUS_CYCLE.length]
    setRows(p => p.map(x => x.id === r.id ? { ...x, status: next } : x))
    await supabase.from('co_resume').update({ status: next, updated_at: now() }).eq('id', r.id)
  }
  const add = async (section: string) => {
    if (!label.trim()) return
    const order = Math.max(0, ...rows.filter(r => r.section === section).map(r => r.sort_order)) + 1
    await supabase.from('co_resume').insert({ section, label: label.trim(), status: 'target', sort_order: order, updated_at: now() })
    setLabel(''); setAdding(null); fetchAll()
  }
  const remove = async (id: string) => { await supabase.from('co_resume').delete().eq('id', id); fetchAll() }

  if (loading) return <p className="text-gray-500 text-sm">불러오는 중...</p>

  const gap = rows.filter(r => r.status !== 'done' && r.section !== 'narrative').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-600">✓ 아닌 항목 {gap}개 = 다음에 확보할 것</p>
        <button onClick={() => setOnlyGap(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${onlyGap ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-500'}`}>확보할 것만</button>
      </div>
      {RESUME_SECTIONS.map(sec => {
        let list = rows.filter(r => r.section === sec.key)
        if (onlyGap) list = list.filter(r => r.status !== 'done')
        if (onlyGap && !list.length) return null
        return (
          <div key={sec.key} className="bg-gray-900 rounded-2xl p-4">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-3">{sec.label}</p>
            <div className="space-y-1.5">
              {list.map(r => {
                const st = RESUME_STATUS[r.status]
                return (
                  <div key={r.id} className="flex items-center gap-2.5 group">
                    <button onClick={() => cycle(r)} title={st.label}
                      className="w-5 h-5 rounded-md shrink-0 text-[12px] leading-none font-bold flex items-center justify-center"
                      style={{ color: st.color, backgroundColor: st.color + '1a' }}>{st.mark}</button>
                    <span className={`text-sm flex-1 ${r.status === 'done' ? 'text-gray-500' : 'text-gray-200'}`}>{r.label}</span>
                    {r.tag && RESUME_TAGS[r.tag as keyof typeof RESUME_TAGS] && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded shrink-0"
                        style={{ color: RESUME_TAGS[r.tag as keyof typeof RESUME_TAGS].color, backgroundColor: RESUME_TAGS[r.tag as keyof typeof RESUME_TAGS].color + '1a' }}>
                        {RESUME_TAGS[r.tag as keyof typeof RESUME_TAGS].label}
                      </span>
                    )}
                    <button onClick={() => remove(r.id)} className="text-[11px] text-gray-800 group-hover:text-gray-600 hover:!text-red-400 shrink-0">✕</button>
                  </div>
                )
              })}
            </div>
            {adding === sec.key ? (
              <div className="flex gap-1.5 mt-2">
                <input autoFocus value={label} onChange={e => setLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') add(sec.key); if (e.key === 'Escape') setAdding(null) }}
                  placeholder="새 항목" className="flex-1 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-1.5 text-sm outline-none placeholder:text-gray-700" />
                <button onClick={() => add(sec.key)} className="px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs">추가</button>
                <button onClick={() => setAdding(null)} className="px-2 text-gray-600 text-xs">취소</button>
              </div>
            ) : (
              <button onClick={() => { setAdding(sec.key); setLabel('') }} className="mt-2 text-[11px] text-gray-600 hover:text-gray-400">+ 항목 추가</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── 이해관계 벤 ─────────────────────────────────────────
function VennView() {
  const [rows, setRows] = useState<Venn[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState<string | null>(null)
  const [label, setLabel] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('co_venn').select('*').order('sort_order')
    setRows((data as Venn[]) || []); setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const add = async (side: string) => {
    if (!label.trim()) return
    const order = Math.max(0, ...rows.filter(r => r.side === side).map(r => r.sort_order)) + 1
    await supabase.from('co_venn').insert({ side, label: label.trim(), sort_order: order, updated_at: now() })
    setLabel(''); setAdding(null); fetchAll()
  }
  const remove = async (id: string) => { await supabase.from('co_venn').delete().eq('id', id); fetchAll() }

  if (loading) return <p className="text-gray-500 text-sm">불러오는 중...</p>

  const cols = [
    { key: 'company', label: '회사가 얻는 것', color: '#85b7eb' },
    { key: 'overlap', label: '교집합 — 둘 다 이득', color: '#5dcaa5' },
    { key: 'me', label: '내가 얻는 것', color: '#f0997b' },
  ]
  return (
    <div>
      <p className="text-[11px] text-gray-600 mb-3">교집합을 넓히는 게 정렬. 상무가 공을 가져가도 내 산출물만 미리 정의해두면 괜찮다.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {cols.map(c => (
          <div key={c.key} className="bg-gray-900 rounded-2xl p-4">
            <p className="text-xs uppercase tracking-widest mb-3" style={{ color: c.color }}>{c.label}</p>
            <div className="space-y-1.5">
              {rows.filter(r => r.side === c.key).map(r => (
                <div key={r.id} className="flex items-start gap-2 text-[13px] text-gray-300 group">
                  <span className="mt-0.5" style={{ color: c.color }}>·</span>
                  <span className="flex-1">{r.label}</span>
                  <button onClick={() => remove(r.id)} className="text-[11px] text-gray-800 group-hover:text-gray-600 hover:!text-red-400">✕</button>
                </div>
              ))}
            </div>
            {adding === c.key ? (
              <div className="flex gap-1.5 mt-2">
                <input autoFocus value={label} onChange={e => setLabel(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') add(c.key); if (e.key === 'Escape') setAdding(null) }}
                  placeholder="추가" className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm outline-none placeholder:text-gray-700 min-w-0" />
                <button onClick={() => add(c.key)} className="px-2.5 rounded-lg bg-gray-800 text-xs shrink-0">+</button>
              </div>
            ) : (
              <button onClick={() => { setAdding(c.key); setLabel('') }} className="mt-2 text-[11px] text-gray-600 hover:text-gray-400">+ 추가</button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 일의 사분면 ─────────────────────────────────────────
function QuadrantView() {
  const [rows, setRows] = useState<Quad[]>([])
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('co_quadrant').select('*').order('sort_order')
    setRows((data as Quad[]) || []); setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const add = async () => {
    if (!label.trim()) return
    const order = Math.max(0, ...rows.map(r => r.sort_order)) + 1
    await supabase.from('co_quadrant').insert({ label: label.trim(), sort_order: order, updated_at: now() })
    setLabel(''); fetchAll()
  }
  const patch = async (r: Quad, p: Partial<Quad>) => {
    setRows(prev => prev.map(x => x.id === r.id ? { ...x, ...p } : x))
    await supabase.from('co_quadrant').update({ ...p, updated_at: now() }).eq('id', r.id)
  }
  const remove = async (id: string) => { await supabase.from('co_quadrant').delete().eq('id', id); fetchAll() }

  if (loading) return <p className="text-gray-500 text-sm">불러오는 중...</p>

  // 가로 = 회사 중요도(important), 세로 = 경쟁 적음(uncontested)
  const cell = (imp: boolean, unc: boolean) => rows.filter(r => r.important === imp && r.uncontested === unc)
  const Cell = ({ imp, unc, title, hint, hot }: { imp: boolean; unc: boolean; title: string; hint: string; hot?: boolean }) => (
    <div className={`rounded-2xl p-4 min-h-[130px] ${hot ? 'bg-emerald-500/10 border border-emerald-500/25' : 'bg-gray-900'}`}>
      <p className={`text-xs font-bold mb-0.5 ${hot ? 'text-emerald-300' : 'text-gray-400'}`}>{title}</p>
      <p className="text-[10px] text-gray-600 mb-2.5">{hint}</p>
      <div className="space-y-1">
        {cell(imp, unc).map(r => (
          <div key={r.id} className="flex items-center gap-1.5 text-[13px] text-gray-200 group">
            {r.growth && <span className="text-[9px] text-blue-300">★</span>}
            <span className="flex-1">{r.label}</span>
            <button onClick={() => patch(r, { growth: !r.growth })} title="내 성장(이력서 기여)"
              className={`text-[10px] shrink-0 ${r.growth ? 'text-blue-300' : 'text-gray-700 hover:text-gray-500'}`}>★</button>
            <button onClick={() => patch(r, { uncontested: !r.uncontested })} title="세로 이동(경쟁 적음)" className="text-[10px] text-gray-700 hover:text-gray-400 shrink-0">↕</button>
            <button onClick={() => patch(r, { important: !r.important })} title="가로 이동(회사 중요)" className="text-[10px] text-gray-700 hover:text-gray-400 shrink-0">↔</button>
            <button onClick={() => remove(r.id)} className="text-[10px] text-gray-800 group-hover:text-gray-600 hover:!text-red-400 shrink-0">✕</button>
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-3 mb-3 text-[10px] text-gray-600">
        <span>가로 → 회사 중요도</span><span>세로 ↑ 경쟁 적음(무용지용)</span><span className="text-blue-300">★ 내 성장</span>
      </div>
      <div className="grid grid-cols-2 gap-3 mb-2">
        <Cell imp={true} unc={true} title="노리는 칸" hint="회사엔 중요한데 다들 꺼리는 곳" hot />
        <Cell imp={false} unc={true} title="짬 내서" hint="경쟁 없지만 회사엔 덜 중요 — 티 안 나게" />
        <Cell imp={true} unc={false} title="성실히, 최소 공수" hint="중요하지만 경쟁 심함 — 신뢰만 적립" />
        <Cell imp={false} unc={false} title="버리거나 위임" hint="에너지 새는 곳" />
      </div>
      <div className="flex gap-1.5 mt-3">
        <input value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="일 추가 (기본: 노리는 칸 아님 — 화살표로 이동)"
          className="flex-1 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-gray-700" />
        <button onClick={add} className="px-4 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm">추가</button>
      </div>
      <p className="text-[10px] text-gray-700 mt-2">추가하면 &apos;버리거나 위임&apos; 칸에 들어간다. ↔ ↕ 로 칸을 옮기고, ★ 로 내 성장 표시.</p>
    </div>
  )
}
