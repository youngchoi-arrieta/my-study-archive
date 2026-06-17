'use client'
import { useState, useMemo, useEffect } from 'react'
import {
  DailyLog, BudgetConfig, ExpenseCat, IncomeCat,
  DEFAULT_EXPENSE_CATS, DEFAULT_INCOME_CATS, DEFAULT_ACTIVITY_CATS,
  ActivityEntry, ActivityCat,
  Lang, Currency, t, formatAmount, parseToKrw, currentStreak,
  DEFAULT_STUDY_BLOCKS,
} from '../types'
import { quoteOfDay, promptOfDay } from '../quotes'
import StudyBlocksView from './StudyBlocksView'

interface Props {
  logs: DailyLog[]
  config: BudgetConfig
  onUpsertToday: (patch: Partial<DailyLog>) => Promise<void>
  onUpdateConfig: (patch: Partial<BudgetConfig>) => Promise<void>
  onUpdateLog: (id: string, patch: Partial<DailyLog>) => Promise<void>
  onDeleteLog: (id: string) => Promise<void>
  lang: Lang
  currency: Currency
  copPerKrw: number
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function sumKrw(e: Record<string, number>) { return Object.values(e).reduce((a, b) => a + b, 0) }

export default function DailyLogView({ logs, config, onUpsertToday, onUpdateConfig, onUpdateLog, onDeleteLog, lang, currency, copPerKrw }: Props) {
  const [today, setToday] = useState(todayStr())

  // 자정에 today 갱신
  useEffect(() => {
    function msUntilMidnight() {
      const now = new Date()
      const midnight = new Date(now)
      midnight.setHours(24, 0, 0, 0)
      return midnight.getTime() - now.getTime()
    }
    const timeout = setTimeout(() => {
      setToday(todayStr())
    }, msUntilMidnight() + 500)
    return () => clearTimeout(timeout)
  }, [today])  // today가 바뀔 때마다 다음 자정 타이머 재설정
  const todayLog = useMemo(() => logs.find(l => l.log_date === today) || null, [logs, today])
  const recent   = useMemo(() => [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, 14), [logs])
  const fmt = (krw: number) => formatAmount(krw, currency, copPerKrw)

  const expenseCats  = config.expense_cats  ?? DEFAULT_EXPENSE_CATS
  const incomeCats   = config.income_cats   ?? DEFAULT_INCOME_CATS
  const activityCats = config.activity_cats ?? DEFAULT_ACTIVITY_CATS

  const actStreak = currentStreak(logs, 'activity')
  const lisStreak = currentStreak(logs, 'listening')

  const [balanceOpen, setBalanceOpen] = useState(false)

  return (
    <div className="space-y-4">
      {/* Balance quick-edit strip */}
      <button onClick={() => setBalanceOpen(true)}
        className="w-full bg-gray-900 hover:bg-gray-800 rounded-2xl px-4 py-3 flex items-center justify-between transition group">
        <span className="text-xs text-gray-500 group-hover:text-gray-400">Balance</span>
        <span className="text-xl font-bold">{fmt(config.start_balance_krw - logs.reduce((s,l)=>s+sumKrw(l.expense_krw),0) + logs.reduce((s,l)=>s+sumKrw(l.income_krw||{}),0))}</span>
        <span className="text-xs text-gray-600 group-hover:text-gray-400">tap to adjust ✏️</span>
      </button>

      {/* Habit streaks */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-2xl px-4 py-3 ${actStreak > 0 ? 'bg-orange-950/30 border border-orange-900/40' : 'bg-gray-900'}`}>
          <p className="text-xs text-gray-500">🏃 {lang === 'en' ? 'Activity streak' : 'Racha actividad'}</p>
          <p className="text-2xl font-bold">{actStreak > 0 ? `🔥 ${actStreak}` : '–'}<span className="text-sm text-gray-500 font-normal">{actStreak > 0 ? (lang==='en'?' days':' días') : ''}</span></p>
        </div>
        <div className={`rounded-2xl px-4 py-3 ${lisStreak > 0 ? 'bg-blue-950/30 border border-blue-900/40' : 'bg-gray-900'}`}>
          <p className="text-xs text-gray-500">🎧 {lang === 'en' ? 'Listening streak' : 'Racha escucha'}</p>
          <p className="text-2xl font-bold">{lisStreak > 0 ? `🔥 ${lisStreak}` : '–'}<span className="text-sm text-gray-500 font-normal">{lisStreak > 0 ? (lang==='en'?' days':' días') : ''}</span></p>
        </div>
      </div>

      {/* Daily fixed study blocks */}
      <StudyBlocksView
        logs={logs} todayLog={todayLog}
        blocks={config.study_blocks_cfg ?? DEFAULT_STUDY_BLOCKS}
        onUpsertToday={onUpsertToday} onUpdateConfig={onUpdateConfig}
        lang={lang}
      />

      {/* Quote of the day */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-900/40 rounded-2xl px-5 py-4 border border-gray-800/50">
        <p className="text-sm text-gray-200 italic leading-relaxed">
          "{quoteOfDay(today)[lang]}"
        </p>
        <p className="text-xs text-gray-500 mt-2">— {quoteOfDay(today).who}</p>
      </div>

      <TodayCard
        log={todayLog} expenseCats={expenseCats} incomeCats={incomeCats} activityCats={activityCats}
        onUpsert={onUpsertToday} onUpdateConfig={onUpdateConfig}
        dailyTargetKrw={config.daily_target_krw}
        lang={lang} currency={currency} copPerKrw={copPerKrw} fmt={fmt}
      />
      <HistoryTable logs={recent} dailyTargetKrw={config.daily_target_krw}
        fmt={fmt} lang={lang} expenseCats={expenseCats} incomeCats={incomeCats} activityCats={activityCats}
        onUpdateLog={onUpdateLog} onDeleteLog={onDeleteLog} />

      {balanceOpen && (
        <BalanceModal
          config={config}
          onSave={async (patch) => { await onUpdateConfig(patch); setBalanceOpen(false) }}
          onClose={() => setBalanceOpen(false)}
        />
      )}
    </div>
  )
}

// ── Balance modal ─────────────────────────────────────────────────────────────
function BalanceModal({ config, onSave, onClose }: {
  config: BudgetConfig
  onSave: (p: Partial<BudgetConfig>) => Promise<void>
  onClose: () => void
}) {
  const [mode, setMode] = useState<'set'|'add'|'sub'>('set')
  const [amt,  setAmt]  = useState('')
  const [cop,  setCop]  = useState(String(config.cop_per_krw ?? 0.42))

  const current = config.start_balance_krw
  const parsed  = parseInt(amt.replace(/,/g, '')) || 0
  const result  = mode === 'set' ? parsed : mode === 'add' ? current + parsed : current - parsed

  const copRate = parseFloat(cop) || 0.42

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-bold">✏️ Adjust Balance</h2>
          <span className="text-xs text-gray-500">current: {current.toLocaleString('ko-KR')}원</span>
        </div>

        <div className="flex gap-2">
          {(['set','add','sub'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); setAmt('') }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition ${
                mode === m ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
              {m === 'set' ? 'Set new' : m === 'add' ? '＋ Add' : '－ Subtract'}
            </button>
          ))}
        </div>

        <input autoFocus type="number" inputMode="numeric"
          className="w-full bg-gray-800 rounded-xl px-4 py-3 text-lg font-mono"
          placeholder="금액 (원)"
          value={amt} onChange={e => setAmt(e.target.value)} />

        {amt && (
          <p className="text-sm text-center">
            → <span className="text-xl font-bold text-blue-400">{result.toLocaleString('ko-KR')}원</span>
          </p>
        )}

        {/* Exchange rate */}
        <div className="border-t border-gray-800 pt-3">
          <label className="text-xs text-gray-500 block mb-1.5">💱 Exchange rate (1 KRW = ? COP)</label>
          <div className="flex items-center gap-2">
            <input type="number" inputMode="decimal" step="0.001"
              className="bg-gray-800 rounded-lg px-3 py-2 text-sm font-mono w-32"
              value={cop} onChange={e => setCop(e.target.value)} />
            <span className="text-xs text-gray-600">
              1만원 ≈ {Math.round(10000 * copRate).toLocaleString('es-CO')} COP
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg bg-gray-800 text-sm">Cancel</button>
          <button
            onClick={() => onSave({
              start_balance_krw: amt ? result : current,
              cop_per_krw: copRate,
            })}
            className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Today card ────────────────────────────────────────────────────────────────
function TodayCard({ log, expenseCats, incomeCats, activityCats, onUpsert, onUpdateConfig, dailyTargetKrw, lang, currency, copPerKrw, fmt }: {
  log: DailyLog | null
  expenseCats: ExpenseCat[]
  incomeCats: IncomeCat[]
  activityCats: ActivityCat[]
  onUpsert: (p: Partial<DailyLog>) => Promise<void>
  onUpdateConfig: (p: Partial<BudgetConfig>) => Promise<void>
  dailyTargetKrw: number
  lang: Lang; currency: Currency; copPerKrw: number
  fmt: (n: number) => string
}) {
  const today   = todayStr()
  const expense = log?.expense_krw || {}
  const income  = log?.income_krw  || {}

  const [activeCat,   setActiveCat]   = useState<string | null>(null)
  const [activeInc,   setActiveInc]   = useState<string | null>(null)
  const [amtInput,    setAmtInput]    = useState('')
  const [noteInput,   setNoteInput]   = useState('')
  const [incAmtInput, setIncAmtInput] = useState('')
  const [weightInput, setWeightInput] = useState(log?.weight_kg != null ? String(log.weight_kg) : '')
  const [condition,   setCondition]   = useState(log?.condition ?? 3)
  const [memo,        setMemo]        = useState(log?.memo ?? '')
  const [reflection,  setReflection]  = useState(log?.reflection ?? '')
  const [activities,  setActivities]  = useState<ActivityEntry[]>(log?.activities ?? [])
  const [lisMin,      setLisMin]      = useState(log?.listening_min != null ? String(log.listening_min) : '')
  const [lisContent,  setLisContent]  = useState(log?.listening_content ?? '')
  const [actMinInput, setActMinInput] = useState<Record<string, string>>({})
  const [saving,      setSaving]      = useState(false)
  const [editCats,    setEditCats]    = useState(false)

  useEffect(() => {
    if (log) {
      setCondition(log.condition ?? 3)
      setMemo(log.memo ?? '')
      setReflection(log.reflection ?? '')
      setActivities(log.activities ?? [])
      setLisMin(log.listening_min != null ? String(log.listening_min) : '')
      setLisContent(log.listening_content ?? '')
      setWeightInput(log.weight_kg != null ? String(log.weight_kg) : '')
    }
  }, [log?.id])

  const totalExp   = sumKrw(expense)
  const totalInc   = sumKrw(income)
  const overBudget = totalExp > dailyTargetKrw
  const placeholder = currency === 'KRW' ? '원' : 'COP'

  async function commitExpense() {
    if (!activeCat) return
    const krw = parseToKrw(amtInput, currency, copPerKrw)
    if (!krw) return
    setSaving(true)
    const key = noteInput.trim() ? `${activeCat}:${noteInput.trim()}` : activeCat
    await onUpsert({ expense_krw: { ...expense, [key]: (expense[key] || 0) + krw } })
    setAmtInput(''); setNoteInput(''); setActiveCat(null); setSaving(false)
  }

  async function commitIncome() {
    if (!activeInc) return
    const krw = parseToKrw(incAmtInput, currency, copPerKrw)
    if (!krw) return
    setSaving(true)
    await onUpsert({ income_krw: { ...income, [activeInc]: (income[activeInc] || 0) + krw } })
    setIncAmtInput(''); setActiveInc(null); setSaving(false)
  }

  async function saveMeta() {
    const w = parseFloat(weightInput)
    const lm = parseInt(lisMin)
    await onUpsert({
      condition,
      memo: memo.trim() || null,
      reflection: reflection.trim() || null,
      weight_kg: isNaN(w) ? null : w,
      listening_min: isNaN(lm) ? null : lm,
      listening_content: lisContent.trim() || null,
    })
  }

  async function toggleActivity(catKey: string) {
    const exists = activities.find(a => a.type === catKey)
    let next: ActivityEntry[]
    if (exists) {
      next = activities.filter(a => a.type !== catKey)
    } else {
      const min = parseInt(actMinInput[catKey] || '') || 0
      next = [...activities, { type: catKey, minutes: min }]
    }
    setActivities(next)
    await onUpsert({ activities: next.length ? next : null })
  }

  async function setActivityMinutes(catKey: string, minutes: number) {
    const next = activities.map(a => a.type === catKey ? { ...a, minutes } : a)
    setActivities(next)
    await onUpsert({ activities: next })
  }

  const actLabel = (key: string) => activityCats.find(c => c.key === key)?.[lang] ?? key

  const typeColor = (type: string) =>
    type === 'fixed'  ? 'border-purple-700 text-purple-300 bg-purple-900/20' :
    type === 'invest' ? 'border-blue-700 text-blue-300 bg-blue-900/20' :
                        'border-gray-700 text-gray-300 bg-gray-800/60'

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">Today <span className="text-gray-500 text-sm font-normal">{today}</span></h3>
        <div className="flex gap-3 text-sm">
          <span className={overBudget ? 'text-red-400' : 'text-green-400'}>{fmt(totalExp)}</span>
          {totalInc > 0 && <span className="text-emerald-400">+{fmt(totalInc)}</span>}
        </div>
      </div>

      {/* ── EXPENSE ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-gray-500 uppercase tracking-widest">💸 {t('expense', lang)}</p>
          <button onClick={() => setEditCats(v => !v)}
            className="text-xs text-gray-600 hover:text-gray-400 transition">
            {editCats ? '✓ done' : '✏️ edit tags'}
          </button>
        </div>

        {/* Entered today — compact summary, no per-note chips */}
        {Object.keys(expense).length > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            {Object.keys(expense).length} item{Object.keys(expense).length > 1 ? 's' : ''} logged today · <span className="text-gray-300">{fmt(sumKrw(expense))}</span>
            <span className="text-gray-600"> · edit in history below</span>
          </p>
        )}

        {/* Category tags (edit mode or normal) */}
        {editCats
          ? <CatEditor
              cats={expenseCats} kind="expense" lang={lang}
              onSave={cats => onUpdateConfig({ expense_cats: cats })}
            />
          : (
            <div className="flex flex-wrap gap-2 mb-3">
              {expenseCats.map(c => (
                <button key={c.key}
                  onClick={() => { setActiveCat(activeCat === c.key ? null : c.key); setAmtInput(''); setNoteInput('') }}
                  className={`text-sm px-3 py-1.5 rounded-full border transition ${typeColor(c.type)}
                    ${activeCat === c.key ? 'ring-2 ring-white/30 brightness-125' : 'hover:brightness-125'}`}>
                  {c[lang]}
                </button>
              ))}
            </div>
          )
        }

        {activeCat && !editCats && (
          <div className="bg-gray-800 rounded-xl p-3 space-y-2">
            <div className="flex gap-2">
              <input autoFocus type="text" inputMode="numeric"
                className="bg-gray-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
                placeholder={placeholder} value={amtInput}
                onChange={e => setAmtInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && commitExpense()} />
              <button onClick={commitExpense} disabled={saving}
                className="bg-white text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50">
                Add
              </button>
            </div>
            <input type="text" className="bg-gray-700 rounded-lg px-3 py-2 text-xs w-full"
              placeholder="Note (optional)" value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitExpense()} />
          </div>
        )}
      </div>

      {/* ── INCOME ── */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">💰 {t('income', lang)}</p>

        {Object.keys(income).length > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            {Object.keys(income).length} item{Object.keys(income).length > 1 ? 's' : ''} · <span className="text-emerald-400">+{fmt(sumKrw(income))}</span>
            <span className="text-gray-600"> · edit in history below</span>
          </p>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          {incomeCats.map(c => (
            <button key={c.key}
              onClick={() => { setActiveInc(activeInc === c.key ? null : c.key); setIncAmtInput('') }}
              className={`text-sm px-3 py-1.5 rounded-full border transition
                border-emerald-700 text-emerald-300 bg-emerald-900/20 hover:brightness-125
                ${activeInc === c.key ? 'ring-2 ring-white/30 brightness-125' : ''}`}>
              {c[lang]}
            </button>
          ))}
          <IncCatEditorInline incomeCats={incomeCats} lang={lang}
            onSave={cats => onUpdateConfig({ income_cats: cats })} />
        </div>

        {activeInc && (
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="flex gap-2">
              <input autoFocus type="text" inputMode="numeric"
                className="bg-gray-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
                placeholder={placeholder} value={incAmtInput}
                onChange={e => setIncAmtInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && commitIncome()} />
              <button onClick={commitIncome} disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-4 py-2 rounded-lg text-sm disabled:opacity-50">
                Add
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── 신체활동 (required daily habit) ── */}
      <div className="border-t border-gray-800 pt-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
          🏃 {lang === 'en' ? 'Physical activity' : 'Actividad física'}
          {activities.length === 0 && <span className="text-red-400 ml-2">• {lang === 'en' ? 'not done yet' : 'pendiente'}</span>}
        </p>
        <div className="flex flex-wrap gap-2">
          {activityCats.map(c => {
            const active = activities.find(a => a.type === c.key)
            return (
              <div key={c.key} className="flex items-center">
                <button onClick={() => toggleActivity(c.key)}
                  className={`text-sm px-3 py-1.5 rounded-full border transition ${
                    active ? 'border-orange-600 text-orange-200 bg-orange-900/30 ring-1 ring-orange-700/50'
                           : 'border-gray-700 text-gray-400 bg-gray-800/60 hover:brightness-125'}`}>
                  {active ? '✓ ' : ''}{c[lang]}
                </button>
                {active && (
                  <input type="number" inputMode="numeric"
                    className="bg-gray-800 rounded-lg px-2 py-1 text-xs w-14 ml-1"
                    placeholder="min" value={active.minutes || ''}
                    onChange={e => setActivityMinutes(c.key, parseInt(e.target.value) || 0)} />
                )}
              </div>
            )
          })}
          <ActivityCatEditor cats={activityCats} lang={lang}
            onSave={cats => onUpdateConfig({ activity_cats: cats })} />
        </div>
      </div>

      {/* ── 일본어 청해 (required daily habit) ── */}
      <div className="border-t border-gray-800 pt-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
          🎧 {lang === 'en' ? 'JP Listening' : 'Escucha JP'}
          {!(parseInt(lisMin) > 0) && <span className="text-red-400 ml-2">• {lang === 'en' ? 'not done yet' : 'pendiente'}</span>}
        </p>
        <div className="flex gap-2">
          <input type="number" inputMode="numeric"
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm w-20"
            placeholder="min" value={lisMin}
            onChange={e => setLisMin(e.target.value)} onBlur={saveMeta} />
          <input type="text"
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
            placeholder={lang === 'en' ? 'content (e.g. シャドテン, anime…)' : 'contenido…'}
            value={lisContent} onChange={e => setLisContent(e.target.value)} onBlur={saveMeta} />
        </div>
      </div>

      {/* ── META ── */}
      <div className="border-t border-gray-800 pt-4 space-y-3">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-20">⚖️ {t('weight', lang)}</span>
          <input type="number" inputMode="decimal" step="0.1"
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm w-24"
            placeholder="kg" value={weightInput}
            onChange={e => setWeightInput(e.target.value)} onBlur={saveMeta} />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-20">🌡️ {t('condition', lang)}</span>
          <div className="flex gap-1.5">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => { setCondition(n); onUpsert({ condition: n }) }}
                className={`w-8 h-8 rounded-lg text-sm transition
                  ${condition === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
        <textarea className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm resize-none"
          rows={2} placeholder={t('memoPlaceholder', lang)}
          value={memo} onChange={e => setMemo(e.target.value)} onBlur={saveMeta} />

        {/* Reflection prompt of the day */}
        <div className="bg-gray-950/60 rounded-lg p-3 space-y-2 border border-gray-800/60">
          <p className="text-xs text-purple-300/80 italic">
            🪞 {promptOfDay(today)[lang]}
          </p>
          <textarea className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm resize-none"
            rows={2}
            placeholder={lang === 'en' ? 'A line of reflection…' : 'Una línea de reflexión…'}
            value={reflection} onChange={e => setReflection(e.target.value)} onBlur={saveMeta} />
        </div>

        <p className="text-xs text-gray-600">* auto-saved on blur</p>
      </div>
    </div>
  )
}

// ── Expense category editor ───────────────────────────────────────────────────
function CatEditor({ cats, kind, lang, onSave }: {
  cats: ExpenseCat[]
  kind: 'expense'
  lang: Lang
  onSave: (cats: ExpenseCat[]) => Promise<void>
}) {
  const [list, setList] = useState<ExpenseCat[]>(cats)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType]   = useState<'daily'|'fixed'|'invest'>('daily')
  const [saving, setSaving]     = useState(false)

  function addCat() {
    const label = newLabel.trim()
    if (!label) return
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now()
    setList(prev => [...prev, { key, en: label, es: label, type: newType }])
    setNewLabel('')
  }

  function removeCat(key: string) {
    setList(prev => prev.filter(c => c.key !== key))
  }

  async function save() {
    setSaving(true); await onSave(list); setSaving(false)
  }

  const typeColor = (type: string) =>
    type === 'fixed'  ? 'bg-purple-900/40 text-purple-300' :
    type === 'invest' ? 'bg-blue-900/40 text-blue-300'     :
                        'bg-gray-800 text-gray-300'

  return (
    <div className="bg-gray-800 rounded-xl p-3 space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {list.map(c => (
          <span key={c.key} className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${typeColor(c.type)}`}>
            {c[lang]}
            <button onClick={() => removeCat(c.key)} className="text-gray-500 hover:text-red-400 ml-0.5">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" className="bg-gray-700 rounded-lg px-3 py-1.5 text-sm flex-1"
          placeholder="New tag name" value={newLabel}
          onChange={e => setNewLabel(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCat()} />
        <select className="bg-gray-700 rounded-lg px-2 py-1.5 text-xs"
          value={newType} onChange={e => setNewType(e.target.value as 'daily'|'fixed'|'invest')}>
          <option value="daily">daily</option>
          <option value="fixed">fixed</option>
          <option value="invest">invest</option>
        </select>
        <button onClick={addCat} className="bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded-lg text-sm">＋</button>
      </div>
      <button onClick={save} disabled={saving}
        className="w-full bg-blue-600 hover:bg-blue-500 py-1.5 rounded-lg text-sm font-semibold disabled:opacity-50">
        {saving ? 'Saving…' : 'Save tags'}
      </button>
    </div>
  )
}

// ── Income tag inline editor (small ✏️ button) ─────────────────────────────────
function IncCatEditorInline({ incomeCats, lang, onSave }: {
  incomeCats: IncomeCat[]; lang: Lang; onSave: (cats: IncomeCat[]) => Promise<void>
}) {
  const [open, setOpen]     = useState(false)
  const [list, setList]     = useState<IncomeCat[]>(incomeCats)
  const [newLabel, setNew]  = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1.5 rounded-full border border-gray-700 transition">
      ✏️
    </button>
  )

  function addCat() {
    const label = newLabel.trim(); if (!label) return
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now()
    setList(prev => [...prev, { key, en: label, es: label }]); setNew('')
  }

  async function save() {
    setSaving(true); await onSave(list); setSaving(false); setOpen(false)
  }

  return (
    <div className="w-full bg-gray-800 rounded-xl p-3 space-y-2 mt-1">
      <div className="flex flex-wrap gap-1.5">
        {list.map(c => (
          <span key={c.key} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-emerald-900/30 text-emerald-300">
            {c[lang]}
            <button onClick={() => setList(prev => prev.filter(x => x.key !== c.key))}
              className="text-gray-500 hover:text-red-400">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" className="bg-gray-700 rounded-lg px-3 py-1.5 text-sm flex-1"
          placeholder="New tag" value={newLabel}
          onChange={e => setNew(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCat()} />
        <button onClick={addCat} className="bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded-lg text-sm">＋</button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 bg-gray-700 py-1.5 rounded-lg text-xs">Cancel</button>
        <button onClick={save} disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-500 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50">
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── Activity category editor (inline ✏️) ──────────────────────────────────────
function ActivityCatEditor({ cats, lang, onSave }: {
  cats: ActivityCat[]; lang: Lang; onSave: (cats: ActivityCat[]) => Promise<void>
}) {
  const [open, setOpen]     = useState(false)
  const [list, setList]     = useState<ActivityCat[]>(cats)
  const [newLabel, setNew]  = useState('')
  const [saving, setSaving] = useState(false)

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1.5 rounded-full border border-gray-700 transition">
      ✏️
    </button>
  )

  function addCat() {
    const label = newLabel.trim(); if (!label) return
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now()
    setList(prev => [...prev, { key, en: label, es: label }]); setNew('')
  }

  async function save() {
    setSaving(true); await onSave(list); setSaving(false); setOpen(false)
  }

  return (
    <div className="w-full bg-gray-800 rounded-xl p-3 space-y-2 mt-1">
      <div className="flex flex-wrap gap-1.5">
        {list.map(c => (
          <span key={c.key} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-orange-900/30 text-orange-300">
            {c[lang]}
            <button onClick={() => setList(prev => prev.filter(x => x.key !== c.key))}
              className="text-gray-500 hover:text-red-400">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input type="text" className="bg-gray-700 rounded-lg px-3 py-1.5 text-sm flex-1"
          placeholder={lang === 'en' ? 'New activity (e.g. 🚴 Cycle)' : 'Nueva actividad'} value={newLabel}
          onChange={e => setNew(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addCat()} />
        <button onClick={addCat} className="bg-gray-600 hover:bg-gray-500 px-3 py-1.5 rounded-lg text-sm">＋</button>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)} className="flex-1 bg-gray-700 py-1.5 rounded-lg text-xs">Cancel</button>
        <button onClick={save} disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-500 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50">
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── History table ─────────────────────────────────────────────────────────────
function HistoryTable({ logs, dailyTargetKrw, fmt, lang, expenseCats, incomeCats, activityCats, onUpdateLog, onDeleteLog }: {
  logs: DailyLog[]; dailyTargetKrw: number; fmt: (n: number) => string; lang: Lang
  expenseCats: ExpenseCat[]; incomeCats: IncomeCat[]; activityCats: ActivityCat[]
  onUpdateLog: (id: string, patch: Partial<DailyLog>) => Promise<void>
  onDeleteLog: (id: string) => Promise<void>
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  if (logs.length === 0) return null

  // category key → type
  const typeOf = (key: string): 'daily' | 'fixed' | 'invest' => {
    const catKey = key.split(':')[0]
    return expenseCats.find(c => c.key === catKey)?.type ?? 'daily'
  }
  function splitExp(expMap: Record<string, number>) {
    let op = 0, lump = 0
    for (const [k, amt] of Object.entries(expMap)) {
      if (typeOf(k) === 'daily') op += amt; else lump += amt
    }
    return { op, lump, total: op + lump }
  }

  function entryLabel(key: string, cats: ExpenseCat[] | IncomeCat[]) {
    const [catKey, ...rest] = key.split(':')
    const catObj = cats.find(c => c.key === catKey)
    const catName = catObj?.[lang] ?? catKey
    return rest.length ? `${catName} · ${rest.join(':')}` : catName
  }

  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      {/* header row */}
      <div className="bg-gray-950 text-xs text-gray-500 grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] gap-2 px-4 py-2.5">
        <span className="w-12">Date</span>
        <span className="text-right">☕ Op</span>
        <span className="text-right">🏠🚀 Fix</span>
        <span className="text-right">Σ Total</span>
        <span className="text-right w-8 hidden sm:block">kg</span>
        <span className="text-center w-6">😐</span>
      </div>

      {logs.map(l => {
        const { op, lump, total } = splitExp(l.expense_krw)
        const inc = sumKrw(l.income_krw || {})
        const isOpen = openId === l.id
        const hasDetail = Object.keys(l.expense_krw).length > 0
          || Object.keys(l.income_krw || {}).length > 0
          || l.memo || l.reflection

        return (
          <div key={l.id} className="border-t border-gray-800/60">
            {/* summary row (click to expand) */}
            <button
              onClick={() => setOpenId(isOpen ? null : l.id)}
              className="w-full grid grid-cols-[auto_1fr_1fr_1fr_auto_auto] gap-2 px-4 py-2.5 text-sm hover:bg-gray-800/40 transition text-left items-center">
              <span className="text-gray-400 tabular-nums flex items-center gap-1 w-12">
                <span className={`text-gray-600 transition-transform ${isOpen ? 'rotate-90' : ''}`}>›</span>
                {l.log_date.slice(5)}
              </span>
              <span className="text-right tabular-nums text-gray-200">{op > 0 ? fmt(op) : '–'}</span>
              <span className="text-right tabular-nums text-amber-400/90">{lump > 0 ? fmt(lump) : '–'}</span>
              <span className={`text-right tabular-nums font-semibold ${total > dailyTargetKrw ? 'text-red-400' : 'text-gray-100'}`}>
                {total > 0 ? fmt(total) : '–'}
                {inc > 0 && <span className="text-emerald-400 text-xs"> +{fmt(inc)}</span>}
              </span>
              <span className="text-right w-8 text-gray-500 hidden sm:block">{l.weight_kg ?? '–'}</span>
              <span className="text-center w-6 text-gray-500">{l.condition ?? '–'}</span>
            </button>

            {/* expanded detail */}
            {isOpen && (
              <div className="px-4 pb-4 pt-1 bg-gray-950/40 space-y-3 text-sm">
                {/* expense entries */}
                {Object.keys(l.expense_krw).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">💸 {t('expense', lang)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(l.expense_krw).map(([key, krw]) => (
                        <button key={key}
                          onClick={async () => {
                            const next = { ...l.expense_krw }; delete next[key]
                            await onUpdateLog(l.id, { expense_krw: next })
                          }}
                          className="bg-gray-800 hover:bg-red-900/40 text-gray-300 hover:text-red-200 text-xs px-2.5 py-1 rounded-full transition">
                          {entryLabel(key, expenseCats)} · {fmt(krw)} ×
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* income entries */}
                {Object.keys(l.income_krw || {}).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">💰 {t('income', lang)}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(l.income_krw).map(([key, krw]) => (
                        <button key={key}
                          onClick={async () => {
                            const next = { ...l.income_krw }; delete next[key]
                            await onUpdateLog(l.id, { income_krw: next })
                          }}
                          className="bg-emerald-900/30 hover:bg-red-900/40 text-emerald-200 hover:text-red-200 text-xs px-2.5 py-1 rounded-full transition">
                          {entryLabel(key, incomeCats)} · +{fmt(krw)} ×
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* activity + listening (read-only summary) */}
                {(l.activities && l.activities.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {l.activities.map(a => (
                      <span key={a.type} className="bg-orange-900/30 text-orange-200 text-xs px-2.5 py-1 rounded-full">
                        {activityCats.find(c => c.key === a.type)?.[lang] ?? a.type}
                        {a.minutes > 0 ? ` · ${a.minutes}m` : ''}
                      </span>
                    ))}
                  </div>
                )}
                {l.listening_min != null && l.listening_min > 0 && (
                  <div className="text-xs text-blue-300">
                    🎧 {l.listening_min}m{l.listening_content ? ` · ${l.listening_content}` : ''}
                  </div>
                )}
                {/* meta + memo + reflection — inline editable */}
                <HistoryMetaEditor log={l} lang={lang} onSave={onUpdateLog} />

                {!hasDetail && <p className="text-xs text-gray-600">No entries.</p>}

                {/* delete whole day */}
                <button
                  onClick={async () => {
                    if (confirm(`Delete all data for ${l.log_date}?`)) {
                      await onDeleteLog(l.id); setOpenId(null)
                    }
                  }}
                  className="text-xs text-red-400/70 hover:text-red-400 transition">
                  🗑️ Delete this day
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Inline meta editor for past log entries ───────────────────────────────────
function HistoryMetaEditor({ log, lang, onSave }: {
  log: DailyLog
  lang: Lang
  onSave: (id: string, patch: Partial<DailyLog>) => Promise<void>
}) {
  const [weight,     setWeight]     = useState(log.weight_kg != null ? String(log.weight_kg) : '')
  const [condition,  setCondition]  = useState<number>(log.condition ?? 0)
  const [memo,       setMemo]       = useState(log.memo ?? '')
  const [reflection, setReflection] = useState(log.reflection ?? '')
  const [saving,     setSaving]     = useState(false)

  // sync when parent log changes (e.g. after save)
  useEffect(() => {
    setWeight(log.weight_kg != null ? String(log.weight_kg) : '')
    setCondition(log.condition ?? 0)
    setMemo(log.memo ?? '')
    setReflection(log.reflection ?? '')
  }, [log.id, log.weight_kg, log.condition, log.memo, log.reflection])

  async function save() {
    setSaving(true)
    const w = parseFloat(weight)
    await onSave(log.id, {
      weight_kg:  isNaN(w) ? null : w,
      condition:  condition || null,
      memo:       memo.trim() || null,
      reflection: reflection.trim() || null,
    })
    setSaving(false)
  }

  return (
    <div className="space-y-2 pt-1">
      {/* weight + condition row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">⚖️</span>
          <input type="number" inputMode="decimal" step="0.1"
            className="bg-gray-800 rounded-lg px-2 py-1 text-xs w-20 font-mono"
            placeholder="kg" value={weight}
            onChange={e => setWeight(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">🌡️</span>
          {[1,2,3,4,5].map(n => (
            <button key={n} onClick={() => setCondition(condition === n ? 0 : n)}
              className={`w-6 h-6 rounded text-xs transition ${
                condition === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* memo */}
      <textarea
        className="w-full bg-gray-800 rounded-lg px-3 py-2 text-xs resize-none"
        rows={2} placeholder="📝 memo…"
        value={memo} onChange={e => setMemo(e.target.value)} />

      {/* reflection */}
      <textarea
        className="w-full bg-purple-950/30 border border-purple-900/30 rounded-lg px-3 py-2 text-xs resize-none text-purple-100 placeholder-purple-800"
        rows={2} placeholder="🪞 reflection…"
        value={reflection} onChange={e => setReflection(e.target.value)} />

      <button onClick={save} disabled={saving}
        className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition">
        {saving ? 'Saving…' : '💾 Save changes'}
      </button>
    </div>
  )
}
