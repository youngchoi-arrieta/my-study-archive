'use client'
import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { DailyLog, BudgetConfig, Lang, Currency, t, formatAmount } from '../types'

interface Props {
  logs: DailyLog[]
  config: BudgetConfig
  onUpdateConfig: (patch: Partial<BudgetConfig>) => Promise<void>
  lang: Lang
  currency: Currency
}

function sumKrw(e: Record<string, number>): number {
  return Object.values(e).reduce((a, b) => a + (b || 0), 0)
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000
  )
}

function todayStr(): string { return new Date().toISOString().slice(0, 10) }

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function survivalDate(balanceKrw: number, netDailyBurnKrw: number, fromDate: string): string | null {
  if (netDailyBurnKrw <= 0) return null  // infinite — income covers it
  const days = Math.floor(balanceKrw / netDailyBurnKrw)
  return addDays(fromDate, days)
}

export default function BudgetView({ logs, config, onUpdateConfig, lang, currency }: Props) {
  const today = todayStr()

  const { totalExpenseKrw, totalIncomeKrw, expenseByDate, incomeByDate } = useMemo(() => {
    let tExp = 0, tInc = 0
    const eMap = new Map<string, number>()
    const iMap = new Map<string, number>()
    logs.forEach(l => {
      const exp = sumKrw(l.expense_krw)
      const inc = sumKrw(l.income_krw || {})
      tExp += exp; tInc += inc
      eMap.set(l.log_date, exp)
      iMap.set(l.log_date, inc)
    })
    return { totalExpenseKrw: tExp, totalIncomeKrw: tInc, expenseByDate: eMap, incomeByDate: iMap }
  }, [logs])

  const daysSinceStart   = daysBetween(config.start_date, today)
  const actualBalance    = config.start_balance_krw - totalExpenseKrw + totalIncomeKrw
  const avgDailyExpense  = daysSinceStart > 0 ? totalExpenseKrw / daysSinceStart : 0
  const avgDailyIncome   = daysSinceStart > 0 ? totalIncomeKrw  / daysSinceStart : 0
  const netDailyBurn     = avgDailyExpense - avgDailyIncome   // positive = burning cash

  const daysToPivot      = config.pivot_date ? daysBetween(today, config.pivot_date) : 0
  const projectedAtPivot = actualBalance - netDailyBurn * daysToPivot

  // Pace status vs target
  const pace       = avgDailyExpense - config.daily_target_krw
  const paceStatus = pace < -5000 ? 'good' : pace > 5000 ? 'bad' : 'warn'

  // Survival scenarios
  const cuts = [0, 5000, 10000, 20000]
  const scenarios = cuts.map(cut => {
    const adjustedBurn = Math.max(0, netDailyBurn - cut)
    const date = survivalDate(actualBalance, adjustedBurn, today)
    return { cut, adjustedBurn, date }
  })

  // Weight data for mini chart
  const weightData = useMemo(() => {
    return [...logs]
      .filter(l => l.weight_kg != null)
      .sort((a, b) => a.log_date.localeCompare(b.log_date))
      .map(l => ({ date: l.log_date.slice(5), kg: l.weight_kg as number }))
  }, [logs])

  // Main balance chart
  const chartData = useMemo(() => {
    if (!config.pivot_date) return []
    const start    = config.start_date
    const end      = config.pivot_date
    const totalDays = daysBetween(start, end)
    if (totalDays <= 0) return []

    // Build cumulative actuals by date
    let cumExp = 0, cumInc = 0
    const actualBalByDate = new Map<string, number>()
    const sortedDates = [...new Set([...expenseByDate.keys(), ...incomeByDate.keys()])].sort()
    for (const d of sortedDates) {
      cumExp += expenseByDate.get(d) || 0
      cumInc += incomeByDate.get(d)  || 0
      actualBalByDate.set(d, config.start_balance_krw - cumExp + cumInc)
    }

    const step = totalDays > 90 ? 3 : 1
    const data: Array<{
      date: string
      target: number
      actual: number | null
      forecast: number | null
    }> = []

    for (let i = 0; i <= totalDays; i += step) {
      const d      = addDays(start, i)
      const target = config.start_balance_krw - config.daily_target_krw * i

      let actual: number | null   = null
      let forecast: number | null = null

      if (d <= today) {
        let last = config.start_balance_krw
        for (const [dt, v] of actualBalByDate) {
          if (dt <= d) last = v
          else break
        }
        actual = last
      } else {
        const daysAhead = daysBetween(today, d)
        forecast = actualBalance - netDailyBurn * daysAhead
      }

      data.push({ date: d.slice(5), target, actual, forecast })
    }

    // Connect forecast to last actual point
    const lastActualIdx = [...data].reverse().findIndex(p => p.actual !== null)
    if (lastActualIdx >= 0) {
      const idx = data.length - 1 - lastActualIdx
      data[idx].forecast = data[idx].actual
    }

    return data
  }, [config, expenseByDate, incomeByDate, today, actualBalance, netDailyBurn])

  const [settingsOpen, setSettingsOpen] = useState(false)

  // Currency-aware tick formatter
  const tickFmt = (v: number) => {
    if (currency === 'KRW') return (v / 10000).toFixed(0) + '만'
    return (v * 0.42 / 1000).toFixed(0) + 'k'
  }

  return (
    <div className="space-y-5">

      {/* Key stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label={t('balance', lang)}
          value={formatAmount(actualBalance, currency)}
          sub={`start: ${formatAmount(config.start_balance_krw, currency)}`}
        />
        <StatCard
          label={t('totalSpent', lang)}
          value={formatAmount(totalExpenseKrw, currency)}
          sub={`${daysSinceStart}d elapsed`}
        />
        <StatCard
          label={t('totalIncome', lang)}
          value={`+${formatAmount(totalIncomeKrw, currency)}`}
          tone="emerald"
          sub={`avg +${formatAmount(Math.round(avgDailyIncome), currency)}/day`}
        />
        <StatCard
          label={t('netBurn', lang)}
          value={formatAmount(Math.round(netDailyBurn), currency)}
          sub={`${t('targetPace', lang)}: ${formatAmount(config.daily_target_krw, currency)}`}
          tone={netDailyBurn <= config.daily_target_krw ? 'green' : 'red'}
        />
      </div>

      {/* Pace banner */}
      <div className={`rounded-2xl p-4 ${
        paceStatus === 'good' ? 'bg-green-900/20 border border-green-800/40' :
        paceStatus === 'bad'  ? 'bg-red-900/20 border border-red-800/40' :
                                'bg-amber-900/20 border border-amber-800/40'
      }`}>
        <p className="text-sm">
          {paceStatus === 'good' && (
            <>{t('good', lang)} <span className="font-bold text-green-400">{formatAmount(Math.round(-pace), currency)}</span> {t('underTarget', lang)}.</>
          )}
          {paceStatus === 'warn' && t('warn', lang)}
          {paceStatus === 'bad' && (
            <>{t('bad', lang)} <span className="font-bold text-red-400">{formatAmount(Math.round(pace), currency)}</span> {t('overTarget', lang)}.</>
          )}
        </p>
      </div>

      {/* Survival scenarios */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <h3 className="text-sm font-semibold mb-3">
          {lang === 'en' ? '🧮 Survival Scenarios' : '🧮 Escenarios de supervivencia'}
        </h3>
        <div className="space-y-2">
          {scenarios.map(({ cut, adjustedBurn, date }) => (
            <div key={cut} className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                {cut === 0
                  ? (lang === 'en' ? 'Current pace' : 'Ritmo actual')
                  : `${t('scenarioIf', lang)} ${formatAmount(cut, currency)}${t('scenarioPer', lang)}`
                }
              </span>
              <span className={`font-mono ${cut > 0 ? 'text-emerald-400' : 'text-gray-200'}`}>
                {date
                  ? `${t('scenarioSurvive', lang)} ${date}`
                  : (lang === 'en' ? '∞ (income covers burn)' : '∞ (ingresos cubren gastos)')
                }
              </span>
            </div>
          ))}
        </div>
        {config.pivot_date && (
          <p className="text-xs text-gray-600 mt-3 border-t border-gray-800 pt-2">
            Pivot {config.pivot_date} · {t('survivalAt', lang)}: {formatAmount(Math.round(projectedAtPivot), currency)}
            {' '}(D-{daysToPivot})
          </p>
        )}
      </div>

      {/* Balance trajectory chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">{t('balanceTrajectory', lang)}</h3>
            <button onClick={() => setSettingsOpen(true)} className="text-xs text-gray-400 hover:text-white">
              ⚙️ {t('settings', lang)}
            </button>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: 11 }} />
                <YAxis stroke="#6b7280" style={{ fontSize: 11 }} tickFormatter={tickFmt} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => typeof v === 'number' ? formatAmount(Math.round(v), currency) : '–'}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                <Line
                  type="monotone" dataKey="target"
                  name={lang === 'en' ? 'Target pace' : 'Meta'}
                  stroke="#6b7280" strokeDasharray="4 4" dot={false} strokeWidth={1.5}
                />
                <Line
                  type="monotone" dataKey="actual"
                  name={lang === 'en' ? 'Actual' : 'Real'}
                  stroke="#3b82f6" dot={false} strokeWidth={2} connectNulls={false}
                />
                <Line
                  type="monotone" dataKey="forecast"
                  name={lang === 'en' ? 'Forecast' : 'Proyección'}
                  stroke="#f59e0b" strokeDasharray="2 2" dot={false} strokeWidth={2} connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weight mini chart */}
      {weightData.length >= 2 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3">⚖️ {t('weight', lang)}</h3>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer>
              <LineChart data={weightData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: 10 }} />
                <YAxis
                  stroke="#6b7280" style={{ fontSize: 10 }}
                  domain={['dataMin - 1', 'dataMax + 1']}
                  tickFormatter={v => `${v}kg`}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v} kg`, '']}
                />
                <Line
                  type="monotone" dataKey="kg"
                  stroke="#a78bfa" dot={{ r: 3 }} strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!config.pivot_date && (
        <div className="bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-gray-400 text-sm mb-3">
            {lang === 'en' ? 'No pivot date set.' : 'Sin fecha pivote.'}
          </p>
          <button
            onClick={() => setSettingsOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm"
          >
            ⚙️ {t('settings', lang)}
          </button>
        </div>
      )}

      {settingsOpen && (
        <BudgetSettingsModal
          config={config}
          lang={lang}
          onSave={async (patch) => { await onUpdateConfig(patch); setSettingsOpen(false) }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function StatCard({
  label, value, sub, tone,
}: {
  label: string; value: string; sub?: string
  tone?: 'green' | 'red' | 'amber' | 'emerald'
}) {
  const toneCls =
    tone === 'green'   ? 'text-green-400'   :
    tone === 'red'     ? 'text-red-400'     :
    tone === 'amber'   ? 'text-amber-400'   :
    tone === 'emerald' ? 'text-emerald-400' :
                         'text-white'
  return (
    <div className="bg-gray-900 rounded-2xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${toneCls}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
    </div>
  )
}

function BudgetSettingsModal({
  config, lang, onSave, onClose,
}: {
  config: BudgetConfig
  lang: Lang
  onSave: (p: Partial<BudgetConfig>) => Promise<void>
  onClose: () => void
}) {
  const [startBal,   setStartBal]   = useState(String(config.start_balance_krw))
  const [startDate,  setStartDate]  = useState(config.start_date)
  const [target,     setTarget]     = useState(String(config.daily_target_krw))
  const [pivotDate,  setPivotDate]  = useState(config.pivot_date || '')

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">⚙️ {t('settings', lang)}</h2>
        <div className="space-y-3">
          {[
            { label: t('startBalance', lang), val: startBal,  set: setStartBal,  type: 'number' },
            { label: t('startDate',    lang), val: startDate, set: setStartDate, type: 'date'   },
            { label: t('dailyTarget',  lang), val: target,    set: setTarget,    type: 'number' },
            { label: t('pivotDate',    lang), val: pivotDate, set: setPivotDate, type: 'date'   },
          ].map(({ label, val, set, type }) => (
            <div key={label}>
              <label className="text-xs text-gray-500 block mb-1">{label}</label>
              <input
                type={type}
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm"
                value={val}
                onChange={e => set(e.target.value)}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg">
            {t('cancel', lang)}
          </button>
          <button
            onClick={() => onSave({
              start_balance_krw: parseInt(startBal)  || 0,
              start_date:        startDate,
              daily_target_krw:  parseInt(target)    || 0,
              pivot_date:        pivotDate || null,
            })}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg"
          >
            {t('save', lang)}
          </button>
        </div>
      </div>
    </div>
  )
}
