import { supabase } from './supabase'
import { signPath } from './storageSign'
import {
  DIGEST_CHECKS, MAX_FILE_BYTES, SLOT_META, SLOTS,
  type Slot, type UnitStatus,
} from './constants-armory'

// 병기고 — 데이터 계층
// -------------------------------------------------------------------
// 화면은 이 파일의 함수만 부른다. supabase 호출을 화면에 흩지 않는다.
//
//   기체(unit) ─┬─ 리비전(revision) ─┬─ ▶ 실행 HTML
//               │                    ├─ 📦 소스 zip
//               │                    ├─ 📐 제1원리 노트 PDF
//               │                    ├─ 소화 체크 (digest)
//               │                    └─ 출고 대장 (releases)
//               └─ 서가 노트 연결 (arm_unit_notes)
//
// 리비전의 단계는 저장하지 않고 계산한다 (stageOf):
//   🏢 회사 보관  keep = 'company'  — 카드만, 파이프라인 밖
//   입고          소화 체크 하나도 안 함
//   소화 중       일부만 체크
//   출고 대기     전부 체크 (= 소화 완료)
//   출고됨        출고 대장에 한 줄 이상

export const ARMORY_BUCKET = 'armory'
export const ARMORY_EVENT = 'armory:changed'

export type Keep = 'home' | 'company'

export interface Release {
  id: string
  revision_id: string
  released_on: string
  target: string
  form: string
  memo: string | null
  created_at: string
}

export interface Revision {
  id: string
  unit_id: string
  ver: string
  made_on: string
  changelog: string | null
  keep: Keep
  html_path: string | null; html_name: string | null; html_size: number | null
  zip_path: string | null;  zip_name: string | null;  zip_size: number | null
  zip_listing: string[] | null
  note_path: string | null; note_name: string | null; note_pages: number | null
  digest: Record<string, boolean>
  digested_at: string | null
  created_at: string
  releases: Release[]
}

export interface Unit {
  id: string
  code: string | null
  name: string
  family: string | null
  status: UnitStatus
  summary: string | null
  origin_project: string | null
  standards: string | null
  refs: string | null
  parent_id: string | null
  on_core: boolean
  sort_order: number
  created_at: string
  updated_at: string
  revisions: Revision[]     // 최신이 앞
  noteIds: string[]
}

export type Stage = 'company' | 'stock' | 'digesting' | 'ready' | 'released'
export const STAGE_META: Record<Stage, { label: string; color: string }> = {
  company:   { label: '🏢 회사 보관', color: '#94A3B8' },
  stock:     { label: '입고',        color: '#85B7EB' },
  digesting: { label: '소화 중',     color: '#E0B341' },
  ready:     { label: '출고 대기',   color: '#34D399' },
  released:  { label: '출고됨',      color: '#F0997B' },
}
export const PIPELINE: Stage[] = ['stock', 'digesting', 'ready', 'released']

// ── 계산 ───────────────────────────────────────────────────────────
export function digestState(r: Pick<Revision, 'digest' | 'note_path'>) {
  const done = DIGEST_CHECKS.filter(c => c.auto === 'note' ? !!r.note_path : !!r.digest?.[c.key])
  return { done: done.length, total: DIGEST_CHECKS.length, all: done.length === DIGEST_CHECKS.length }
}

export function stageOf(r: Revision): Stage {
  if (r.keep === 'company') return 'company'
  if (r.releases.length) return 'released'
  if (digestState(r).all) return 'ready'
  // 손으로 체크한 칸이 하나도 없으면 아직 '입고' (노트 자동 칸만 켜진 것은 소화가 아님)
  const manual = DIGEST_CHECKS.some(c => !c.auto && r.digest?.[c.key])
  return manual ? 'digesting' : 'stock'
}

export const latestRev = (u: Unit): Revision | null => u.revisions[0] ?? null

export const unitLabel = (u: Pick<Unit, 'code' | 'name'>) => u.code ? `${u.code} ${u.name}` : u.name

