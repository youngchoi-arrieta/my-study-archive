'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { fetchNotes, fetchTags, NOTES_EVENT, sortTags, type Note, type NoteTag } from '@/lib/notes'
import UploadDrop from './_components/UploadDrop'
import TagManager from './_components/TagManager'
import TagChip from './_components/TagChip'
import BookCover from './_components/BookCover'
import ReaderPanel from './_components/ReaderPanel'

// ───────────────────────────────────────────────────────────────
//  서가 — /notes
//  클로드와 대화하며 정리한 생각을 PDF 로 꽂아두는 곳.
//  입력은 대화에서, 앱은 보관과 다시 찾기만.
//    위   PDF 끌어다 놓기 (속성 자동 읽기)
//    중간 검색 · 태그 필터(여러 개 고르면 모두 가진 노트) · 보기 전환
//    아래 책장(성격 태그별 선반) · 날짜순(월별) · 시리즈별
//    책·줄을 누르면 페이지를 떠나지 않고 옆에서 펼친다 (레퍼런스 라이브러리와 같은 방식)
// ───────────────────────────────────────────────────────────────

type View = 'shelf' | 'date' | 'series'
const VIEW_KEY = 'notes:view'
const readView = (): View => {
  try { const v = localStorage.getItem(VIEW_KEY); return v === 'date' || v === 'series' ? v : 'shelf' } catch { return 'shelf' }
}

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
  // Shelf 는 useSearchParams 때문에 클라이언트에서만 그려지므로 localStorage 를 바로 읽어도 된다
  const [view, setViewState] = useState<View>(readView)
  const [openId, setOpenId] = useState<string | null>(null)
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v) } catch {} }
  const [editTags, setEditTags] = useState(() => params.get('edit') === 'tags')
  const [showUpload, setShowUpload] = useState(false)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const tagBoxRef = useRef<HTMLDivElement>(null)

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
  const seriesOptions = useMemo(() =>
    [...new Set(allNotes.map(n => n.series).filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, 'ko')), [allNotes])
  const openTagEditor = () => {
    setEditTags(true)
    setTimeout(() => tagBoxRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }
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

  // 책장: 성격 태그 하나당 선반 하나. 성격이 없으면 맨 아래 「성격 미정」 선반
  const shelves = useMemo(() => {
    const typeTags = sortTags(tags).filter(t => t.grp === 'type')
    const typeIds = new Set(typeTags.map(t => t.id))
    const m = new Map<string, Note[]>()
    for (const n of visible) {
      const k = n.tagIds.find(id => typeIds.has(id)) ?? ''
      ;(m.get(k) ?? m.set(k, []).get(k)!).push(n)
    }
    const out: { key: string; label: string; color: string; notes: Note[] }[] = []
    typeTags.forEach(t => { const ns = m.get(t.id); if (ns?.length) out.push({ key: t.id, label: t.label, color: t.color, notes: ns }) })
    const rest = m.get('')
    if (rest?.length) out.push({ key: '', label: '성격 미정', color: '#64748B', notes: rest })
    out.forEach(s => s.notes.sort((a, b) => b.made_on.localeCompare(a.made_on)))
    return out
  }, [visible, tags])

  const opened = useMemo(() => (openId ? allNotes.find(n => n.id === openId) ?? notes.find(n => n.id === openId) ?? null : null), [openId, allNotes, notes])
  const toggleOpen = (id: string) => setOpenId(cur => (cur === id ? null : id))

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
      <div className={`mx-auto ${opened ? 'max-w-[1500px] lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-6' : 'max-w-5xl'}`}>
      <div className="min-w-0">
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
            <UploadDrop tags={tags} onSaved={() => { loadTags(); loadAll() }} onTagsChanged={loadTags}
              onEditTags={openTagEditor} seriesOptions={seriesOptions} />
          </div>
        )}

        {/* 검색 */}
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍 제목 · 요지 · 본문에서 찾기"
          className="w-full bg-gray-900 border border-gray-800 focus:border-gray-600 rounded-xl px-4 py-2.5 text-sm outline-none mb-3 placeholder:text-gray-600" />

        {/* 태그 */}
        <div ref={tagBoxRef} className="scroll-mt-4" />
        {editTags ? (
          <div className="mb-4">
            <TagManager tags={tags} counts={counts} onChanged={() => { loadTags(); loadAll() }} onClose={() => setEditTags(false)} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 mb-4">
            {sortTags(tags).map((t, i, arr) => (
              <span key={t.id} className="contents">
                {i > 0 && arr[i - 1].grp !== t.grp && <span className="w-px h-4 bg-gray-800 mx-0.5" aria-hidden />}
                <TagChip label={t.label} color={t.color} on={selected.includes(t.id)}
                  count={counts[t.id] ?? 0} onClick={() => toggleTag(t.id)} />
              </span>
            ))}
            {untaggedCount > 0 && (
              <TagChip label="태그 없음" color="#94A3B8" on={selected.includes('none')} count={untaggedCount}
                onClick={() => setSelected(selected.includes('none') ? [] : ['none'])} />
            )}
            {selected.length > 0 && (
              <button onClick={() => setSelected([])} className="text-[11px] text-gray-500 hover:text-gray-300 px-1">필터 지우기</button>
            )}
            <button onClick={openTagEditor} className="text-[11px] text-gray-500 hover:text-gray-300 ml-auto">✎ 태그 편집·삭제</button>
          </div>
        )}

        {/* 보기 전환 */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] text-gray-600">
            {visible.length}권{selected.length > 1 && !selected.includes('none') ? ' · 고른 태그를 모두 가진 노트' : ''}
          </p>
          <div className="flex bg-gray-900 rounded-lg p-0.5 text-[11px]">
            {([['shelf', '책장'], ['date', '날짜순'], ['series', '시리즈']] as const).map(([k, l]) => (
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
          ) : view === 'shelf' ? (
            <div className="space-y-7">
              {shelves.map(sh => (
                <section key={sh.key || '_'}>
                  <div className="flex items-center gap-2 rounded-t-lg px-3 py-1.5"
                    style={{ background: `linear-gradient(90deg, ${sh.color}40, ${sh.color}10)` }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: sh.color }} />
                    <span className="text-sm font-semibold" style={{ color: sh.color }}>{sh.label}</span>
                    <span className="text-[11px] text-white/40">{sh.notes.length}권</span>
                    {sh.key && (
                      <button onClick={() => setSelected([sh.key])} className="ml-auto text-[10px] text-white/40 hover:text-white/80">이 선반만 →</button>
                    )}
                  </div>
                  <div className="bg-gray-900/70 border-x border-gray-800 px-4 pt-5 pb-3">
                    <div className="flex flex-wrap gap-3">
                      {sh.notes.map(n => (
                        <BookCover key={n.id} note={n} tagMap={tagMap} active={openId === n.id} onOpen={() => toggleOpen(n.id)} />
                      ))}
                    </div>
                  </div>
                  <div className="h-2.5 rounded-b-md bg-gray-700 shadow-lg shadow-black/40" />
                </section>
              ))}
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map(([k, ns]) => (
                <section key={k || '_'}>
                  <p className="text-[11px] text-gray-500 font-semibold mb-2 sticky top-0 bg-gray-950/95 py-1 z-10">
                    {groupLabel(k)} <span className="text-gray-700 font-normal">{ns.length}</span>
                  </p>
                  <div className="rounded-xl overflow-hidden border border-gray-800 divide-y divide-gray-800/80">
                    {ns.map(n => <NoteRow key={n.id} note={n} tagMap={tagMap} active={openId === n.id} onOpen={() => toggleOpen(n.id)} />)}
                  </div>
                </section>
              ))}
            </div>
          )}
      </div>

      {opened && (
        <ReaderPanel note={opened} tagMap={tagMap} onClose={() => setOpenId(null)}
          onTagClick={id => { setSelected([id]) }} />
      )}
      </div>
    </main>
  )
}

