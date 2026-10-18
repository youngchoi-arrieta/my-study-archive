'use client'

import { useRef, useState } from 'react'
import {
  TAG_COLORS, createTag, deleteTag, moveTagTo, sortTags, updateTag, type NoteTag,
} from '@/lib/notes'

// 태그 편집 — 추가 · 이름 바꾸기 · 색 · 순서 · 삭제
// 순서: 위에 있을수록 중요. 서가 칩·책장 선반·노트가 꽂힐 선반이 모두 이 순서를 따른다.
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
  const [dragId, setDragId] = useState<string | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const pendingEnter = useRef(false)

  const sorted = sortTags(tags)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('')
    try { await fn() }
    catch (e) { setErr(msg(e)) }
    finally { setBusy(false); onChanged() }
  }

  const rename = (t: NoteTag) => {
    const v = (names[t.id] ?? t.label).trim()
    setNames(n => { const c = { ...n }; delete c[t.id]; return c })
    if (!v || v === t.label) return
    if (tags.some(o => o.id !== t.id && o.label.trim().toLowerCase() === v.toLowerCase())) {
      setErr(`'${v}' 태그가 이미 있어요.`); return
    }
    run(() => updateTag(t.id, { label: v }))
  }

  const nextColor = (c: string) => TAG_COLORS[(TAG_COLORS.indexOf(c as typeof TAG_COLORS[number]) + 1) % TAG_COLORS.length]

  const add = (raw: string) => {
    const v = raw.trim().replace(/^#/, '')
    if (!v) { setErr('태그 이름을 적어 주세요.'); return }
    if (tags.some(o => o.label.trim().toLowerCase() === v.toLowerCase())) { setErr(`'${v}' 태그가 이미 있어요.`); return }
    setNewLabel('')
    run(() => createTag(v))
  }

  const remove = (t: NoteTag) => {
    const n = counts[t.id] ?? 0
    const warn = n ? `'${t.label}' 태그를 지울까요?\n노트 ${n}개에서 이 태그만 떨어지고, 노트는 그대로 남아요.` : `'${t.label}' 태그를 지울까요?`
    if (!confirm(warn)) return
    run(() => deleteTag(t.id))
  }

  const move = (id: string, to: number) => run(() => moveTagTo(tags, id, to))

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-300 font-semibold">태그 편집</p>
          <p className="text-[10px] text-gray-600 mt-0.5">위에 있을수록 중요 · 끌어서 옮기거나 ⤒ 로 맨 위로 · 선반도 이 순서로 놓여요</p>
        </div>
        <button onClick={onClose} className="text-[11px] text-gray-500 hover:text-gray-300 shrink-0">완료</button>
      </div>

      <ul className="space-y-1">
        {sorted.map((t, i) => (
          <li key={t.id}
            draggable={!busy}
            onDragStart={e => { setDragId(t.id); e.dataTransfer.effectAllowed = 'move' }}
            onDragOver={e => { if (dragId) { e.preventDefault(); setOverIdx(i) } }}
            onDragLeave={() => setOverIdx(o => (o === i ? null : o))}
            onDrop={e => { e.preventDefault(); if (dragId && dragId !== t.id) move(dragId, i); setDragId(null); setOverIdx(null) }}
            onDragEnd={() => { setDragId(null); setOverIdx(null) }}
            className={`flex items-center gap-2 rounded-lg px-1 py-0.5 transition ${
              dragId === t.id ? 'opacity-40' : ''} ${overIdx === i && dragId !== t.id ? 'ring-1 ring-blue-500/60 bg-blue-500/5' : ''}`}
          >
            <span className="text-gray-600 cursor-grab select-none text-xs w-3 shrink-0" title="끌어서 순서 바꾸기">⋮⋮</span>
            <span className="text-[10px] text-gray-600 w-4 text-right tabular-nums shrink-0">{i + 1}</span>
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
            <button onClick={() => move(t.id, 0)} disabled={busy || i === 0}
              className="text-xs text-gray-500 hover:text-gray-200 disabled:opacity-20 px-1" aria-label="맨 위로" title="맨 위로">⤒</button>
            <button onClick={() => move(t.id, i - 1)} disabled={busy || i === 0}
              className="text-xs text-gray-500 hover:text-gray-200 disabled:opacity-20 px-1" aria-label="위로">↑</button>
            <button onClick={() => move(t.id, i + 1)} disabled={busy || i === sorted.length - 1}
              className="text-xs text-gray-500 hover:text-gray-200 disabled:opacity-20 px-1" aria-label="아래로">↓</button>
            <button onClick={() => remove(t)} disabled={busy}
              className="text-xs text-gray-500 hover:text-red-400 px-1.5" aria-label={`${t.label} 삭제`} title="삭제">✕</button>
          </li>
        ))}
        {!tags.length && <li className="text-xs text-gray-600">태그가 없어요. 아래에서 추가하세요.</li>}
      </ul>

      <div className="flex gap-1.5">
        <input
          value={newLabel}
          onChange={e => { setNewLabel(e.target.value); setErr('') }}
          onKeyDown={e => {
            if (e.key !== 'Enter') return
            e.preventDefault()
            if (e.nativeEvent.isComposing) { pendingEnter.current = true; return }
            add(e.currentTarget.value)
          }}
          onCompositionEnd={e => { if (pendingEnter.current) { pendingEnter.current = false; add(e.currentTarget.value) } }}
          placeholder="새 태그 (맨 아래에 추가돼요)"
          className="flex-1 min-w-0 bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-1.5 text-sm outline-none placeholder:text-gray-700"
        />
        <button onClick={() => add(newLabel)} disabled={busy}
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
