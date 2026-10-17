'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { fetchRecentNotes, fetchTags, NOTES_EVENT, type Note, type NoteTag } from '../../lib/notes'

// 홈의 서가 띠 — 최근에 꽂은 노트 몇 권과 태그 바로가기.
// 읽기만. 올리기·고치기는 /notes 에서.

export default function ShelfBlock() {
  const [notes, setNotes] = useState<Note[]>([])
  const [tags, setTags] = useState<NoteTag[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    const load = () => Promise.all([fetchRecentNotes(3), fetchTags()])
      .then(([n, t]) => { if (alive) { setNotes(n); setTags(t); setReady(true) } })
      .catch(() => { if (alive) setReady(true) })   // 마이그레이션 전이어도 홈은 뜨게
    load()
    window.addEventListener(NOTES_EVENT, load)
    return () => { alive = false; window.removeEventListener(NOTES_EVENT, load) }
  }, [])

  return (
    <section className="bg-gray-900 rounded-2xl p-5 mb-10 border border-blue-500/15">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl">📚</span>
        <div className="flex-1 min-w-0">
          <Link href="/notes" className="text-lg font-bold text-blue-300 hover:text-blue-200 leading-tight">서가</Link>
          <p className="text-[11px] text-gray-500 leading-snug">클로드와 정리한 생각 — PDF 노트 아카이브</p>
        </div>
        <Link href="/notes" className="text-xs text-gray-500 hover:text-gray-300 shrink-0">전체 보기 →</Link>
      </div>

      {!ready ? <p className="text-xs text-gray-600">불러오는 중…</p>
        : notes.length === 0 ? (
          <Link href="/notes" className="block text-xs text-gray-500 hover:text-gray-300">
            아직 꽂힌 노트가 없어요 → 첫 PDF 올리기
          </Link>
        ) : (
          <ul className="space-y-1.5">
            {notes.map(n => (
              <li key={n.id}>
                <Link href={`/notes/${n.id}`} className="flex items-baseline gap-2 text-sm text-gray-300 hover:text-white">
                  <span className="text-[11px] text-gray-600 tabular-nums shrink-0">{n.made_on.slice(5)}</span>
                  <span className="truncate">{n.title}</span>
                  {n.scope === 'company' && <span className="text-[10px] text-amber-300 shrink-0">🔒</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-800">
          {tags.map(t => (
            <Link key={t.id} href={`/notes?tags=${t.id}`}
              className="text-[11px] rounded-full border px-2.5 py-1 leading-none hover:brightness-125"
              style={{ color: t.color, borderColor: t.color + '66' }}>
              #{t.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}
