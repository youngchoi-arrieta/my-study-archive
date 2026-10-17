'use client'

import { useState } from 'react'
import {
  TAG_COLORS, createTag, deleteTag, moveTag, updateTag, type NoteTag,
} from '@/lib/notes'

// 태그 편집 — 추가 · 이름 바꾸기 · 색 · 순서 · 삭제
// 이름을 바꾸면 이미 붙어 있는 노트에도 그대로 반영된다 (id 로 연결돼 있으므로).

export default function TagManager({
  tags, counts, onChanged, onClose,
}: {
  tags: NoteTag[]
  counts: Record<string, number>
  onChanged: () => void
  onClose: () => void
}) {
  const [names, setNames] = useState<Record<string, string>>({})
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('')
    try { await fn(); onChanged() }
    catch (e) { setErr(msg(e)) }
    finally { setBusy(false) }
  }

  const rename = (t: NoteTag) => {
    const v = (names[t.id] ?? t.label).trim()
    if (!v || v === t.label) { setNames(n => { const c = { ...n }; delete c[t.id]; return c }); return }
    if (tags.some(o => o.id !== t.id && o.label.trim().toLowerCase() === v.toLowerCase())) {
      setErr(`'${v}' 태그가 이미 있어요.`); return
    }
    run(() => updateTag(t.id, { label: v }))
  }

  const nextColor = (c: string) => TAG_COLORS[(TAG_COLORS.indexOf(c as typeof TAG_COLORS[number]) + 1) % TAG_COLORS.length]

  const add = () => {
    const v = newLabel.trim()
    if (!v) { setErr('태그 이름을 적어 주세요.'); return }
    if (tags.some(o => o.label.trim().toLowerCase() === v.toLowerCase())) { setErr(`'${v}' 태그가 이미 있어요.`); return }
    run(async () => { await createTag(v); setNewLabel('') })
  }

  const remove = (t: NoteTag) => {
    const n = counts[t.id] ?? 0
    const warn = n ? `'${t.label}' 태그를 지울까요?\n노트 ${n}개에서 이 태그만 떨어지고, 노트는 그대로 남아요.` : `'${t.label}' 태그를 지울까요?`
    if (!confirm(warn)) return
    run(() => deleteTag(t.id))
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-300 font-semibold">태그 편집</p>
        <button onClick={onClose} className="text-[11px] text-gray-500 hover:text-gray-300">완료</button>
      </div>

      <ul className="space-y-1.5">
        {tags.map((t, i) => (
          <li key={t.id} className="flex items-center gap-2">
            <button
              onClick={() => run(() => updateTag(t.id, { color: nextColor(t.color) }))}
              disabled={busy}
              className="w-5 h-5 rounded-full shrink-0 border border-black/30"
              style={{ backgroundColor: t.color }}
              title="눌러서 색 바꾸기" aria-label={`${t.label} 색 바꾸기`}
            />
            <input
              value={names[t.id] ?? t.label}
              onChange={e => setNames(n => ({ ...n, [t.id]: e.target.value }))}
              onBlur={() => rename(t)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) (e.target as HTMLInputElement).blur() }}
              className="flex-1 min-w-0 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-2.5 py-1 text-sm outline-none"
            />
            <span className="text-[10px] text-gray-600 w-8 text-right shrink-0">{counts[t.id] ?? 0}권</span>
            <button onClick={() => run(() => moveTag(tags, t.id, -1))} disabled={busy || i === 0}
              className="text-xs text-gray-500 hover:text-gray-200 disabled:opacity-20 px-1" aria-label="위로">↑</button>
            <button onClick={() => run(() => moveTag(tags, t.id, 1))} disabled={busy || i === tags.length - 1}
              className="text-xs text-gray-500 hover:text-gray-200 disabled:opacity-20 px-1" aria-label="아래로">↓</button>
            <button onClick={() => remove(t)} disabled={busy}
              className="text-xs text-gray-600 hover:text-red-400 px-1" aria-label={`${t.label} 삭제`}>✕</button>
          </li>
        ))}
        {!tags.length && <li className="text-xs text-gray-600">태그가 없어요. 아래에서 추가하세요.</li>}
      </ul>

      <div className="flex gap-1.5">
        <input
          value={newLabel}
          onChange={e => { setNewLabel(e.target.value); setErr('') }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) add() }}
          placeholder="새 태그 (예: 배전망ESS)"
          className="flex-1 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-1.5 text-sm outline-none placeholder:text-gray-700"
        />
        <button onClick={add} disabled={busy}
          className="px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold">추가</button>
      </div>
      {err && <p className="text-[11px] text-red-400">{err}</p>}
    </div>
  )
}

function msg(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return '저장하지 못했어요.'
}
