'use client'
import { useState, useMemo, useEffect } from 'react'
import { DailyLog, EXPENSE_CATS, INCOME_CATS, Lang, Currency, t, formatAmount, parseToKrw } from '../types'

interface Props {
  logs: DailyLog[]
  onUpsertToday: (patch: Partial<DailyLog>) => Promise<void>
  dailyTargetKrw: number
  lang: Lang
  currency: Currency
  copPerKrw: number
}

function todayStr() { return new Date().toISOString().slice(0, 10) }
function sumKrw(e: Record<string, number>) { return Object.values(e).reduce((a, b) => a + b, 0) }

export default function DailyLogView({ logs, onUpsertToday, dailyTargetKrw, lang, currency, copPerKrw }: Props) {
  const today = todayStr()
  const todayLog = useMemo(() => logs.find(l => l.log_date === today) || null, [logs, today])
  const recent = useMemo(
    () => [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, 14),
    [logs]
  )
  const fmt = (krw: number) => formatAmount(krw, currency, copPerKrw)

  return (
    <div className="space-y-4">
      <TodayCard log={todayLog} onUpsert={onUpsertToday} dailyTargetKrw={dailyTargetKrw}
        lang={lang} currency={currency} copPerKrw={copPerKrw} fmt={fmt} />
      <HistoryTable logs={recent} dailyTargetKrw={dailyTargetKrw} fmt={fmt} lang={lang} />
    </div>
  )
}

