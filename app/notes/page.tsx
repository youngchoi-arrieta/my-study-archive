'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchNotes, fetchTags, NOTES_EVENT, type Note, type NoteTag } from '@/lib/notes'
import UploadDrop from './_components/UploadDrop'
import TagManager from './_components/TagManager'
import NoteCard from './_components/NoteCard'
import TagChip from './_components/TagChip'

// ───────────────────────────────────────────────────────────────
//  서가 — /notes
//  클로드와 대화하며 정리한 생각을 PDF 로 꽂아두는 곳.
//  입력은 대화에서, 앱은 보관과 다시 찾기만.
//    위   PDF 끌어다 놓기 (속성 자동 읽기)
//    중간 검색 · 태그 필터(여러 개 고르면 모두 가진 노트) · 보기 전환
//    아래 날짜순(월별) 또는 시리즈별 목록
// ───────────────────────────────────────────────────────────────

type View = 'date' | 'series'

export default function NotesPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-950" />}>
      <Shelf />
    </Suspense>
  )
}

function Shelf() {
  const router = useRouter()
  const params = useSearchParams()
  const selected = useMemo(() => (params.get('tags') ?? '').split(',').filter(Boolean), [params])

  const [notes, setNotes] = useState<Note[]>([])
  const [allNotes, setAllNotes] = useState<Note[]>([])   // 태그별 개수용 (검색과 무관)
  const [tags, setTags] = useState<NoteTag[]>([])
  const [q, setQ] = useState('')
  const [debounced, setDebounced] = useState('')
  const [view, setView] = useState<View>('date')
  const [editTags, setEditTags] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => { const t = setTimeout(() => setDebounced(q), 300); return () => clearTimeout(t) }, [q])

  const loadTags = useCallback(() => fetchTags().then(setTags).catch(e => setErr(String(e?.message ?? e))), [])
  const loadAll = useCallback(() => fetchNotes('').then(setAllNotes).catch(() => {}), [])

  useEffect(() => {
    let alive = true
    fetchNotes(debounced)
      .then(n => { if (alive) { setNotes(n); setLoading(false) } })
      .catch(e => { if (alive) { setErr(String(e?.message ?? e)); setLoading(false) } })
    return () => { alive = false }
  }, [debounced])

  useEffect(() => {
    loadTags(); loadAll()
    const on = () => { loadAll(); fetchNotes(debounced).then(setNotes).catch(() => {}) }
    window.addEventListener(NOTES_EVENT, on)
    return () => window.removeEventListener(NOTES_EVENT, on)
  }, [loadTags, loadAll, debounced])

  const tagMap = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags])
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    allNotes.forEach(n => n.tagIds.forEach(id => { c[id] = (c[id] ?? 0) + 1 }))
    return c
  }, [allNotes])
  const untaggedCount = useMemo(() => allNotes.filter(n => !n.tagIds.length).length, [allNotes])

  const setSelected = (ids: string[]) => {
    const sp = new URLSearchParams(params.toString())
    if (ids.length) sp.set('tags', ids.join(',')); else sp.delete('tags')
    router.replace(`/notes${sp.toString() ? `?${sp}` : ''}`, { scroll: false })
  }
  const toggleTag = (id: string) =>
    setSelected(selected.includes(id) ? selected.filter(x => x !== id) : [...selected, id])

  const visible = useMemo(() => {
    if (!selected.length) return notes
    if (selected.includes('none')) return notes.filter(n => !n.tagIds.length)
    return notes.filter(n => selected.every(id => n.tagIds.includes(id)))
  }, [notes, selected])

  const groups = useMemo(() => {
    const m = new Map<string, Note[]>()
    for (const n of visible) {
      const k = view === 'date' ? n.made_on.slice(0, 7) : (n.series || '')
      ;(m.get(k) ?? m.set(k, []).get(k)!).push(n)
    }
    const entries = [...m.entries()]
    if (view === 'series') {
      // 시리즈 안에서는 버전·날짜 순, 시리즈 없는 노트는 맨 아래
      entries.forEach(([, ns]) => ns.sort((a, b) => a.made_on.localeCompare(b.made_on) || a.ver - b.ver))
      entries.sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'ko')))
    }
    return entries
  }, [visible, view])

  const groupLabel = (k: string) => {
    if (view === 'series') return k || '시리즈 없음'
    const [y, mo] = k.split('-')
    return `${y}년 ${parseInt(mo, 10)}월`
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-end justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xl">📚</span>
            <h1 className="text-xl font-bold">서가</h1>
            <span className="text-xs text-gray-600">{allNotes.length}권</span>
          </div>
          <button onClick={() => setShowUpload(v => !v)}
            className={`text-xs font-semibold rounded-lg px-3 py-1.5 transition ${showUpload ? 'bg-gray-800 text-gray-300' : 'bg-blue-600 hover:bg-blue-500'}`}>
            {showUpload ? '닫기' : '+ PDF 올리기'}
          </button>
        </div>
        <p className="text-gray-600 text-[11px] mb-4">생각은 대화에서 정리하고, 여기에는 결과만 꽂아둔다</p>

        {err && <p className="text-xs text-red-400 mb-3">불러오지 못했어요: {err}<br />
          <span className="text-gray-500">supabase/notes_migration.sql 을 아직 실행하지 않았다면 먼저 실행해 주세요.</span></p>}

        {(showUpload || (!loading && !allNotes.length && !err)) && (
          <div className="mb-5">
            <UploadDrop tags={tags} onSaved={() => { loadTags(); loadAll() }} />
          </div>
        )}

        {/* 검색 */}
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍 제목 · 요지 · 본문에서 찾기"
          className="w-full bg-gray-900 border border-gray-800 focus:border-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none mb-3 placeholder:text-gray-600" />

        {/* 태그 */}
        {editTags ? (
          <div className="mb-4">
            <TagManager tags={tags} counts={counts} onChanged={() => { loadTags(); loadAll() }} onClose={() => setEditTags(false)} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {tags.map(t => (
              <TagChip key={t.id} label={t.label} color={t.color} on={selected.includes(t.id)}
                count={counts[t.id] ?? 0} onClick={() => toggleTag(t.id)} />
            ))}
            {untaggedCount > 0 && (
              <TagChip label="태그 없음" color="#94A3B8" on={selected.includes('none')} count={untaggedCount}
                onClick={() => setSelected(selected.includes('none') ? [] : ['none'])} />
            )}
            {selected.length > 0 && (
              <button onClick={() => setSelected([])} className="text-[11px] text-gray-500 hover:text-gray-300 px-1">필터 지우기</button>
            )}
            <button onClick={() => setEditTags(true)} className="text-[11px] text-gray-600 hover:text-gray-300 ml-auto">✎ 태그 편집</button>
          </div>
        )}

        {/* 보기 전환 */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-gray-600">
            {visible.length}권{selected.length > 1 && !selected.includes('none') ? ' · 고른 태그를 모두 가진 노트' : ''}
          </p>
          <div className="flex bg-gray-900 rounded-lg p-0.5 text-[11px]">
            {([['date', '날짜순'], ['series', '시리즈']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setView(k)}
                className={`px-2.5 py-1 rounded-md transition ${view === k ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{l}</button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        {loading ? <p className="text-sm text-gray-500">불러오는 중…</p>
          : !visible.length ? (
            <p className="text-sm text-gray-600 text-center py-10">
              {allNotes.length ? '조건에 맞는 노트가 없어요.' : '아직 꽂힌 노트가 없어요. 위에 PDF 를 끌어다 놓으세요.'}
            </p>
          ) : (
            <div className="space-y-6">
              {groups.map(([k, ns]) => (
                <section key={k || '_'}>
                  <p className="text-[11px] text-gray-500 font-semibold mb-2 sticky top-0 bg-gray-950/95 py-1 z-10">
                    {groupLabel(k)} <span className="text-gray-700 font-normal">{ns.length}</span>
                  </p>
                  <div className="space-y-2">
                    {ns.map(n => <NoteCard key={n.id} note={n} tagMap={tagMap} onTagClick={id => setSelected([id])} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
      </div>
    </main>
  )
}
