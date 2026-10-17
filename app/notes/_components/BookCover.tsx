'use client'

import type { Note, NoteTag } from '@/lib/notes'

// 책장 보기의 노트 한 권 — 세로로 선 책 표지.
// 표지색 = 성격 태그 색(없으면 회색). 왼쪽 띠는 책등.
// 아래 작은 점들 = 주제 태그 색. 눌러도 페이지를 떠나지 않고 옆에서 펼친다.
export default function BookCover({
  note, tagMap, active, onOpen,
}: {
  note: Note
  tagMap: Map<string, NoteTag>
  active: boolean
  onOpen: () => void
}) {
  const tags = note.tagIds.map(id => tagMap.get(id)).filter((t): t is NoteTag => !!t)
  const type = tags.find(t => t.grp === 'type')
  const topics = tags.filter(t => t.grp !== 'type')
  const base = type?.color ?? '#64748B'

  return (
    <button
      type="button"
      onClick={onOpen}
      title={note.summary ? `${note.title}\n\n${note.summary}` : note.title}
      className={`relative w-[92px] h-[132px] sm:w-[104px] sm:h-[148px] shrink-0 rounded-md text-left flex flex-col overflow-hidden
        transition-all duration-200 hover:-translate-y-1.5 hover:shadow-xl focus:outline-none
        ${active ? '-translate-y-1.5 ring-2 ring-white/80 shadow-xl' : 'shadow-md'}`}
      style={{ background: `linear-gradient(160deg, ${base}55 0%, ${base}26 55%, #0b1120 100%)`, borderColor: base + '66' }}
    >
      {/* 책등 */}
      <span className="absolute left-0 top-0 bottom-0 w-[6px]" style={{ background: base + 'cc' }} aria-hidden />

      <span className="pl-3 pr-2 pt-2 flex items-center gap-1 text-[9px] text-white/50 tabular-nums">
        {note.made_on.slice(2).replace(/-/g, '.')}
        {note.scope === 'company' && <span className="text-amber-300" title="회사자료 · 파일은 로컬 보관">🔒</span>}
        {note.widget_path && <span className="text-purple-300" title="인터랙티브 위젯">◈</span>}
      </span>

      <span className="pl-3 pr-2 mt-1 flex-1 text-[12px] font-semibold leading-snug text-white line-clamp-5 break-keep">
        {note.title}
      </span>

      <span className="pl-3 pr-2 pb-2 flex items-center gap-1">
        {topics.slice(0, 5).map(t => (
          <span key={t.id} className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} title={`#${t.label}`} />
        ))}
        {note.series && (
          <span className="ml-auto text-[9px] text-white/45 truncate max-w-[52px]" title={note.series}>
            {note.ver > 1 ? `v${note.ver}` : note.series}
          </span>
        )}
        {!note.series && note.pages ? <span className="ml-auto text-[9px] text-white/35">{note.pages}쪽</span> : null}
      </span>
    </button>
  )
}
