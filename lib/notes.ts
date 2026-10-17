import { supabase } from './supabase'
import { signPath } from './storageSign'
import type { PdfDraft } from './pdfMeta'

// 서가 — 데이터 계층
// -------------------------------------------------------------------
// 화면은 이 파일의 함수만 부른다. supabase 호출을 화면에 흩지 않는다.

export const NOTES_BUCKET = 'notes'
export const NOTES_EVENT = 'notes:changed'

export type Scope = 'personal' | 'company'

export type TagGroup = 'type' | 'topic'

export interface NoteTag {
  id: string
  label: string
  color: string
  sort_order: number
  grp: TagGroup | null      // 성격(하나만) · 주제(여러 개) · 기타(null)
}

// 태그 묶음 — 서가·업로드·노트 화면이 같은 순서로 보여준다
export const TAG_GROUPS: { key: TagGroup | null; label: string; hint: string }[] = [
  { key: 'type', label: '성격', hint: '하나만' },
  { key: 'topic', label: '주제', hint: '여러 개' },
  { key: null, label: '기타', hint: '' },
]
const grpRank = (g: TagGroup | null) => (g === 'type' ? 0 : g === 'topic' ? 1 : 2)
export const sortTags = (ts: NoteTag[]) =>
  [...ts].sort((a, b) => grpRank(a.grp) - grpRank(b.grp) || a.sort_order - b.sort_order)

// 추천 태그셋 — 「태그 편집 → 추천 태그셋 채우기」와 notes_tags_v2_migration.sql 이 같은 목록을 쓴다
export const RECOMMENDED_TAGS: { label: string; grp: TagGroup; color: string }[] = [
  { label: '통찰', grp: 'type', color: '#F0997B' },
  { label: '로드맵', grp: 'type', color: '#85B7EB' },
  { label: '분석', grp: 'type', color: '#A78BFA' },
  { label: '설계', grp: 'type', color: '#34D399' },
  { label: '도구', grp: 'type', color: '#E0B341' },
  { label: '문헌', grp: 'type', color: '#94A3B8' },
  { label: '조직', grp: 'topic', color: '#F472B6' },
  { label: '배전망ESS', grp: 'topic', color: '#5DCAA5' },
  { label: '테스트벤치', grp: 'topic', color: '#85B7EB' },
  { label: 'KERI알고리즘', grp: 'topic', color: '#A78BFA' },
  { label: '마이크로그리드·인버터', grp: 'topic', color: '#E0B341' },
]

// 성격 태그는 하나만 — 켜면 다른 성격 태그는 떨어진다
export function toggleWithRule(tagIds: string[], tag: NoteTag, tags: NoteTag[]): string[] {
  if (tagIds.includes(tag.id)) return tagIds.filter(x => x !== tag.id)
  if (tag.grp !== 'type') return [...tagIds, tag.id]
  const typeIds = new Set(tags.filter(t => t.grp === 'type').map(t => t.id))
  return [...tagIds.filter(x => !typeIds.has(x)), tag.id]
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
// grp 열은 notes_tags_v2_migration.sql 에서 생긴다. 아직 안 돌렸어도 서가가 깨지지 않게 한 번 물러선다.
let hasGrp = true
const TAG_COLS = () => (hasGrp ? 'id,label,color,sort_order,grp' : 'id,label,color,sort_order')
const missingGrp = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === '42703' || e.code === 'PGRST204' || /grp/.test(e.message ?? ''))

export async function fetchTags(): Promise<NoteTag[]> {
  let r = await supabase.from('note_tags').select(TAG_COLS()).order('sort_order').order('created_at')
  if (r.error && hasGrp && missingGrp(r.error)) {
    hasGrp = false
    r = await supabase.from('note_tags').select(TAG_COLS()).order('sort_order').order('created_at')
  }
  if (r.error) throw r.error
  const rows = (r.data ?? []) as unknown as (Omit<NoteTag, 'grp'> & { grp?: TagGroup | null })[]
  return rows.map(t => ({ ...t, grp: t.grp ?? null }))
}

export const tagsNeedMigration = () => !hasGrp

export async function createTag(label: string, opts: { color?: string; grp?: TagGroup | null } = {}): Promise<NoteTag> {
  const tags = await fetchTags()
  const exist = tags.find(t => norm(t.label) === norm(label))
  if (exist) return exist
  const row: Record<string, unknown> = {
    label: label.trim(),
    color: opts.color ?? TAG_COLORS[tags.length % TAG_COLORS.length],
    sort_order: tags.length ? Math.max(...tags.map(t => t.sort_order)) + 1 : 0,
  }
  if (hasGrp) row.grp = opts.grp ?? null
  const { data, error } = await supabase.from('note_tags').insert(row).select(TAG_COLS()).single()
  if (error) throw error
  if (!data) throw new Error('태그를 만들지 못했어요. 로그인 상태를 확인해 주세요.')
  const t = data as unknown as Omit<NoteTag, 'grp'> & { grp?: TagGroup | null }
  return { ...t, grp: t.grp ?? null }
}

export async function updateTag(id: string, patch: Partial<Pick<NoteTag, 'label' | 'color' | 'sort_order' | 'grp'>>) {
  const p: Record<string, unknown> = { ...patch }
  if (patch.label !== undefined) p.label = patch.label.trim()
  if (!hasGrp) delete p.grp
  if (!Object.keys(p).length) return
  const { data, error } = await supabase.from('note_tags').update(p).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('태그를 바꾸지 못했어요. 로그인 상태를 확인해 주세요.')
}

// 태그를 지워도 노트는 남는다 (연결만 사라짐).
// RLS 로 막히면 오류 없이 0행이 지워지므로, 지워진 행을 돌려받아 확인한다.
export async function deleteTag(id: string) {
  const { data, error } = await supabase.from('note_tags').delete().eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('태그를 지우지 못했어요. 로그인 상태를 확인하거나 notes_tags_v2_migration.sql 을 실행해 주세요.')
}

// 추천 태그셋 채우기 — 없는 것만 만들고, 이미 있는 같은 이름 태그는 묶음(grp)만 맞춘다
export async function seedRecommendedTags() {
  for (const r of RECOMMENDED_TAGS) {
    const t = await createTag(r.label, { color: r.color, grp: r.grp })
    if (hasGrp && t.grp !== r.grp) await updateTag(t.id, { grp: r.grp })
  }
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