// 날짜순·시리즈 보기의 한 줄 — 카드 대신 촘촘한 줄. 누르면 옆에서 펼친다.
function NoteRow({ note, tagMap, active, onOpen }: {
  note: Note; tagMap: Map<string, NoteTag>; active: boolean; onOpen: () => void
}) {
  const tags = sortTags(note.tagIds.map(id => tagMap.get(id)).filter((t): t is NoteTag => !!t))
  const type = tags.find(t => t.grp === 'type')
  return (
    <button type="button" onClick={onOpen} title={note.summary ?? note.title}
      className={`w-full text-left flex items-center gap-2.5 px-3 py-2 transition ${active ? 'bg-gray-800' : 'bg-gray-900/60 hover:bg-gray-800/70'}`}>
      <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: type?.color ?? '#334155' }} />
      <span className="text-[11px] text-gray-500 tabular-nums shrink-0 w-[42px]">{note.made_on.slice(5)}</span>
      <span className="flex-1 min-w-0 truncate text-sm text-gray-200">{note.title}</span>
      {note.series && <span className="hidden sm:inline text-[10px] text-gray-500 shrink-0 max-w-[120px] truncate">{note.series}{note.ver > 1 ? ` v${note.ver}` : ''}</span>}
      <span className="hidden md:flex items-center gap-1 shrink-0">
        {tags.filter(t => t.grp !== 'type').slice(0, 4).map(t => (
          <span key={t.id} className="w-1.5 h-1.5 rounded-full" style={{ background: t.color }} title={`#${t.label}`} />
        ))}
      </span>
      {note.scope === 'company' && <span className="text-[10px] text-amber-300 shrink-0">🔒</span>}
      {note.widget_path && <span className="text-[10px] text-purple-300 shrink-0">◈</span>}
      {note.pages ? <span className="text-[10px] text-gray-600 shrink-0 w-8 text-right">{note.pages}쪽</span> : null}
    </button>
  )
}
