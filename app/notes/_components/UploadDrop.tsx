'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { readPdf, type PdfDraft } from '@/lib/pdfMeta'
import { createTag, ensureTags, findByHash, saveDraft, toggleWithRule, type NoteTag } from '@/lib/notes'
import TagPicker from './TagPicker'

// PDF 끌어다 놓기 → 브라우저에서 읽어 카드 미리 채움 → 확인 후 저장
// -------------------------------------------------------------------
// 규약(문서 속성)을 지킨 PDF 는 그대로 저장만 누르면 된다.
// 규약 이전 PDF 는 제목·날짜만 추측되므로 태그를 그 자리에서 찍는다.

const MAX_BYTES = 50 * 1024 * 1024

type Status = 'reading' | 'ready' | 'dup' | 'saving' | 'saved' | 'error'
interface Item {
  key: string
  file: File
  status: Status
  draft?: PdfDraft
  tagIds: string[]
  newLabels: string[]       // PDF 에 적혔지만 아직 없는 태그 — 저장할 때 만든다
  dupOf?: { id: string; title: string }
  savedId?: string
  error?: string
}

export default function UploadDrop({
  tags, onSaved, onTagsChanged, onEditTags, seriesOptions = [],
}: {
  tags: NoteTag[]
  onSaved: () => void
  onTagsChanged: () => void       // 새 태그를 만들었을 때 — 부모가 태그 목록을 다시 읽는다
  onEditTags?: () => void
  seriesOptions?: string[]
}) {
  const [items, setItems] = useState<Item[]>([])
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const patch = (key: string, p: Partial<Item>) =>
    setItems(prev => prev.map(i => i.key === key ? { ...i, ...p } : i))
  const patchDraft = (key: string, p: Partial<PdfDraft>) =>
    setItems(prev => prev.map(i => i.key === key && i.draft ? { ...i, draft: { ...i.draft, ...p } } : i))

  async function accept(files: FileList | File[]) {
    const list = Array.from(files)
    const fresh: Item[] = list.map(f => ({
      key: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file: f, status: 'reading', tagIds: [], newLabels: [],
    }))
    setItems(prev => [...fresh, ...prev])

    for (const it of fresh) {
      const f = it.file
      if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') {
        patch(it.key, { status: 'error', error: 'PDF 파일만 올릴 수 있어요.' }); continue
      }
      if (f.size > MAX_BYTES) {
        patch(it.key, { status: 'error', error: '50MB 보다 큰 파일은 올릴 수 없어요.' }); continue
      }
      try {
        const d = await readPdf(f)
        const lower = new Map(tags.map(t => [t.label.trim().toLowerCase(), t.id]))
        const tagIds: string[] = []
        const newLabels: string[] = []
        for (const l of d.tagLabels) {
          const id = lower.get(l.trim().toLowerCase())
          if (id) { if (!tagIds.includes(id)) tagIds.push(id) }
          else if (!newLabels.includes(l)) newLabels.push(l)
        }
        const dup = await findByHash(d.fileHash)
        patch(it.key, { draft: d, tagIds, newLabels, status: dup ? 'dup' : 'ready', dupOf: dup ?? undefined })
      } catch (e) {
        console.error(e)
        patch(it.key, { status: 'error', error: 'PDF 를 읽지 못했어요. 암호가 걸렸거나 손상된 파일일 수 있어요.' })
      }
    }
  }

  async function save(it: Item) {
    const d = it.draft
    if (!d) return
    if (!d.title.trim()) { patch(it.key, { error: '제목을 적어 주세요.' }); return }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d.madeOn)) { patch(it.key, { error: '날짜를 골라 주세요.' }); return }
    patch(it.key, { status: 'saving', error: undefined })
    try {
      const created = await ensureTags(it.newLabels)
      if (created.length) onTagsChanged()
      // 편집 중에 지워진 태그가 남아 있으면 빼고 저장
      const alive = new Set(tags.map(t => t.id))
      const ids = Array.from(new Set([...it.tagIds.filter(x => alive.has(x)), ...created]))
      const id = await saveDraft(it.file, d, ids)
      patch(it.key, { status: 'saved', savedId: id, newLabels: [] })
      onSaved()
    } catch (e) {
      const m = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : ''
      patch(it.key, {
        status: 'ready',
        error: /duplicate|unique/i.test(m) ? '이미 서가에 있는 파일이에요.' : `저장하지 못했어요. ${m}`,
      })
    }
  }

  // 새 태그는 그 자리에서 바로 만든다 → 모든 카드의 태그 줄에 곧바로 나타난다
  async function addTag(key: string, label: string) {
    try {
      const t = await createTag(label)
      onTagsChanged()
      setItems(prev => prev.map(i => i.key === key && !i.tagIds.includes(t.id)
        ? { ...i, tagIds: toggleWithRule(i.tagIds, t, [...tags, t]), error: undefined } : i))
    } catch (e) {
      const m = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : ''
      patch(key, { error: `태그를 만들지 못했어요. ${m}` })
    }
  }

  const ready = items.filter(i => i.status === 'ready')
  const busy = items.some(i => i.status === 'reading' || i.status === 'saving')

  return (
    <section className="space-y-3">
      <div
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); if (e.dataTransfer.files.length) accept(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        role="button" tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
        className={`rounded-2xl border border-dashed px-5 py-5 text-center cursor-pointer transition ${
          over ? 'border-blue-400 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500 bg-gray-900/40'
        }`}
      >
        <p className="text-sm text-gray-300">📄 PDF 노트를 여기에 끌어다 놓거나 눌러서 고르기</p>
        <p className="text-[11px] text-gray-600 mt-1">여러 개 한 번에 가능 · 제목·날짜·요지·태그는 파일에서 자동으로 읽어요</p>
        <input
          ref={inputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden"
          onChange={e => { if (e.target.files?.length) accept(e.target.files); e.target.value = '' }}
        />
      </div>

      <datalist id="notes-series-options">
        {seriesOptions.map(x => <option key={x} value={x} />)}
      </datalist>

      {items.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px] text-gray-500">
            {items.length}개 · 저장됨 {items.filter(i => i.status === 'saved').length}
          </p>
          <div className="flex gap-2">
            {ready.length > 1 && (
              <button onClick={async () => { for (const it of ready) await save(it) }} disabled={busy}
                className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg px-3 py-1.5">
                {ready.length}개 모두 저장
              </button>
            )}
            <button onClick={() => setItems(prev => prev.filter(i => i.status === 'reading' || i.status === 'saving'))}
              className="text-xs text-gray-500 hover:text-gray-300 px-2">목록 비우기</button>
          </div>
        </div>
      )}

      {items.map(it => (
        <div key={it.key} className={`rounded-2xl p-4 border ${it.status === 'saved' ? 'bg-gray-900/40 border-teal-500/20' : 'bg-gray-900 border-gray-800'}`}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-gray-500 truncate flex-1">{it.file.name}</span>
            <StatusBadge it={it} />
            {it.status !== 'saving' && (
              <button onClick={() => setItems(prev => prev.filter(x => x.key !== it.key))}
                className="text-[11px] text-gray-600 hover:text-gray-300" aria-label="목록에서 빼기">✕</button>
            )}
          </div>

          {it.status === 'error' && <p className="text-xs text-red-400">{it.error}</p>}

          {it.status === 'dup' && it.dupOf && (
            <p className="text-xs text-amber-300">
              이미 서가에 있는 파일이에요 → <Link href={`/notes/${it.dupOf.id}`} className="underline">{it.dupOf.title}</Link>
            </p>
          )}

          {it.status === 'saved' && it.savedId && it.draft && (
            <p className="text-xs text-teal-300">
              저장했어요 → <Link href={`/notes/${it.savedId}`} className="underline">{it.draft.title}</Link>
            </p>
          )}

          {(it.status === 'ready' || it.status === 'saving') && it.draft && (
            <div className="space-y-2">
              {!it.draft.fromConvention && (
                <p className="text-[10px] text-gray-500">규약 이전 PDF 라 제목·날짜만 추측했어요. 태그를 골라 주세요.</p>
              )}
              <input
                value={it.draft.title}
                onChange={e => { patchDraft(it.key, { title: e.target.value }); patch(it.key, { error: undefined }) }}
                placeholder="제목"
                className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-1.5 text-sm font-semibold outline-none"
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input type="date" value={it.draft.madeOn}
                  onChange={e => patchDraft(it.key, { madeOn: e.target.value })}
                  className="bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs outline-none" aria-label="날짜" />
                <input value={it.draft.series} onChange={e => patchDraft(it.key, { series: e.target.value })}
                  placeholder="시리즈 (선택)" list="notes-series-options"
                  className="bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs outline-none placeholder:text-gray-700" />
                <label className="flex items-center gap-1 bg-gray-950 border border-gray-800 rounded-lg px-2 py-1.5 text-xs text-gray-500">
                  v<input type="number" min={1} value={it.draft.ver}
                    onChange={e => patchDraft(it.key, { ver: Math.max(1, parseInt(e.target.value || '1', 10)) })}
                    className="w-full bg-transparent outline-none text-gray-200" aria-label="버전" />
                </label>
                <ScopeToggle value={it.draft.scope} onChange={s => patchDraft(it.key, { scope: s })} />
              </div>
              <textarea value={it.draft.summary} onChange={e => patchDraft(it.key, { summary: e.target.value })}
                rows={3} placeholder="요지 (선택)"
                className="w-full bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-1.5 text-xs outline-none resize-y placeholder:text-gray-700" />

              <TagPicker
                tags={tags}
                selected={it.tagIds}
                onToggle={t => patch(it.key, { tagIds: toggleWithRule(it.tagIds, t, tags) })}
                onAdd={l => addTag(it.key, l)}
                pendingLabels={it.newLabels}
                onRemovePending={l => patch(it.key, { newLabels: it.newLabels.filter(x => x !== l) })}
                onEditTags={onEditTags}
                disabled={it.status === 'saving'}
              />

              {it.draft.scope === 'company' && (
                <p className="text-[10px] text-amber-300/80">회사자료 노트 — PDF 파일과 본문은 올리지 않고, 제목·요지·태그 카드만 남겨요. 원본은 내 컴퓨터에 보관하세요.</p>
              )}
              {it.error && <p className="text-[11px] text-red-400">{it.error}</p>}

              <div className="flex justify-end">
                <button onClick={() => save(it)} disabled={it.status === 'saving'}
                  className="text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg px-4 py-1.5">
                  {it.status === 'saving' ? '저장 중…' : '저장'}
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  )
}

function StatusBadge({ it }: { it: Item }) {
  const map: Record<Status, [string, string]> = {
    reading: ['읽는 중…', 'text-gray-400'],
    ready: [it.draft ? `${it.draft.pages}쪽` : '', 'text-gray-500'],
    dup: ['중복', 'text-amber-300'],
    saving: ['저장 중…', 'text-blue-300'],
    saved: ['저장됨', 'text-teal-300'],
    error: ['실패', 'text-red-400'],
  }
  const [t, c] = map[it.status]
  return t ? <span className={`text-[10px] shrink-0 ${c}`}>{t}</span> : null
}

export function ScopeToggle({ value, onChange }: { value: 'personal' | 'company'; onChange: (v: 'personal' | 'company') => void }) {
  return (
    <div className="flex rounded-lg border border-gray-800 overflow-hidden text-[11px]">
      {(['personal', 'company'] as const).map(s => (
        <button key={s} type="button" onClick={() => onChange(s)}
          className={`flex-1 px-2 py-1.5 transition ${value === s
            ? (s === 'company' ? 'bg-amber-500/15 text-amber-300' : 'bg-gray-800 text-gray-100')
            : 'text-gray-600 hover:text-gray-400'}`}>
          {s === 'personal' ? '개인' : '🔒 회사자료'}
        </button>
      ))}
    </div>
  )
}
