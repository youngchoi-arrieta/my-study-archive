import { supabase } from './supabase'
import { signPath } from './storageSign'
import type { PdfDraft } from './pdfMeta'

// 서가 — 데이터 계층
// -------------------------------------------------------------------
// 화면은 이 파일의 함수만 부른다. supabase 호출을 화면에 흩지 않는다.

export const NOTES_BUCKET = 'notes'
export const NOTES_EVENT = 'notes:changed'

export type Scope = 'personal' | 'company'

export interface NoteTag {
  id: string
  label: string
  color: string
  sort_order: number
}

export interface Note {
  id: string
  title: string
  made_on: string
  summary: string | null
  series: string | null
  ver: number
  scope: Scope
  pdf_path: string | null
  widget_path: string | null
  file_name: string | null
  pages: number | null
  created_at: string
  tagIds: string[]
}

// 태그 색 — 고르기 쉽게 몇 개만. 홈의 기존 팔레트와 맞춘다.
export const TAG_COLORS = [
  '#5DCAA5', '#85B7EB', '#F0997B', '#A78BFA',
  '#E0B341', '#F472B6', '#94A3B8', '#34D399',
] as const

const LIST_COLS =
  'id,title,made_on,summary,series,ver,scope,pdf_path,widget_path,file_name,pages,created_at,note_tag_links(tag_id)'

type NoteRow = Omit<Note, 'tagIds'> & { note_tag_links?: { tag_id: string }[] | null }
const toNote = (r: NoteRow): Note => {
  const { note_tag_links, ...rest } = r
  return { ...rest, tagIds: (note_tag_links ?? []).map(l => l.tag_id) }
}

function changed() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(NOTES_EVENT))
}

// ── 태그 ───────────────────────────────────────────────────────────
export async function fetchTags(): Promise<NoteTag[]> {
  const { data, error } = await supabase.from('note_tags').select('id,label,color,sort_order')
    .order('sort_order').order('created_at')
  if (error) throw error
  return data ?? []
}

export async function createTag(label: string, color?: string): Promise<NoteTag> {
  const tags = await fetchTags()
  const exist = tags.find(t => norm(t.label) === norm(label))
  if (exist) return exist
  const { data, error } = await supabase.from('note_tags').insert({
    label: label.trim(),
    color: color ?? TAG_COLORS[tags.length % TAG_COLORS.length],
    sort_order: tags.length ? Math.max(...tags.map(t => t.sort_order)) + 1 : 0,
  }).select('id,label,color,sort_order').single()
  if (error) throw error
  return data
}

export async function updateTag(id: string, patch: Partial<Pick<NoteTag, 'label' | 'color' | 'sort_order'>>) {
  const p = { ...patch, ...(patch.label !== undefined ? { label: patch.label.trim() } : {}) }
  const { error } = await supabase.from('note_tags').update(p).eq('id', id)
  if (error) throw error
}

// 태그를 지워도 노트는 남는다 (연결만 사라짐)
export async function deleteTag(id: string) {
  const { error } = await supabase.from('note_tags').delete().eq('id', id)
  if (error) throw error
}

// 위/아래로 한 칸 — 정렬 순서를 0..n 으로 다시 매긴다
export async function moveTag(tags: NoteTag[], id: string, dir: -1 | 1) {
  const i = tags.findIndex(t => t.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= tags.length) return
  const next = [...tags]
  ;[next[i], next[j]] = [next[j], next[i]]
  await Promise.all(next.map((t, k) =>
    t.sort_order === k ? null : supabase.from('note_tags').update({ sort_order: k }).eq('id', t.id)))
}

const norm = (s: string) => s.trim().toLowerCase()

// 이름 목록 → 태그 id 목록. 없는 이름은 새 태그로 만든다.
export async function ensureTags(labels: string[]): Promise<string[]> {
  const ids: string[] = []
  for (const l of labels) {
    if (!l.trim()) continue
    const t = await createTag(l)
    if (!ids.includes(t.id)) ids.push(t.id)
  }
  return ids
}

// ── 노트 목록·검색 ─────────────────────────────────────────────────
// q 가 있으면 제목·요지·시리즈·본문에서 찾는다 (본문은 목록에 싣지 않음).
export async function fetchNotes(q = ''): Promise<Note[]> {
  let query = supabase.from('notes').select(LIST_COLS)
    .order('made_on', { ascending: false }).order('created_at', { ascending: false })
  const s = q.replace(/[%,()*\\]/g, ' ').trim()
  if (s) {
    const like = `%${s}%`
    query = query.or(`title.ilike.${like},summary.ilike.${like},series.ilike.${like},body_text.ilike.${like}`)
  }
  const { data, error } = await query
  if (error) throw error
  return ((data ?? []) as unknown as NoteRow[]).map(toNote)
}

