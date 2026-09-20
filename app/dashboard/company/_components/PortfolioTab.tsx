'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { OUTPUT_KINDS, WATCH_LAYERS, RESUME_STATUS, RESUME_STATUS_CYCLE, type ResumeStatus } from '@/lib/constants-company'

type Inner = 'watch' | 'outputs' | 'projects'
const now = () => new Date().toISOString()

interface Watch { id: string; channel: string; url: string | null; cadence: string | null; layer: string | null; sort_order: number }
interface Output { id: string; title: string; kind: string; status: ResumeStatus; link: string | null; sort_order: number }
interface Project { id: string; site: string; scale: string | null; role: string | null; period: string | null; note: string | null; sort_order: number }

export default function PortfolioTab() {
  const [inner, setInner] = useState<Inner>('projects')
  return (
    <div>
      <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-4 w-fit">
        {([['projects', '프로젝트 실적'], ['outputs', '산출물'], ['watch', '업계 동향']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setInner(k)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition ${inner === k ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{l}</button>
        ))}
      </div>
      {inner === 'projects' && <ProjectsView />}
      {inner === 'outputs' && <OutputsView />}
      {inner === 'watch' && <WatchView />}
    </div>
  )
}

// ── 프로젝트 실적 ───────────────────────────────────────
function ProjectsView() {
  const [rows, setRows] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [d, setD] = useState({ site: '', scale: '', role: '', period: '', note: '' })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('co_projects').select('*').order('sort_order', { ascending: false })
    setRows((data as Project[]) || []); setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const add = async () => {
    if (!d.site.trim()) return
    const order = Math.max(0, ...rows.map(r => r.sort_order)) + 1
    await supabase.from('co_projects').insert({
      site: d.site.trim(), scale: d.scale.trim() || null, role: d.role.trim() || null,
      period: d.period.trim() || null, note: d.note.trim() || null, sort_order: order, updated_at: now(),
    })
    setD({ site: '', scale: '', role: '', period: '', note: '' }); setOpen(false); fetchAll()
  }
  const remove = async (id: string) => { if (confirm('지울까요?')) { await supabase.from('co_projects').delete().eq('id', id); fetchAll() } }

  const inp = 'bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-gray-700'
  if (loading) return <p className="text-gray-500 text-sm">불러오는 중...</p>
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-600">site · MW/MWh · 역할 — 목표 이력서의 재료. 모든 경로가 요구하는 습관.</p>
      {rows.map(p => (
        <div key={p.id} className="bg-gray-900 rounded-2xl p-4 group">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-gray-100">{p.site}</span>
                {p.scale && <span className="text-[11px] text-teal-300">{p.scale}</span>}
                {p.period && <span className="text-[11px] text-gray-600">{p.period}</span>}
              </div>
              {p.role && <p className="text-[13px] text-gray-300 mt-0.5">{p.role}</p>}
              {p.note && <p className="text-[12px] text-gray-500 mt-0.5">{p.note}</p>}
            </div>
            <button onClick={() => remove(p.id)} className="text-[11px] text-gray-800 group-hover:text-gray-600 hover:!text-red-400 shrink-0">✕</button>
          </div>
        </div>
      ))}
      {!rows.length && <p className="text-gray-600 text-sm text-center py-6">입사 후 사이트를 겪으며 채웁니다.</p>}
      {open ? (
        <div className="bg-gray-900 rounded-2xl p-4 space-y-2 border border-gray-800">
          <input value={d.site} onChange={e => setD({ ...d, site: e.target.value })} placeholder="사이트명" className={`${inp} w-full`} />
          <div className="grid grid-cols-2 gap-2">
            <input value={d.scale} onChange={e => setD({ ...d, scale: e.target.value })} placeholder="규모 (MW/MWh)" className={inp} />
            <input value={d.period} onChange={e => setD({ ...d, period: e.target.value })} placeholder="기간" className={inp} />
          </div>
          <input value={d.role} onChange={e => setD({ ...d, role: e.target.value })} placeholder="내 역할" className={`${inp} w-full`} />
          <input value={d.note} onChange={e => setD({ ...d, note: e.target.value })} placeholder="기자재 조합·메모 (선택)" className={`${inp} w-full`} />
          <div className="flex gap-2"><button onClick={add} className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold">저장</button><button onClick={() => setOpen(false)} className="px-4 text-gray-500 text-sm">취소</button></div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full border border-dashed border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-xl py-3 text-sm font-semibold transition">+ 프로젝트 추가</button>
      )}
    </div>
  )
}

