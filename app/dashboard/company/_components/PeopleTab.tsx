'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { PEOPLE_PIN } from '@/lib/constants-company'

interface Person { id: string; name: string; role: string | null; strengths: string | null; cautions: string | null; sort_order: number }
const now = () => new Date().toISOString()

export default function PeopleTab() {
  const [unlocked, setUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [rows, setRows] = useState<Person[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [d, setD] = useState({ name: '', role: '', strengths: '', cautions: '' })

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('co_people').select('*').order('sort_order')
    setRows((data as Person[]) || []); setLoading(false)
  }, [])
  useEffect(() => { if (unlocked) fetchAll() }, [unlocked, fetchAll])

  const tryUnlock = () => { if (pin === PEOPLE_PIN) { setUnlocked(true); setPin('') } else alert('PIN이 맞지 않습니다.') }

  const add = async () => {
    if (!d.name.trim()) return
    const order = Math.max(0, ...rows.map(r => r.sort_order)) + 1
    await supabase.from('co_people').insert({
      name: d.name.trim(), role: d.role.trim() || null,
      strengths: d.strengths.trim() || null, cautions: d.cautions.trim() || null,
      sort_order: order, updated_at: now(),
    })
    setD({ name: '', role: '', strengths: '', cautions: '' }); setOpen(false); fetchAll()
  }
  const remove = async (id: string) => { if (confirm('지울까요?')) { await supabase.from('co_people').delete().eq('id', id); fetchAll() } }

  const inp = 'bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none placeholder:text-gray-700'

  if (!unlocked) {
    return (
      <div className="bg-gray-900 rounded-2xl p-8 text-center max-w-sm mx-auto mt-6">
        <p className="text-3xl mb-3">🔒</p>
        <p className="text-sm text-gray-300 font-semibold mb-1">사람</p>
        <p className="text-[11px] text-gray-600 mb-5 leading-relaxed">
          조직 맥락 메모. 회사에서 열지 않는 게 원칙이고, 화면 힐끗·자리비움 대비의 얇은 자물쇠입니다.
        </p>
        <div className="flex gap-2">
          <input type="password" value={pin} onChange={e => setPin(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') tryUnlock() }}
            placeholder="PIN" className={`${inp} flex-1 text-center`} />
          <button onClick={tryUnlock} className="px-5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold">열기</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-amber-300/80">평가 말고 사실·맥락만. &quot;별로다&quot;가 아니라 &quot;현장 경험 많고 통합 때 업무 늘었다&quot;.</p>
        <button onClick={() => setUnlocked(false)} className="text-[11px] text-gray-600 hover:text-gray-400">🔒 잠그기</button>
      </div>
      {loading ? <p className="text-gray-500 text-sm">불러오는 중...</p> : rows.map(p => (
        <div key={p.id} className="bg-gray-900 rounded-2xl p-4 group">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-100">{p.name}</span>
                {p.role && <span className="text-[11px] text-gray-500">{p.role}</span>}
              </div>
              {p.strengths && <p className="text-[13px] text-emerald-300/80 mt-1.5"><span className="text-gray-600">강점 </span>{p.strengths}</p>}
              {p.cautions && <p className="text-[13px] text-amber-300/80 mt-0.5"><span className="text-gray-600">주의 </span>{p.cautions}</p>}
            </div>
            <button onClick={() => remove(p.id)} className="text-[11px] text-gray-800 group-hover:text-gray-600 hover:!text-red-400 shrink-0">✕</button>
          </div>
        </div>
      ))}
      {open ? (
        <div className="bg-gray-900 rounded-2xl p-4 space-y-2 border border-gray-800">
          <div className="grid grid-cols-2 gap-2">
            <input value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="이름" className={inp} />
            <input value={d.role} onChange={e => setD({ ...d, role: e.target.value })} placeholder="직급·부서 (사실)" className={inp} />
          </div>
          <input value={d.strengths} onChange={e => setD({ ...d, strengths: e.target.value })} placeholder="강점·특기 (사실)" className={`${inp} w-full`} />
          <input value={d.cautions} onChange={e => setD({ ...d, cautions: e.target.value })} placeholder="주의점 (사실·맥락만, 험담 금지)" className={`${inp} w-full`} />
          <div className="flex gap-2"><button onClick={add} className="px-5 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold">저장</button><button onClick={() => setOpen(false)} className="px-4 text-gray-500 text-sm">취소</button></div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} className="w-full border border-dashed border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-xl py-3 text-sm font-semibold transition">+ 사람 추가</button>
      )}
    </div>
  )
}