// 기체 정렬: sort_order → Mk 번호 → 이름
export function sortUnits(us: Unit[]) {
  const mk = (c: string | null) => { const m = c?.match(/(\d+)/); return m ? Number(m[1]) : 9999 }
  return [...us].sort((a, b) => a.sort_order - b.sort_order || mk(a.code) - mk(b.code) || a.name.localeCompare(b.name, 'ko'))
}

// ── 파일 읽기 도우미 (브라우저) ──────────────────────────────────────
// 파일명에서 버전 추측: lab_v8.3.html → v8.3 / 기능시험_E6.3.zip → E6.3
export function guessVersion(name: string): string | null {
  const base = name.replace(/\.[^.]+$/, '')
  const v = base.match(/(?:^|[_\-\s.(])(v\d+(?:\.\d+)*[a-z]?)(?=$|[_\-\s.)])/i)
  if (v) return v[1].toLowerCase().startsWith('v') ? 'v' + v[1].slice(1) : v[1]
  const e = base.match(/(?:^|[_\-\s(])([A-Z]\d+\.\d+(?:\.\d+)*)(?=$|[_\-\s.)])/)
  return e ? e[1] : null
}

// HTML <title> 꺼내기 — 새 기체 이름 미리 채우기용
export function htmlTitle(text: string): string | null {
  const m = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!m) return null
  const t = m[1].replace(/\s+/g, ' ').trim()
  return t || null
}

// zip 목차 읽기 — 압축은 풀지 않고 맨 끝의 '중앙 목록'만 읽는다 (라이브러리 없이)
//   한글 이름: UTF-8 표시가 있으면 UTF-8, 없으면 UTF-8 시도 → 실패 시 EUC-KR(윈도 탐색기 압축)
export function zipNames(buf: ArrayBuffer): string[] {
  const dv = new DataView(buf)
  const n = buf.byteLength
  let eocd = -1
  for (let i = n - 22; i >= Math.max(0, n - 22 - 65535); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('zip 목차를 찾지 못했어요.')
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const utf8 = new TextDecoder('utf-8', { fatal: true })
  const loose = new TextDecoder('utf-8')
  let euc: TextDecoder | null = null
  try { euc = new TextDecoder('euc-kr') } catch { euc = null }
  const out: string[] = []
  for (let k = 0; k < count && p + 46 <= n; k++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const flag = dv.getUint16(p + 8, true)
    const nl = dv.getUint16(p + 28, true)
    const el = dv.getUint16(p + 30, true)
    const cl = dv.getUint16(p + 32, true)
    const bytes = new Uint8Array(buf, p + 46, nl)
    let name: string
    if (flag & 0x800) name = loose.decode(bytes)
    else {
      try { name = utf8.decode(bytes) } catch { name = euc ? euc.decode(bytes) : loose.decode(bytes) }
    }
    out.push(name)
    p += 46 + nl + el + cl
  }
  return out.filter(x => !/(^|\/)(__MACOSX|\.DS_Store)/.test(x))
}

async function pdfPages(file: File): Promise<number | null> {
  try {
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc =
      new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
    const k = doc.numPages
    await doc.destroy()
    return k
  } catch { return null }
}

// 떨군 파일들 → 세 칸으로 나누기
export interface Sorted { html?: File; zip?: File; note?: File; rejected: { file: File; why: string }[] }
export function sortFiles(files: File[]): Sorted {
  const out: Sorted = { rejected: [] }
  for (const f of files) {
    const slot = SLOTS.find(s => SLOT_META[s].ext.test(f.name))
    if (!slot) { out.rejected.push({ file: f, why: 'HTML · zip · PDF 만 받아요.' }); continue }
    if (f.size > MAX_FILE_BYTES) { out.rejected.push({ file: f, why: '50MB 보다 커요.' }); continue }
    if (out[slot]) {
      out.rejected.push({ file: f, why: slot === 'note'
        ? '제1원리 노트는 한 장만. 다른 보고서 PDF 는 서가에 꽂고 기체에 연결하세요.'
        : `${SLOT_META[slot].label}은 한 개만 받아요.` })
      continue
    }
    out[slot] = f
  }
  return out
}

// ── 목록 ───────────────────────────────────────────────────────────
const UNIT_COLS = '*, arm_revisions(*, arm_releases(*)), arm_unit_notes(note_id)'

type RevRow = Omit<Revision, 'releases'> & { arm_releases?: Release[] | null }
type UnitRow = Omit<Unit, 'revisions' | 'noteIds'> & {
  arm_revisions?: RevRow[] | null
  arm_unit_notes?: { note_id: string }[] | null
}

const toRev = (r: RevRow): Revision => {
  const { arm_releases, ...rest } = r
  return {
    ...rest,
    digest: rest.digest ?? {},
    zip_listing: Array.isArray(rest.zip_listing) ? rest.zip_listing : null,
    releases: [...(arm_releases ?? [])].sort((a, b) =>
      b.released_on.localeCompare(a.released_on) || b.created_at.localeCompare(a.created_at)),
  }
}
const toUnit = (u: UnitRow): Unit => {
  const { arm_revisions, arm_unit_notes, ...rest } = u
  return {
    ...rest,
    revisions: (arm_revisions ?? []).map(toRev).sort((a, b) =>
      b.made_on.localeCompare(a.made_on) || b.created_at.localeCompare(a.created_at)),
    noteIds: (arm_unit_notes ?? []).map(x => x.note_id),
  }
}

function changed() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ARMORY_EVENT))
}

