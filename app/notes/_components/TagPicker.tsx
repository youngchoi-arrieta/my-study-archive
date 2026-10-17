'use client'

import { sortTags, type NoteTag } from '@/lib/notes'
import TagChip from './TagChip'
import TagInput from './TagInput'

// 태그 고르기 — 태그 편집에서 정한 순서대로 한 줄. 업로드 카드와 노트 화면이 같이 쓴다.

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

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {sorted.map(t => {
          const on = selected.includes(t.id)
          return (
            <TagChip key={t.id} label={t.label} color={t.color} on={on}
              title={on ? '눌러서 떼기' : '눌러서 붙이기'}
              onClick={disabled ? undefined : () => onToggle(t)} />
          )
        })}
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
