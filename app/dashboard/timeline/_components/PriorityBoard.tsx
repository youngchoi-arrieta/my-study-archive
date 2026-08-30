'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  PrPath, PrItem, PrReview, PathStatus,
  PATH_STATUS_ORDER, PATH_STATUS_META,
  Layer, LAYER_META, SHARED_MIN,
  liveCount, layerOf, lockOf, LockState,
  dday, ddayLabel, todayStr, collectFlags,
  SEED_PATHS, SEED_ITEMS,
} from '@/lib/constants-priority'

// ───────────────────────────────────────────────────────────────
//  3층 우선순위 보드
//  간트가 "언제"를 그린다면 이 화면은 "무엇을 놓을까"를 그린다.
//  층을 손으로 옮기는 기능은 일부러 넣지 않았다.
//  옮길 수 있게 만들면 결국 마인드맵으로 돌아간다.
//
//  레이아웃 원칙 — 한 화면에 다 들어와야 한다.
//    스크롤을 내려야 보이는 층은 없는 층과 같다.
//    위 띠   점검 · 경로 · 축적    (판단의 배경)
//    0층 띠  경계조건              (한 줄 칩. 배경이니 자리도 배경만큼)
//    본문    1층 · 2층 · 3층       (가로 3열. 이게 실제 판단 대상)
// ───────────────────────────────────────────────────────────────

interface Link { item_id: string; path_id: string }

const emptyDraft = () => ({
  title: '', note: '', fixed: false, daily: false,
  expires_on: '', decide_by: '', paths: [] as string[],
})
type Draft = ReturnType<typeof emptyDraft>

