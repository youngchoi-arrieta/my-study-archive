'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { Milestone, DailyLog, BudgetConfig, Lang, Currency, t } from './types'
import MilestonesView from './components/MilestonesView'
import DailyLogView from './components/DailyLogView'
import dynamic from 'next/dynamic'

const BudgetView = dynamic(() => import('./components/BudgetView'), {
  ssr: false,
  loading: () => <div style={{ height: 200, background: '#111827', borderRadius: 12 }} />,
})

type Tab = 'summary' | 'milestones' | 'log' | 'budget'

function todayStr(): string { return new Date().toISOString().slice(0, 10) }

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((new Date(dateStr + 'T00:00:00').getTime() - today.getTime()) / 86400000)
}

function formatKRW(n: number): string {
  return Math.abs(n) >= 10000 ? (n / 10000).toFixed(0) + '만원' : n.toLocaleString('ko-KR') + '원'
}

export default function LifeOpsDashboard() {
  const [tab,        setTab]        = useState<Tab>('summary')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [logs,       setLogs]       = useState<DailyLog[]>([])
  const [config,     setConfig]     = useState<BudgetConfig | null>(null)
  const [loading,    setLoading]    = useState(true)

  // ── Global UI state ──────────────────────────────────────────────────────
  const [lang,     setLang]     = useState<Lang>('en')
  const [currency, setCurrency] = useState<Currency>('KRW')

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

  // ── Milestone handlers ───────────────────────────────────────────────────
  async function saveMilestone(patch: Partial<Milestone>, id?: string) {
    if (id) await supabase.from('milestones').update(patch).eq('id', id)
    else    await supabase.from('milestones').insert(patch)
    await fetchAll()
  }
  async function deleteMilestone(id: string) {
    await supabase.from('milestones').delete().eq('id', id)
    await fetchAll()
  }
  async function toggleDone(id: string, done: boolean) {
    await supabase.from('milestones').update({ done }).eq('id', id)
    setMilestones(prev => prev.map(m => m.id === id ? { ...m, done } : m))
  }

  // ── Daily log upsert ─────────────────────────────────────────────────────
  async function upsertToday(patch: Partial<DailyLog>) {
    const today    = todayStr()
    const existing = logs.find(l => l.log_date === today)
    if (existing) {
      const merged = {
        ...existing,
        ...patch,
        study_minutes: patch.study_minutes !== undefined ? patch.study_minutes : existing.study_minutes,
        expense_krw:   patch.expense_krw   !== undefined ? patch.expense_krw   : existing.expense_krw,
        income_krw:    patch.income_krw    !== undefined ? patch.income_krw    : (existing.income_krw || {}),
        weight_kg:     patch.weight_kg     !== undefined ? patch.weight_kg     : existing.weight_kg,
      }
      await supabase.from('daily_logs').update(merged).eq('id', existing.id)
    } else {
      await supabase.from('daily_logs').insert({
        log_date:      today,
        study_minutes: patch.study_minutes || {},
        expense_krw:   patch.expense_krw   || {},
        income_krw:    patch.income_krw    || {},
        weight_kg:     patch.weight_kg     ?? null,
        condition:     patch.condition     ?? null,
        memo:          patch.memo          ?? null,
      })
    }
    await fetchAll()
  }

  // ── Budget config update ─────────────────────────────────────────────────
  async function updateConfig(patch: Partial<BudgetConfig>) {
    if (config) {
      await supabase.from('budget_config').update(patch).eq('id', 1)
    } else {
      await supabase.from('budget_config').insert({ id: 1, ...patch })
    }
    await fetchAll()
  }

  // ── Render ───────────────────────────────────────────────────────────────
  const TABS: { key: Tab; label: string }[] = [
    { key: 'summary',    label: t('summary',    lang) },
    { key: 'milestones', label: t('milestones', lang) },
    { key: 'log',        label: t('log',        lang) },
    { key: 'budget',     label: t('budget',     lang) },
  ]

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-950 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">← Home</Link>

          {/* Lang + Currency toggles */}
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            <button
              onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}
              className="px-2.5 py-1 rounded-lg text-xs font-mono bg-gray-800 hover:bg-gray-700 transition"
              title="Toggle language"
            >
              {lang === 'en' ? '🇺🇸 EN' : '🇨🇴 ES'}
            </button>

            {/* Currency toggle */}
            <button
              onClick={() => setCurrency(c => c === 'KRW' ? 'COP' : 'KRW')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono transition ${
                currency === 'KRW'
                  ? 'bg-blue-900/60 hover:bg-blue-800/60 text-blue-200'
                  : 'bg-amber-900/60 hover:bg-amber-800/60 text-amber-200'
              }`}
              title="Toggle currency"
            >
              {currency === 'KRW' ? '₩ KRW' : '$ COP'}
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-3xl mx-auto px-4 flex gap-1 pb-0">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm rounded-t-lg transition ${
                tab === key
                  ? 'bg-gray-900 text-white font-semibold'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
          </div>
        )}

        {!loading && tab === 'summary' && config && (
          <SummaryView
            milestones={milestones}
            logs={logs}
            config={config}
            lang={lang}
            currency={currency}
            onJumpTab={setTab}
          />
        )}

        {!loading && tab === 'milestones' && (
          <MilestonesView
            milestones={milestones}
            onSave={saveMilestone}
            onDelete={deleteMilestone}
            onToggleDone={toggleDone}
          />
        )}

        {!loading && tab === 'log' && config && (
          <DailyLogView
            logs={logs}
            onUpsertToday={upsertToday}
            dailyTargetKrw={config.daily_target_krw}
            lang={lang}
            currency={currency}
          />
        )}

        {!loading && tab === 'budget' && config && (
          <BudgetView
            logs={logs}
            config={config}
            onUpdateConfig={updateConfig}
            lang={lang}
            currency={currency}
          />
        )}

        {!loading && !config && tab !== 'milestones' && (
          <div className="text-center py-20">
            <p className="text-gray-400 mb-4">
              {lang === 'en' ? 'No budget config found.' : 'Sin configuración de presupuesto.'}
            </p>
            <button
              onClick={() => updateConfig({
                id: 1,
                start_balance_krw: 0,
                start_date: todayStr(),
                daily_target_krw: 30000,
                pivot_date: null,
                updated_at: new Date().toISOString(),
              })}
              className="bg-blue-600 hover:bg-blue-500 px-5 py-2 rounded-lg"
            >
              {lang === 'en' ? 'Initialize Budget' : 'Inicializar presupuesto'}
            </button>
          </div>
        )}
      </div>
    </main>
  )
}

// ── Summary view ─────────────────────────────────────────────────────────────
function SummaryView({
  milestones, logs, config, lang, currency, onJumpTab,
}: {
  milestones: Milestone[]
  logs: DailyLog[]
  config: BudgetConfig
  lang: Lang
  currency: Currency
  onJumpTab: (t: Tab) => void
}) {
  const today    = todayStr()
  const todayLog = logs.find(l => l.log_date === today)

  const studyToday   = Object.values(todayLog?.study_minutes || {}).reduce((a, b) => a + b, 0)
  const expenseToday = Object.values(todayLog?.expense_krw   || {}).reduce((a, b) => a + b, 0)
  const incomeToday  = Object.values(todayLog?.income_krw    || {}).reduce((a, b) => a + b, 0)

  const totalExpense = logs.reduce((s, l) => s + Object.values(l.expense_krw || {}).reduce((a, b) => a + b, 0), 0)
  const totalIncome  = logs.reduce((s, l) => s + Object.values(l.income_krw  || {}).reduce((a, b) => a + b, 0), 0)
  const balance      = config.start_balance_krw - totalExpense + totalIncome

  // KRW-format for balance (no currency toggle on summary — keep simple)
  const balFmt = formatKRW(balance)

  const upcoming = [...milestones]
    .filter(m => !m.done && daysUntil(m.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)

  return (
    <div className="space-y-5">
      {/* Today snapshot */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">{t('todayStudy', lang)}</p>
          <p className="text-xl font-bold">
            {Math.floor(studyToday / 60)}h {studyToday % 60}m
          </p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">{t('todayExpense', lang)}</p>
          <p className={`text-xl font-bold ${expenseToday > config.daily_target_krw ? 'text-red-400' : 'text-green-400'}`}>
            {formatKRW(expenseToday)}
          </p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">{t('balance', lang)}</p>
          <p className="text-xl font-bold">{balFmt}</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">{t('logDays', lang)}</p>
          <p className="text-xl font-bold">{logs.length}<span className="text-sm text-gray-400 font-normal">d</span></p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onJumpTab('log')}
          className="bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/40 rounded-2xl p-4 text-left transition"
        >
          <p className="text-sm font-semibold mb-1">{t('quickLog', lang)}</p>
          <p className="text-xs text-gray-400">{t('quickLogSub', lang)}</p>
        </button>
        <button
          onClick={() => onJumpTab('budget')}
          className="bg-amber-900/30 hover:bg-amber-900/50 border border-amber-800/40 rounded-2xl p-4 text-left transition"
        >
          <p className="text-sm font-semibold mb-1">{t('viewBudget', lang)}</p>
          <p className="text-xs text-gray-400">{t('viewBudgetSub', lang)}</p>
        </button>
      </div>

      {/* Upcoming milestones */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
            {t('upcomingMilestones', lang)}
          </h3>
          <button onClick={() => onJumpTab('milestones')} className="text-xs text-gray-500 hover:text-white">
            {t('viewAll', lang)}
          </button>
        </div>
        <div className="space-y-2">
          {upcoming.length === 0 && (
            <p className="text-gray-600 text-center py-6 text-sm">{t('noMilestones', lang)}</p>
          )}
          {upcoming.map(m => {
            const d = daysUntil(m.date)
            return (
              <div key={m.id} className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-xs text-gray-500">{m.date}{m.note ? ` · ${m.note}` : ''}</p>
                </div>
                <p className={`text-2xl font-bold ${d <= 7 ? 'text-red-400' : 'text-white'}`}>
                  {d === 0 ? t('today', lang) : `D-${d}`}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
