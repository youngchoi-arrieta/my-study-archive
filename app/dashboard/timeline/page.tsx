'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ───────────────────────────────────────────────────────────────
//  시험 일정 간트
//  공기업 트랙과 일본 트랙을 한 줄에 놓고 보기 위한 화면.
//  띠 = 원서접수 기간, ◆ = 시험일.
//  두 트랙이 겹치는 달을 눈으로 잡는 게 이 화면의 목적이다.
// ───────────────────────────────────────────────────────────────

type Track = 'language' | 'kr-license' | 'jp-license' | 'skill' | 'career' | 'public'

const TRACKS: { key: Track; label: string; color: string }[] = [
  { key: 'public', label: '공기업 채용', color: '#f472b6' },
  { key: 'kr-license', label: '한국 자격증', color: '#60a5fa' },
  { key: 'jp-license', label: '일본 자격증', color: '#fb923c' },
  { key: 'language', label: '어학', color: '#34d399' },
  { key: 'skill', label: '기능검정', color: '#a78bfa' },
  { key: 'career', label: '진학 · 교육', color: '#94a3b8' },
]
const trackMeta = (t: string) => TRACKS.find(x => x.key === t) ?? TRACKS[TRACKS.length - 1]

interface Ev {
  id: string
  track: Track
  title: string
  reg_start: string | null
  reg_end: string | null
  exam_date: string | null
  note: string | null
  done: boolean
  sort_order: number
}

const ZOOMS = [
  { w: 30, label: '촘촘' },
  { w: 46, label: '보통' },
  { w: 68, label: '넓게' },
  { w: 96, label: '크게' },
]
const SPANS = [
  { n: 6, label: '6개월' },
  { n: 12, label: '1년' },
  { n: 24, label: '2년' },
  { n: 0, label: '전체' },
]

const ym = (d: string) => d.slice(0, 7)
const today = () => new Date().toISOString().slice(0, 10)
const monthIndex = (from: string, d: string) => {
  const [fy, fm] = from.split('-').map(Number)
  const [y, m] = d.split('-').map(Number)
  return (y - fy) * 12 + (m - fm)
}
const addMonths = (from: string, n: number) => {
  const [y, m] = from.split('-').map(Number)
  const total = (y * 12 + (m - 1)) + n
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}
/** 그 달 안에서의 위치 비율 (0~1) — 실제 그 달의 일수로 나눈다 */
const dayFrac = (d: string) => {
  const [y, m] = d.split('-').map(Number)
  const day = Number(d.slice(8, 10) || 1)
  const days = new Date(y, m, 0).getDate()
  return (day - 1) / days
}

const emptyDraft = () => ({
  track: 'public' as Track, title: '', reg_start: '', reg_end: '', exam_date: '', note: '',
})
type Draft = ReturnType<typeof emptyDraft>

