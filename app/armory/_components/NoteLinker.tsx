'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fetchNotes, type Note } from '@/lib/notes'
import { linkNote } from '@/lib/armory'

// 기체 ↔ 서가 보고서 연결
// 제1원리 노트(리비전마다 한 장)와 달리, 로드맵·분석 같은 PDF 보고서는 서가에 두고 여기서 이어 둔다.

export default function NoteLinker({ unitId, noteIds }: { unitId: string; noteIds: string[] }) {
  const [notes, setNotes] = useState<Note[] | null>(null)
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    fetchNotes('').then(n => { if (alive) setNotes(n) }).catch(() => { if (alive) setNotes([]) })
    return () => { alive = false }
  }, [])

  const linked = useMemo(() => (notes ?? []).filter(n => noteIds.includes(n.id)), [notes, noteIds])
  const cands = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (notes ?? []).filter(n => !noteIds.includes(n.id))
      .filter(n => !s || n.title.toLowerCase().includes(s) || (n.series ?? '').toLowerCase().includes(s))
      .slice(0, 8)
  }, [notes, noteIds, q])

  const toggle = (id: string, on: boolean) =>
    linkNote(unitId, id, on).catch(e => setErr(String(e?.message ?? e)))

  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-bold flex-1">📚 서가 보고서</p>
        <button onClick={() => setAdding(v => !v)} className="text-[11px] text-blue-300 hover:text-blue-200">
          {adding ? '닫기' : '+ 연결'}
        </button>
      </div>
      {notes == null ? <p className="text-[11px] text-gray-600">불러오는 중…</p>
        : linked.length === 0 ? <p className="text-[11px] text-gray-600">연결된 보고서가 없어요.</p>
        : (
          <ul className="space-y-1">
            {linked.map(n => (
              <li key={n.id} className="flex items-baseline gap-2 text-xs">
                <span className="text-gray-600 tabular-nums shrink-0">{n.made_on.slice(2)}</span>
                <Link href={`/notes/${n.id}`} className="text-gray-300 hover:text-white truncate">{n.title}</Link>
                <button onClick={() => toggle(n.id, false)} className="ml-auto text-gray-600 hover:text-red-400 shrink-0" title="연결 끊기">✕</button>
              </li>
            ))}
          </ul>
        )}
      {adding && (
        <div className="mt-3 pt-3 border-t border-gray-800 space-y-1.5">
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="제목·시리즈로 찾기"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs" />
          {cands.map(n => (
            <button key={n.id} onClick={() => toggle(n.id, true)}
              className="block w-full text-left text-xs text-gray-400 hover:text-white truncate">
              + {n.title} <span className="text-gray-600">{n.made_on.slice(2)}</span>
            </button>
          ))}
          {cands.length === 0 && <p className="text-[11px] text-gray-600">맞는 노트가 없어요.</p>}
        </div>
      )}
      {err && <p className="text-[11px] text-red-400 mt-1">{err}</p>}
    </div>
  )
}
