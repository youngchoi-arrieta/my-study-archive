'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  createTag, deleteNote, fetchNote, fetchNotes, fetchTags, removeWidget, signedNoteUrl,
  toggleNoteTag, updateNote, uploadWidget, type Note, type NoteTag,
} from '@/lib/notes'
import TagChip from '../_components/TagChip'
import NoteCard from '../_components/NoteCard'
import WidgetFrame from '../_components/WidgetFrame'

// ───────────────────────────────────────────────────────────────
//  노트 한 권 — /notes/[id]
//    요지 · 태그(눌러서 붙이고 떼기) · PDF 보기 · 위젯 · 같은 시리즈/태그 노트
// ───────────────────────────────────────────────────────────────

export default function NotePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [note, setNote] = useState<Note | null>(null)
  const [tags, setTags] = useState<NoteTag[]>([])
  const [others, setOthers] = useState<Note[]>([])
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  const [edit, setEdit] = useState(false)
  const [form, setForm] = useState({ title: '', made_on: '', series: '', ver: 1, summary: '' })
  const [tagInput, setTagInput] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [widgetRev, setWidgetRev] = useState(0)
  const widgetRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const [n, t, all] = await Promise.all([fetchNote(id), fetchTags(), fetchNotes('')])
      if (!n) { setMissing(true); setLoading(false); return }
      setNote(n); setTags(t); setOthers(all.filter(x => x.id !== n.id))
      setForm({ title: n.title, made_on: n.made_on, series: n.series ?? '', ver: n.ver, summary: n.summary ?? '' })
      setLoading(false)
    } catch (e) {
      setErr(msg(e)); setLoading(false)
    }
  }, [id])
  useEffect(() => { load() }, [load])

  // PDF 서명 URL — 1시간짜리. 경로가 바뀔 때만 새로 받는다.
  const pdfPath = note?.pdf_path ?? null
  useEffect(() => {
    if (!pdfPath) return
    let alive = true
    signedNoteUrl(pdfPath).then(u => { if (alive) setPdfUrl(u) })
    return () => { alive = false }
  }, [pdfPath])

  const tagMap = useMemo(() => new Map(tags.map(t => [t.id, t])), [tags])

  const related = useMemo(() => {
    if (!note) return { series: [] as Note[], byTag: [] as Note[] }
    const series = note.series ? others.filter(o => o.series === note.series)
      .sort((a, b) => a.made_on.localeCompare(b.made_on) || a.ver - b.ver) : []
    const seen = new Set(series.map(s => s.id))
    const byTag = others
      .filter(o => !seen.has(o.id))
      .map(o => ({ o, k: o.tagIds.filter(t => note.tagIds.includes(t)).length }))
      .filter(x => x.k > 0)
      .sort((a, b) => b.k - a.k || b.o.made_on.localeCompare(a.o.made_on))
      .slice(0, 5).map(x => x.o)
    return { series, byTag }
  }, [note, others])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('')
    try { await fn() } catch (e) { setErr(msg(e)); load() } finally { setBusy(false) }
  }

  const toggle = (tagId: string) => note && run(async () => {
    const on = !note.tagIds.includes(tagId)
    setNote({ ...note, tagIds: on ? [...note.tagIds, tagId] : note.tagIds.filter(x => x !== tagId) })
    await toggleNoteTag(note.id, tagId, on)
  })

  const addTag = () => note && run(async () => {
    const v = tagInput.trim().replace(/^#/, '')
    if (!v) return
    const t = await createTag(v)
    if (!tags.some(x => x.id === t.id)) setTags(prev => [...prev, t])
    if (!note.tagIds.includes(t.id)) {
      await toggleNoteTag(note.id, t.id, true)
      setNote({ ...note, tagIds: [...note.tagIds, t.id] })
    }
    setTagInput('')
  })

  const saveMeta = () => {
    if (!form.title.trim()) { setErr('제목을 적어 주세요.'); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(form.made_on)) { setErr('날짜를 골라 주세요.'); return }
    return saveMetaNow()
  }
  const saveMetaNow = () => note && run(async () => {
    const patch = {
      title: form.title.trim(), made_on: form.made_on, series: form.series.trim() || null,
      ver: Math.max(1, form.ver || 1), summary: form.summary.trim() || null,
    }
    await updateNote(note.id, patch)
    setNote({ ...note, ...patch }); setEdit(false)
  })

  const onWidget = (f: File | undefined) => note && f && run(async () => {
    if (!/\.html?$/i.test(f.name)) throw new Error('HTML 파일만 올릴 수 있어요.')
    if (f.size > 5 * 1024 * 1024) throw new Error('위젯 파일은 5MB 까지예요.')
    const path = await uploadWidget(note.id, f)
    setNote({ ...note, widget_path: path })
    setWidgetRev(r => r + 1)   // 같은 경로를 덮어써도 다시 불러오게
  })

  const remove = () => note && run(async () => {
    if (!confirm(`'${note.title}' 노트를 서가에서 지울까요?\n올린 PDF 와 위젯 파일도 같이 지워져요.`)) return
    await deleteNote(note)
    router.replace('/notes')
  })

  if (loading) return <main className="min-h-screen bg-gray-950 text-gray-500 p-6 text-sm">불러오는 중…</main>
  if (missing || !note) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-6">
        <Link href="/notes" className="text-gray-400 hover:text-white text-sm">← 서가</Link>
        <p className="text-sm text-gray-500 mt-6">{err || '없는 노트예요. 지워졌을 수 있어요.'}</p>
      </main>
    )
  }

  const input = 'bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-1.5 text-sm outline-none'

  return (
    <main className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-5">
        <div><Link href="/notes" className="text-gray-400 hover:text-white text-sm">← 서가</Link></div>

        {/* 머리 */}
        {!edit ? (
          <header className="space-y-2">
            <div className="flex items-baseline gap-2 flex-wrap text-[11px] text-gray-500">
              <span className="tabular-nums">{note.made_on}</span>
              {note.series && <span className="bg-gray-800 text-gray-300 rounded px-1.5 py-0.5">{note.series}</span>}
              <span>v{note.ver}</span>
              {note.pages ? <span>{note.pages}쪽</span> : null}
              {note.scope === 'company' && <span className="text-amber-300 bg-amber-500/10 rounded px-1.5 py-0.5">🔒 회사자료 · 카드만</span>}
              <button onClick={() => setEdit(true)} className="ml-auto text-gray-500 hover:text-gray-200">✎ 고치기</button>
            </div>
            <h1 className="text-2xl font-bold leading-snug">{note.title}</h1>
            {note.summary && (
              <div className="bg-gray-900 border-l-2 border-teal-500/60 rounded-r-xl px-4 py-3">
                <p className="text-[10px] text-teal-300/70 uppercase tracking-widest mb-1">요지</p>
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-line">{note.summary}</p>
              </div>
            )}
          </header>
        ) : (
          <div className="bg-gray-900 rounded-2xl p-4 space-y-2">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="제목" className={`${input} w-full font-semibold`} />
            <div className="grid grid-cols-3 gap-2">
              <input type="date" value={form.made_on} onChange={e => setForm({ ...form, made_on: e.target.value })} className={input} aria-label="날짜" />
              <input value={form.series} onChange={e => setForm({ ...form, series: e.target.value })} placeholder="시리즈" className={input} />
              <input type="number" min={1} value={form.ver} onChange={e => setForm({ ...form, ver: parseInt(e.target.value || '1', 10) })} className={input} aria-label="버전" />
            </div>
            <textarea value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} rows={4} placeholder="요지" className={`${input} w-full resize-y`} />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setEdit(false); setErr('') }} className="text-xs text-gray-500 px-3">취소</button>
              <button onClick={saveMeta} disabled={busy} className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg px-4 py-1.5">저장</button>
            </div>
          </div>
        )}

        {/* 태그 — 눌러서 붙이고 떼기 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map(t => (
            <TagChip key={t.id} label={t.label} color={t.color} on={note.tagIds.includes(t.id)} onClick={() => toggle(t.id)}
              title={note.tagIds.includes(t.id) ? '눌러서 떼기' : '눌러서 붙이기'} />
          ))}
          <input value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) addTag() }}
            placeholder="+ 새 태그"
            className="w-24 bg-transparent border-b border-gray-800 focus:border-gray-600 px-1 py-0.5 text-[11px] outline-none placeholder:text-gray-600" />
        </div>

        {err && <p className="text-xs text-red-400">{err}</p>}

        {/* PDF */}
        {note.pdf_path ? (
          <section className="space-y-2">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-gray-400 font-semibold">PDF</span>
              {pdfUrl && <>
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-blue-300 hover:text-blue-200">새 탭에서 열기 ↗</a>
                <a href={`${pdfUrl}&download=${encodeURIComponent(note.file_name || `${note.title}.pdf`)}`} className="text-gray-500 hover:text-gray-300">내려받기</a>
              </>}
            </div>
            {pdfUrl
              ? <iframe title={note.title} src={pdfUrl} className="w-full h-[78vh] rounded-xl border border-gray-800 bg-white" />
              : <p className="text-xs text-gray-500">PDF 여는 중…</p>}
          </section>
        ) : (
          <p className="text-xs text-amber-300/80 bg-amber-500/5 border border-amber-500/20 rounded-xl px-4 py-3">
            회사자료 노트라 파일은 서가에 없어요. 원본은 내 컴퓨터에서 여세요{note.file_name ? ` — ${note.file_name}` : ''}.
          </p>
        )}

        {/* 위젯 */}
        <section className="space-y-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-gray-400 font-semibold">◈ 인터랙티브 위젯</span>
            <button onClick={() => widgetRef.current?.click()} disabled={busy} className="text-gray-500 hover:text-gray-200">
              {note.widget_path ? 'HTML 바꾸기' : '+ HTML 올리기'}
            </button>
            {note.widget_path && (
              <button onClick={() => run(async () => {
                if (!confirm('위젯을 지울까요?')) return
                await removeWidget(note.id, note.widget_path!)
                setNote({ ...note, widget_path: null })
              })} className="text-gray-600 hover:text-red-400">지우기</button>
            )}
            <input ref={widgetRef} type="file" accept=".html,.htm,text/html" className="hidden"
              onChange={e => { onWidget(e.target.files?.[0]); e.target.value = '' }} />
          </div>
          {note.widget_path
            ? <WidgetFrame key={`${note.widget_path}-${widgetRev}`} path={note.widget_path} />
            : <p className="text-[11px] text-gray-600">시뮬레이션·그래프 같은 독립 HTML 파일을 붙여 둘 수 있어요.</p>}
        </section>

        {/* 이어지는 노트 */}
        {related.series.length > 0 && (
          <section>
            <p className="text-[11px] text-gray-500 font-semibold mb-2">같은 시리즈 · {note.series}</p>
            <div className="space-y-2">{related.series.map(n => <NoteCard key={n.id} note={n} tagMap={tagMap} compact />)}</div>
          </section>
        )}
        {related.byTag.length > 0 && (
          <section>
            <p className="text-[11px] text-gray-500 font-semibold mb-2">태그가 겹치는 노트</p>
            <div className="space-y-2">{related.byTag.map(n => <NoteCard key={n.id} note={n} tagMap={tagMap} compact />)}</div>
          </section>
        )}

        <div className="pt-6 border-t border-gray-900 flex justify-end">
          <button onClick={remove} disabled={busy} className="text-[11px] text-gray-600 hover:text-red-400">이 노트 지우기</button>
        </div>
      </div>
    </main>
  )
}

function msg(e: unknown) {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message)
  return '처리하지 못했어요.'
}
