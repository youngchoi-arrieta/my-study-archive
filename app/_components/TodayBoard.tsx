'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { addInbox, INBOX_EVENT } from '../../lib/inbox'

// 홈 맨 위 '오늘' — 들어가지 않고 한눈에 보는 카드 세 장.
// -------------------------------------------------------------------
//   기록함        : 안 처리한 개수 + 최근 5개, 맨 위 한 줄 입력
//   다가오는 마감  : 업무 간트 · 시험 간트 · 우선순위 보드를 날짜순으로 합침
//   안 끝난 지시   : 업무일지에서 action_needed && !resolved
// 읽기 위주. 고치는 건 각 화면에서.

const PAST_DAYS = 3    // 며칠 지난 것까지 '지남'으로 보여줄지
const AHEAD_DAYS = 14  // 앞으로 며칠까지

interface InboxRow { id: string; body: string; created_at: string }
interface Deadline { key: string; date: string; label: string; src: string; href: string }
interface Order { id: string; body: string; person: string | null; day: string }

function ymd(d: Date) {
  const z = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`
}
function shift(days: number) { const d = new Date(); d.setDate(d.getDate() + days); return ymd(d) }
function dday(date: string) {
  const diff = Math.round((new Date(date + 'T00:00:00').getTime() - new Date(ymd(new Date()) + 'T00:00:00').getTime()) / 86400000)
  if (diff === 0) return { text: '오늘', cls: 'text-amber-300' }
  if (diff < 0) return { text: `${-diff}일 지남`, cls: 'text-red-400' }
  return { text: `D-${diff}`, cls: diff <= 3 ? 'text-amber-300' : 'text-gray-500' }
}

interface InboxData { rows: InboxRow[]; count: number }

async function fetchInbox(): Promise<InboxData> {
  const [{ data }, { count }] = await Promise.all([
    supabase.from('inbox').select('id,body,created_at').eq('done', false)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('inbox').select('id', { count: 'exact', head: true }).eq('done', false),
  ])
  return { rows: data ?? [], count: count ?? 0 }
}

async function fetchRest(): Promise<{ deadlines: Deadline[]; orders: Order[] }> {
  const from = shift(-PAST_DAYS), to = shift(AHEAD_DAYS)
  const [co, tl, pr, jo] = await Promise.all([
    supabase.from('co_events').select('id,title,end_date,milestone').eq('done', false),
    supabase.from('tl_events').select('id,title,reg_end,exam_date').eq('done', false),
    supabase.from('pr_items').select('id,title,expires_on,decide_by').eq('done', false),
    supabase.from('co_journal').select('id,body,person,day')
      .eq('action_needed', true).eq('resolved', false).order('day', { ascending: true }),
  ])
  const out: Deadline[] = []
  const push = (id: string, date: string | null, label: string, src: string, href: string) => {
    if (date && date >= from && date <= to) out.push({ key: `${src}-${id}-${label}`, date, label, src, href })
  }
  for (const e of co.data ?? []) push(e.id, e.milestone ?? e.end_date, e.title, '업무', '/dashboard/company')
  for (const e of tl.data ?? []) {
    push(e.id, e.reg_end, `${e.title} 접수마감`, '시험', '/dashboard/timeline')
    push(e.id, e.exam_date, `${e.title} 시험`, '시험', '/dashboard/timeline')
  }
  for (const e of pr.data ?? []) {
    push(e.id, e.expires_on, `${e.title} 만료`, '우선순위', '/dashboard/timeline')
    push(e.id, e.decide_by, `${e.title} 결정`, '우선순위', '/dashboard/timeline')
  }
  out.sort((a, b) => a.date.localeCompare(b.date))
  return { deadlines: out, orders: jo.data ?? [] }
}

export default function TodayBoard() {
  const [inbox, setInbox] = useState<InboxRow[]>([])
  const [openCount, setOpenCount] = useState(0)
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [line, setLine] = useState('')
  const [loading, setLoading] = useState(true)

  const applyInbox = useCallback((a: InboxData) => { setInbox(a.rows); setOpenCount(a.count) }, [])
  const refreshInbox = useCallback(() => fetchInbox().then(applyInbox), [applyInbox])

  useEffect(() => {
    let alive = true
    Promise.all([fetchInbox(), fetchRest()]).then(([a, b]) => {
      if (!alive) return
      applyInbox(a); setDeadlines(b.deadlines); setOrders(b.orders); setLoading(false)
    })
    const on = () => { fetchInbox().then(a => { if (alive) applyInbox(a) }) }
    window.addEventListener(INBOX_EVENT, on)
    return () => { alive = false; window.removeEventListener(INBOX_EVENT, on) }
  }, [applyInbox])

  async function submitLine() {
    if (await addInbox(line)) setLine('')
  }
  async function markDone(id: string) {
    setInbox(prev => prev.filter(r => r.id !== id)); setOpenCount(c => Math.max(0, c - 1))
    await supabase.from('inbox').update({ done: true }).eq('id', id)
    refreshInbox()
  }
  async function resolveOrder(id: string) {
    setOrders(prev => prev.filter(o => o.id !== id))
    await supabase.from('co_journal').update({ resolved: true }).eq('id', id)
  }

  const card = 'bg-gray-900 rounded-2xl p-4'
  const head = 'text-[11px] uppercase tracking-widest font-semibold mb-2'

  return (
    <section className="mb-10 space-y-3">
      <input
        value={line} onChange={e => setLine(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) submitLine() }}
        placeholder="✏️ 아무거나 한 줄 — 엔터로 기록함에"
        className="w-full bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3 text-sm outline-none focus:border-blue-600"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 기록함 */}
        <div className={card}>
          <p className={`${head} text-blue-300`}>기록함 · 안 처리 {openCount}</p>
          {loading ? <p className="text-xs text-gray-600">불러오는 중…</p>
            : inbox.length === 0 ? <p className="text-xs text-gray-600">비어 있음</p>
            : <ul className="space-y-1.5">
                {inbox.map(r => (
                  <li key={r.id} className="flex items-start gap-2 text-xs text-gray-300">
                    <button onClick={() => markDone(r.id)} title="처리함"
                      className="mt-0.5 w-3.5 h-3.5 shrink-0 rounded border border-gray-600 hover:border-blue-400" />
                    <span className="flex-1 break-words">{r.body}</span>
                  </li>
                ))}
              </ul>}
        </div>

        {/* 다가오는 마감 */}
        <div className={card}>
          <p className={`${head} text-amber-300`}>다가오는 마감 · {AHEAD_DAYS}일</p>
          {loading ? <p className="text-xs text-gray-600">불러오는 중…</p>
            : deadlines.length === 0 ? <p className="text-xs text-gray-600">없음</p>
            : <ul className="space-y-1.5">
                {deadlines.slice(0, 6).map(d => {
                  const t = dday(d.date)
                  return (
                    <li key={d.key}>
                      <Link href={d.href} className="flex items-baseline gap-2 text-xs hover:text-white text-gray-300">
                        <span className={`w-14 shrink-0 ${t.cls}`}>{t.text}</span>
                        <span className="flex-1 truncate">{d.label}</span>
                        <span className="text-[10px] text-gray-600 shrink-0">{d.src}</span>
                      </Link>
                    </li>
                  )
                })}
                {deadlines.length > 6 && <li className="text-[10px] text-gray-600">외 {deadlines.length - 6}건</li>}
              </ul>}
        </div>

        {/* 안 끝난 지시 */}
        <div className={card}>
          <p className={`${head} text-pink-300`}>안 끝난 지시 · {orders.length}</p>
          {loading ? <p className="text-xs text-gray-600">불러오는 중…</p>
            : orders.length === 0 ? <p className="text-xs text-gray-600">없음</p>
            : <ul className="space-y-1.5">
                {orders.slice(0, 5).map(o => (
                  <li key={o.id} className="flex items-start gap-2 text-xs text-gray-300">
                    <button onClick={() => resolveOrder(o.id)} title="끝남"
                      className="mt-0.5 w-3.5 h-3.5 shrink-0 rounded border border-gray-600 hover:border-pink-400" />
                    <span className="flex-1 break-words">
                      {o.body}{o.person && <span className="text-gray-600"> · {o.person}</span>}
                    </span>
                  </li>
                ))}
                {orders.length > 5 && <li className="text-[10px] text-gray-600">외 {orders.length - 5}건</li>}
              </ul>}
        </div>
      </div>
    </section>
  )
}
