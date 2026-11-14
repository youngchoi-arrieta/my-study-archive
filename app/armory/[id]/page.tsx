'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { FAMILIES, SLOT_META, SLOTS, STATUS_META, STATUS_ORDER, type Slot, type UnitStatus } from '@/lib/constants-armory'
import {
  ARMORY_EVENT, clearSlot, deleteRevision, deleteUnit, fetchUnit, fetchUnits, filePath, fileName, fmtSize,
  putSlot, signedArmoryUrl, signedDownloadUrl, unitLabel, updateRevision, updateUnit,
  type Revision, type Unit,
} from '@/lib/armory'
import { FamilyChip, StageChip, StatusBadge } from '../_components/bits'
import DigestPanel from '../_components/DigestPanel'
import IntakeModal from '../_components/IntakeModal'
import LabFrame from '../_components/LabFrame'
import NoteLinker from '../_components/NoteLinker'
import ZipTree from '../_components/ZipTree'

// ───────────────────────────────────────────────────────────────
//  기체 한 벌 — /armory/[id]
//    제원(임무·출발 프로젝트·표준·참조·계승·코어) · 리비전 목록
//    리비전: ▶ 실행 · 📦 소스 · 📐 제1원리 노트 · 🍽 소화·출고
// ───────────────────────────────────────────────────────────────

type View = 'run' | 'src' | 'note' | 'digest'
const VIEWS: { key: View; label: string }[] = [
  { key: 'run', label: '▶ 실행' },
  { key: 'src', label: '📦 소스' },
  { key: 'note', label: '📐 제1원리 노트' },
  { key: 'digest', label: '🍽 소화 · 출고' },
]

const errMsg = (e: unknown) => String((e as { message?: string })?.message ?? e)

