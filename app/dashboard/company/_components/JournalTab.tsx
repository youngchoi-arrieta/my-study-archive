'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { JOURNAL_KINDS } from '@/lib/constants-company'

interface Entry {
  id: string; day: string; kind: string; person: string | null
  body: string; action_needed: boolean; resolved: boolean
}

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const kindColor = (k: string) => JOURNAL_KINDS.find(x => x.key === k)?.color ?? '#94a3b8'

export default function JournalTab() {
  const [rows, setRows] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<string>('관찰')
  const [body, setBody] = useState('')
  const [person, setPerson] = useState('')
  const [onlyPending, setOnlyPending] = useState(false)
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('co_journal').select('*')
      .order('day', { ascending: false }).order('created_at', { ascending: false })
    setRows((data as Entry[]) || [])
    setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const add = async () => {
    if (!body.trim() || saving) return
    setSaving(true)
    const { error } = await supabase.from('co_journal').insert({
      day: todayStr(), kind, body: body.trim(),
      person: person.trim() || null,
      action_needed: kind === '지시',
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) { alert(`저장하지 못했습니다.\n${error.message}`); return }
    setBody(''); setPerson(''); fetchAll()
  }

  const toggleResolved = async (e: Entry) => {
    setRows(prev => prev.map(x => x.id === e.id ? { ...x, resolved: !x.resolved } : x))
    await supabase.from('co_journal').update({ resolved: !e.resolved }).eq('id', e.id)
  }
  const remove = async (e: Entry) => {
    if (!confirm('이 기록을 지울까요?')) return
    await supabase.from('co_journal').delete().eq('id', e.id)
    fetchAll()
  }

  const visible = useMemo(
    () => onlyPending ? rows.filter(r => r.action_needed && !r.resolved) : rows,
    [rows, onlyPending],
  )
  const grouped = useMemo(() => {
    const m = new Map<string, Entry[]>()
    visible.forEach(r => { (m.get(r.day) ?? m.set(r.day, []).get(r.day)!).push(r) })
    return [...m.entries()]
  }, [visible])

  return (
    <div className="space-y-4">

      {/* 입력 */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <div className="flex gap-1.5 mb-2.5">
          {JOURNAL_KINDS.map(k => (
            <button key={k.key} onClick={() => setKind(k.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition border"
              style={kind === k.key
                ? { backgroundColor: k.color + '22', borderColor: k.color, color: k.color }
                : { borderColor: '#1f2937', color: '#6b7280' }}>
              {k.key}
            </button>
          ))}
        </div>
        <textarea value={body} onChange={e => setBody(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) add() }}
          placeholder={kind === '지시' ? '받은 지시 — 요약해서 되짚기 (⌘/Ctrl+Enter 저장)' : '한 줄 기록 (⌘/Ctrl+Enter 저장)'}
          rows={2}
          className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition resize-none placeholder:text-gray-700 mb-2" />
        <div className="flex gap-2">
          <input value={person} onChange={e => setPerson(e.target.value)}
            placeholder="상대 (선택)"
            className="flex-1 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-1.5 text-sm outline-none placeholder:text-gray-700" />
          <button onClick={add} disabled={!body.trim() || saving}
            className="px-5 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40 text-sm font-semibold transition">
            기록
          </button>
        </div>
        {kind === '지시' && <p className="text-[10px] text-pink-300/70 mt-2">지시는 팔로업 대상 — 끝나면 체크. 안 끝난 건 &apos;오늘&apos; 상단에 뜬다.</p>}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-[11px] text-gray-600">{visible.length}건</p>
        <button onClick={() => setOnlyPending(v => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${onlyPending ? 'bg-pink-500/20 text-pink-300' : 'bg-gray-900 text-gray-500'}`}>
          미완료 지시만
        </button>
      </div>

      {/* 목록 */}
      {loading ? <p className="text-gray-500 text-sm">불러오는 중...</p> : grouped.map(([d, es]) => (
        <div key={d}>
          <p className="text-[11px] text-gray-600 mb-1.5 sticky top-0 bg-gray-950 py-1">{d}</p>
          <div className="space-y-1.5">
            {es.map(e => (
              <div key={e.id} className="bg-gray-900 rounded-xl px-3 py-2.5 flex items-start gap-2.5 group">
                {e.action_needed ? (
                  <button onClick={() => toggleResolved(e)}
                    className={`w-4 h-4 rounded shrink-0 mt-0.5 text-[10px] leading-none transition ${e.resolved ? 'bg-green-600 text-white' : 'bg-gray-800 text-transparent hover:bg-gray-700'}`}>✓</button>
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0 mt-2" style={{ backgroundColor: kindColor(e.kind) }} />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${e.resolved ? 'text-gray-600 line-through' : 'text-gray-200'}`}>{e.body}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px]" style={{ color: kindColor(e.kind) }}>{e.kind}</span>
                    {e.person && <span className="text-[10px] text-gray-600">· {e.person}</span>}
                  </div>
                </div>
                <button onClick={() => remove(e)}
                  className="text-[11px] text-gray-800 group-hover:text-gray-600 hover:!text-red-400 shrink-0">✕</button>
              </div>
            ))}
          </div>
        </div>
      ))}
      {!loading && !visible.length && <p className="text-gray-600 text-sm text-center py-8">아직 기록이 없습니다.</p>}
    </div>
  )
}