export async function fetchNote(id: string): Promise<Note | null> {
  const { data, error } = await supabase.from('notes').select(LIST_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toNote(data as unknown as NoteRow) : null
}

export async function fetchRecentNotes(limit = 4): Promise<Note[]> {
  const { data, error } = await supabase.from('notes').select(LIST_COLS)
    .order('created_at', { ascending: false }).limit(limit)
  if (error) throw error
  return ((data ?? []) as unknown as NoteRow[]).map(toNote)
}

export async function findByHash(hash: string): Promise<Pick<Note, 'id' | 'title'> | null> {
  const { data } = await supabase.from('notes').select('id,title').eq('file_hash', hash).maybeSingle()
  return data ?? null
}

// ── 저장 ───────────────────────────────────────────────────────────
// personal → PDF 를 비공개 버킷에 올리고 카드 저장
// company  → 파일은 올리지 않고 카드(제목·요지·태그)만 저장
export async function saveDraft(file: File, d: PdfDraft, tagIds: string[]): Promise<string> {
  const id = crypto.randomUUID()
  let pdfPath: string | null = null

  if (d.scope === 'personal') {
    pdfPath = `pdf/${id}.pdf`
    const up = await supabase.storage.from(NOTES_BUCKET)
      .upload(pdfPath, file, { contentType: 'application/pdf', upsert: false })
    if (up.error) throw up.error
  }

  const { error } = await supabase.from('notes').insert({
    id,
    title: d.title.trim() || file.name,
    made_on: d.madeOn,
    summary: d.summary.trim() || null,
    series: d.series.trim() || null,
    ver: d.ver || 1,
    scope: d.scope,
    pdf_path: pdfPath,
    file_name: file.name,
    file_hash: d.fileHash,
    pages: d.pages,
    // company 노트는 본문도 남기지 않는다 — 카드만
    body_text: d.scope === 'personal' ? d.bodyText : null,
  })
  if (error) {
    if (pdfPath) await supabase.storage.from(NOTES_BUCKET).remove([pdfPath])
    throw error
  }
  if (tagIds.length) {
    const { error: le } = await supabase.from('note_tag_links')
      .insert(tagIds.map(tag_id => ({ note_id: id, tag_id })))
    if (le) console.error(le)
  }
  changed()
  return id
}

export type NotePatch = Partial<Pick<Note, 'title' | 'made_on' | 'summary' | 'series' | 'ver'>>

export async function updateNote(id: string, patch: NotePatch) {
  const { error } = await supabase.from('notes')
    .update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
  changed()
}

export async function setNoteTags(id: string, tagIds: string[]) {
  const { error: de } = await supabase.from('note_tag_links').delete().eq('note_id', id)
  if (de) throw de
  if (tagIds.length) {
    const { error } = await supabase.from('note_tag_links')
      .insert(tagIds.map(tag_id => ({ note_id: id, tag_id })))
    if (error) throw error
  }
  changed()
}

export async function toggleNoteTag(id: string, tagId: string, on: boolean) {
  const q = on
    ? supabase.from('note_tag_links').insert({ note_id: id, tag_id: tagId })
    : supabase.from('note_tag_links').delete().eq('note_id', id).eq('tag_id', tagId)
  const { error } = await q
  if (error) throw error
  changed()
}

export async function deleteNote(n: Pick<Note, 'id' | 'pdf_path' | 'widget_path'>) {
  const paths = [n.pdf_path, n.widget_path].filter((p): p is string => !!p)
  if (paths.length) await supabase.storage.from(NOTES_BUCKET).remove(paths)
  const { error } = await supabase.from('notes').delete().eq('id', n.id)
  if (error) throw error
  changed()
}

// ── 파일 열기 ───────────────────────────────────────────────────────
export const signedNoteUrl = (path: string) => signPath(NOTES_BUCKET, path, 60 * 60)

// ── 위젯 (인터랙티브 HTML) ─────────────────────────────────────────
// Supabase 는 보안상 HTML 을 웹페이지로 띄워주지 않는다.
// 그래서 텍스트로 받아와 격리된 iframe(srcdoc) 안에서 돌린다.
export async function uploadWidget(noteId: string, file: File): Promise<string> {
  const path = `widget/${noteId}.html`
  const up = await supabase.storage.from(NOTES_BUCKET)
    .upload(path, file, { contentType: 'text/plain;charset=utf-8', upsert: true })
  if (up.error) throw up.error
  const { error } = await supabase.from('notes').update({ widget_path: path }).eq('id', noteId)
  if (error) throw error
  changed()
  return path
}

export async function removeWidget(noteId: string, path: string) {
  await supabase.storage.from(NOTES_BUCKET).remove([path])
  const { error } = await supabase.from('notes').update({ widget_path: null }).eq('id', noteId)
  if (error) throw error
  changed()
}

export async function loadWidgetHtml(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(NOTES_BUCKET).download(path)
  if (error || !data) { console.error(error); return null }
  return data.text()
}
