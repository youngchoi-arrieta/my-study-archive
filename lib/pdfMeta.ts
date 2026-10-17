// PDF 노트 읽기 — 브라우저 안에서 pdf.js 로 문서 속성과 본문을 뽑는다.
// -------------------------------------------------------------------
// 서버 왕복도, API 비용도 없다. 업로드 직전에 카드를 미리 채우는 용도.
//
// 「PDF 노트 규약」 (클로드가 노트를 만들 때 지키는 약속)
//   파일명     2026-10-09_허브_허브자리에서-나로-남기_v2.pdf
//   Title      제목
//   Subject    요지 3줄 (줄바꿈 또는 ' / ' 로 구분)
//   Keywords   tags=회사생활,조직동역학; series=허브; ver=2; scope=personal
// 규약 이전 PDF 는 속성이 비어 있으므로 파일명 → 첫 페이지 순으로 추측한다.

export interface PdfDraft {
  title: string
  madeOn: string            // YYYY-MM-DD
  summary: string
  series: string
  ver: number
  scope: 'personal' | 'company'
  tagLabels: string[]       // 아직 태그 id 가 아니라 이름. 저장할 때 매칭한다.
  pages: number
  bodyText: string
  fileHash: string
  fromConvention: boolean   // 규약 Keywords 가 있었는지 (UI 힌트용)
}

const BODY_LIMIT = 200_000  // 검색용 본문은 앞부분만 (DB 비대 방지)

// ── Keywords 문법 ──────────────────────────────────────────────────
// 'tags=a,b; series=허브; ver=2; scope=company'
// 규약을 안 따른 Keywords('a, b, c')는 그냥 태그 목록으로 본다.
export function parseKeywords(raw: string | undefined | null) {
  const out: { tags: string[]; series?: string; ver?: number; scope?: 'personal' | 'company'; structured: boolean } =
    { tags: [], structured: false }
  const s = (raw ?? '').trim()
  if (!s) return out
  if (!s.includes('=')) {
    out.tags = splitList(s)
    return out
  }
  out.structured = true
  for (const part of s.split(/[;\n]/)) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim().toLowerCase()
    const v = part.slice(i + 1).trim()
    if (!v) continue
    if (k === 'tags' || k === 'tag') out.tags = splitList(v)
    else if (k === 'series') out.series = v
    else if (k === 'ver' || k === 'version') { const n = parseInt(v.replace(/^v/i, ''), 10); if (n > 0) out.ver = n }
    else if (k === 'scope') out.scope = v.toLowerCase() === 'company' ? 'company' : 'personal'
  }
  return out
}

function splitList(s: string) {
  return Array.from(new Set(s.split(/[,，、|]/).map(t => t.trim().replace(/^#/, '')).filter(Boolean)))
}

// ── 파일명 규약 ────────────────────────────────────────────────────
// 2026-10-09_허브_허브자리에서-나로-남기_v2.pdf
// 날짜만 있거나, 아무 규칙도 없어도 최대한 건진다.
export function parseFileName(name: string) {
  const base = name.replace(/\.pdf$/i, '').normalize('NFC')
  const out: { date?: string; series?: string; title?: string; ver?: number } = {}
  let rest = base

  const dm = rest.match(/^(\d{4})[-.]?(\d{2})[-.]?(\d{2})[_\s-]*/)
  if (dm) {
    out.date = `${dm[1]}-${dm[2]}-${dm[3]}`
    rest = rest.slice(dm[0].length)
  }
  const vm = rest.match(/[_\s-]v(\d+)$/i)
  if (vm) {
    out.ver = parseInt(vm[1], 10)
    rest = rest.slice(0, -vm[0].length)
  }
  const parts = rest.split('_').filter(Boolean)
  if (dm && parts.length >= 2) {
    out.series = parts[0]
    out.title = parts.slice(1).join(' ').replace(/-/g, ' ')
  } else if (parts.length) {
    out.title = parts.join(' ')
  }
  return out
}

// pdf 의 CreationDate 'D:20261009153000+09'00'' → '2026-10-09'
function pdfDate(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return
  const m = raw.match(/^D?:?(\d{4})(\d{2})(\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined
}

function today() {
  const d = new Date()
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}

export async function sha256Hex(buf: ArrayBuffer) {
  const h = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(h)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// pdf.js 는 모듈을 읽는 순간 브라우저 API(DOMMatrix 등)를 찾는다.
// 서버 렌더링 때 터지지 않게 쓰는 순간에만 불러온다.
type PdfJs = typeof import('pdfjs-dist')
let pdfjsPromise: Promise<PdfJs> | null = null
function loadPdfJs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist').then(m => {
      m.GlobalWorkerOptions.workerSrc =
        new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString()
      return m
    })
  }
  return pdfjsPromise
}

// 같은 줄 판정: pdf.js 텍스트 조각을 줄 단위로 다시 묶는다.
interface TextItemLike { str: string; hasEOL?: boolean }

export async function readPdf(file: File): Promise<PdfDraft> {
  const buf = await file.arrayBuffer()
  const fileHash = await sha256Hex(buf)

  const pdfjs = await loadPdfJs()
  // pdf.js 가 버퍼를 워커로 넘기며 비워버리므로 사본을 준다
  const doc = await pdfjs.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise

  const meta = await doc.getMetadata().catch(() => null)
  const info = (meta?.info ?? {}) as Record<string, unknown>
  const str = (k: string) => (typeof info[k] === 'string' ? (info[k] as string).trim() : '')

  // 본문 — 페이지마다 줄을 살려서 이어붙인다
  const pageTexts: string[] = []
  let total = 0
  for (let p = 1; p <= doc.numPages && total < BODY_LIMIT; p++) {
    const page = await doc.getPage(p)
    const tc = await page.getTextContent()
    let line = ''
    const lines: string[] = []
    for (const it of tc.items as TextItemLike[]) {
      if (typeof it.str !== 'string') continue
      line += it.str
      if (it.hasEOL) { lines.push(line); line = '' }
    }
    if (line) lines.push(line)
    const t = lines.map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n')
    pageTexts.push(t)
    total += t.length
    page.cleanup()
  }
  const pages = doc.numPages
  await doc.destroy()
  const bodyText = pageTexts.join('\n\n').slice(0, BODY_LIMIT)

  const kw = parseKeywords(str('Keywords'))
  const fn = parseFileName(file.name)

  // 제목: 속성 → 파일명 → 첫 페이지 첫 줄
  const firstLine = (pageTexts[0] ?? '').split('\n').find(l => l.length >= 2) ?? ''
  const metaTitle = str('Title')
  const looksGenerated = /^(untitled|microsoft word|report|document)\b/i.test(metaTitle) || /\.html?$/i.test(metaTitle)
  const title = (!looksGenerated && metaTitle) || fn.title || firstLine.slice(0, 80) || file.name

  return {
    title,
    madeOn: fn.date || pdfDate(info.CreationDate) || today(),
    summary: str('Subject').replace(/\s+\/\s+/g, '\n'),
    series: kw.series ?? fn.series ?? '',
    ver: kw.ver ?? fn.ver ?? 1,
    scope: kw.scope ?? 'personal',
    tagLabels: kw.tags,
    pages,
    bodyText,
    fileHash,
    fromConvention: kw.structured,
  }
}
