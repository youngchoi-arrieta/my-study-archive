'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signedNoteUrl, sortTags, type Note, type NoteTag } from '@/lib/notes'
import TagChip from './TagChip'

// 책장에서 고른 노트를 옆에서 펼쳐 보는 판.
// 넓은 화면: 오른쪽 기둥 / 좁은 화면: 화면 전체를 덮는 판.
// 고치기·위젯·삭제는 원래 노트 화면(/notes/[id])에서.
export default function ReaderPanel({
  note, tagMap, onClose, onTagClick,
}: {
  note: Note
  tagMap: Map<string, NoteTag>
  onClose: () => void
  onTagClick: (tagId: string) => void
}) {
  // 어느 경로의 서명 결과인지 함께 들고 있어서, 다른 책으로 바뀌면 자동으로 '펼치는 중'이 된다
  const [signed, setSigned] = useState<{ path: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!note.pdf_path) return
    let alive = true
    const path = note.pdf_path
    signedNoteUrl(path).then(u => { if (alive) setSigned({ path, url: u }) })
    return () => { alive = false }
  }, [note.pdf_path])
  const current = signed && signed.path === note.pdf_path ? signed : null
  const url = current?.url ?? null
  const signing = !!note.pdf_path && !current

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const tags = sortTags(note.tagIds.map(id => tagMap.get(id)).filter((t): t is NoteTag => !!t))

  return (
    <aside className="fixed inset-0 z-40 bg-gray-950 flex flex-col
      lg:static lg:inset-auto lg:z-auto lg:h-[calc(100dvh-2rem)] lg:sticky lg:top-4 lg:rounded-2xl lg:border lg:border-gray-800 lg:bg-gray-900/60">
      {/* 머리 */}
      <div className="flex items-start gap-3 px-4 py-3 border-b border-gray-800 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-gray-500 tabular-nums">
            {note.made_on}
            {note.series && <> · {note.series}{note.ver > 1 ? ` v${note.ver}` : ''}</>}
            {note.pages ? <> · {note.pages}쪽</> : null}
          </p>
          <h2 className="text-[15px] font-semibold leading-snug mt-0.5">{note.title}</h2>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-sm shrink-0" aria-label="닫기">✕</button>
      </div>

      {(note.summary || tags.length > 0) && (
        <div className="px-4 py-2.5 border-b border-gray-800 shrink-0 space-y-2">
          {note.summary && <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line line-clamp-4">{note.summary}</p>}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map(t => <TagChip key={t.id} label={t.label} color={t.color} small onClick={() => onTagClick(t.id)} />)}
            </div>
          )}
        </div>
      )}

      {/* 본문 */}
      <div className="flex-1 min-h-0 p-2">
        {url ? (
          <iframe key={url} title={note.title} src={url} className="w-full h-full rounded-lg bg-white" />
        ) : (
          <div className="h-full flex items-center justify-center text-center text-xs text-gray-500 px-6">
            {note.scope === 'company' && !note.pdf_path
              ? <p>🔒 회사자료 — 파일은 로컬에 보관하고 카드만 꽂아둔 노트예요.</p>
              : signing ? <p>펼치는 중…</p>
              : note.pdf_path ? <p>파일을 열지 못했어요.</p>
              : <p>올라간 PDF 가 없어요.</p>}
          </div>
        )}
      </div>

      {/* 발 */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-800 text-xs shrink-0">
        <Link href={`/notes/${note.id}`} className="text-blue-300 hover:text-blue-200">노트 화면 · 고치기 →</Link>
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-gray-500 hover:text-gray-300">새 탭 ↗</a>}
        {note.widget_path && <Link href={`/notes/${note.id}`} className="text-purple-300 hover:text-purple-200 ml-auto">◈ 위젯 보기</Link>}
      </div>
    </aside>
  )
}
