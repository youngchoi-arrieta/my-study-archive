'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { Milestone, DailyLog, BudgetConfig, Lang, Currency, t, formatAmount } from './types'
import MilestonesView from './components/MilestonesView'
import DailyLogView from './components/DailyLogView'
import dynamic from 'next/dynamic'

const BudgetView = dynamic(() => import('./components/BudgetView'), {
  ssr: false,
  loading: () => <div style={{ height: 200, background: '#111827', borderRadius: 12 }} />,
})

const FamiliaRoadmap = dynamic(() => import('../familia/FamiliaRoadmap'), {
  ssr: false,
  loading: () => <div style={{ height: 200, background: '#111827', borderRadius: 12 }} />,
})

type Tab = 'log' | 'budget' | 'milestones' | 'roadmap'

function todayStr() { return new Date().toISOString().slice(0, 10) }
function daysUntil(d: string) {
  const now = new Date(); now.setHours(0,0,0,0)
  return Math.round((new Date(d + 'T00:00:00').getTime() - now.getTime()) / 86400000)
}
function sumKrw(e: Record<string, number>) { return Object.values(e).reduce((a, b) => a + b, 0) }

export default function LifeOpsDashboard() {
  const [tab,        setTab]        = useState<Tab>('log')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [logs,       setLogs]       = useState<DailyLog[]>([])
  const [config,     setConfig]     = useState<BudgetConfig | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [lang,       setLang]       = useState<Lang>('en')
  const [currency,   setCurrency]   = useState<Currency>('KRW')

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [ms, lg, cf] = await Promise.all([
      supabase.from('milestones').select('*'),
      supabase.from('daily_logs').select('*'),
      supabase.from('budget_config').select('*').eq('id', 1).single(),
    ])
    setMilestones(ms.data || [])
    setLogs(lg.data || [])
    setConfig(cf.data || null)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── 자정 감지: 날짜가 바뀌면 fetchAll 재호출 ─────────────────────────────
  useEffect(() => {
    function msUntilMidnight() {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      return midnight.getTime() - now.getTime()
    }
    // 자정 직후 한 번 fetchAll, 그 다음은 매 24시간마다
    const timeout = setTimeout(() => {
      fetchAll()
      const interval = setInterval(fetchAll, 24 * 60 * 60 * 1000)
      return () => clearInterval(interval)
    }, msUntilMidnight() + 500)   // +500ms 여유
    return () => clearTimeout(timeout)
  }, [fetchAll])

  // ── Milestone handlers ───────────────────────────────────────────────────
  async function saveMilestone(patch: Partial<Milestone>, id?: string) {
    if (id) await supabase.from('milestones').update(patch).eq('id', id)
    else    await supabase.from('milestones').insert(patch)
    await fetchAll()
  }
  async function deleteMilestone(id: string) {
    await supabase.from('milestones').delete().eq('id', id); await fetchAll()
  }
  async function toggleDone(id: string, done: boolean) {
    await supabase.from('milestones').update({ done }).eq('id', id)
    setMilestones(p => p.map(m => m.id === id ? { ...m, done } : m))
  }

  // ── Daily log upsert ─────────────────────────────────────────────────────
  async function upsertToday(patch: Partial<DailyLog>) {
    const today    = todayStr()
    const existing = logs.find(l => l.log_date === today)
    if (existing) {
      const merged = {
        ...existing, ...patch,
        expense_krw: patch.expense_krw ?? existing.expense_krw,
        income_krw:  patch.income_krw  ?? (existing.income_krw || {}),
        weight_kg:   patch.weight_kg   !== undefined ? patch.weight_kg : existing.weight_kg,
      }
      await supabase.from('daily_logs').update(merged).eq('id', existing.id)
    } else {
      await supabase.from('daily_logs').insert({
        log_date:    today,
        expense_krw: patch.expense_krw || {},
        income_krw:  patch.income_krw  || {},
        weight_kg:   patch.weight_kg   ?? null,
        condition:   patch.condition   ?? null,
        memo:        patch.memo        ?? null,
        reflection:  patch.reflection  ?? null,
        activities:  patch.activities  ?? null,
        listening_min: patch.listening_min ?? null,
        listening_content: patch.listening_content ?? null,
        study_blocks: patch.study_blocks ?? null,
      })
    }
    await fetchAll()
  }

  // ── Edit / delete any past log by id ─────────────────────────────────────
  async function updateLog(id: string, patch: Partial<DailyLog>) {
    await supabase.from('daily_logs').update(patch).eq('id', id)
    await fetchAll()
  }
  async function deleteLog(id: string) {
    await supabase.from('daily_logs').delete().eq('id', id)
    await fetchAll()
  }

  // ── Config update ────────────────────────────────────────────────────────
  async function updateConfig(patch: Partial<BudgetConfig>) {
    if (config) await supabase.from('budget_config').update(patch).eq('id', 1)
    else        await supabase.from('budget_config').insert({ id: 1, ...patch })
    await fetchAll()
  }

  const copPerKrw = config?.cop_per_krw ?? 0.42
  const fmt = (krw: number) => formatAmount(krw, currency, copPerKrw)

  // ── Quick summary numbers ────────────────────────────────────────────────
  const today     = todayStr()
  const todayLog  = logs.find(l => l.log_date === today)
  const expToday  = sumKrw(todayLog?.expense_krw || {})
  const totalExp  = logs.reduce((s, l) => s + sumKrw(l.expense_krw), 0)
  const totalInc  = logs.reduce((s, l) => s + sumKrw(l.income_krw || {}), 0)
  const balance   = (config?.start_balance_krw ?? 0) - totalExp + totalInc
  const upcoming  = [...milestones]
    .filter(m => !m.done && daysUntil(m.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)

  const TABS: { key: Tab; label: string }[] = [
    { key: 'log',        label: t('log', lang)        },
    { key: 'budget',     label: t('budget', lang)     },
    { key: 'milestones', label: t('milestones', lang) },
    { key: 'roadmap',    label: lang === 'en' ? '🗺️ Roadmap' : '🗺️ Plan' },
  ]

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Sticky top bar */}
      <div className="border-b border-gray-800 bg-gray-950 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 pt-3 flex items-center justify-between">
          <Link href="/familia" className="text-gray-500 hover:text-white text-sm">← Familia</Link>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}
              className="px-2.5 py-1 rounded-lg text-xs bg-gray-800 hover:bg-gray-700 transition">
              {lang === 'en' ? '🇺🇸 EN' : '🇨🇴 ES'}
            </button>
            <button onClick={() => setCurrency(c => c === 'KRW' ? 'COP' : 'KRW')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition ${
                currency === 'KRW'
                  ? 'bg-blue-900/60 text-blue-200 hover:bg-blue-800/60'
                  : 'bg-amber-900/60 text-amber-200 hover:bg-amber-800/60'}`}>
              {currency === 'KRW' ? '₩ KRW' : '$ COP'}
            </button>
          </div>
        </div>

        {/* Mini summary strip */}
        {config && !loading && (
          <div className="max-w-2xl mx-auto px-4 py-2 flex gap-4 text-xs text-gray-400">
            <span>Balance: <span className="text-white font-semibold">{fmt(balance)}</span></span>
            <span>Today: <span className={expToday > (config.daily_target_krw) ? 'text-red-400' : 'text-green-400'}>{fmt(expToday)}</span></span>
            {todayLog?.weight_kg && <span>⚖️ {todayLog.weight_kg}kg</span>}
          </div>
        )}

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4 flex gap-0.5">
          {TABS.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm transition rounded-t-lg ${
                tab === key ? 'bg-gray-900 text-white font-semibold' : 'text-gray-500 hover:text-gray-300'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-5">
        {loading && (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}

        {/* Upcoming milestones strip (always visible above log) */}
        {!loading && tab === 'log' && upcoming.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-none">
            {upcoming.map(m => {
              const d = daysUntil(m.date)
              return (
                <div key={m.id}
                  className="flex-shrink-0 bg-gray-900 rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className={`font-bold text-sm ${d <= 7 ? 'text-red-400' : 'text-white'}`}>
                    {d === 0 ? t('today', lang) : `D-${d}`}
                  </span>
                  <span className="text-xs text-gray-400">{m.title}</span>
                </div>
              )
            })}
          </div>
        )}

        {!loading && tab === 'log' && config && (
          <DailyLogView logs={logs} config={config}
            onUpsertToday={upsertToday} onUpdateConfig={updateConfig}
            onUpdateLog={updateLog} onDeleteLog={deleteLog}
            lang={lang} currency={currency} copPerKrw={copPerKrw} />
        )}

        {!loading && tab === 'budget' && config && (
          <BudgetView logs={logs} config={config} onUpdateConfig={updateConfig}
            lang={lang} currency={currency} />
        )}

        {!loading && tab === 'milestones' && (
          <MilestonesView milestones={milestones} onSave={saveMilestone}
            onDelete={deleteMilestone} onToggleDone={toggleDone} />
        )}

        {!loading && tab === 'roadmap' && (
          <FamiliaRoadmap embedded lang={lang} />
        )}

        {!loading && !config && tab !== 'milestones' && tab !== 'roadmap' && (
          <div className="text-center py-20">
            <p className="text-gray-500 mb-4 text-sm">No budget config yet.</p>
            <button onClick={() => updateConfig({
              id: 1, start_balance_krw: 0, start_date: today,
              daily_target_krw: 30000, monthly_fixed_krw: 0, pivot_date: null,
              activity_cats: null,
              cop_per_krw: 0.42, updated_at: new Date().toISOString(),
            })} className="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg text-sm">
              Initialize
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
