'use client'

import { useEffect, useRef, useState } from 'react'
import { FAMILIES, SLOT_META, SLOTS, type Slot } from '@/lib/constants-armory'
import {
  createRevision, createUnit, fmtSize, guessVersion, htmlTitle, sortFiles, today, unitLabel,
  type Keep, type Unit,
} from '@/lib/armory'

// 한번에 입고 — HTML · zip · 제1원리 노트 PDF 를 한 번에 끌어다 놓는다
// -------------------------------------------------------------------
//   파일 떨구기 → 확장자로 세 칸 자동 분류 → 파일명에서 버전 추측
//   → 기체 고르기 (없으면 새 기체, HTML <title> 로 이름 미리 채움)
//   → 보관처: 🏠 집 원본(파일 올림) / 🏢 회사 보관(카드만)
//   → 입고

export default function IntakeModal({
  units, presetUnitId, onClose, onSaved,
}: {
  units: Unit[]
  presetUnitId?: string
  onClose: () => void
  onSaved: (unitId: string) => void
}) {
  const [files, setFiles] = useState<Partial<Record<Slot, File>>>({})
  const [rejected, setRejected] = useState<{ name: string; why: string }[]>([])
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<'existing' | 'new'>(presetUnitId || units.length ? 'existing' : 'new')
  const [unitId, setUnitId] = useState(presetUnitId ?? units[0]?.id ?? '')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [family, setFamily] = useState('')
  const [ver, setVer] = useState('')
  const [madeOn, setMadeOn] = useState(today())
  const [changelog, setChangelog] = useState('')
  const [keep, setKeep] = useState<Keep>('home')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, onClose])

  async function accept(list: FileList | File[]) {
    const s = sortFiles(Array.from(list))
    setRejected(s.rejected.map(r => ({ name: r.file.name, why: r.why })))
    const next = { ...files }
    for (const k of SLOTS) if (s[k]) next[k] = s[k]
    setFiles(next)
    if (!ver) {
      const g = SLOTS.map(k => next[k]).map(f => f && guessVersion(f.name)).find(Boolean)
      if (g) setVer(g)
    }
    if (s.html && !name) {
      try { const t = htmlTitle(await s.html.slice(0, 64 * 1024).text()); if (t) setName(t) } catch { /* 이름은 손으로 */ }
    }
  }

  const count = SLOTS.filter(k => files[k]).length
  const canSave = !busy && ver.trim() && (mode === 'existing' ? !!unitId : !!name.trim())
    && (keep === 'company' || count > 0)

  async function save() {
    setBusy(true); setErr('')
    try {
      let uid = unitId
      if (mode === 'new') { setStep('기체 등록 중…'); uid = await createUnit({ code, name, family }) }
      await createRevision({ unitId: uid, ver, madeOn, changelog, keep, files }, setStep)
      onSaved(uid)
    } catch (e) {
      setErr(String((e as { message?: string })?.message ?? e))
    } finally { setBusy(false); setStep('') }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 overflow-y-auto"
      role="dialog" aria-modal="true" aria-label="한번에 입고">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl p-5 space-y-4 my-6">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold flex-1">📥 한번에 입고</h2>
          <button onClick={onClose} disabled={busy} className="text-gray-400 hover:text-white px-2">✕</button>
        </div>

        {/* 1. 파일 세 칸 */}
        <div
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); accept(e.dataTransfer.files) }}
          onClick={() => inputRef.current?.click()}
          className={`rounded-xl border-2 border-dashed p-4 cursor-pointer transition ${over ? 'border-blue-400 bg-blue-500/10' : 'border-gray-700 hover:border-gray-500'}`}>
          <input ref={inputRef} type="file" multiple hidden accept=".html,.htm,.zip,.pdf"
            onChange={e => { if (e.target.files) accept(e.target.files); e.target.value = '' }} />
          <p className="text-sm text-gray-300 text-center mb-3">HTML · zip · PDF 를 한꺼번에 끌어다 놓기 <span className="text-gray-500">(또는 눌러서 고르기)</span></p>
          <div className="grid grid-cols-3 gap-2">
            {SLOTS.map(k => {
              const f = files[k]
              return (
                <div key={k} className={`rounded-lg p-2.5 text-center border ${f ? 'border-blue-500/40 bg-blue-500/10' : 'border-gray-800 bg-gray-950'}`}>
                  <div className="text-xl">{SLOT_META[k].icon}</div>
                  <div className="text-[11px] text-gray-400">{SLOT_META[k].label}</div>
                  {f ? (
                    <div className="mt-1">
                      <p className="text-[11px] text-blue-200 truncate" title={f.name}>{f.name}</p>
                      <p className="text-[10px] text-gray-500">{fmtSize(f.size)}
                        <button onClick={e => { e.stopPropagation(); setFiles(p => ({ ...p, [k]: undefined })) }}
                          className="ml-2 text-gray-500 hover:text-red-400">빼기</button></p>
                    </div>
                  ) : <p className="text-[10px] text-gray-600 mt-1">비어 있음</p>}
                </div>
              )
            })}
          </div>
        </div>
        {rejected.length > 0 && (
          <ul className="text-[11px] text-amber-300 space-y-0.5">
            {rejected.map(r => <li key={r.name}>⚠ {r.name} — {r.why}</li>)}
          </ul>
        )}

        {/* 2. 어느 기체에 */}
        <div className="space-y-2">
          <div className="flex gap-1.5 text-xs">
            <button onClick={() => setMode('existing')} disabled={!units.length}
              className={`px-3 py-1.5 rounded-lg ${mode === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'} disabled:opacity-40`}>기존 기체에 새 리비전</button>
            <button onClick={() => setMode('new')}
              className={`px-3 py-1.5 rounded-lg ${mode === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400'}`}>새 기체 등록</button>
          </div>
          {mode === 'existing' ? (
            <select value={unitId} onChange={e => setUnitId(e.target.value)}
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm">
              {units.map(u => <option key={u.id} value={u.id}>{unitLabel(u)}{u.revisions[0] ? `  (최근 ${u.revisions[0].ver})` : ''}</option>)}
            </select>
          ) : (
            <div className="grid grid-cols-[90px_1fr] gap-2">
              <input value={code} onChange={e => setCode(e.target.value)} placeholder="Mk10"
                className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm" />
              <input value={name} onChange={e => setName(e.target.value)} placeholder="기체 이름 (HTML 제목으로 미리 채워짐)"
                className="bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm" />
              <input value={family} onChange={e => setFamily(e.target.value)} list="arm-families" placeholder="계열"
                className="col-span-2 bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm" />
              <datalist id="arm-families">{FAMILIES.map(f => <option key={f.label} value={f.label} />)}</datalist>
            </div>
          )}
        </div>

        {/* 3. 리비전 */}
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] text-gray-500">버전
            <input value={ver} onChange={e => setVer(e.target.value)} placeholder="v8.4 (파일명에서 추측)"
              className="mt-1 w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white" />
          </label>
          <label className="text-[11px] text-gray-500">만든 날
            <input type="date" value={madeOn} onChange={e => setMadeOn(e.target.value)}
              className="mt-1 w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white" />
          </label>
          <label className="col-span-2 text-[11px] text-gray-500">바뀐 점
            <textarea value={changelog} onChange={e => setChangelog(e.target.value)} rows={2}
              placeholder="예) 끊김 시나리오에 expiresAt 만료 처리 추가"
              className="mt-1 w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white" />
          </label>
        </div>

        {/* 4. 보관처 */}
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setKeep('home')}
            className={`text-left rounded-xl p-3 border ${keep === 'home' ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-gray-950'}`}>
            <p className="text-sm font-semibold">🏠 집 원본</p>
            <p className="text-[11px] text-gray-500 leading-snug">공개 자료·예시값으로 만든 내 것. 파일을 비공개 격납고에 올림 → 소화 후 출고</p>
          </button>
          <button onClick={() => setKeep('company')}
            className={`text-left rounded-xl p-3 border ${keep === 'company' ? 'border-amber-500 bg-amber-500/10' : 'border-gray-800 bg-gray-950'}`}>
            <p className="text-sm font-semibold">🏢 회사 보관</p>
            <p className="text-[11px] text-gray-500 leading-snug">사내 규격·고객 자료가 들어간 것. 파일은 회사 PC 에만, 여기엔 카드만</p>
          </button>
        </div>
        {keep === 'company' && count > 0 && (
          <p className="text-[11px] text-amber-300">🏢 회사 보관으로 고르면 고른 파일은 올라가지 않아요. 이름·버전·바뀐 점만 남습니다.</p>
        )}

        {err && <p className="text-xs text-red-400">{err}</p>}
        <div className="flex items-center gap-3 justify-end">
          {step && <span className="text-[11px] text-gray-400">{step}</span>}
          <button onClick={onClose} disabled={busy} className="text-sm text-gray-400 hover:text-white px-3 py-2">취소</button>
          <button onClick={save} disabled={!canSave}
            className="text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg px-4 py-2 font-semibold">
            {busy ? '입고 중…' : '입고'}
          </button>
        </div>
      </div>
    </div>
  )
}