export async function fetchUnits(): Promise<Unit[]> {
  const { data, error } = await supabase.from('arm_units').select(UNIT_COLS)
  if (error) throw error
  return sortUnits(((data ?? []) as unknown as UnitRow[]).map(toUnit))
}

export async function fetchUnit(id: string): Promise<Unit | null> {
  const { data, error } = await supabase.from('arm_units').select(UNIT_COLS).eq('id', id).maybeSingle()
  if (error) throw error
  return data ? toUnit(data as unknown as UnitRow) : null
}

// ── 기체 ───────────────────────────────────────────────────────────
export type UnitPatch = Partial<Pick<Unit,
  'code' | 'name' | 'family' | 'status' | 'summary' | 'origin_project' | 'standards' | 'refs' | 'parent_id' | 'on_core' | 'sort_order'>>

const blank = (s: string | null | undefined) => (s ?? '').trim() || null

export async function createUnit(p: { code?: string; name: string; family?: string; status?: UnitStatus }): Promise<string> {
  const { data: last } = await supabase.from('arm_units').select('sort_order').order('sort_order', { ascending: false }).limit(1)
  const sort = ((last?.[0] as { sort_order?: number } | undefined)?.sort_order ?? 0) + 1
  const { data, error } = await supabase.from('arm_units').insert({
    code: blank(p.code), name: p.name.trim(), family: blank(p.family),
    status: p.status ?? 'building', sort_order: sort,
  }).select('id').single()
  if (error) throw error
  if (!data) throw new Error('기체를 만들지 못했어요. 로그인 상태를 확인해 주세요.')
  changed()
  return (data as { id: string }).id
}

