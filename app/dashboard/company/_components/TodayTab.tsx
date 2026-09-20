'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { ITEM_GROUPS, LOCUS, type ItemGrp } from '@/lib/constants-company'

interface Item { id: string; grp: ItemGrp; mode: string; label: string; sort_order: number; active: boolean }
interface Day {
  day: string; checks: Record<string, boolean>; intent: string | null
  distress: boolean | null; locus: string | null; note: string | null
}
interface Pending { id: string; body: string; person: string | null; day: string }

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TodayTab() {
  const [items, setItems] = useState<Item[]>([])
  const [day, setDay] = useState<Day | null>(null)
  const [pending, setPending] = useState<Pending[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState(false)
  const [adding, setAdding] = useState<ItemGrp | null>(null)
  const [newLabel, setNewLabel] = useState('')
  const D = todayStr()

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [it, dy, pd] = await Promise.all([
      supabase.from('co_items').select('*').eq('active', true).order('sort_order'),
      supabase.from('co_days').select('*').eq('day', D).maybeSingle(),
      supabase.from('co_journal').select('id,body,person,day')
        .eq('action_needed', true).eq('resolved', false).order('day', { ascending: true }),
    ])
    setItems((it.data as Item[]) || [])
    setDay((dy.data as Day) ?? { day: D, checks: {}, intent: null, distress: null, locus: null, note: null })
    setPending((pd.data as Pending[]) || [])
    setLoading(false)
  }, [D])
  useEffect(() => { fetchAll() }, [fetchAll])

  const grp = (g: ItemGrp) => items.filter(i => i.grp === g)

  // co_days 부분 갱신 (upsert)
  const patchDay = async (patch: Partial<Day>) => {
    const next = { ...(day as Day), ...patch }
    setDay(next)
    await supabase.from('co_days').upsert({
      day: D, checks: next.checks, intent: next.intent,
      distress: next.distress, locus: next.locus, note: next.note,
      updated_at: new Date().toISOString(),
    })
  }

  const toggleCheck = (id: string) => {
    const checks = { ...(day?.checks || {}) }
    checks[id] = !checks[id]
    patchDay({ checks })
  }

  const addItem = async (g: ItemGrp) => {
    if (!newLabel.trim()) return
    const order = Math.max(0, ...grp(g).map(i => i.sort_order)) + 1
    await supabase.from('co_items').insert({
      grp: g, mode: ITEM_GROUPS[g].mode, label: newLabel.trim(), sort_order: order,
      updated_at: new Date().toISOString(),
    })
    setNewLabel(''); setAdding(null); fetchAll()
  }
  const delItem = async (id: string) => {
    await supabase.from('co_items').update({ active: false }).eq('id', id)
    fetchAll()
  }

  const resolvePending = async (id: string) => {
    setPending(p => p.filter(x => x.id !== id))
    await supabase.from('co_journal').update({ resolved: true }).eq('id', id)
  }

  if (loading) return <p className="text-gray-500 text-sm">불러오는 중...</p>

  const north = grp('north')

  return (
    <div className="space-y-4">

      {/* 북극성 */}
      {north.map(n => (
        <div key={n.id} className="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-5 py-3.5">
          <p className="text-[10px] text-rose-300/70 uppercase tracking-widest mb-0.5">북극성 · 단 하나의 기준</p>
          <p className="text-sm font-bold text-rose-200 leading-snug">{n.label}</p>
        </div>
      ))}

      {/* 미완료 지시 — 유지 고리 */}
      {pending.length > 0 && (
        <div className="bg-pink-500/5 border border-pink-500/20 rounded-2xl p-4">
          <p className="text-[11px] text-pink-300 uppercase tracking-widest mb-2">아직 안 끝난 지시</p>
          <div className="space-y-1.5">
            {pending.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <button onClick={() => resolvePending(p.id)}
                  className="w-4 h-4 rounded shrink-0 bg-gray-800 hover:bg-green-600 text-transparent hover:text-white text-[10px] leading-none transition">✓</button>
                <span className="flex-1 truncate">{p.body}</span>
                {p.person && <span className="text-[10px] text-gray-600 shrink-0">{p.person}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 오늘의 한 줄 */}
      <input value={day?.intent || ''} onChange={e => setDay(d => d && { ...d, intent: e.target.value })}
        onBlur={() => patchDay({ intent: day?.intent || null })}
        placeholder="오늘의 한 줄 (선택)"
        className="w-full bg-gray-900 border border-gray-800 focus:border-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none transition placeholder:text-gray-700" />

      {/* 위생·준비 — 매일 체크 */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-teal-300 uppercase tracking-widest">{ITEM_GROUPS.prep.label} · 매일 체크</p>
          <button onClick={() => setEdit(v => !v)}
            className="text-[10px] text-gray-600 hover:text-gray-400">{edit ? '완료' : '편집'}</button>
        </div>
        <div className="space-y-1.5">
          {grp('prep').map(i => {
            const on = !!day?.checks?.[i.id]
            return (
              <div key={i.id} className="flex items-center gap-2.5">
                <button onClick={() => toggleCheck(i.id)}
                  className={`w-5 h-5 rounded-md shrink-0 text-[11px] leading-none transition ${on ? 'bg-teal-600 text-white' : 'bg-gray-800 text-transparent hover:bg-gray-700'}`}>✓</button>
                <span className={`text-sm flex-1 ${on ? 'text-gray-500 line-through' : 'text-gray-200'}`}>{i.label}</span>
                {edit && <button onClick={() => delItem(i.id)} className="text-[11px] text-gray-700 hover:text-red-400">✕</button>}
              </div>
            )
          })}
        </div>
        {edit && <AddRow g="prep" adding={adding} setAdding={setAdding} newLabel={newLabel} setNewLabel={setNewLabel} onAdd={addItem} />}
      </div>

      {/* 태도 리마인더 — 고정, 체크 없음 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(['avoid', 'strive'] as const).map(g => (
          <div key={g} className="bg-gray-900 rounded-2xl p-4">
            <p className={`text-xs uppercase tracking-widest mb-3 ${g === 'avoid' ? 'text-amber-300' : 'text-emerald-300'}`}>
              {ITEM_GROUPS[g].label}
            </p>
            <ul className="space-y-1.5">
              {grp(g).map(i => (
                <li key={i.id} className="flex items-start gap-2 text-[13px] text-gray-300 leading-snug">
                  <span className="text-gray-700 mt-0.5">{g === 'avoid' ? '✕' : '·'}</span>
                  <span className="flex-1">{i.label}</span>
                  {edit && <button onClick={() => delItem(i.id)} className="text-[11px] text-gray-700 hover:text-red-400">✕</button>}
                </li>
              ))}
            </ul>
            {edit && <AddRow g={g} adding={adding} setAdding={setAdding} newLabel={newLabel} setNewLabel={setNewLabel} onAdd={addItem} />}
          </div>
        ))}
      </div>

      {/* 저녁 반성 — 삼분법 */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <p className="text-xs text-purple-300 uppercase tracking-widest mb-1">저녁 반성 (선택)</p>
        <p className="text-[10px] text-gray-600 mb-3">괴로웠다면 그게 내가 제어할 수 없는 걸 제어하려던 건지. 자책 아님.</p>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-gray-400">오늘 괴로운 일</span>
          <button onClick={() => patchDay({ distress: !day?.distress, ...(day?.distress ? { locus: null } : {}) })}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition ${day?.distress ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-500'}`}>
            {day?.distress ? '있었다' : '없음'}
          </button>
        </div>
        {day?.distress && (
          <>
            <div className="flex gap-1.5 mb-3">
              {LOCUS.map(l => (
                <button key={l.key} onClick={() => patchDay({ locus: l.key })}
                  className="flex-1 py-2 rounded-lg text-xs font-bold transition border"
                  style={day?.locus === l.key
                    ? { backgroundColor: l.color + '22', borderColor: l.color, color: l.color }
                    : { borderColor: '#1f2937', color: '#6b7280' }}>
                  {l.label}
                </button>
              ))}
            </div>
            <input value={day?.note || ''} onChange={e => setDay(d => d && { ...d, note: e.target.value })}
              onBlur={() => patchDay({ note: day?.note || null })}
              placeholder="한 줄 (선택)"
              className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition placeholder:text-gray-700" />
          </>
        )}
      </div>

    </div>
  )
}

function AddRow({ g, adding, setAdding, newLabel, setNewLabel, onAdd }: {
  g: ItemGrp
  adding: ItemGrp | null; setAdding: (v: ItemGrp | null) => void
  newLabel: string; setNewLabel: (v: string) => void
  onAdd: (g: ItemGrp) => void
}) {
  if (adding !== g) {
    return (
      <button onClick={() => { setAdding(g); setNewLabel('') }}
        className="mt-2 text-[11px] text-gray-600 hover:text-gray-400">+ 항목 추가</button>
    )
  }
  return (
    <div className="flex gap-1.5 mt-2">
      <input autoFocus value={newLabel} onChange={e => setNewLabel(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') onAdd(g); if (e.key === 'Escape') setAdding(null) }}
        placeholder="새 항목"
        className="flex-1 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-1.5 text-sm outline-none placeholder:text-gray-700" />
      <button onClick={() => onAdd(g)} className="px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs">추가</button>
      <button onClick={() => setAdding(null)} className="px-2 text-gray-600 text-xs">취소</button>
    </div>
  )
}