// ── Today card ────────────────────────────────────────────────────────────────
function TodayCard({ log, onUpsert, dailyTargetKrw, lang, currency, copPerKrw, fmt }: {
  log: DailyLog | null
  onUpsert: (p: Partial<DailyLog>) => Promise<void>
  dailyTargetKrw: number
  lang: Lang; currency: Currency; copPerKrw: number
  fmt: (n: number) => string
}) {
  const expense = log?.expense_krw || {}
  const income  = log?.income_krw  || {}

  const [activeCat,    setActiveCat]    = useState<string | null>(null)
  const [activeInc,    setActiveInc]    = useState<string | null>(null)
  const [amtInput,     setAmtInput]     = useState('')
  const [noteInput,    setNoteInput]    = useState('')
  const [incAmtInput,  setIncAmtInput]  = useState('')
  const [weightInput,  setWeightInput]  = useState(log?.weight_kg != null ? String(log.weight_kg) : '')
  const [condition,    setCondition]    = useState(log?.condition ?? 3)
  const [memo,         setMemo]         = useState(log?.memo ?? '')
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    if (log) {
      setCondition(log.condition ?? 3)
      setMemo(log.memo ?? '')
      setWeightInput(log.weight_kg != null ? String(log.weight_kg) : '')
    }
  }, [log?.id])

  const totalExp = sumKrw(expense)
  const totalInc = sumKrw(income)
  const overBudget = totalExp > dailyTargetKrw

  const placeholder = currency === 'KRW' ? '원' : 'COP'

  async function commitExpense() {
    if (!activeCat) return
    const krw = parseToKrw(amtInput, currency, copPerKrw)
    if (!krw) return
    setSaving(true)
    // Use cat+note as key if note provided, else just cat
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

  async function removeEntry(map: Record<string, number>, key: string, field: 'expense_krw' | 'income_krw') {
    const next = { ...map }; delete next[key]
    await onUpsert({ [field]: next })
  }

  async function saveMeta() {
    const w = parseFloat(weightInput)
    await onUpsert({
      condition,
      memo: memo.trim() || null,
      weight_kg: isNaN(w) ? null : w,
    })
  }

  // Display key: strip the "cat:" prefix for the label, show note if present
  function entryLabel(key: string, cats: typeof EXPENSE_CATS | typeof INCOME_CATS) {
    const [catKey, ...rest] = key.split(':')
    const catObj = (cats as ReadonlyArray<{readonly key: string; readonly en: string; readonly es: string}>)
      .find(c => c.key === catKey)
    const catName = catObj?.[lang] ?? catKey
    return rest.length ? `${catName} · ${rest.join(':')}` : catName
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-5">
      {/* Header + totals */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">Today <span className="text-gray-500 text-sm font-normal">{today}</span></h3>
        <div className="flex gap-3 text-sm">
          <span className={overBudget ? 'text-red-400' : 'text-green-400'}>{fmt(totalExp)}</span>
          {totalInc > 0 && <span className="text-emerald-400">+{fmt(totalInc)}</span>}
        </div>
      </div>

      {/* ── EXPENSE ── */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">💸 {t('expense', lang)}</p>

        {/* Existing entries */}
        {Object.keys(expense).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(expense).map(([key, krw]) => (
              <button key={key} onClick={() => removeEntry(expense, key, 'expense_krw')}
                className="bg-gray-800 hover:bg-red-900/40 text-gray-200 hover:text-red-200 text-xs px-3 py-1.5 rounded-full transition">
                {entryLabel(key, EXPENSE_CATS)} · {fmt(krw)} ×
              </button>
            ))}
          </div>
        )}

        {/* Category tag buttons */}
        <div className="flex flex-wrap gap-2 mb-3">
          {EXPENSE_CATS.map(c => {
            const typeColor =
              c.type === 'fixed'  ? 'border-purple-700 text-purple-300 bg-purple-900/20' :
              c.type === 'invest' ? 'border-blue-700 text-blue-300 bg-blue-900/20' :
                                    'border-gray-700 text-gray-300 bg-gray-800/60'
            const active = activeCat === c.key
            return (
              <button key={c.key}
                onClick={() => { setActiveCat(active ? null : c.key); setAmtInput(''); setNoteInput('') }}
                className={`text-sm px-3 py-1.5 rounded-full border transition ${typeColor}
                  ${active ? 'ring-2 ring-white/30 brightness-125' : 'hover:brightness-125'}`}>
                {c[lang]}
              </button>
            )
          })}
        </div>

        {/* Inline input when category selected */}
        {activeCat && (
          <div className="bg-gray-800 rounded-xl p-3 space-y-2">
            <div className="flex gap-2">
              <input autoFocus type="text" inputMode="numeric"
                className="bg-gray-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
                placeholder={placeholder}
                value={amtInput}
                onChange={e => setAmtInput(e.target.value.replace(/[^0-9.,]/g, ''))}
                onKeyDown={e => e.key === 'Enter' && commitExpense()} />
              <button onClick={commitExpense} disabled={saving}
                className="bg-white text-gray-900 font-semibold px-4 py-2 rounded-lg text-sm hover:bg-gray-100 disabled:opacity-50">
                Add
              </button>
            </div>
            <input type="text"
              className="bg-gray-700 rounded-lg px-3 py-2 text-xs w-full"
              placeholder="Note (optional)"
              value={noteInput}
              onChange={e => setNoteInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && commitExpense()} />
          </div>
        )}
      </div>

      {/* ── INCOME ── */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">💰 {t('income', lang)}</p>

        {Object.keys(income).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(income).map(([key, krw]) => (
              <button key={key} onClick={() => removeEntry(income, key, 'income_krw')}
                className="bg-emerald-900/30 hover:bg-red-900/40 text-emerald-200 hover:text-red-200 text-xs px-3 py-1.5 rounded-full transition">
                {entryLabel(key, INCOME_CATS)} · +{fmt(krw)} ×
              </button>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-3">
          {INCOME_CATS.map(c => (
            <button key={c.key}
              onClick={() => { setActiveInc(activeInc === c.key ? null : c.key); setIncAmtInput('') }}
              className={`text-sm px-3 py-1.5 rounded-full border transition
                border-emerald-700 text-emerald-300 bg-emerald-900/20 hover:brightness-125
                ${activeInc === c.key ? 'ring-2 ring-white/30 brightness-125' : ''}`}>
              {c[lang]}
            </button>
          ))}
        </div>

        {activeInc && (
          <div className="bg-gray-800 rounded-xl p-3">
            <div className="flex gap-2">
              <input autoFocus type="text" inputMode="numeric"
                className="bg-gray-700 rounded-lg px-3 py-2 text-sm flex-1 min-w-0"
                placeholder={placeholder}
                value={incAmtInput}
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

      {/* ── META ── */}
      <div className="border-t border-gray-800 pt-4 space-y-3">
        {/* Weight */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-20">⚖️ {t('weight', lang)}</span>
          <input type="number" inputMode="decimal" step="0.1"
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm w-24"
            placeholder="kg" value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            onBlur={saveMeta} />
        </div>

        {/* Condition */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 w-20">🌡️ {t('condition', lang)}</span>
          <div className="flex gap-1.5">
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => { setCondition(n); }}
                className={`w-8 h-8 rounded-lg text-sm transition
                  ${condition === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Memo */}
        <textarea className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm resize-none"
          rows={2} placeholder={t('memoPlaceholder', lang)}
          value={memo} onChange={e => setMemo(e.target.value)} onBlur={saveMeta} />
        <p className="text-xs text-gray-600">* auto-saved on blur</p>
      </div>
    </div>
  )
}

// ── History table ─────────────────────────────────────────────────────────────
function HistoryTable({ logs, dailyTargetKrw, fmt, lang }: {
  logs: DailyLog[]; dailyTargetKrw: number; fmt: (n: number) => string; lang: Lang
}) {
  if (logs.length === 0) return null
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-950 text-xs text-gray-500">
          <tr>
            <th className="text-left px-4 py-2.5">Date</th>
            <th className="text-right px-4 py-2.5">{t('expense', lang)}</th>
            <th className="text-right px-4 py-2.5">{t('income', lang)}</th>
            <th className="text-right px-4 py-2.5 hidden sm:table-cell">kg</th>
            <th className="text-center px-4 py-2.5">😐</th>
          </tr>
        </thead>
        <tbody>
          {logs.map(l => {
            const exp = sumKrw(l.expense_krw)
            const inc = sumKrw(l.income_krw || {})
            return (
              <tr key={l.id} className="border-t border-gray-800/60">
                <td className="px-4 py-2.5 text-gray-400 tabular-nums">{l.log_date.slice(5)}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${exp > dailyTargetKrw ? 'text-red-400' : ''}`}>
                  {fmt(exp)}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-400">
                  {inc > 0 ? `+${fmt(inc)}` : '–'}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500 hidden sm:table-cell">
                  {l.weight_kg ?? '–'}
                </td>
                <td className="px-4 py-2.5 text-center text-gray-500">{l.condition ?? '–'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