// ── 제원 ────────────────────────────────────────────────────────
function SpecEditor({ unit, all, onDone }: { unit: Unit; all: Unit[]; onDone: () => void }) {
  const [f, setF] = useState({
    code: unit.code ?? '', name: unit.name, family: unit.family ?? '', status: unit.status,
    summary: unit.summary ?? '', origin_project: unit.origin_project ?? '', standards: unit.standards ?? '',
    refs: unit.refs ?? '', parent_id: unit.parent_id ?? '', on_core: unit.on_core, sort_order: unit.sort_order,
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const inp = 'mt-1 w-full bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm text-white'
  const save = async () => {
    setBusy(true); setErr('')
    try { await updateUnit(unit.id, { ...f, parent_id: f.parent_id || null, sort_order: Number(f.sort_order) || 0 }); onDone() }
    catch (e) { setErr(errMsg(e)) } finally { setBusy(false) }
  }
  return (
    <div className="bg-gray-900 rounded-2xl p-4 border border-blue-500/30 grid grid-cols-2 md:grid-cols-4 gap-2">
      <label className="text-[11px] text-gray-500">번호<input className={inp} value={f.code} onChange={e => setF({ ...f, code: e.target.value })} placeholder="Mk10" /></label>
      <label className="text-[11px] text-gray-500 col-span-1 md:col-span-2">이름<input className={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></label>
      <label className="text-[11px] text-gray-500">순서<input type="number" className={inp} value={f.sort_order} onChange={e => setF({ ...f, sort_order: Number(e.target.value) })} /></label>
      <label className="text-[11px] text-gray-500">계열
        <input className={inp} list="arm-fam2" value={f.family} onChange={e => setF({ ...f, family: e.target.value })} />
        <datalist id="arm-fam2">{FAMILIES.map(x => <option key={x.label} value={x.label} />)}</datalist>
      </label>
      <label className="text-[11px] text-gray-500">상태
        <select className={inp} value={f.status} onChange={e => setF({ ...f, status: e.target.value as UnitStatus })}>
          {STATUS_ORDER.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </label>
      <label className="text-[11px] text-gray-500">계승한 마크
        <select className={inp} value={f.parent_id} onChange={e => setF({ ...f, parent_id: e.target.value })}>
          <option value="">— 없음</option>
          {all.filter(u => u.id !== unit.id).map(u => <option key={u.id} value={u.id}>{unitLabel(u)}</option>)}
        </select>
      </label>
      <label className="text-[11px] text-gray-500 flex items-end gap-2 pb-2">
        <input type="checkbox" checked={f.on_core} onChange={e => setF({ ...f, on_core: e.target.checked })} className="accent-amber-400 w-4 h-4" />
        공통 코어 장착
      </label>
      <label className="text-[11px] text-gray-500 col-span-2 md:col-span-4">임무 (한 줄)<input className={inp} value={f.summary} onChange={e => setF({ ...f, summary: e.target.value })} /></label>
      <label className="text-[11px] text-gray-500 col-span-2">출발 프로젝트<input className={inp} value={f.origin_project} onChange={e => setF({ ...f, origin_project: e.target.value })} /></label>
      <label className="text-[11px] text-gray-500 col-span-2">대응 표준<input className={inp} value={f.standards} onChange={e => setF({ ...f, standards: e.target.value })} /></label>
      <label className="text-[11px] text-gray-500 col-span-2 md:col-span-4">참조문헌
        <textarea rows={3} className={inp} value={f.refs} onChange={e => setF({ ...f, refs: e.target.value })} placeholder="한 줄에 하나" />
      </label>
      {err && <p className="col-span-full text-xs text-red-400">{err}</p>}
      <div className="col-span-full flex justify-end gap-2">
        <button onClick={onDone} className="text-xs text-gray-400 hover:text-white px-3 py-1.5">취소</button>
        <button onClick={save} disabled={busy || !f.name.trim()} className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg px-3 py-1.5 font-semibold">저장</button>
      </div>
    </div>
  )
}

// ── 세 칸 (올리기 · 바꿔 끼우기 · 내려받기 · 빼기) ──────────────────────
function SlotStrip({ rev }: { rev: Revision }) {
  const refs = useRef<Record<Slot, HTMLInputElement | null>>({ html: null, zip: null, note: null })
  const [busy, setBusy] = useState<Slot | null>(null)
  const [err, setErr] = useState('')
  const company = rev.keep === 'company'

  const put = async (s: Slot, f: File) => {
    if (!SLOT_META[s].ext.test(f.name)) { setErr(`${SLOT_META[s].label} 칸에는 ${SLOT_META[s].accept.split(',')[0]} 파일만.`); return }
    setBusy(s); setErr('')
    try { await putSlot(rev, s, f) } catch (e) { setErr(errMsg(e)) } finally { setBusy(null) }
  }
  const download = async (s: Slot) => {
    const p = filePath(rev, s); if (!p) return
    const u = await signedDownloadUrl(p, fileName(rev, s) ?? p.split('/').pop()!)
    if (u) window.location.href = u; else setErr('내려받기 주소를 만들지 못했어요.')
  }
  const clear = async (s: Slot) => {
    if (!confirm(`${SLOT_META[s].label} 파일을 이 리비전에서 뺄까요?`)) return
    setBusy(s); setErr('')
    try { await clearSlot(rev, s) } catch (e) { setErr(errMsg(e)) } finally { setBusy(null) }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {SLOTS.map(s => {
          const has = !!filePath(rev, s)
          const size = s === 'html' ? rev.html_size : s === 'zip' ? rev.zip_size : null
          return (
            <div key={s}
              onDragOver={e => { if (!company) e.preventDefault() }}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f && !company) put(s, f) }}
              className={`rounded-xl p-3 border ${has ? 'border-blue-500/30 bg-blue-500/5' : 'border-dashed border-gray-700 bg-gray-950'}`}>
              <input ref={el => { refs.current[s] = el }} type="file" hidden accept={SLOT_META[s].accept}
                onChange={e => { const f = e.target.files?.[0]; if (f) put(s, f); e.target.value = '' }} />
              <p className="text-xs text-gray-300">{SLOT_META[s].icon} {SLOT_META[s].label}</p>
              {company ? <p className="text-[11px] text-gray-600 mt-1">🏢 회사 PC 에 보관</p>
                : has ? (
                  <>
                    <p className="text-[11px] text-blue-200 truncate mt-1" title={fileName(rev, s) ?? ''}>{fileName(rev, s)}</p>
                    <p className="text-[10px] text-gray-500">
                      {s === 'note' && rev.note_pages ? `${rev.note_pages}쪽` : fmtSize(size)}
                      {s === 'zip' && rev.zip_listing ? ` · 파일 ${rev.zip_listing.length}개` : ''}
                    </p>
                    <div className="flex gap-2 mt-1.5 text-[11px]">
                      <button onClick={() => download(s)} className="text-gray-400 hover:text-white">⬇ 받기</button>
                      <button onClick={() => refs.current[s]?.click()} disabled={busy === s} className="text-gray-400 hover:text-white">↻ 바꾸기</button>
                      <button onClick={() => clear(s)} disabled={busy === s} className="text-gray-600 hover:text-red-400 ml-auto">빼기</button>
                    </div>
                  </>
                ) : (
                  <button onClick={() => refs.current[s]?.click()} disabled={busy === s}
                    className="text-[11px] text-gray-500 hover:text-gray-200 mt-1">
                    {busy === s ? '올리는 중…' : '＋ 올리기 (끌어다 놓아도 됨)'}
                  </button>
                )}
            </div>
          )
        })}
      </div>
      {err && <p className="text-xs text-red-400 mt-1">{err}</p>}
    </div>
  )
}

function NoteView({ path }: { path: string }) {
  const [s, setS] = useState<{ path: string; url: string | null } | null>(null)
  useEffect(() => {
    let alive = true
    signedArmoryUrl(path).then(u => { if (alive) setS({ path, url: u }) })
    return () => { alive = false }
  }, [path])
  const cur = s && s.path === path ? s : null
  if (!cur) return <p className="text-xs text-gray-500 py-10 text-center">펼치는 중…</p>
  if (!cur.url) return <p className="text-xs text-red-400 py-10 text-center">노트를 열지 못했어요.</p>
  return (
    <div className="space-y-1.5">
      <iframe title="제1원리 노트" src={`${cur.url}#view=FitH`} className="w-full h-[78vh] rounded-xl border border-gray-800 bg-white" />
      <div className="flex justify-end"><a href={cur.url} target="_blank" rel="noreferrer" className="text-[11px] text-gray-500 hover:text-gray-300">새 탭 ↗</a></div>
    </div>
  )
}

// ── 리비전 한 장 ────────────────────────────────────────────────
function RevisionPanel({ unit, rev, onDeleted }: { unit: Unit; rev: Revision; onDeleted: () => void }) {
  const [view, setView] = useState<View>(rev.html_path ? 'run' : 'digest')
  const [editLog, setEditLog] = useState(false)
  const [log, setLog] = useState(rev.changelog ?? '')
  const [err, setErr] = useState('')

  const empty = (what: string) => (
    <p className="text-xs text-gray-500 py-10 text-center bg-gray-950 rounded-xl border border-dashed border-gray-800">
      {rev.keep === 'company' ? '🏢 회사 보관 — 파일은 회사 PC 에 있어요.' : `${what} 이(가) 아직 없어요. 위 칸에 올려 주세요.`}
    </p>
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-xl font-bold">{rev.ver}</h2>
        <span className="text-xs text-gray-500 tabular-nums">{rev.made_on}</span>
        <StageChip rev={rev} />
        {rev.keep === 'home'
          ? <span className="text-[10px] text-gray-500">🏠 집 원본</span>
          : <span className="text-[10px] text-amber-300">🏢 회사 보관</span>}
        <button onClick={() => {
          if (!confirm(`${unitLabel(unit)} ${rev.ver} 리비전을 지울까요?\n올린 파일과 출고 기록도 같이 지워져요.`)) return
          deleteRevision(rev).then(onDeleted).catch(e => setErr(errMsg(e)))
        }} className="ml-auto text-[11px] text-gray-600 hover:text-red-400">🗑 리비전 삭제</button>
      </div>

      {editLog ? (
        <div className="flex gap-2">
          <textarea value={log} onChange={e => setLog(e.target.value)} rows={2}
            className="flex-1 bg-gray-950 border border-gray-800 rounded-lg px-2.5 py-1.5 text-sm" />
          <button onClick={() => updateRevision(rev.id, { changelog: log.trim() || null }).then(() => setEditLog(false)).catch(e => setErr(errMsg(e)))}
            className="text-xs bg-blue-600 rounded-lg px-3">저장</button>
        </div>
      ) : (
        <button onClick={() => setEditLog(true)} className="block text-left text-sm text-gray-400 hover:text-gray-200 whitespace-pre-line">
          {rev.changelog || <span className="text-gray-600 text-xs">✎ 바뀐 점 적기</span>}
        </button>
      )}

      <SlotStrip rev={rev} />

      <div className="flex gap-1.5 flex-wrap">
        {VIEWS.map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`text-xs px-3 py-1.5 rounded-lg ${view === v.key ? 'bg-gray-100 text-gray-900 font-semibold' : 'bg-gray-900 text-gray-400 hover:text-gray-200'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {view === 'run' && (rev.html_path ? <LabFrame path={rev.html_path} title={`${unitLabel(unit)} ${rev.ver}`} /> : empty('실행 HTML'))}
      {view === 'src' && (rev.zip_path
        ? (rev.zip_listing?.length ? <ZipTree names={rev.zip_listing} /> : <p className="text-xs text-gray-500">zip 목차를 읽지 못했어요. ⬇ 받기로 열어 보세요.</p>)
        : empty('소스 zip'))}
      {view === 'note' && (rev.note_path ? <NoteView path={rev.note_path} /> : empty('제1원리 노트'))}
      {view === 'digest' && <DigestPanel rev={rev} />}
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  )
}

// ── 페이지 ──────────────────────────────────────────────────────
function UnitInner() {
  const { id } = useParams<{ id: string }>()
  const sp = useSearchParams()
  const router = useRouter()
  const [unit, setUnit] = useState<Unit | null>(null)
  const [all, setAll] = useState<Unit[]>([])
  const [state, setState] = useState<'loading' | 'ok' | 'missing' | 'error'>('loading')
  const [err, setErr] = useState('')
  const [edit, setEdit] = useState(false)
  const [intake, setIntake] = useState(false)

  const load = useCallback(() => {
    Promise.all([fetchUnit(id), fetchUnits()])
      .then(([u, a]) => { setAll(a); if (!u) setState('missing'); else { setUnit(u); setState('ok') } })
      .catch(e => { setErr(errMsg(e)); setState('error') })
  }, [id])
  useEffect(() => {
    load()
    window.addEventListener(ARMORY_EVENT, load)
    return () => window.removeEventListener(ARMORY_EVENT, load)
  }, [load])

  const revId = sp.get('rev')
  const rev = unit ? (unit.revisions.find(r => r.id === revId) ?? unit.revisions[0] ?? null) : null
  const pickRev = (rid: string) => router.replace(`/armory/${id}?rev=${rid}`, { scroll: false })

  if (state === 'loading') return <main className="min-h-screen bg-gray-950 text-gray-500 p-8 text-sm">격납고에서 꺼내는 중…</main>
  if (state === 'missing') return <main className="min-h-screen bg-gray-950 text-gray-400 p-8 text-sm">없는 기체예요. <Link href="/armory" className="text-blue-300">← 병기고</Link></main>
  if (state === 'error' || !unit) return <main className="min-h-screen bg-gray-950 text-red-300 p-8 text-sm">불러오지 못했어요: {err}</main>

  const parent = all.find(u => u.id === unit.parent_id)
  const children = all.filter(u => u.parent_id === unit.id)

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-5">
        <Link href="/armory" className="text-xs text-gray-500 hover:text-gray-300">← 병기고</Link>

        {/* 머리 */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1"><FamilyChip family={unit.family} /><StatusBadge status={unit.status} />
              {unit.on_core && <span className="text-[10px] text-amber-300">⚙ 코어 장착</span>}</div>
            <h1 className="text-3xl font-bold leading-tight">
              {unit.code && <span className="text-gray-400 mr-2">{unit.code}</span>}{unit.name}
            </h1>
            {unit.summary && <p className="text-sm text-gray-400 mt-1">{unit.summary}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIntake(true)} className="text-sm bg-blue-600 hover:bg-blue-500 rounded-xl px-3.5 py-2 font-semibold">📥 새 리비전 입고</button>
            <button onClick={() => setEdit(v => !v)} className="text-sm bg-gray-800 hover:bg-gray-700 rounded-xl px-3 py-2">✎ 제원</button>
          </div>
        </div>

        {edit ? <SpecEditor unit={unit} all={all} onDone={() => setEdit(false)} /> : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
            {[
              ['출발 프로젝트', unit.origin_project],
              ['대응 표준', unit.standards],
              ['계승', parent ? unitLabel(parent) : null, parent ? `/armory/${parent.id}` : null],
              ['이어받은 기체', children.map(unitLabel).join(', ') || null],
            ].map(([k, v, href]) => (
              <div key={k as string} className="bg-gray-900 rounded-xl px-3 py-2 border border-gray-800">
                <p className="text-[10px] text-gray-500">{k}</p>
                {href ? <Link href={href} className="text-blue-300 hover:text-blue-200">{v}</Link>
                  : <p className={v ? 'text-gray-200' : 'text-gray-600'}>{v || '—'}</p>}
              </div>
            ))}
            {unit.refs && (
              <div className="md:col-span-4 bg-gray-900 rounded-xl px-3 py-2 border border-gray-800">
                <p className="text-[10px] text-gray-500">참조문헌</p>
                <p className="text-gray-300 whitespace-pre-line">{unit.refs}</p>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
          <div className="lg:col-span-3 min-w-0">
            {rev ? <RevisionPanel key={rev.id} unit={unit} rev={rev} onDeleted={() => router.replace(`/armory/${id}`)} />
              : (
                <div className="bg-gray-900 rounded-2xl p-8 text-center border border-dashed border-gray-700">
                  <p className="text-sm text-gray-400 mb-3">아직 리비전이 없어요.</p>
                  <button onClick={() => setIntake(true)} className="text-sm bg-blue-600 hover:bg-blue-500 rounded-xl px-4 py-2 font-semibold">📥 첫 리비전 입고</button>
                </div>
              )}
          </div>
          <aside className="space-y-4">
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <p className="text-sm font-bold mb-2">🗂 리비전</p>
              {unit.revisions.length === 0 ? <p className="text-[11px] text-gray-600">없음</p> : (
                <ul className="space-y-1">
                  {unit.revisions.map(r => (
                    <li key={r.id}>
                      <button onClick={() => pickRev(r.id)}
                        className={`w-full text-left rounded-lg px-2.5 py-1.5 transition ${r.id === rev?.id ? 'bg-gray-800' : 'hover:bg-gray-800/60'}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{r.ver}</span>
                          <span className="ml-auto"><StageChip rev={r} /></span>
                        </div>
                        <p className="text-[10px] text-gray-500 tabular-nums">{r.made_on}{r.keep === 'company' ? ' · 🏢' : ''}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <NoteLinker unitId={unit.id} noteIds={unit.noteIds} />
            <button onClick={() => {
              if (!confirm(`'${unitLabel(unit)}' 기체를 통째로 지울까요?\n리비전 ${unit.revisions.length}개와 올린 파일, 출고 기록이 모두 지워져요.`)) return
              deleteUnit(unit).then(() => router.push('/armory')).catch(e => setErr(errMsg(e)))
            }} className="text-[11px] text-gray-600 hover:text-red-400">🗑 기체 삭제</button>
            {err && <p className="text-xs text-red-400">{err}</p>}
          </aside>
        </div>
      </div>

      {intake && (
        <IntakeModal units={all} presetUnitId={unit.id} onClose={() => setIntake(false)}
          onSaved={() => { setIntake(false); router.replace(`/armory/${id}`, { scroll: false }); load() }} />
      )}
    </main>
  )
}

export default function UnitPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-950" />}>
      <UnitInner />
    </Suspense>
  )
}
