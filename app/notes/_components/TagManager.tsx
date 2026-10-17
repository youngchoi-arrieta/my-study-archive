'use client'

import { useRef, useState } from 'react'
import {
  RECOMMENDED_TAGS, TAG_COLORS, TAG_GROUPS, createTag, deleteTag, moveTag, seedRecommendedTags,
  sortTags, tagsNeedMigration, updateTag, type NoteTag, type TagGroup,
} from '@/lib/notes'

// 태그 편집 — 추가 · 이름 바꾸기 · 색 · 묶음(성격/주제/기타) · 순서 · 삭제
// 이름을 바꾸면 이미 붙어 있는 노트에도 그대로 반영된다 (id 로 연결돼 있으므로).

const GROUP_CYCLE: (TagGroup | null)[] = ['type', 'topic', null]
const groupLabel = (g: TagGroup | null) => TAG_GROUPS.find(x => x.key === g)?.label ?? '기타'

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
  const [newGrp, setNewGrp] = useState<TagGroup | null>('topic')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const pendingEnter = useRef(false)

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
  const nextGroup = (g: TagGroup | null) => GROUP_CYCLE[(GROUP_CYCLE.indexOf(g) + 1) % GROUP_CYCLE.length]

  const add = (raw: string) => {
    const v = raw.trim().replace(/^#/, '')
    if (!v) { setErr('태그 이름을 적어 주세요.'); return }
    if (tags.some(o => o.label.trim().toLowerCase() === v.toLowerCase())) { setErr(`'${v}' 태그가 이미 있어요.`); return }
    setNewLabel('')
    run(() => createTag(v, { grp: newGrp }))
  }

  const remove = (t: NoteTag) => {
    const n = counts[t.id] ?? 0
    const warn = n ? `'${t.label}' 태그를 지울까요?\n노트 ${n}개에서 이 태그만 떨어지고, 노트는 그대로 남아요.` : `'${t.label}' 태그를 지울까요?`
    if (!confirm(warn)) return
    run(() => deleteTag(t.id))
  }

  const missingRec = RECOMMENDED_TAGS.filter(r => !tags.some(t =>
    t.label.trim().toLowerCase() === r.label.toLowerCase() && t.grp === r.grp))

  const sorted = sortTags(tags)
  const sections = TAG_GROUPS.map(g => ({ ...g, items: sorted.filter(t => t.grp === g.key) }))
  const needMig = tagsNeedMigration()

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-300 font-semibold">태그 편집</p>
        <button onClick={onClose} className="text-[11px] text-gray-500 hover:text-gray-300">완료</button>
      </div>

      {needMig && (
        <p className="text-[11px] text-amber-300/90">
          성격·주제 묶음을 쓰려면 Supabase 에서 <code>supabase/notes_tags_v2_migration.sql</code> 을 한 번 실행해 주세요.
          그 전에도 추가·이름 바꾸기·삭제는 됩니다.
        </p>
      )}

      {!needMig && missingRec.length > 0 && (
        <div className="flex items-center gap-2 bg-gray-950 border border-gray-800 rounded-xl px-3 py-2">
          <p className="text-[11px] text-gray-400 flex-1">
            추천 태그셋 — 성격(통찰·로드맵·분석·설계·도구·문헌) + 주제(조직·배전망ESS·테스트벤치·KERI알고리즘·마이크로그리드·인버터)
          </p>
          <button onClick={() => run(seedRecommendedTags)} disabled={busy}
            className="text-[11px] font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg px-2.5 py-1 shrink-0">
            채우기 ({missingRec.length})
          </button>
        </div>
      )}

      {sections.map(sec => sec.items.length > 0 && (
        <div key={sec.label} className="space-y-1.5">
          {!needMig && (
            <p className="text-[10px] text-gray-500">{sec.label}{sec.hint && <span className="text-gray-700"> · {sec.hint}</span>}</p>
          )}
          <ul className="space-y-1.5">
            {sec.items.map((t, i) => (
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
                {!needMig && (
                  <button onClick={() => run(() => updateTag(t.id, { grp: nextGroup(t.grp) }))} disabled={busy}
                    className="text-[10px] text-gray-400 bg-gray-800 hover:bg-gray-700 rounded px-1.5 py-0.5 shrink-0"
                    title="눌러서 묶음 바꾸기 (성격 → 주제 → 기타)">{groupLabel(t.grp)}</button>
                )}
                <span className="text-[10px] text-gray-600 w-8 text-right shrink-0">{counts[t.id] ?? 0}권</span>
                <button onClick={() => run(() => moveTag(sec.items, t.id, -1))} disabled={busy || i === 0}
                  className="text-xs text-gray-500 hover:text-gray-200 disabled:opacity-20 px-1" aria-label="위로">↑</button>
                <button onClick={() => run(() => moveTag(sec.items, t.id, 1))} disabled={busy || i === sec.items.length - 1}
                  className="text-xs text-gray-500 hover:text-gray-200 disabled:opacity-20 px-1" aria-label="아래로">↓</button>
                <button onClick={() => remove(t)} disabled={busy}
                  className="text-xs text-gray-500 hover:text-red-400 px-1.5" aria-label={`${t.label} 삭제`} title="삭제">✕</button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {!tags.length && <p className="text-xs text-gray-600">태그가 없어요. 아래에서 추가하세요.</p>}

      <div className="flex gap-1.5">
        {!needMig && (
          <button type="button" onClick={() => setNewGrp(nextGroup(newGrp))}
            className="text-[11px] text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-lg px-2.5 shrink-0"
            title="새 태그의 묶음 (눌러서 바꾸기)">{groupLabel(newGrp)}</button>
        )}
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
          placeholder="새 태그 (예: 배전망ESS)"
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