// ── 산출물 ──────────────────────────────────────────────
function OutputsView() {
  const [rows, setRows] = useState<Output[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [d, setD] = useState({ title: '', kind: '문서', link: '' })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('co_outputs').select('*').order('sort_order')
    setRows((data as Output[]) || []); setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const add = async () => {
    if (!d.title.trim()) return
    const order = Math.max(0, ...rows.map(r => r.sort_order)) + 1
    await supabase.from('co_outputs').insert({ title: d.title.trim(), kind: d.kind, link: d.link.trim() || null, status: 'progress', sort_order: order, updated_at: now() })
    setD({ title: '', kind: '문서', link: '' }); setOpen(false); fetchAll()
  }
  const cycle = async (r: Output) => {
    const next = RESUME_STATUS_CYCLE[(RESUME_STATUS_CYCLE.indexOf(r.status) + 1) % RESUME_STATUS_CYCLE.length]
    setRows(p => p.map(x => x.id === r.id ? { ...x, status: next } : x))
    await supabase.from('co_outputs').update({ status: next, updated_at: now() }).eq('id', r.id)
  }
  const remove = async (id: string) => { await supabase.from('co_outputs').delete().eq('id', id); fetchAll() }

  const inp = 'bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-gray-700'
  if (loading) return <p className="text-gray-500 text-sm">불러오는 중...</p>
  return (
    <div className="space-y-2">
      {rows.map(r => {
        const st = RESUME_STATUS[r.status]
        return (
          <div key={r.id} className="bg-gray-900 rounded-xl px-3 py-2.5 flex items-center gap-2.5 group">
            <button onClick={() => cycle(r)} title={st.label}
              className="w-5 h-5 rounded-md shrink-0 text-[12px] leading-none font-bold flex items-center justify-center"
              style={{ color: st.color, backgroundColor: st.color + '1a' }}>{st.mark}</button>
            <div className="flex-1 min-w-0">
              {r.link ? <a href={r.link} target="_blank" rel="noreferrer" className="text-sm text-gray-100 hover:text-blue-300 truncate block">{r.title}</a>
                : <span className="text-sm text-gray-100">{r.title}</span>}
            </div>
            <span className="text-[10px] text-gray-600 shrink-0">{r.kind}</span>
            <button onClick={() => remove(r.id)} className="text-[11px] text-gray-800 group-hover:text-gray-600 hover:!text-red-400 shrink-0">✕</button>
          </div>
        )
      })}
      {open ? (
        <div className="bg-gray-900 rounded-2xl p-4 space-y-2 border border-gray-800">
          <input value={d.title} onChange={e => setD({ ...d, title: e.target.value })} placeholder="산출물 이름" className={`${inp} w-full`} />
          <div className="grid grid-cols-2 gap-2">
            <select value={d.kind} onChange={e => setD({ ...d, kind: e.target.value })} className={inp}>{OUTPUT_KINDS.map(k => <option key={k} value={k}>{k}</option>)}</select>
            <input value={d.link} onChange={e => setD({ ...d, link: e.target.value })} placeholder="링크 (선택)" className={inp} />
          </div>
          <div className="flex gap-2"><button onClick={add} className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold">저장</button><button onClick={() => setOpen(false)} className="px-4 text-gray-500 text-sm">취소</button></div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full border border-dashed border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-xl py-3 text-sm font-semibold transition">+ 산출물 추가</button>
      )}
    </div>
  )
}

// ── 업계 동향 ───────────────────────────────────────────
function WatchView() {
  const [rows, setRows] = useState<Watch[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [d, setD] = useState({ channel: '', url: '', cadence: '수시', layer: '운영' })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('co_watch').select('*').order('sort_order')
    setRows((data as Watch[]) || []); setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const add = async () => {
    if (!d.channel.trim()) return
    const order = Math.max(0, ...rows.map(r => r.sort_order)) + 1
    await supabase.from('co_watch').insert({ channel: d.channel.trim(), url: d.url.trim() || null, cadence: d.cadence, layer: d.layer, sort_order: order, updated_at: now() })
    setD({ channel: '', url: '', cadence: '수시', layer: '운영' }); setOpen(false); fetchAll()
  }
  const remove = async (id: string) => { await supabase.from('co_watch').delete().eq('id', id); fetchAll() }

  const inp = 'bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-gray-700'
  const layerColor = (l: string | null) => ({ 제조: '#f472b6', EPC: '#f0997b', 운영: '#85b7eb', 정책: '#a78bfa' }[l || ''] || '#94a3b8')
  if (loading) return <p className="text-gray-500 text-sm">불러오는 중...</p>
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-gray-600 mb-1">뉴스가 나올 때마다 &quot;몇 번째 층 얘기지?&quot;만 물어도 위치가 잡힌다.</p>
      {rows.map(r => (
        <div key={r.id} className="bg-gray-900 rounded-xl px-3 py-2.5 flex items-center gap-2.5 group">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: layerColor(r.layer) }} />
          <div className="flex-1 min-w-0">
            {r.url ? <a href={r.url} target="_blank" rel="noreferrer" className="text-sm text-gray-100 hover:text-blue-300 truncate block">{r.channel}</a>
              : <span className="text-sm text-gray-100">{r.channel}</span>}
          </div>
          {r.layer && <span className="text-[10px] shrink-0" style={{ color: layerColor(r.layer) }}>{r.layer}</span>}
          {r.cadence && <span className="text-[10px] text-gray-600 shrink-0">{r.cadence}</span>}
          <button onClick={() => remove(r.id)} className="text-[11px] text-gray-800 group-hover:text-gray-600 hover:!text-red-400 shrink-0">✕</button>
        </div>
      ))}
      {open ? (
        <div className="bg-gray-900 rounded-2xl p-4 space-y-2 border border-gray-800">
          <input value={d.channel} onChange={e => setD({ ...d, channel: e.target.value })} placeholder="채널명" className={`${inp} w-full`} />
          <input value={d.url} onChange={e => setD({ ...d, url: e.target.value })} placeholder="URL (선택)" className={`${inp} w-full`} />
          <div className="grid grid-cols-2 gap-2">
            <select value={d.layer} onChange={e => setD({ ...d, layer: e.target.value })} className={inp}>{WATCH_LAYERS.map(l => <option key={l} value={l}>{l}</option>)}</select>
            <input value={d.cadence} onChange={e => setD({ ...d, cadence: e.target.value })} placeholder="주기" className={inp} />
          </div>
          <div className="flex gap-2"><button onClick={add} className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold">저장</button><button onClick={() => setOpen(false)} className="px-4 text-gray-500 text-sm">취소</button></div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full border border-dashed border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-xl py-3 text-sm font-semibold transition">+ 채널 추가</button>
      )}
    </div>
  )
}