export async function updateUnit(id: string, patch: UnitPatch) {
  const p: Record<string, unknown> = { ...patch, updated_at: new Date().toISOString() }
  for (const k of ['code', 'family', 'summary', 'origin_project', 'standards', 'refs'] as const) {
    if (k in patch) p[k] = blank(patch[k] as string | null)
  }
  if (patch.name !== undefined) p.name = patch.name.trim()
  const { data, error } = await supabase.from('arm_units').update(p).eq('id', id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('기체를 고치지 못했어요. 로그인 상태를 확인해 주세요.')
  changed()
}

export async function deleteUnit(u: Unit) {
  const paths = u.revisions.flatMap(r => [r.html_path, r.zip_path, r.note_path]).filter((x): x is string => !!x)
  if (paths.length) await supabase.storage.from(ARMORY_BUCKET).remove(paths)
  const { data, error } = await supabase.from('arm_units').delete().eq('id', u.id).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('기체를 지우지 못했어요.')
  changed()
}

// ── 리비전 ──────────────────────────────────────────────────────────
const storagePath = (unitId: string, revId: string, slot: Slot) =>
  `${unitId}/${revId}/${slot === 'html' ? 'lab.html' : slot === 'zip' ? 'source.zip' : 'note.pdf'}`

const CONTENT_TYPE: Record<Slot, string> = {
  // Supabase 는 보안상 HTML 을 웹페이지로 띄워주지 않는다 → 텍스트로 넣고 격리 iframe 에서 돌린다
  html: 'text/plain;charset=utf-8',
  zip: 'application/zip',
  note: 'application/pdf',
}

// 한 칸 올리기 (새로 올리기 · 바꿔 끼우기 둘 다)
export async function putSlot(rev: Pick<Revision, 'id' | 'unit_id' | 'keep'>, slot: Slot, file: File) {
  if (rev.keep === 'company') throw new Error('회사 보관 리비전에는 파일을 올리지 않아요.')
  if (file.size > MAX_FILE_BYTES) throw new Error('50MB 보다 큰 파일은 올릴 수 없어요.')
  const path = storagePath(rev.unit_id, rev.id, slot)
  const up = await supabase.storage.from(ARMORY_BUCKET).upload(path, file, { contentType: CONTENT_TYPE[slot], upsert: true })
  if (up.error) throw up.error

  const patch: Record<string, unknown> = { [`${slot}_path`]: path, [`${slot}_name`]: file.name }
  if (slot === 'html' || slot === 'zip') patch[`${slot}_size`] = file.size
  if (slot === 'zip') {
    try { patch.zip_listing = zipNames(await file.arrayBuffer()) } catch { patch.zip_listing = null }
  }
  if (slot === 'note') patch.note_pages = await pdfPages(file)
  const { error } = await supabase.from('arm_revisions').update(patch).eq('id', rev.id)
  if (error) throw error
  changed()
}

// 리비전의 칸별 파일 경로 · 이름
export const filePath = (r: Pick<Revision, 'html_path' | 'zip_path' | 'note_path'> | null | undefined, s: Slot) =>
  !r ? null : s === 'html' ? r.html_path : s === 'zip' ? r.zip_path : r.note_path
export const fileName = (r: Revision, s: Slot) =>
  s === 'html' ? r.html_name : s === 'zip' ? r.zip_name : r.note_name

export async function clearSlot(rev: Revision, slot: Slot) {
  const path = filePath(rev, slot)
  if (path) await supabase.storage.from(ARMORY_BUCKET).remove([path])
  const patch: Record<string, unknown> = { [`${slot}_path`]: null, [`${slot}_name`]: null }
  if (slot === 'html' || slot === 'zip') patch[`${slot}_size`] = null
  if (slot === 'zip') patch.zip_listing = null
  if (slot === 'note') patch.note_pages = null
  const { error } = await supabase.from('arm_revisions').update(patch).eq('id', rev.id)
  if (error) throw error
  changed()
}

export interface NewRevision {
  unitId: string
  ver: string
  madeOn: string
  changelog: string
  keep: Keep
  files: Partial<Record<Slot, File>>
}

// 한번에 입고 — 리비전 한 줄 만들고, 세 칸을 차례로 올린다.
// 하나라도 실패하면 리비전째 되돌린다 (반쯤 들어간 리비전을 남기지 않음).
export async function createRevision(n: NewRevision, onStep?: (msg: string) => void): Promise<string> {
  const { data, error } = await supabase.from('arm_revisions').insert({
    unit_id: n.unitId, ver: n.ver.trim(), made_on: n.madeOn,
    changelog: blank(n.changelog), keep: n.keep,
  }).select('id').single()
  if (error) throw error
  if (!data) throw new Error('리비전을 만들지 못했어요. 로그인 상태를 확인해 주세요.')
  const id = (data as { id: string }).id
  if (n.keep === 'home') {
    try {
      for (const s of SLOTS) {
        const f = n.files[s]
        if (!f) continue
        onStep?.(`${SLOT_META[s].label} 올리는 중…`)
        await putSlot({ id, unit_id: n.unitId, keep: 'home' }, s, f)
      }
    } catch (e) {
      await supabase.storage.from(ARMORY_BUCKET).remove(SLOTS.map(s => storagePath(n.unitId, id, s)))
      await supabase.from('arm_revisions').delete().eq('id', id)
      throw e
    }
  }
  await supabase.from('arm_units').update({ updated_at: new Date().toISOString() }).eq('id', n.unitId)
  changed()
  return id
}

export async function updateRevision(id: string, patch: Partial<Pick<Revision, 'ver' | 'made_on' | 'changelog'>>) {
  const { error } = await supabase.from('arm_revisions').update(patch).eq('id', id)
  if (error) throw error
  changed()
}

export async function deleteRevision(r: Revision) {
  const paths = [r.html_path, r.zip_path, r.note_path].filter((x): x is string => !!x)
  if (paths.length) await supabase.storage.from(ARMORY_BUCKET).remove(paths)
  const { error } = await supabase.from('arm_revisions').delete().eq('id', r.id)
  if (error) throw error
  changed()
}

// ── 소화 · 출고 ─────────────────────────────────────────────────────
export async function setDigest(r: Revision, key: string, on: boolean) {
  const digest = { ...(r.digest ?? {}), [key]: on }
  const all = digestState({ digest, note_path: r.note_path }).all
  const { error } = await supabase.from('arm_revisions').update({
    digest, digested_at: all ? (r.digested_at ?? new Date().toISOString()) : null,
  }).eq('id', r.id)
  if (error) throw error
  changed()
}

export async function addRelease(r: Revision, p: { releasedOn: string; target: string; form: string; memo: string }) {
  if (r.keep === 'company') throw new Error('회사 보관 리비전은 이미 회사에 있어요.')
  if (!digestState(r).all) throw new Error('소화 체크를 다 채워야 출고할 수 있어요.')
  const { error } = await supabase.from('arm_releases').insert({
    revision_id: r.id, released_on: p.releasedOn, target: p.target.trim(), form: p.form.trim(), memo: blank(p.memo),
  })
  if (error) throw error
  changed()
}

export async function deleteRelease(id: string) {
  const { error } = await supabase.from('arm_releases').delete().eq('id', id)
  if (error) throw error
  changed()
}

// ── 서가 노트 연결 ──────────────────────────────────────────────────
export async function linkNote(unitId: string, noteId: string, on: boolean) {
  const q = on
    ? supabase.from('arm_unit_notes').upsert({ unit_id: unitId, note_id: noteId })
    : supabase.from('arm_unit_notes').delete().eq('unit_id', unitId).eq('note_id', noteId)
  const { error } = await q
  if (error) throw error
  changed()
}

// ── 파일 열기 ───────────────────────────────────────────────────────
export const signedArmoryUrl = (path: string) => signPath(ARMORY_BUCKET, path, 60 * 60)

export async function signedDownloadUrl(path: string, fileName: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(ARMORY_BUCKET)
    .createSignedUrl(path, 60 * 10, { download: fileName })
  if (error || !data?.signedUrl) { console.error(error); return null }
  return data.signedUrl
}

export async function loadHtml(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(ARMORY_BUCKET).download(path)
  if (error || !data) { console.error(error); return null }
  return data.text()
}

export const fmtSize = (b: number | null | undefined) =>
  b == null ? '' : b < 1024 ? `${b}B` : b < 1024 * 1024 ? `${(b / 1024).toFixed(0)}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`

export const today = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