export default function PriorityBoard() {
  const [paths, setPaths] = useState<PrPath[]>([])
  const [items, setItems] = useState<PrItem[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [reviews, setReviews] = useState<PrReview[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [pathEdit, setPathEdit] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [busy, setBusy] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [p, i, l, r] = await Promise.all([
      supabase.from('pr_paths').select('*').order('sort_order'),
      supabase.from('pr_items').select('*').order('sort_order'),
      supabase.from('pr_item_paths').select('item_id, path_id'),
      supabase.from('pr_reviews').select('*').order('reviewed_on', { ascending: false }).limit(6),
    ])
    setErr(p.error ? p.error.message : null)
    setPaths((p.data as PrPath[]) || [])
    setItems((i.data as PrItem[]) || [])
    setLinks((l.data as Link[]) || [])
    setReviews((r.data as PrReview[]) || [])
    setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const visible = useMemo(
    () => items.filter(it => showDone || !it.done),
    [items, showDone],
  )

  const grouped = useMemo(() => {
    const g: Record<Layer, PrItem[]> = {
      fixed: [], expiring: [], shared: [], single: [], orphan: [], daily: [],
    }
    for (const it of visible) {
      g[layerOf(it, liveCount(it.id, links, paths))].push(it)
    }
    // 1층은 결정시점 순. 비어 있는 것이 위로 올라오게 둔다.
    g.expiring.sort((a, b) => {
      const av = a.decide_by ?? '', bv = b.decide_by ?? ''
      if (!av && bv) return -1
      if (av && !bv) return 1
      return av.localeCompare(bv)
    })
    // 2층은 걸침 수가 많은 순
    g.shared.sort((a, b) =>
      liveCount(b.id, links, paths) - liveCount(a.id, links, paths))
    // 3층은 열린 것 먼저. 잠긴 것과 매몰된 것은 아래로.
    const lockRank = { open: 0, locked: 1, sunk: 2 }
    g.single.sort((a, b) =>
      lockRank[lockOf(a.id, links, paths)] - lockRank[lockOf(b.id, links, paths)])
    return g
  }, [visible, links, paths])

  const flags = useMemo(
    () => collectFlags(items, links, paths, reviews[0]?.reviewed_on ?? null),
    [items, links, paths, reviews],
  )

  const pathOf = (id: string) => paths.find(p => p.id === id)
  const pathsOf = (itemId: string) =>
    links.filter(l => l.item_id === itemId)
      .map(l => pathOf(l.path_id))
      .filter((p): p is PrPath => !!p)

  // ── 쓰기 ──────────────────────────────────────────────────────
  const cyclePathStatus = async (p: PrPath) => {
    const next = PATH_STATUS_ORDER[
      (PATH_STATUS_ORDER.indexOf(p.status) + 1) % PATH_STATUS_ORDER.length
    ] as PathStatus
    setPaths(prev => prev.map(x => x.id === p.id ? { ...x, status: next } : x))
    await supabase.from('pr_paths')
      .update({ status: next, updated_at: new Date().toISOString() }).eq('id', p.id)
  }

  const openAdd = () => { setDraft(emptyDraft()); setEditingId(null); setFormOpen(true) }
  const openEdit = (it: PrItem) => {
    setDraft({
      title: it.title, note: it.note ?? '',
      fixed: it.fixed, daily: it.daily,
      expires_on: it.expires_on ?? '', decide_by: it.decide_by ?? '',
      paths: links.filter(l => l.item_id === it.id).map(l => l.path_id),
    })
    setEditingId(it.id); setFormOpen(true)
  }
  const close = () => { setFormOpen(false); setEditingId(null); setDraft(emptyDraft()) }

  const save = async () => {
    if (!draft.title.trim() || busy) return
    setBusy(true)
    const payload = {
      title: draft.title.trim(),
      note: draft.note.trim() || null,
      fixed: draft.fixed, daily: draft.daily,
      expires_on: draft.expires_on || null,
      decide_by: draft.decide_by || null,
      updated_at: new Date().toISOString(),
    }
    let id = editingId
    if (id) {
      const { error } = await supabase.from('pr_items').update(payload).eq('id', id)
      if (error) { setBusy(false); alert(`저장하지 못했습니다.\n${error.message}`); return }
      await supabase.from('pr_item_paths').delete().eq('item_id', id)
    } else {
      const { data, error } = await supabase.from('pr_items')
        .insert({ ...payload, sort_order: items.length + 1 }).select('id').single()
      if (error || !data) { setBusy(false); alert(`저장하지 못했습니다.\n${error?.message}`); return }
      id = (data as { id: string }).id
    }
    if (draft.paths.length) {
      await supabase.from('pr_item_paths')
        .insert(draft.paths.map(p => ({ item_id: id, path_id: p })))
    }
    setBusy(false); close(); fetchAll()
  }

  const toggleDone = async (it: PrItem) => {
    setItems(prev => prev.map(x => x.id === it.id ? { ...x, done: !x.done } : x))
    await supabase.from('pr_items').update({ done: !it.done }).eq('id', it.id)
  }

  const remove = async (it: PrItem) => {
    if (!confirm(`"${it.title}" 항목을 지울까요?`)) return
    await supabase.from('pr_items').delete().eq('id', it.id)
    if (editingId === it.id) close()
    fetchAll()
  }

  const stampReview = async () => {
    if (busy) return
    setBusy(true)
    await supabase.from('pr_reviews').insert({ reviewed_on: todayStr() })
    setBusy(false); fetchAll()
  }

  const seed = async () => {
    if (busy) return
    if (!confirm('시범 데이터를 넣습니다. 프레임이 안 맞으면 항목을 지우면 됩니다.')) return
    setBusy(true)
    await supabase.from('pr_paths').upsert(
      SEED_PATHS.map(p => ({ ...p, note: null })), { onConflict: 'id' })
    for (let n = 0; n < SEED_ITEMS.length; n++) {
      const s = SEED_ITEMS[n]
      const { data } = await supabase.from('pr_items').insert({
        title: s.title, note: s.note ?? null,
        fixed: !!s.fixed, daily: !!s.daily,
        expires_on: s.expires_on ?? null, decide_by: s.decide_by ?? null,
        sort_order: n + 1,
      }).select('id').single()
      const id = (data as { id: string } | null)?.id
      if (id && s.paths.length) {
        await supabase.from('pr_item_paths')
          .insert(s.paths.map(p => ({ item_id: id, path_id: p })))
      }
    }
    setBusy(false); fetchAll()
  }

  const inputCls = 'bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition w-full'

  if (loading) return <p className="text-gray-500 text-sm">불러오는 중...</p>

  if (err) return (
    <div className="bg-gray-900 rounded-2xl p-5">
      <p className="text-sm text-red-400 mb-2">보드를 불러오지 못했습니다.</p>
      <p className="text-xs text-gray-500 mb-3">{err}</p>
      <p className="text-[11px] text-gray-600">
        supabase/priority_migration.sql 을 한 번 실행하면 됩니다.
      </p>
    </div>
  )

  return (
    <>
      {/* ── 위 띠: 점검 · 경로 · 축적 ──────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-2">

        <ReviewPanel flags={flags} last={reviews[0] ?? null}
          onStamp={stampReview} busy={busy} />

        {/* 경로 */}
        <Panel title="경로" right={
          <button onClick={() => setPathEdit(v => !v)}
            className={`text-[10px] px-2 py-0.5 rounded font-bold transition ${
              pathEdit ? 'bg-blue-600 text-white' : 'text-gray-600 hover:text-gray-300'
            }`}>
            {pathEdit ? '완료' : '✎'}
          </button>
        }>
          <div className="flex flex-wrap gap-1">
            {paths.map(p => {
              const n = links.filter(l => l.path_id === p.id).length
              return (
                <button key={p.id} disabled={!pathEdit}
                  onClick={() => cyclePathStatus(p)}
                  title={pathEdit ? '확정 → 보류 → 접음' : PATH_STATUS_META[p.status].label}
                  className={`px-1.5 py-1 rounded text-[10px] font-bold transition flex items-center gap-1 ${
                    p.status === 'dropped'
                      ? 'bg-gray-950 text-gray-700 line-through'
                      : p.status === 'active'
                        ? 'bg-gray-800 text-white'
                        : 'bg-gray-950 text-gray-500'
                  } ${pathEdit ? 'hover:ring-1 hover:ring-gray-600' : 'cursor-default'}`}>
                  <span className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.status === 'dropped' ? '#374151' : p.color }} />
                  {p.label}
                  <span className="opacity-50">{n}</span>
                  <span className={`px-1 rounded text-[9px] ${PATH_STATUS_META[p.status].chip}`}>
                    {PATH_STATUS_META[p.status].short}
                  </span>
                </button>
              )
            })}
            {paths.length === 0 && (
              <p className="text-[10px] text-gray-600">경로 없음 · 아래에서 시범 데이터를 넣어보세요</p>
            )}
          </div>
        </Panel>

        {/* 옆줄 — 층이 아니라 별도 레인 */}
        <Panel title="축적 트랙" accent={LAYER_META.daily.accent}
          hint={LAYER_META.daily.blurb}>
          {grouped.daily.length === 0 ? (
            <p className="text-[10px] text-gray-700">비어 있음 · 시험 공부는 못 들어옵니다</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {grouped.daily.map(it => (
                <button key={it.id} onClick={() => openEdit(it)} title={it.note ?? ''}
                  className={`px-2 py-1 rounded bg-gray-950 hover:bg-gray-800 text-[11px] font-semibold transition ${
                    it.done ? 'text-gray-600 line-through' : 'text-green-300/90'
                  }`}>
                  {it.title}
                </button>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── 0층 띠: 배경이니 자리도 배경만큼 ───────────────────── */}
      <div className="bg-gray-900 rounded-xl px-3 py-2 mb-2 flex items-center gap-3 flex-wrap">
        <div className="flex items-baseline gap-1.5 shrink-0">
          <span className="text-xs font-black text-gray-600">0</span>
          <span className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">경계조건</span>
        </div>
        {grouped.fixed.length === 0 ? (
          <p className="text-[10px] text-gray-700">없음</p>
        ) : grouped.fixed.map(it => (
          <button key={it.id} onClick={() => openEdit(it)} title={it.note ?? ''}
            className={`px-2 py-1 rounded bg-gray-950 hover:bg-gray-800 text-[11px] transition ${
              it.done ? 'text-gray-700 line-through' : 'text-gray-400'
            }`}>
            {it.title}
          </button>
        ))}
        <span className="text-[9px] text-gray-700 ml-auto hidden md:block">
          {LAYER_META.fixed.blurb}
        </span>
      </div>

      {/* ── 본문: 판단 대상 세 층을 가로로 ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 items-start">

        <LayerColumn layer="expiring" count={grouped.expiring.length}>
          {grouped.expiring.map(it => (
            <ItemRow key={it.id} it={it} layer="expiring"
              live={liveCount(it.id, links, paths)}
              lock={lockOf(it.id, links, paths)}
              tags={pathsOf(it.id)}
              onEdit={() => openEdit(it)} onDone={() => toggleDone(it)} />
          ))}
          {grouped.expiring.length === 0 && <Empty>날짜가 붙은 항목이 없습니다</Empty>}
        </LayerColumn>

        <LayerColumn layer="shared" count={grouped.shared.length}>
          {grouped.shared.map(it => (
            <ItemRow key={it.id} it={it} layer="shared"
              live={liveCount(it.id, links, paths)}
              lock={lockOf(it.id, links, paths)}
              tags={pathsOf(it.id)}
              onEdit={() => openEdit(it)} onDone={() => toggleDone(it)} />
          ))}
          {grouped.shared.length === 0 && (
            <Empty>살아있는 경로 {SHARED_MIN}개 이상에 걸친 항목이 없습니다</Empty>
          )}

          {grouped.orphan.length > 0 && (
            <div className="pt-2 mt-2 border-t border-gray-800">
              <p className={`text-[10px] font-bold mb-1.5 ${LAYER_META.orphan.accent}`}>
                미분류 {grouped.orphan.length} · {LAYER_META.orphan.blurb}
              </p>
              <div className="space-y-1">
                {grouped.orphan.map(it => (
                  <ItemRow key={it.id} it={it} layer="orphan" live={0} lock="locked"
                    tags={[]} onEdit={() => openEdit(it)} onDone={() => toggleDone(it)} />
                ))}
              </div>
            </div>
          )}
        </LayerColumn>

        <LayerColumn layer="single" count={grouped.single.length}>
          {grouped.single.map(it => (
            <ItemRow key={it.id} it={it} layer="single"
              live={liveCount(it.id, links, paths)}
              lock={lockOf(it.id, links, paths)}
              tags={pathsOf(it.id)}
              onEdit={() => openEdit(it)} onDone={() => toggleDone(it)} />
          ))}
          {grouped.single.length === 0 && (
            <Empty>비어 있는 것이 정상입니다</Empty>
          )}
        </LayerColumn>
      </div>

      {/* ── 하단 ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <button onClick={openAdd}
          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-bold transition">
          + 항목
        </button>
        <button onClick={() => setShowDone(v => !v)}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition ${
            showDone ? 'bg-gray-800 text-white' : 'bg-gray-900 text-gray-600 hover:text-gray-300'
          }`}>
          끝난 항목 {showDone ? '숨기기' : '보기'}
        </button>
        {items.length === 0 && (
          <button onClick={seed} disabled={busy}
            className="px-2.5 py-1.5 rounded-lg bg-gray-900 hover:bg-gray-800 text-[11px] font-bold text-gray-400 transition disabled:opacity-40">
            시범 데이터 넣기
          </button>
        )}
        <span className="text-[10px] text-gray-700 ml-auto hidden lg:block">
          층은 고르는 게 아니라 계산됩니다 · 자리가 어색하면 태그를 고치세요
        </span>
      </div>

      {/* ── 입력 ──────────────────────────────────────────────── */}
      {formOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-md my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold">{editingId ? '항목 수정' : '항목 추가'}</h3>
              <button onClick={close} className="text-gray-500 hover:text-white text-sm">닫기</button>
            </div>

            <div className="space-y-3">
              <input value={draft.title} placeholder="항목"
                onChange={e => setDraft({ ...draft, title: e.target.value })}
                className={inputCls} />
              <input value={draft.note} placeholder="메모 (선택)"
                onChange={e => setDraft({ ...draft, note: e.target.value })}
                className={inputCls} />

              <div className="flex gap-2">
                <ToggleChip on={draft.fixed} label="경계조건 (0층)"
                  onClick={() => setDraft({ ...draft, fixed: !draft.fixed })} />
                <ToggleChip on={draft.daily} label="매일 20분 (축적)"
                  onClick={() => setDraft({ ...draft, daily: !draft.daily })} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] text-gray-500 block mb-1">만료일</span>
                  <input type="date" value={draft.expires_on}
                    onChange={e => setDraft({ ...draft, expires_on: e.target.value })}
                    className={inputCls} />
                </label>
                <label className="block">
                  <span className="text-[10px] text-amber-500/80 block mb-1">결정시점</span>
                  <input type="date" value={draft.decide_by}
                    onChange={e => setDraft({ ...draft, decide_by: e.target.value })}
                    className={inputCls} />
                </label>
              </div>
              <p className="text-[10px] text-gray-600 leading-relaxed -mt-1">
                둘은 다릅니다. 결정시점을 비워두면 만료일까지 계속 열려 있는 척하면서 힘을 갉아먹습니다.
              </p>

              <div>
                <span className="text-[10px] text-gray-500 block mb-1.5">걸치는 경로</span>
                <div className="flex flex-wrap gap-1.5">
                  {paths.map(p => {
                    const on = draft.paths.includes(p.id)
                    return (
                      <button key={p.id}
                        onClick={() => setDraft({
                          ...draft,
                          paths: on ? draft.paths.filter(x => x !== p.id) : [...draft.paths, p.id],
                        })}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 ${
                          on ? 'bg-gray-800 text-white' : 'bg-gray-950 text-gray-600 hover:text-gray-400'
                        }`}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.color }} />
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              {editingId && (
                <button onClick={() => { const it = items.find(x => x.id === editingId); if (it) remove(it) }}
                  className="px-3 py-2.5 rounded-lg bg-gray-950 hover:bg-red-900/40 text-xs text-gray-500 hover:text-red-400 transition">
                  삭제
                </button>
              )}
              <button onClick={save} disabled={busy || !draft.title.trim()}
                className="flex-1 py-2.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-sm font-bold transition">
                {busy ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── 조각 ─────────────────────────────────────────────────────────

function Panel({ title, accent, hint, right, children }: {
  title: string; accent?: string; hint?: string
  right?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="bg-gray-900 rounded-xl px-3 py-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <p className={`text-[10px] uppercase tracking-widest font-semibold ${accent ?? 'text-gray-500'}`}>
          {title}
        </p>
        {right}
      </div>
      {hint && <p className="text-[9px] text-gray-700 leading-snug mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-gray-700">{children}</p>
}

function ToggleChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
        on ? 'bg-gray-800 text-white' : 'bg-gray-950 text-gray-600 hover:text-gray-400'
      }`}>
      {label}
    </button>
  )
}

function LayerColumn({ layer, count, children }: {
  layer: Layer; count: number; children: React.ReactNode
}) {
  const m = LAYER_META[layer]
  return (
    <div className="bg-gray-900 rounded-xl px-3 py-2.5">
      <div className="flex items-baseline gap-1.5 mb-0.5">
        <span className={`text-xs font-black ${m.accent}`}>{m.n}</span>
        <p className={`text-[10px] uppercase tracking-widest font-semibold ${m.accent}`}>{m.label}</p>
        <span className="text-[10px] text-gray-700">{count}</span>
      </div>
      <p className="text-[9px] text-gray-700 leading-snug mb-2">{m.blurb}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function ItemRow({ it, layer, live, lock, tags, onEdit, onDone }: {
  it: PrItem; layer: Layer; live: number; lock: LockState
  tags: PrPath[]; onEdit: () => void; onDone: () => void
}) {
  const d = dday(it.decide_by)
  const overdue = d !== null && d < 0
  const dim = layer === 'single' && lock !== 'open'
  const sunk = lock === 'sunk'

  return (
    <div className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition ${
      sunk ? 'bg-gray-950/50' : 'bg-gray-950 hover:bg-gray-800'
    }`}>
      <button onClick={onDone} aria-label="완료"
        className={`w-3.5 h-3.5 rounded-sm border shrink-0 transition ${
          it.done ? 'bg-green-700 border-green-700' : 'border-gray-700 hover:border-gray-500'
        }`} />

      <button onClick={onEdit} className="min-w-0 flex-1 text-left" title={it.note ?? ''}>
        <div className="flex items-center gap-1">
          {sunk && <span className="text-[9px] shrink-0">💀</span>}
          {dim && !sunk && <span className="text-[9px] shrink-0">🔒</span>}
          {layer === 'shared' && (
            <span className={`text-[9px] px-1 rounded font-bold shrink-0 ${
              live >= 3 ? 'bg-blue-600/30 text-blue-300' : 'bg-gray-800 text-gray-500'
            }`}>{live}</span>
          )}
          <p className={`text-[12px] font-semibold leading-tight truncate ${
            it.done || sunk ? 'text-gray-600 line-through' : dim ? 'text-gray-500' : ''
          }`}>
            {it.title}
          </p>
        </div>
        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 mt-0.5 overflow-hidden">
            {tags.map(p => (
              <span key={p.id} className="text-[9px] text-gray-600 flex items-center gap-0.5 shrink-0">
                <span className="w-1 h-1 rounded-full"
                  style={{ backgroundColor: p.status === 'dropped' ? '#374151' : p.color }} />
                {p.label}
              </span>
            ))}
          </div>
        )}
      </button>

      {layer === 'expiring' && (
        <div className="text-right shrink-0 leading-tight">
          {it.decide_by ? (
            <p className={`text-[10px] font-bold ${overdue ? 'text-red-400' : 'text-amber-400'}`}>
              {ddayLabel(d)}
            </p>
          ) : (
            <p className="text-[9px] text-red-400/80 font-bold">결정시점<br />없음</p>
          )}
          {it.expires_on && (
            <p className="text-[9px] text-gray-700">~{it.expires_on.slice(2)}</p>
          )}
        </div>
      )}
    </div>
  )
}

function ReviewPanel({ flags, last, onStamp, busy }: {
  flags: ReturnType<typeof collectFlags>
  last: PrReview | null
  onStamp: () => void
  busy: boolean
}) {
  const alerts = [
    { n: flags.overdue,   label: '결정 지남',   tone: 'text-red-400' },
    { n: flags.undecided, label: '결정시점 없음', tone: 'text-amber-400' },
    { n: flags.orphan,    label: '경로 미지정',  tone: 'text-red-400' },
    { n: flags.locked,    label: '3층 잠김',    tone: 'text-gray-500' },
  ].filter(a => a.n > 0)

  return (
    <Panel title="월간 점검" right={
      <button onClick={onStamp} disabled={busy}
        className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-[10px] font-bold transition disabled:opacity-40">
        오늘 점검함
      </button>
    }>
      <p className="text-[9px] text-gray-700 mb-1.5">
        {last
          ? `마지막 점검 ${last.reviewed_on} · ${flags.daysSinceReview}일 전`
          : '아직 점검한 적이 없습니다'}
      </p>
      {alerts.length === 0 ? (
        <p className="text-[10px] text-gray-600">지금 썩고 있는 항목은 없습니다</p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {alerts.map(a => (
            <div key={a.label} className="bg-gray-950 rounded px-1.5 py-1 flex items-baseline gap-1">
              <span className={`text-sm font-black ${a.tone}`}>{a.n}</span>
              <span className="text-[9px] text-gray-500">{a.label}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  )
}
