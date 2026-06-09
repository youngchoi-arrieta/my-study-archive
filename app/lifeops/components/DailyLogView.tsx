'use client'
import { useState, useMemo, useEffect } from 'react'
import {
  DailyLog, STUDY_SUBJECTS, EXPENSE_CATEGORIES, INCOME_CATEGORIES,
  Lang, Currency, t, formatAmount, fromDisplayAmount, toDisplayAmount,
} from '../types'

interface Props {
  logs: DailyLog[]
  onUpsertToday: (patch: Partial<DailyLog>) => Promise<void>
  dailyTargetKrw: number
  lang: Lang
  currency: Currency
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function sumMinutes(m: Record<string, number>): number {
  return Object.values(m).reduce((a, b) => a + (b || 0), 0)
}

function sumKrw(e: Record<string, number>): number {
  return Object.values(e).reduce((a, b) => a + (b || 0), 0)
}

export default function DailyLogView({ logs, onUpsertToday, dailyTargetKrw, lang, currency }: Props) {
  const today = todayStr()
  const todayLog = useMemo(
    () => logs.find(l => l.log_date === today) || null,
    [logs, today]
  )

  const recent = useMemo(
    () => [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, 14),
    [logs]
  )

  return (
    <div className="space-y-6">
      <TodayCard
        log={todayLog}
        onUpsert={onUpsertToday}
        dailyTargetKrw={dailyTargetKrw}
        lang={lang}
        currency={currency}
      />
      <HistoryTable logs={recent} dailyTargetKrw={dailyTargetKrw} lang={lang} currency={currency} />
    </div>
  )
}

function TodayCard({
  log, onUpsert, dailyTargetKrw, lang, currency,
}: {
  log: DailyLog | null
  onUpsert: (patch: Partial<DailyLog>) => Promise<void>
  dailyTargetKrw: number
  lang: Lang
  currency: Currency
}) {
  const study   = log?.study_minutes || {}
  const expense = log?.expense_krw   || {}
  const income  = log?.income_krw    || {}

  const [addSubject, setAddSubject] = useState<string>(STUDY_SUBJECTS[0])
  const [addMin,     setAddMin]     = useState<string>('')

  const [addExpCat, setAddExpCat]   = useState<string>(EXPENSE_CATEGORIES[0].key)
  const [addExpAmt, setAddExpAmt]   = useState<string>('')

  const [addIncCat, setAddIncCat]   = useState<string>(INCOME_CATEGORIES[0].key)
  const [addIncAmt, setAddIncAmt]   = useState<string>('')

  const [weightInput, setWeightInput] = useState<string>(
    log?.weight_kg != null ? String(log.weight_kg) : ''
  )
  const [condition, setCondition] = useState<number>(log?.condition || 3)
  const [memo,      setMemo]      = useState<string>(log?.memo || '')

  useEffect(() => {
    if (log) {
      setCondition(log.condition || 3)
      setMemo(log.memo || '')
      setWeightInput(log.weight_kg != null ? String(log.weight_kg) : '')
    }
  }, [log])

  const totalExpenseKrw = sumKrw(expense)
  const totalIncomeKrw  = sumKrw(income)
  const netKrw          = totalIncomeKrw - totalExpenseKrw
  const overBudget      = totalExpenseKrw > dailyTargetKrw

  // currency-aware amount parser
  function parseInput(raw: string): number {
    const n = parseFloat(raw.replace(/,/g, ''))
    if (!n || n <= 0) return 0
    return fromDisplayAmount(n, currency)  // → KRW
  }

  async function addStudy() {
    const m = parseInt(addMin)
    if (!m || m <= 0) return
    await onUpsert({ study_minutes: { ...study, [addSubject]: (study[addSubject] || 0) + m } })
    setAddMin('')
  }

  async function addExpense() {
    const krw = parseInput(addExpAmt)
    if (!krw) return
    await onUpsert({ expense_krw: { ...expense, [addExpCat]: (expense[addExpCat] || 0) + krw } })
    setAddExpAmt('')
  }

  async function addIncome() {
    const krw = parseInput(addIncAmt)
    if (!krw) return
    await onUpsert({ income_krw: { ...income, [addIncCat]: (income[addIncCat] || 0) + krw } })
    setAddIncAmt('')
  }

  async function removeStudy(sub: string) {
    const next = { ...study }; delete next[sub]
    await onUpsert({ study_minutes: next })
  }

  async function removeExpense(cat: string) {
    const next = { ...expense }; delete next[cat]
    await onUpsert({ expense_krw: next })
  }

  async function removeIncome(cat: string) {
    const next = { ...income }; delete next[cat]
    await onUpsert({ income_krw: next })
  }

  async function saveWeight() {
    const w = parseFloat(weightInput)
    await onUpsert({ weight_kg: isNaN(w) ? null : w })
  }

  async function saveMeta() {
    await onUpsert({ condition, memo: memo.trim() || null })
  }

  const catLabel = (cats: ReadonlyArray<{readonly key: string; readonly en: string; readonly es: string}>, key: string) =>
    cats.find(c => c.key === key)?.[lang] || key

  const inputPlaceholder = currency === 'KRW' ? '원' : 'COP'

  return (
    <div className="bg-gray-900 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-lg font-bold">{t('todayRecord', lang)}</h3>
        <p className="text-xs text-gray-500">{todayStr()}</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-950 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">{t('studyTime', lang)}</p>
          <p className="text-xl font-bold">
            {Math.floor(sumMinutes(study) / 60)}
            <span className="text-sm text-gray-400 font-normal">h </span>
            {sumMinutes(study) % 60}
            <span className="text-sm text-gray-400 font-normal">m</span>
          </p>
        </div>
        <div className="bg-gray-950 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">
            {t('expense', lang)} / {formatAmount(dailyTargetKrw, currency)}
          </p>
          <p className={`text-xl font-bold ${overBudget ? 'text-red-400' : 'text-green-400'}`}>
            {formatAmount(totalExpenseKrw, currency)}
          </p>
        </div>
        <div className="bg-gray-950 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">Net</p>
          <p className={`text-xl font-bold ${netKrw >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {netKrw >= 0 ? '+' : ''}{formatAmount(netKrw, currency)}
          </p>
        </div>
      </div>

      {/* Study */}
      <Section title={`📚 ${t('studyTime', lang)}`}>
        <TagRow>
          {Object.entries(study).map(([sub, min]) => (
            <Tag key={sub} onClick={() => removeStudy(sub)} color="blue">
              {sub} · {min}m ×
            </Tag>
          ))}
          {Object.keys(study).length === 0 && <Empty lang={lang} />}
        </TagRow>
        <InputRow>
          <select
            className="bg-gray-800 rounded-lg px-2 py-1.5 text-sm flex-1"
            value={addSubject}
            onChange={e => setAddSubject(e.target.value)}
          >
            {STUDY_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="number" inputMode="numeric"
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm w-20"
            placeholder="min"
            value={addMin}
            onChange={e => setAddMin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStudy()}
          />
          <AddBtn onClick={addStudy} color="blue" label={t('add', lang)} />
        </InputRow>
      </Section>

      {/* Expense */}
      <Section title={`💸 ${t('expense', lang)}`}>
        <TagRow>
          {Object.entries(expense).map(([cat, krw]) => (
            <Tag key={cat} onClick={() => removeExpense(cat)} color="amber">
              {catLabel(EXPENSE_CATEGORIES, cat)} · {formatAmount(krw, currency)} ×
            </Tag>
          ))}
          {Object.keys(expense).length === 0 && <Empty lang={lang} />}
        </TagRow>
        <InputRow>
          <select
            className="bg-gray-800 rounded-lg px-2 py-1.5 text-sm flex-1"
            value={addExpCat}
            onChange={e => setAddExpCat(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c[lang]}</option>
            ))}
          </select>
          <input
            type="text" inputMode="numeric"
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm w-28"
            placeholder={inputPlaceholder}
            value={addExpAmt}
            onChange={e => setAddExpAmt(e.target.value.replace(/[^0-9.,]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && addExpense()}
          />
          <AddBtn onClick={addExpense} color="amber" label={t('add', lang)} />
        </InputRow>
      </Section>

      {/* Income */}
      <Section title={`💰 ${t('income', lang)}`}>
        <TagRow>
          {Object.entries(income).map(([cat, krw]) => (
            <Tag key={cat} onClick={() => removeIncome(cat)} color="emerald">
              {catLabel(INCOME_CATEGORIES, cat)} · {formatAmount(krw, currency)} ×
            </Tag>
          ))}
          {Object.keys(income).length === 0 && <Empty lang={lang} />}
        </TagRow>
        <InputRow>
          <select
            className="bg-gray-800 rounded-lg px-2 py-1.5 text-sm flex-1"
            value={addIncCat}
            onChange={e => setAddIncCat(e.target.value)}
          >
            {INCOME_CATEGORIES.map(c => (
              <option key={c.key} value={c.key}>{c[lang]}</option>
            ))}
          </select>
          <input
            type="text" inputMode="numeric"
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm w-28"
            placeholder={inputPlaceholder}
            value={addIncAmt}
            onChange={e => setAddIncAmt(e.target.value.replace(/[^0-9.,]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && addIncome()}
          />
          <AddBtn onClick={addIncome} color="emerald" label={t('add', lang)} />
        </InputRow>
      </Section>

      {/* Weight + Condition + Memo */}
      <div className="border-t border-gray-800 pt-4 space-y-3">
        {/* Weight */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-20">⚖️ {t('weight', lang)}</span>
          <input
            type="number" inputMode="decimal" step="0.1"
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm w-24"
            placeholder="kg"
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            onBlur={saveWeight}
          />
          {log?.weight_kg != null && (
            <span className="text-xs text-gray-500">{log.weight_kg} kg saved</span>
          )}
        </div>

        {/* Condition */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-20">🌡️ {t('condition', lang)}</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => setCondition(n)}
                className={`w-8 h-8 rounded-lg text-sm transition ${
                  condition === n ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                }`}
              >{n}</button>
            ))}
          </div>
        </div>

        {/* Memo */}
        <textarea
          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm resize-none"
          rows={2}
          placeholder={t('memoPlaceholder', lang)}
          value={memo}
          onChange={e => setMemo(e.target.value)}
          onBlur={saveMeta}
        />
        <p className="text-xs text-gray-600">{t('autoSave', lang)}</p>
      </div>
    </div>
  )
}

// ── History table ────────────────────────────────────────────────────────────
function HistoryTable({
  logs, dailyTargetKrw, lang, currency,
}: {
  logs: DailyLog[]
  dailyTargetKrw: number
  lang: Lang
  currency: Currency
}) {
  if (logs.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-widest">
        {t('recentTwo', lang)}
      </h3>
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-950 text-xs text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">{t('date', lang)}</th>
              <th className="text-right px-3 py-2">{t('study', lang)}</th>
              <th className="text-right px-3 py-2">{t('expense', lang)}</th>
              <th className="text-right px-3 py-2">{t('income', lang)}</th>
              <th className="text-right px-3 py-2 hidden sm:table-cell">⚖️</th>
              <th className="text-center px-3 py-2">{t('condition', lang)}</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => {
              const studyMin = sumMinutes(l.study_minutes)
              const expKrw   = sumKrw(l.expense_krw)
              const incKrw   = sumKrw(l.income_krw || {})
              const over     = expKrw > dailyTargetKrw
              return (
                <tr key={l.id} className="border-t border-gray-800">
                  <td className="px-3 py-2 text-gray-400">{l.log_date.slice(5)}</td>
                  <td className="px-3 py-2 text-right">
                    {Math.floor(studyMin / 60)}h {studyMin % 60}m
                  </td>
                  <td className={`px-3 py-2 text-right ${over ? 'text-red-400' : ''}`}>
                    {formatAmount(expKrw, currency)}
                  </td>
                  <td className="px-3 py-2 text-right text-emerald-400">
                    {incKrw > 0 ? `+${formatAmount(incKrw, currency)}` : '–'}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-400 hidden sm:table-cell">
                    {l.weight_kg != null ? `${l.weight_kg}` : '–'}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-400">
                    {l.condition || '–'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Primitive components ─────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h4 className="text-sm font-semibold text-gray-300 mb-2">{title}</h4>
      {children}
    </div>
  )
}

function TagRow({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">{children}</div>
}

function Tag({
  children, onClick, color,
}: {
  children: React.ReactNode
  onClick: () => void
  color: 'blue' | 'amber' | 'emerald'
}) {
  const base: Record<string, string> = {
    blue:    'bg-blue-900/40 hover:bg-red-900/40 text-blue-200 hover:text-red-200',
    amber:   'bg-amber-900/40 hover:bg-red-900/40 text-amber-200 hover:text-red-200',
    emerald: 'bg-emerald-900/40 hover:bg-red-900/40 text-emerald-200 hover:text-red-200',
  }
  return (
    <button
      onClick={onClick}
      className={`${base[color]} text-xs px-2.5 py-1 rounded-full transition`}
      title="Click to remove"
    >
      {children}
    </button>
  )
}

function InputRow({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-2">{children}</div>
}

function AddBtn({ onClick, color, label }: { onClick: () => void; color: 'blue' | 'amber' | 'emerald'; label: string }) {
  const cls: Record<string, string> = {
    blue:    'bg-blue-600 hover:bg-blue-500',
    amber:   'bg-amber-600 hover:bg-amber-500',
    emerald: 'bg-emerald-600 hover:bg-emerald-500',
  }
  return (
    <button onClick={onClick} className={`${cls[color]} px-3 py-1.5 rounded-lg text-sm`}>
      {label}
    </button>
  )
}

function Empty({ lang }: { lang: Lang }) {
  return <p className="text-xs text-gray-600 py-1">{t('noRecord', lang)}</p>
}
