'use client'

import Link from 'next/link'
import type { Note, NoteTag } from '@/lib/notes'
import TagChip from './TagChip'

// 서가의 노트 한 권
export default function NoteCard({
  note, tagMap, onTagClick, compact = false,
}: {
  note: Note
  tagMap: Map<string, NoteTag>
  onTagClick?: (tagId: string) => void
  compact?: boolean
}) {
  const tags = note.tagIds.map(id => tagMap.get(id)).filter((t): t is NoteTag => !!t)
    .sort((a, b) => a.sort_order - b.sort_order)

  return (
    <div className="bg-gray-900 hover:bg-gray-800/80 rounded-2xl px-4 py-3.5 transition group">
      <Link href={`/notes/${note.id}`} className="block">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[11px] text-gray-500 tabular-nums shrink-0">{note.made_on}</span>
          {note.series && (
            <span className="text-[10px] text-gray-400 bg-gray-800 rounded px-1.5 py-0.5">
              {note.series}{note.ver > 1 ? ` · v${note.ver}` : ''}
            </span>
          )}
          {!note.series && note.ver > 1 && <span className="text-[10px] text-gray-500">v{note.ver}</span>}
          {note.scope === 'company' && (
            <span className="text-[10px] text-amber-300 bg-amber-500/10 rounded px-1.5 py-0.5" title="파일은 로컬 보관, 카드만 서가에">🔒 회사자료</span>
          )}
          {note.widget_path && <span className="text-[10px] text-purple-300" title="인터랙티브 위젯 있음">◈ 위젯</span>}
          {note.pages ? <span className="text-[10px] text-gray-600 ml-auto">{note.pages}쪽</span> : null}
        </div>
        <h3 className="text-[15px] font-semibold text-gray-100 leading-snug mt-1 group-hover:text-white">{note.title}</h3>
        {!compact && note.summary && (
          <p className="text-xs text-gray-400 leading-relaxed mt-1.5 whitespace-pre-line line-clamp-3">{note.summary}</p>
        )}
      </Link>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {tags.map(t => (
            <TagChip key={t.id} label={t.label} color={t.color} small
              onClick={onTagClick ? () => onTagClick(t.id) : undefined} />
          ))}
        </div>
      )}
    </div>
  )
}
