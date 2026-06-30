'use client'
import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts'
import { DailyLog, BudgetConfig, Lang, Currency, t, formatAmount, DEFAULT_EXPENSE_CATS, DEFAULT_INCOME_CATS } from '../types'

interface Props {
  logs: DailyLog[]
  config: BudgetConfig
  onUpdateConfig: (patch: Partial<BudgetConfig>) => Promise<void>
  lang: Lang
  currency: Currency
}

function sumKrw(e: Record<string, number>) { return Object.values(e).reduce((a, b) => a + b, 0) }
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}
function todayStr() { return new Date().toISOString().slice(0, 10) }
function addDays(d: string, n: number) {
  const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}

export default function BudgetView({ logs, config, onUpdateConfig, lang, currency }: Props) {
  const today = todayStr()
  const copPerKrw = config.cop_per_krw ?? 0.42
  const monthlyFixed = config.monthly_fixed_krw ?? 0
  const fmt = (krw: number) => formatAmount(krw, currency, copPerKrw)

  // Map each expense category key → its type (daily | fixed | invest)
  const catType = useMemo(() => {
    const cats = config.expense_cats ?? DEFAULT_EXPENSE_CATS
    const m = new Map<string, 'daily' | 'fixed' | 'invest'>()
    cats.forEach(c => m.set(c.key, c.type))
    return m
  }, [config.expense_cats])

  // Split a day's expense map into operational vs lump sums
  function splitExpense(expMap: Record<string, number>) {
    let op = 0, lump = 0
    for (const [key, amt] of Object.entries(expMap)) {
      const catKey = key.split(':')[0]
      const type = catType.get(catKey) ?? 'daily'
      if (type === 'daily') op += amt
      else lump += amt   // fixed + invest are one-off / not extrapolated
    }
    return { op, lump }
  }

  // Map each income category key → its type (recurring | oneoff)
  const incCatType = useMemo(() => {
    const cats = config.income_cats ?? DEFAULT_INCOME_CATS
    const m = new Map<string, 'recurring' | 'oneoff'>()
    cats.forEach(c => m.set(c.key, c.type ?? 'recurring'))
    return m
  }, [config.income_cats])

  // Split a day's income map into recurring (projected) vs one-off (balance only)
  function splitIncome(incMap: Record<string, number>) {
    let rec = 0, oneoff = 0
    for (const [key, amt] of Object.entries(incMap)) {
      const catKey = key.split(':')[0]
      const type = incCatType.get(catKey) ?? 'recurring'
      if (type === 'oneoff') oneoff += amt   // 생활비 지원 등 → 잔고만, 예측 제외
      else rec += amt                         // 과외 등 → 예측 기울기에 반영
    }
    return { rec, oneoff }
  }

  const { totalExp, totalOp, totalLump, totalInc, totalIncRec, totalIncOneoff, opByDate, expByDate, incByDate, loggedDates } = useMemo(() => {
    let tE = 0, tOp = 0, tLump = 0, tI = 0, tIrec = 0, tIone = 0
    const opMap = new Map<string, number>()
    const eMap = new Map<string, number>()
    const iMap = new Map<string, number>()
    const dates = new Set<string>()
    logs.forEach(l => {
      const { op, lump } = splitExpense(l.expense_krw)
      const { rec, oneoff } = splitIncome(l.income_krw || {})
      const e = op + lump
      const i = rec + oneoff           // 잔고/actual 곡선엔 전체 income 반영
      tE += e; tOp += op; tLump += lump
      tI += i; tIrec += rec; tIone += oneoff
      opMap.set(l.log_date, op)
      eMap.set(l.log_date, e)
      iMap.set(l.log_date, i)
      if (e > 0 || i > 0) dates.add(l.log_date)
    })
    const sorted = [...dates].sort()
    return { totalExp: tE, totalOp: tOp, totalLump: tLump, totalInc: tI, totalIncRec: tIrec, totalIncOneoff: tIone, opByDate: opMap, expByDate: eMap, incByDate: iMap, loggedDates: sorted }
  }, [logs, catType, incCatType])

  const elapsed      = daysBetween(config.start_date, today)
  const loggedDays   = loggedDates.length
  const firstLogged  = loggedDates[0] ?? null
  const lastLogged   = loggedDates[loggedDates.length - 1] ?? null

  const balance      = config.start_balance_krw - totalExp + totalInc

  // ── Operational burn: only daily-type expenses minus RECURRING income, over logged days ──
  // 일회성 income(생활비 지원 등)은 이미 잔고에 반영됐고, 미래로 외삽하지 않는다.
  const avgOp        = loggedDays > 0 ? totalOp / loggedDays : 0
  const avgInc       = loggedDays > 0 ? totalIncRec / loggedDays : 0
  const opBurn       = avgOp - avgInc                 // daily operational soak (recurring income만 차감)
  // ── Plus monthly fixed cost spread to a daily-equivalent for the headline ──
  const fixedPerDay  = monthlyFixed / 30
  const netBurn      = opBurn + fixedPerDay           // total effective daily burn

  const daysToPivot  = config.pivot_date ? daysBetween(today, config.pivot_date) : 0
  const pivotBalance = config.pivot_date ? balance - netBurn * daysToPivot : null

  // Survival at current pace (operational + fixed)
  const survivalDays = netBurn > 0 ? Math.floor(balance / netBurn) : null
  const survivalDate = survivalDays != null ? addDays(today, survivalDays) : null

  // Pace vs target (operational spending only)
  const pace       = avgOp - config.daily_target_krw
  const paceStatus = pace < -3000 ? 'good' : pace > 5000 ? 'bad' : 'warn'

  // Chart
  const chartData = useMemo(() => {
    if (!config.pivot_date) return []
    const start = config.start_date, end = config.pivot_date
    const total = daysBetween(start, end)
    if (total <= 0) return []

    // actual balance curve uses ALL spending (op + lump)
    let cumE = 0, cumI = 0
    const actMap = new Map<string, number>()
    const dates = [...new Set([...expByDate.keys(), ...incByDate.keys()])].sort()
    for (const d of dates) {
      cumE += expByDate.get(d) || 0; cumI += incByDate.get(d) || 0
      actMap.set(d, config.start_balance_krw - cumE + cumI)
    }

    const step = total > 90 ? 3 : 1
    const data: { date: string; target: number; actual: number | null; forecast: number | null; opForecast: number | null }[] = []

    // forecast: smooth operational burn + stepped monthly fixed on the 1st of each month
    function fixedHitsBetween(fromDate: string, toDate: string): number {
      let count = 0
      const f = new Date(fromDate + 'T00:00:00')
      const t = new Date(toDate + 'T00:00:00')
      const cur = new Date(f.getFullYear(), f.getMonth() + 1, 1)
      while (cur <= t) { count++; cur.setMonth(cur.getMonth() + 1) }
      return count
    }

    for (let i = 0; i <= total; i += step) {
      const d = addDays(start, i)
      const target = config.start_balance_krw - config.daily_target_krw * i
      let actual: number | null = null, forecast: number | null = null, opForecast: number | null = null

      if (d <= today) {
        let last = config.start_balance_krw
        for (const [dt, v] of actMap) { if (dt <= d) last = v; else break }
        actual = last
      } else {
        const aheadDays = daysBetween(today, d)
        const fixedHits = fixedHitsBetween(today, d) * monthlyFixed
        opForecast = balance - opBurn * aheadDays                  // operational only (smooth)
        forecast   = opForecast - fixedHits                        // + stepped fixed
      }
      data.push({ date: d.slice(5), target, actual, forecast, opForecast })
    }

    // Bridge actual → forecast
    const lastActIdx = [...data].reverse().findIndex(p => p.actual !== null)
    if (lastActIdx >= 0) {
      const bridge = data[data.length - 1 - lastActIdx]
      bridge.forecast = bridge.actual
      bridge.opForecast = bridge.actual
    }

    return data
  }, [config, expByDate, incByDate, today, balance, opBurn, monthlyFixed])

  // Weight chart

  const [settingsOpen, setSettingsOpen] = useState(false)
  const tickFmt = (v: number) => currency === 'KRW'
    ? (v / 10000).toFixed(0) + '만'
    : (v * copPerKrw / 1000).toFixed(0) + 'k'

  // Padded Y domain from all chart values so the slope is readable
  const yDomain = useMemo<[number, number]>(() => {
    const vals: number[] = []
    chartData.forEach(d => {
      ;[d.actual, d.forecast, d.opForecast, d.target].forEach(v => {
        if (typeof v === 'number' && !isNaN(v)) vals.push(v)
      })
    })
    if (vals.length === 0) return [0, 1]
    const min = Math.min(...vals), max = Math.max(...vals)
    const pad = Math.max((max - min) * 0.08, 1)
    return [Math.max(0, min - pad), max + pad]
  }, [chartData])

  return (
    <div className="space-y-4">

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label={t('balance', lang)} value={fmt(balance)}
          sub={`start ${fmt(config.start_balance_krw)}`} tone="neutral" />
        <StatCard label="Daily burn (effective)" value={`${fmt(Math.round(netBurn))}/d`}
          sub={`op ${fmt(Math.round(opBurn))} + fixed ${fmt(Math.round(fixedPerDay))}`}
          tone={netBurn <= config.daily_target_krw ? 'green' : 'red'} />
        <StatCard label="☕ Operational" value={`${fmt(Math.round(avgOp))}/d`}
          sub={`total ${fmt(totalOp)} · avg of ${loggedDays}d`} tone="neutral" />
        <StatCard label="🏠 Fixed /day" value={`${fmt(Math.round(fixedPerDay))}/d`}
          sub={`monthly ${monthlyFixed > 0 ? fmt(monthlyFixed) : 'not set'} · one-off ${fmt(totalLump)}`} tone="amber" />
      </div>

      {/* Calculation basis — transparency */}
      <div className="bg-gray-900/60 rounded-xl px-4 py-2.5 text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
        <span>📅 Start: <span className="text-gray-300">{config.start_date}</span></span>
        <span>🧮 Based on <span className="text-gray-300">{loggedDays}</span> logged day{loggedDays !== 1 ? 's' : ''}</span>
        {firstLogged && lastLogged && (
          <span>Range: <span className="text-gray-300">{firstLogged === lastLogged ? firstLogged : `${firstLogged} ~ ${lastLogged}`}</span></span>
        )}
        <span>💰 Income: <span className="text-emerald-400">+{fmt(totalInc)}</span>
          {totalIncOneoff > 0 && (
            <span className="text-gray-600"> (recurring {fmt(totalIncRec)} · one-off {fmt(totalIncOneoff)})</span>
          )}
        </span>
        <span>🏠 Monthly fixed est: <span className="text-gray-300">{monthlyFixed > 0 ? fmt(monthlyFixed) : 'not set'}</span></span>
        <span className="text-gray-600">({elapsed} calendar days since start)</span>
      </div>

      <div className="bg-gray-900/40 rounded-xl px-4 py-2 text-xs text-gray-500 leading-relaxed">
        ℹ️ Forecast = current balance − <span className="text-gray-300">operational burn</span> (smooth daily, from <span className="text-gray-300">daily</span>-type tags only) − <span className="text-gray-300">monthly fixed</span> (stepped on the 1st), + <span className="text-emerald-400">recurring</span> income. One-off <span className="text-amber-400">fixed/invest</span> spending and <span className="text-emerald-400">one-off income</span> (생활비 지원 등) already moved your balance and are not projected forward.
      </div>

      {loggedDays < 3 && (
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-2.5 text-xs text-amber-300">
          ⚠️ Only {loggedDays} day{loggedDays !== 1 ? 's' : ''} logged — projection needs a few more days of data to be meaningful.
        </div>
      )}

      {/* Pace + survival */}
      <div className={`rounded-2xl p-4 text-sm ${
        paceStatus === 'good' ? 'bg-green-900/20 border border-green-800/40' :
        paceStatus === 'bad'  ? 'bg-red-900/20 border border-red-800/40' :
                                'bg-amber-900/20 border border-amber-800/40'}`}>
        <div className="flex items-center justify-between">
          <span>
            {paceStatus === 'good' && `✅ Operational ${fmt(Math.round(-pace))} under target/day`}
            {paceStatus === 'warn' && '⚖️ Operational spending close to target'}
            {paceStatus === 'bad'  && `⚠️ Operational ${fmt(Math.round(pace))} over target/day`}
          </span>
          {survivalDate && (
            <span className="text-gray-400 text-xs">
              survives until <span className="text-white font-mono">{survivalDate}</span>
            </span>
          )}
          {!survivalDate && <span className="text-emerald-400 text-xs">∞ income covers burn</span>}
        </div>
        {pivotBalance != null && (
          <p className="text-xs text-gray-500 mt-1">
            Pivot {config.pivot_date} (D-{daysToPivot}) → {fmt(Math.round(pivotBalance))}
          </p>
        )}
      </div>

      {/* Trajectory chart */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Balance Trajectory</h3>
            <button onClick={() => setSettingsOpen(true)} className="text-xs text-gray-500 hover:text-white">
              ⚙️ {t('settings', lang)}
            </button>
          </div>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" style={{ fontSize: 10 }} tickFormatter={tickFmt}
                  domain={yDomain} allowDataOverflow={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => typeof v === 'number' ? fmt(Math.round(v)) : '–'} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="target" name="Target"
                  stroke="#6b7280" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="actual" name="Actual"
                  stroke="#3b82f6" dot={false} strokeWidth={2} connectNulls={false} />
                <Line type="monotone" dataKey="opForecast" name="Op only"
                  stroke="#10b981" strokeDasharray="1 3" dot={false} strokeWidth={1.5} connectNulls={false} />
                <Line type="monotone" dataKey="forecast" name="+ Fixed"
                  stroke="#f59e0b" strokeDasharray="2 2" dot={false} strokeWidth={2} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* No pivot set */}
      {!config.pivot_date && (
        <div className="bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-gray-500 text-sm mb-3">No pivot date set.</p>
          <button onClick={() => setSettingsOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm">
            ⚙️ {t('settings', lang)}
          </button>
        </div>
      )}

      {/* Settings button if chart visible */}
      {chartData.length > 0 && (
        <button onClick={() => setSettingsOpen(true)}
          className="w-full text-xs text-gray-600 hover:text-gray-400 py-1 transition">
          ⚙️ {t('settings', lang)} (balance · target · pivot · exchange rate)
        </button>
      )}


      {settingsOpen && (
        <SettingsModal config={config} lang={lang} copPerKrw={copPerKrw}
          currentBalance={balance}
          onSave={async p => { await onUpdateConfig(p); setSettingsOpen(false) }}
          onClose={() => setSettingsOpen(false)} />
      )}

    </div>
  )
}

// ── StatCard ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, tone }: {
  label: string; value: string; sub?: string
  tone: 'neutral' | 'green' | 'red' | 'emerald' | 'amber'
}) {
  const cls = tone === 'green' ? 'text-green-400' : tone === 'red' ? 'text-red-400'
    : tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : 'text-white'
  return (
    <div className="bg-gray-900 rounded-2xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${cls}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Settings modal ────────────────────────────────────────────────────────────
function SettingsModal({ config, lang, copPerKrw, currentBalance, onSave, onClose }: {
  config: BudgetConfig; lang: Lang; copPerKrw: number
  currentBalance: number
  onSave: (p: Partial<BudgetConfig>) => Promise<void>
  onClose: () => void
}) {
  const [startDate, setStartDate] = useState(config.start_date)
  const [target,    setTarget]    = useState(String(config.daily_target_krw))
  const [monthlyFx, setMonthlyFx] = useState(String(config.monthly_fixed_krw ?? 0))
  const [pivot,     setPivot]     = useState(config.pivot_date || '')
  const [cop,       setCop]       = useState(String(copPerKrw))
  // Balance adjustment — operates on the *current* balance, not the start baseline.
  const [adjMode,   setAdjMode]   = useState<'set' | 'add' | 'sub'>('set')
  const [adjAmt,    setAdjAmt]    = useState('')

  // netSpent = (총지출 − 총수입). currentBalance = start − netSpent 이므로 역산 가능.
  // 이 값을 보존해야 "현재 잔고 = 입력값"이 되도록 start를 다시 잡을 수 있다.
  const netSpent = config.start_balance_krw - currentBalance

  // 입력한 조정을 적용한 "새 현재 잔고"
  function computeNewCurrent(): number {
    const adj = parseInt(adjAmt) || 0
    if (adjMode === 'add') return currentBalance + adj
    if (adjMode === 'sub') return currentBalance - adj
    return parseInt(adjAmt) || currentBalance   // 'set' → 입력값이 곧 현재 잔고
  }

  // 그 현재 잔고가 나오도록 거꾸로 계산한 start_balance
  function computeNewStart(): number {
    return computeNewCurrent() + netSpent
  }

  async function handleSave() {
    const newStart = adjAmt ? computeNewStart() : config.start_balance_krw
    await onSave({
      start_balance_krw: newStart,
      start_date:        startDate,
      daily_target_krw:  parseInt(target) || 0,
      monthly_fixed_krw: parseInt(monthlyFx) || 0,
      pivot_date:        pivot || null,
      cop_per_krw:       parseFloat(cop) || 0.42,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
        <h2 className="text-base font-bold">⚙️ {t('settings', lang)}</h2>

        {/* Balance section — operates on CURRENT balance (what the Balance card shows) */}
        <div className="bg-gray-800 rounded-xl p-4 space-y-3">
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-widest">Current balance (KRW)</p>
          <p className="text-2xl font-bold">
            {(adjAmt ? computeNewCurrent() : currentBalance).toLocaleString('ko-KR')}원
          </p>
          <p className="text-[11px] text-gray-500 leading-relaxed">
            여기 입력한 값이 <span className="text-gray-300">Balance 카드에 그대로</span> 표시됩니다.
            지출이 다시 차감되지 않아요. 토스 실제 잔고를 그대로 적으면 됩니다.
          </p>

          {/* Adjustment mode */}
          <div className="flex gap-2">
            {(['set','add','sub'] as const).map(m => (
              <button key={m} onClick={() => { setAdjMode(m); setAdjAmt('') }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                  adjMode === m ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}>
                {m === 'set' ? 'Set' : m === 'add' ? '+ Add' : '− Subtract'}
              </button>
            ))}
          </div>
          <input type="number" inputMode="numeric"
            className="w-full bg-gray-700 rounded-lg px-3 py-2 text-sm"
            placeholder={adjMode === 'set' ? '토스 현재 잔고' : 'Amount to adjust'}
            value={adjAmt} onChange={e => setAdjAmt(e.target.value)} />
          {adjAmt && (
            <div className="text-xs text-gray-400 space-y-0.5">
              <p>현재 잔고 → <span className="text-white font-mono">{computeNewCurrent().toLocaleString('ko-KR')}원</span></p>
              <p className="text-gray-600">
                내부 시작 잔고(start) → <span className="font-mono">{computeNewStart().toLocaleString('ko-KR')}원</span>
                <span className="ml-1">(지출 {netSpent.toLocaleString('ko-KR')}원 자동 보정)</span>
              </p>
            </div>
          )}
        </div>

        {/* Other fields */}
        {[
          { label: 'Start date',           val: startDate, set: setStartDate, type: 'date'   },
          { label: 'Daily target (KRW)',    val: target,    set: setTarget,    type: 'number' },
          { label: '🏠 Monthly fixed cost est. (rent+insurance, KRW)', val: monthlyFx, set: setMonthlyFx, type: 'number' },
          { label: 'Pivot date',            val: pivot,     set: setPivot,     type: 'date'   },
          { label: '1 KRW = ? COP (rate)', val: cop,       set: setCop,       type: 'number' },
        ].map(({ label, val, set, type }) => (
          <div key={label}>
            <label className="text-xs text-gray-500 block mb-1">{label}</label>
            <input type={type} step={type === 'number' && label.includes('COP') ? '0.001' : '1'}
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm"
              value={val} onChange={e => set(e.target.value)} />
          </div>
        ))}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg">
            {t('cancel', lang)}
          </button>
          <button onClick={handleSave} className="flex-1 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold">
            {t('save', lang)}
          </button>
        </div>
      </div>
    </div>
  )
}
