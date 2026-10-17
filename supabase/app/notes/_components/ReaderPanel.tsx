'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { signedNoteUrl, sortTags, type Note, type NoteTag } from '@/lib/notes'
import TagChip from './TagChip'

// 책장에서 고른 노트를 화면 전체로 펼쳐 보는 판.
// 머리띠는 한 줄로 얇게, 나머지는 전부 PDF. Esc 나 ✕ 로 닫는다.
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
    // 펼쳐 둔 동안 뒤의 서가가 같이 스크롤되지 않게
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const [showSummary, setShowSummary] = useState(false)

  const tags = sortTags(note.tagIds.map(id => tagMap.get(id)).filter((t): t is NoteTag => !!t))

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col" role="dialog" aria-modal="true" aria-label={note.title}>
      {/* 머리띠 — 한 줄 */}
      <div className="flex items-center gap-3 px-3 sm:px-5 py-2 bg-gray-950 border-b border-gray-800 shrink-0">
        <div className="flex-1 min-w-0 flex items-baseline gap-2">
          <h2 className="text-sm sm:text-[15px] font-semibold truncate">{note.title}</h2>
          <span className="hidden sm:inline text-[11px] text-gray-500 tabular-nums shrink-0">
            {note.made_on}
            {note.series && <> · {note.series}{note.ver > 1 ? ` v${note.ver}` : ''}</>}
            {note.pages ? <> · {note.pages}쪽</> : null}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-1 shrink-0">
          {tags.slice(0, 4).map(t => <TagChip key={t.id} label={t.label} color={t.color} small onClick={() => onTagClick(t.id)} />)}
        </div>
        {note.summary && (
          <button onClick={() => setShowSummary(v => !v)}
            className={`text-[11px] px-2 py-1 rounded-md shrink-0 ${showSummary ? 'bg-gray-800 text-gray-200' : 'text-gray-500 hover:text-gray-300'}`}>요지</button>
        )}
        <Link href={`/notes/${note.id}`} className="hidden sm:inline text-[11px] text-blue-300 hover:text-blue-200 shrink-0">고치기</Link>
        {url && <a href={url} target="_blank" rel="noreferrer" className="text-[11px] text-gray-500 hover:text-gray-300 shrink-0">새 탭 ↗</a>}
        {note.widget_path && <Link href={`/notes/${note.id}`} className="text-[11px] text-purple-300 hover:text-purple-200 shrink-0">◈ 위젯</Link>}
        <button onClick={onClose} className="text-gray-300 hover:text-white text-base px-2 shrink-0" aria-label="닫기" title="닫기 (Esc)">✕</button>
      </div>

      {showSummary && note.summary && (
        <div className="px-3 sm:px-5 py-2.5 bg-gray-950 border-b border-gray-800 shrink-0">
          <p className="text-xs text-gray-400 leading-relaxed whitespace-pre-line max-w-4xl">{note.summary}</p>
        </div>
      )}

      {/* 본문 — 화면 전체 */}
      <div className="flex-1 min-h-0">
        {url ? (
          <iframe key={url} title={note.title} src={`${url}#view=FitH`} className="w-full h-full bg-white" />
        ) : (
          <div className="h-full flex items-center justify-center text-center text-sm text-gray-400 px-6" onClick={onClose}>
            {note.scope === 'company' && !note.pdf_path
              ? <p>🔒 회사자료 — 파일은 로컬에 보관하고 카드만 꽂아둔 노트예요.</p>
              : signing ? <p>펼치는 중…</p>
              : note.pdf_path ? <p>파일을 열지 못했어요.</p>
              : <p>올라간 PDF 가 없어요.</p>}
          </div>
        )}
      </div>
    </div>
  )
}