export default function TimelinePage() {
  const [events, setEvents] = useState<Ev[]>([])
  const [loading, setLoading] = useState(true)
  const [hidden, setHidden] = useState<Set<Track>>(new Set())
  const [showDone, setShowDone] = useState(false)
  const [mw, setMw] = useState(46)
  const [span, setSpan] = useState(12)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [saving, setSaving] = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tl_events').select('*')
      .order('sort_order', { ascending: true })
    setEvents((data as Ev[]) || [])
    setLoading(false)
  }, [])
  useEffect(() => { fetchAll() }, [fetchAll])

  const visible = useMemo(
    () => events.filter(e => !hidden.has(e.track) && (showDone || !e.done)),
    [events, hidden, showDone],
  )

  // 표시 구간: 이번 달 ~ 가장 늦은 일정
  const range = useMemo(() => {
    const now = new Date().toISOString().slice(0, 7)
    const all = visible.flatMap(e => [e.reg_start, e.reg_end, e.exam_date].filter(Boolean) as string[])
    if (!all.length) return { from: now, full: 12 }
    const min = all.map(ym).reduce((a, b) => (a < b ? a : b))
    const max = all.map(ym).reduce((a, b) => (a > b ? a : b))
    const from = min < now ? min : now
    const full = Math.max(monthIndex(from, `${max}-01`) + 2, 6)
    return { from, full }
  }, [visible])

  const months = span === 0 ? range.full : Math.min(range.full, span)
  const cols: string[] = Array.from({ length: months }, (_, i) => addMonths(range.from, i))
  const labelW = mw <= 34 ? 150 : 200

  // 오늘 선의 x 위치 (라벨 칸 제외)
  const todayX = useMemo(() => {
    const t = today()
    const i = monthIndex(range.from, t)
    if (i < 0 || i >= months) return null
    return i * mw + dayFrac(t) * mw
  }, [range.from, months, mw])

  // 다가오는 마감
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const items: { when: string; what: string; kind: string; ev: Ev }[] = []
    events.filter(e => !e.done).forEach(e => {
      if (e.reg_end && e.reg_end >= today) items.push({ when: e.reg_end, what: e.title, kind: '접수 마감', ev: e })
      if (e.exam_date && e.exam_date >= today) items.push({ when: e.exam_date, what: e.title, kind: '시험', ev: e })
    })
    return items.sort((a, b) => a.when.localeCompare(b.when)).slice(0, 5)
  }, [events])

  const toggleTrack = (t: Track) => {
    const n = new Set(hidden)
    if (n.has(t)) n.delete(t); else n.add(t)
    setHidden(n)
  }

  const openAdd = () => { setDraft(emptyDraft()); setEditingId(null); setFormOpen(true) }
  const openEdit = (e: Ev) => {
    setDraft({
      track: e.track, title: e.title,
      reg_start: e.reg_start ?? '', reg_end: e.reg_end ?? '',
      exam_date: e.exam_date ?? '', note: e.note ?? '',
    })
    setEditingId(e.id); setFormOpen(true)
  }
  const close = () => { setFormOpen(false); setEditingId(null); setDraft(emptyDraft()) }

  const save = async () => {
    if (!draft.title.trim() || saving) return
    setSaving(true)
    const payload = {
      track: draft.track, title: draft.title.trim(),
      reg_start: draft.reg_start || null, reg_end: draft.reg_end || null,
      exam_date: draft.exam_date || null, note: draft.note.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = editingId
      ? await supabase.from('tl_events').update(payload).eq('id', editingId)
      : await supabase.from('tl_events').insert(payload)
    setSaving(false)
    if (error) { alert(`저장하지 못했습니다.\n${error.message}`); return }
    close(); fetchAll()
  }

  const toggleDone = async (e: Ev) => {
    setEvents(prev => prev.map(x => x.id === e.id ? { ...x, done: !x.done } : x))
    await supabase.from('tl_events').update({ done: !e.done }).eq('id', e.id)
  }

  const remove = async (e: Ev) => {
    if (!confirm(`"${e.title}" 일정을 지울까요?`)) return
    await supabase.from('tl_events').delete().eq('id', e.id)
    if (editingId === e.id) close()
    fetchAll()
  }

  const inputCls = 'bg-gray-950 border border-gray-800 focus:border-gray-600 rounded-lg px-3 py-2 text-sm outline-none transition'

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6 md:p-8">
      <div className="max-w-6xl mx-auto">

        <div className="mb-2">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← 홈</Link>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">🗓</span>
          <h1 className="text-2xl font-bold">시험 일정</h1>
        </div>
        <p className="text-gray-500 text-sm mb-5">
          공기업 트랙과 일본 트랙을 한 줄에 · 띠는 원서접수, ◆는 시험일
        </p>

        {/* 다가오는 것 */}
        {upcoming.length > 0 && (
          <div className="bg-gray-900 rounded-2xl p-5 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">다음 5개</p>
            <div className="space-y-2">
              {upcoming.map((u, i) => {
                const days = Math.ceil(
                  (new Date(u.when).getTime() - Date.now()) / 86400000,
                )
                return (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: trackMeta(u.ev.track).color }} />
                    <span className="flex-1 truncate">{u.what}</span>
                    <span className={`text-[11px] shrink-0 ${u.kind === '접수 마감' ? 'text-amber-400' : 'text-gray-500'}`}>
                      {u.kind}
                    </span>
                    <span className="text-[11px] text-gray-600 shrink-0 w-24 text-right">
                      {u.when} · D-{days}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          {TRACKS.map(t => (
            <button key={t.key} onClick={() => toggleTrack(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                hidden.has(t.key) ? 'bg-gray-900 text-gray-600' : 'bg-gray-800 text-gray-200'
              }`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: hidden.has(t.key) ? '#374151' : t.color }} />
              {t.label}
            </button>
          ))}
          <button onClick={() => setShowDone(v => !v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ml-auto ${
              showDone ? 'bg-gray-800 text-gray-200' : 'bg-gray-900 text-gray-600'
            }`}>
            완료 {showDone ? '표시' : '숨김'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 mb-3">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-600 mr-1">기간</span>
            {SPANS.map(sp => (
              <button key={sp.n} onClick={() => setSpan(sp.n)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                  span === sp.n ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-600 hover:text-gray-400'
                }`}>{sp.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-600 mr-1">배율</span>
            {ZOOMS.map(z => (
              <button key={z.w} onClick={() => setMw(z.w)}
                className={`px-2 py-1 rounded text-[11px] font-bold transition ${
                  mw === z.w ? 'bg-gray-700 text-white' : 'bg-gray-900 text-gray-600 hover:text-gray-400'
                }`}>{z.label}</button>
            ))}
          </div>
          <span className="text-[10px] text-gray-700 ml-auto flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-red-500" /> 오늘
          </span>
        </div>

        {/* 간트 */}
        {loading ? (
          <p className="text-gray-500 text-sm">불러오는 중...</p>
        ) : (
          <div className="bg-gray-900 rounded-2xl p-4 mb-5 overflow-x-auto">
            <div className="relative" style={{ minWidth: labelW + cols.length * mw }}>

              {/* 오늘 — 전체 행을 가로지르는 붉은 선 */}
              {todayX !== null && (
                <div className="absolute top-0 bottom-0 pointer-events-none z-[5]"
                  style={{ left: labelW + todayX }}>
                  <div className="w-px h-full bg-red-500/70" />
                  <div className="absolute -top-0.5 -left-1 w-2 h-2 rounded-full bg-red-500" />
                </div>
              )}

              {/* 헤더 */}
              <div className="flex border-b border-gray-800 pb-2 mb-2 relative z-10">
                <div className="shrink-0 sticky left-0 bg-gray-900" style={{ width: labelW }} />
                {cols.map(c => {
                  const [y, m] = c.split('-')
                  const isJan = m === '01'
                  const isNow = c === today().slice(0, 7)
                  return (
                    <div key={c} className="text-center shrink-0" style={{ width: mw }}>
                      {isJan && <p className="text-[9px] text-blue-400 font-bold leading-tight">{y}</p>}
                      <p className={`text-[10px] leading-tight ${
                        isNow ? 'text-red-400 font-bold' : isJan ? 'text-gray-300 font-bold' : 'text-gray-600'
                      }`}>
                        {mw <= 34 ? Number(m) : `${Number(m)}월`}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* 행 */}
              {TRACKS.filter(t => !hidden.has(t.key)).map(t => {
                const rows = visible.filter(e => e.track === t.key)
                if (!rows.length) return null
                return (
                  <div key={t.key} className="mb-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1 sticky left-0 z-10"
                      style={{ color: t.color }}>
                      {t.label}
                    </p>
                    {rows.map(e => {
                      const regFrom = e.reg_start ? monthIndex(range.from, e.reg_start) : null
                      const regTo = e.reg_end ? monthIndex(range.from, e.reg_end) : regFrom
                      const ex = e.exam_date ? monthIndex(range.from, e.exam_date) : null
                      const showReg = regFrom !== null && regTo !== null && regTo >= 0 && regFrom < months
                      const showEx = ex !== null && ex >= 0 && ex < months
                      return (
                        <div key={e.id} className={`flex items-center h-7 group ${e.done ? 'opacity-40' : ''}`}>
                          <div className="shrink-0 pr-3 flex items-center gap-1.5 sticky left-0 z-10 bg-gray-900 h-full"
                            style={{ width: labelW }}>
                            <button onClick={() => toggleDone(e)}
                              className={`w-3.5 h-3.5 rounded shrink-0 text-[9px] leading-none ${e.done ? 'bg-green-600 text-white' : 'bg-gray-800 text-transparent'}`}>✓</button>
                            <button onClick={() => openEdit(e)}
                              className="text-[12px] truncate text-left hover:text-blue-300 transition flex-1">
                              {e.title}
                            </button>
                            <button onClick={() => remove(e)}
                              className="text-[10px] text-gray-800 group-hover:text-gray-600 hover:!text-red-400 transition shrink-0">✕</button>
                          </div>
                          <div className="relative h-full" style={{ width: cols.length * mw }}>
                            {cols.map((c, i) => (
                              <div key={c} className="absolute top-0 bottom-0 border-l border-gray-800/40"
                                style={{ left: i * mw }} />
                            ))}
                            {showReg && (
                              <div className="absolute top-1/2 -translate-y-1/2 h-3 rounded-full flex items-center justify-center overflow-hidden"
                                style={{
                                  left: Math.max(regFrom!, 0) * mw + 2,
                                  width: Math.max((Math.min(regTo!, months - 1) - Math.max(regFrom!, 0) + 1) * mw - 4, 12),
                                  backgroundColor: t.color, opacity: 0.35,
                                }}
                                title={`접수 ${e.reg_start} ~ ${e.reg_end ?? ''}`}>
                                {mw > 34 && <span className="text-[9px] font-bold text-white/90">R</span>}
                              </div>
                            )}
                            {showEx && (
                              <div className="absolute top-1/2 -translate-y-1/2 text-[12px] leading-none"
                                style={{ left: ex! * mw + dayFrac(e.exam_date!) * mw - 5, color: t.color }}
                                title={`시험 ${e.exam_date}`}>
                                ◆
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 추가 · 편집 */}
        {!formOpen ? (
          <button onClick={openAdd}
            className="w-full border border-dashed border-gray-800 hover:border-gray-600 text-gray-500 hover:text-gray-300 rounded-xl py-3.5 text-sm font-semibold transition">
            + 일정 추가
          </button>
        ) : (
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
              {editingId ? '일정 수정' : '일정 추가'}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 mb-3">
              <select value={draft.track} onChange={e => setDraft(d => ({ ...d, track: e.target.value as Track }))}
                className={inputCls}>
                {TRACKS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
              <input value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                placeholder="시험명 (예: 電験三種 2次)"
                className={`${inputCls} placeholder:text-gray-700`} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
              <label className="text-[11px] text-gray-500">
                접수 시작
                <input type="date" value={draft.reg_start}
                  onChange={e => setDraft(d => ({ ...d, reg_start: e.target.value }))}
                  className={`${inputCls} w-full mt-1`} />
              </label>
              <label className="text-[11px] text-gray-500">
                접수 마감
                <input type="date" value={draft.reg_end}
                  onChange={e => setDraft(d => ({ ...d, reg_end: e.target.value }))}
                  className={`${inputCls} w-full mt-1`} />
              </label>
              <label className="text-[11px] text-amber-500/80">
                시험일
                <input type="date" value={draft.exam_date}
                  onChange={e => setDraft(d => ({ ...d, exam_date: e.target.value }))}
                  className={`${inputCls} w-full mt-1`} />
              </label>
            </div>
            <input value={draft.note} onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
              placeholder="메모 (CBT 기간 응시 · 공고 URL 등)"
              className={`${inputCls} w-full mb-3 placeholder:text-gray-700`} />
            <div className="flex gap-2">
              <button onClick={close}
                className="px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm font-semibold transition">취소</button>
              <button onClick={save} disabled={!draft.title.trim() || saving}
                className="flex-1 py-2.5 rounded-lg bg-green-700 hover:bg-green-600 disabled:opacity-40 text-sm font-bold transition">
                {saving ? '저장 중...' : editingId ? '수정 저장' : '저장'}
              </button>
            </div>
          </div>
        )}

        <p className="text-[10px] text-gray-700 mt-5 leading-relaxed">
          초기 일정은 정리해두신 스프레드시트를 옮긴 것이라 실제 공고와 며칠씩 어긋날 수 있습니다.
          제목을 눌러 수정하고, 끝난 일정은 왼쪽 체크로 접어두세요.
        </p>

      </div>
    </main>
  )
}
