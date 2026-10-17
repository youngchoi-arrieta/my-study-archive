'use client'

import { TAG_GROUPS, sortTags, type NoteTag } from '@/lib/notes'
import TagChip from './TagChip'
import TagInput from './TagInput'

// 태그 고르기 — 성격 / 주제 / 기타 세 줄로 나눠 보여준다.
// 업로드 카드와 노트 화면이 같이 쓴다. 성격은 하나만(규칙은 부르는 쪽에서 toggleWithRule 로).

export default function TagPicker({
  tags, selected, onToggle, onAdd, pendingLabels = [], onRemovePending, onEditTags, disabled = false,
}: {
  tags: NoteTag[]
  selected: string[]
  onToggle: (t: NoteTag) => void
  onAdd: (label: string) => void | Promise<void>
  pendingLabels?: string[]                  // PDF 에서 읽었지만 아직 없는 태그 — 저장할 때 만들어진다
  onRemovePending?: (label: string) => void
  onEditTags?: () => void
  disabled?: boolean
}) {
  const sorted = sortTags(tags)
  const rows = TAG_GROUPS
    .map(g => ({ ...g, items: sorted.filter(t => t.grp === g.key) }))
    .filter(g => g.items.length)
  const grouped = rows.some(r => r.key !== null)

  return (
    <div className="space-y-1.5">
      {rows.map(r => (
        <div key={r.label} className="flex flex-wrap items-center gap-1.5">
          {grouped && (
            <span className="text-[10px] text-gray-600 w-14 shrink-0">
              {r.label}{r.hint && <span className="text-gray-700"> · {r.hint}</span>}
            </span>
          )}
          {r.items.map(t => {
            const on = selected.includes(t.id)
            return (
              <TagChip key={t.id} label={t.label} color={t.color} on={on}
                title={on ? '눌러서 떼기' : '눌러서 붙이기'}
                onClick={disabled ? undefined : () => onToggle(t)} />
            )
          })}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-1.5">
        {grouped && <span className="w-14 shrink-0" />}
        {pendingLabels.map(l => (
          <TagChip key={`new-${l}`} label={l} color="#E0B341" pending
            title="PDF 에 적힌 새 태그 — 저장할 때 만들어져요. 누르면 빼기"
            onClick={onRemovePending ? () => onRemovePending(l) : undefined} />
        ))}
        <TagInput onAdd={onAdd} disabled={disabled} />
        {onEditTags && (
          <button type="button" onClick={onEditTags}
            className="text-[11px] text-gray-600 hover:text-gray-300 ml-auto">✎ 태그 편집·삭제</button>
        )}
      </div>
    </div>
  )
}
