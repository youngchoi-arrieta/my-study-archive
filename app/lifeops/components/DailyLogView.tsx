'use client'
import { useState, useMemo, useEffect } from 'react'
import {
  DailyLog, BudgetConfig, ExpenseCat, IncomeCat,
  DEFAULT_EXPENSE_CATS, DEFAULT_INCOME_CATS, DEFAULT_ACTIVITY_CATS,
  ActivityEntry, ActivityCat,
  Lang, Currency, t, formatAmount, parseToKrw,
  DEFAULT_STUDY_BLOCKS, StudyBlockCfg,
} from '../types'
import { quoteOfDay } from '../quotes'

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

function todayStr() {
  // 한국시간(KST, UTC+9) 기준 YYYY-MM-DD
  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  return kst.toISOString().slice(0, 10)
}
const nowMs = () => Date.now()   // 핸들러/이펙트에서 시각 취득(렌더 순수성 룰 우회)
function sumKrw(e: Record<string, number>) { return Object.values(e).reduce((a, b) => a + b, 0) }
// 날짜 가감 (YYYY-MM-DD, UTC 정오 기준이라 DST/타임존 영향 없음)
function shiftDate(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function DailyLogView({ logs, config, onUpsertToday, onUpdateConfig, onUpdateLog, onDeleteLog, lang, currency, copPerKrw }: Props) {
  const today = todayStr()
  // 보고 있는 날짜(기본 = 오늘). 화살표/달력으로 이동.
  const [selectedDate, setSelectedDate] = useState(today)
  const isToday = selectedDate === today

  const selectedLog = useMemo(() => logs.find(l => l.log_date === selectedDate) || null, [logs, selectedDate])
  const recent   = useMemo(() => [...logs].sort((a, b) => b.log_date.localeCompare(a.log_date)).slice(0, 14), [logs])
  const fmt = (krw: number) => formatAmount(krw, currency, copPerKrw)

  const expenseCats  = config.expense_cats  ?? DEFAULT_EXPENSE_CATS
  const incomeCats   = config.income_cats   ?? DEFAULT_INCOME_CATS
  const activityCats = config.activity_cats ?? DEFAULT_ACTIVITY_CATS
  const studyBlocks  = config.study_blocks_cfg ?? DEFAULT_STUDY_BLOCKS

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

      {/* Quote of the day */}
      <div className="bg-gradient-to-br from-gray-900 to-gray-900/40 rounded-2xl px-5 py-4 border border-gray-800/50">
        <p className="text-sm text-gray-200 italic leading-relaxed">
          &quot;{quoteOfDay(selectedDate)[lang]}&quot;
        </p>
        <p className="text-xs text-gray-500 mt-2">— {quoteOfDay(selectedDate).who}</p>
      </div>

      {/* 날짜 네비게이션 */}
      <DateNav selectedDate={selectedDate} today={today} lang={lang}
        onChange={setSelectedDate} />

      <TodayCard
        key={selectedDate}
        log={selectedLog} dateStr={selectedDate} isToday={isToday}
        expenseCats={expenseCats} incomeCats={incomeCats} activityCats={activityCats}
        studyBlocks={studyBlocks}
        onUpsert={onUpsertToday} onUpdateConfig={onUpdateConfig}
        dailyTargetKrw={config.daily_target_krw}
        lang={lang} currency={currency} copPerKrw={copPerKrw} fmt={fmt}
      />
      <HistoryTable logs={recent} dailyTargetKrw={config.daily_target_krw}
        fmt={fmt} lang={lang} expenseCats={expenseCats} incomeCats={incomeCats} activityCats={activityCats}
        studyBlocks={studyBlocks}
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
function TodayCard({ log, dateStr, isToday, expenseCats, incomeCats, activityCats, studyBlocks, onUpsert: onUpsertRaw, onUpdateConfig, dailyTargetKrw, lang, currency, copPerKrw, fmt }: {
  log: DailyLog | null
  dateStr: string
  isToday: boolean
  expenseCats: ExpenseCat[]
  incomeCats: IncomeCat[]
  activityCats: ActivityCat[]
  studyBlocks: StudyBlockCfg[]
  onUpsert: (p: Partial<DailyLog>, dateStr?: string) => Promise<void>
  onUpdateConfig: (p: Partial<BudgetConfig>) => Promise<void>
  dailyTargetKrw: number
  lang: Lang; currency: Currency; copPerKrw: number
  fmt: (n: number) => string
}) {
  // 모든 저장은 보고 있는 날짜로 (과거 날짜 편집 지원)
  const onUpsert = (p: Partial<DailyLog>) => onUpsertRaw(p, dateStr)
  const today   = dateStr
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
  const [activities,  setActivities]  = useState<ActivityEntry[]>(log?.activities ?? [])
  const [routine,     setRoutine]     = useState<Record<string, boolean>>(log?.study_blocks ?? {})
  const [routineMin,  setRoutineMin]  = useState<Record<string, number>>(log?.study_minutes ?? {})
  // 타이머: 돌고 있는 항목 key + 시작 시각(ms). 한 번에 하나만.
  const [timerKey,    setTimerKey]    = useState<string | null>(null)
  const [timerStart,  setTimerStart]  = useState<number>(0)
  const [nowTick,     setNowTick]     = useState<number>(0)   // 1초마다 갱신용
  const [actMinInput, setActMinInput] = useState<Record<string, string>>({})
  const [saving,      setSaving]      = useState(false)
  const [editCats,    setEditCats]    = useState(false)

  useEffect(() => {
    if (log) {
      setCondition(log.condition ?? 3)
      setMemo(log.memo ?? '')
      setActivities(log.activities ?? [])
      setRoutine(log.study_blocks ?? {})
      setRoutineMin(log.study_minutes ?? {})
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
    await onUpsert({
      condition,
      memo: memo.trim() || null,
      weight_kg: isNaN(w) ? null : w,
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

  // 타이머 1초 틱 (돌고 있을 때만). 시작 즉시 한 번 갱신.
  useEffect(() => {
    if (timerKey == null) return
    setNowTick(nowMs())
    const t = setInterval(() => setNowTick(nowMs()), 1000)
    return () => clearInterval(t)
  }, [timerKey])

  // 경과 초 → 분(올림). 누적에 더해 저장하고 완료 ✓ 처리.
  async function commitTimer(key: string, startMs: number) {
    const secs = Math.max(0, Math.round((nowMs() - startMs) / 1000))
    // 30초 이상이면 최소 1분으로 인정(짧은 세션 유실 방지)
    const addMin = secs >= 30 ? Math.max(1, Math.round(secs / 60)) : 0
    if (addMin <= 0) return
    const nextMin = { ...routineMin, [key]: (routineMin[key] || 0) + addMin }
    const nextDone = { ...routine, [key]: true }
    setRoutineMin(nextMin); setRoutine(nextDone)
    await onUpsert({ study_minutes: nextMin, study_blocks: nextDone })
  }

  // 항목 타이머 시작/정지. 다른 항목이 돌고 있으면 먼저 정지·저장(한 번에 하나).
  // 타이머는 '오늘'만 가능(과거 날짜는 수동 입력으로만 편집).
  async function toggleTimer(key: string) {
    if (!isToday) return
    if (timerKey === key) {
      // 정지
      const startMs = timerStart
      setTimerKey(null)
      await commitTimer(key, startMs)
    } else {
      if (timerKey != null) await commitTimer(timerKey, timerStart)
      setTimerKey(key)
      setTimerStart(nowMs())
    }
  }

  // 완료 체크만 토글(시간 없이). 해제 시 누적분은 보존.
  async function toggleRoutineDone(key: string) {
    const next = { ...routine, [key]: !routine[key] }
    setRoutine(next)
    await onUpsert({ study_blocks: next })
  }

  // 수동 분 입력(이미 한 것). 누적에 더함 + 완료 ✓.
  async function addRoutineMinutes(key: string, addMin: number) {
    if (!Number.isFinite(addMin) || addMin === 0) return
    const cur = routineMin[key] || 0
    const nextVal = Math.max(0, cur + addMin)
    const nextMin = { ...routineMin, [key]: nextVal }
    const nextDone = { ...routine, [key]: nextVal > 0 ? true : routine[key] }
    setRoutineMin(nextMin); setRoutine(nextDone)
    await onUpsert({ study_minutes: nextMin, study_blocks: nextDone })
  }

  // 화면 표시용 누적 분(돌고 있는 항목은 실시간 가산). 렌더 중 Date.now() 직접 호출 금지 → nowTick 사용.
  const liveMinutes = (key: string) => {
    const base = routineMin[key] || 0
    if (timerKey === key && timerStart > 0) {
      const ref = nowTick > timerStart ? nowTick : timerStart
      return base + Math.round((ref - timerStart) / 1000 / 60)
    }
    return base
  }
  // 현재 도는 세션의 경과 초 (MM:SS 표시용)
  const runningSecs = () => {
    if (timerKey == null || timerStart <= 0) return 0
    const ref = nowTick > timerStart ? nowTick : timerStart
    return Math.max(0, Math.floor((ref - timerStart) / 1000))
  }
  const fmtMMSS = (secs: number) => {
    const m = Math.floor(secs / 60)
    const sObj = secs % 60
    return `${m}:${String(sObj).padStart(2, '0')}`
  }
  const routineDone = studyBlocks.filter(b => routine[b.key]).length

  const actLabel = (key: string) => activityCats.find(c => c.key === key)?.[lang] ?? key

  const typeColor = (type: string) =>
    type === 'fixed'  ? 'border-purple-700 text-purple-300 bg-purple-900/20' :
    type === 'invest' ? 'border-blue-700 text-blue-300 bg-blue-900/20' :
                        'border-gray-700 text-gray-300 bg-gray-800/60'

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">{isToday ? 'Today' : '📅'} <span className="text-gray-500 text-sm font-normal">{today}</span></h3>
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
          {incomeCats.map(c => {
            const oneoff = (c.type ?? 'recurring') === 'oneoff'
            return (
              <button key={c.key}
                onClick={() => { setActiveInc(activeInc === c.key ? null : c.key); setIncAmtInput('') }}
                className={`text-sm px-3 py-1.5 rounded-full border transition hover:brightness-125
                  ${oneoff
                    ? 'border-amber-700 text-amber-300 bg-amber-900/20'
                    : 'border-emerald-700 text-emerald-300 bg-emerald-900/20'}
                  ${activeInc === c.key ? 'ring-2 ring-white/30 brightness-125' : ''}`}>
                {c[lang]}{oneoff && <span className="text-[10px] opacity-60 ml-1">1회</span>}
              </button>
            )
          })}
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

      {/* ── 고정 루틴 (fixed routine — recorded per day) ── */}
      <div className="border-t border-gray-800 pt-4">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">
          📚 {lang === 'en' ? 'Fixed routine' : 'Rutina fija'}
          {routineDone < studyBlocks.length
            ? <span className="text-red-400 ml-2">• {routineDone}/{studyBlocks.length}</span>
            : studyBlocks.length > 0 && <span className="text-emerald-400 ml-2">• ✓ {lang === 'en' ? 'all done' : 'completo'}</span>}
        </p>
        <div className="flex flex-col gap-2">
          {studyBlocks.map(b => {
            const active = !!routine[b.key]
            const running = timerKey === b.key
            const mins = liveMinutes(b.key)
            const target = b.minutes
            const reached = mins >= target && target > 0
            return (
              <div key={b.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition ${
                  running ? 'border-blue-500 bg-blue-900/30 ring-1 ring-blue-600/50'
                  : active ? 'border-emerald-700/60 bg-emerald-900/15'
                           : 'border-gray-700 bg-gray-800/60'}`}>
                {/* 시작/정지 (오늘만 타이머 가능) */}
                {isToday ? (
                  <button onClick={() => toggleTimer(b.key)}
                    className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm transition ${
                      running ? 'bg-blue-600 hover:bg-blue-500 text-white animate-pulse'
                              : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
                    title={running ? (lang === 'en' ? 'Stop' : 'Parar') : (lang === 'en' ? 'Start' : 'Iniciar')}>
                    {running ? '⏸' : '▶'}
                  </button>
                ) : (
                  <span className="shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-sm bg-gray-800 text-gray-600"
                    title={lang === 'en' ? 'Timer only on today — use ＋/－' : '타이머는 오늘만 — ＋/－로 입력'}>
                    🔒
                  </span>
                )}

                {/* 라벨 + 완료 체크 (+ 도는 중엔 경과 MM:SS) */}
                <button onClick={() => toggleRoutineDone(b.key)}
                  className="flex-1 text-left text-sm min-w-0"
                  title={lang === 'en' ? 'Toggle done' : 'Marcar'}>
                  <span className={`block truncate ${active ? 'text-emerald-300' : 'text-gray-300'}`}>
                    {active ? '✓ ' : ''}{b.label}
                  </span>
                  {running && (
                    <span className="block text-lg font-mono tabular-nums text-blue-300 leading-tight mt-0.5">
                      ⏱ {fmtMMSS(runningSecs())}
                    </span>
                  )}
                </button>

                {/* 누적 시간 / 목표 */}
                <span className={`text-sm tabular-nums shrink-0 ${
                  running ? 'text-blue-200' : reached ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {mins}<span className="opacity-50"> / {target}m</span>
                </span>

                {/* 수동 +／− */}
                <div className="flex gap-0.5 shrink-0">
                  <button onClick={() => addRoutineMinutes(b.key, 10)}
                    className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-200"
                    title="+10m">＋</button>
                  <button onClick={() => addRoutineMinutes(b.key, -10)}
                    className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-gray-600 text-xs text-gray-200"
                    title="-10m">－</button>
                </div>
              </div>
            )
          })}
          <div>
            <StudyBlockEditor blocks={studyBlocks} lang={lang}
              onSave={bs => onUpdateConfig({ study_blocks_cfg: bs })} />
          </div>
        </div>
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
  const [newType, setNewType] = useState<'recurring' | 'oneoff'>('recurring')
  const [saving, setSaving] = useState(false)

  if (!open) return (
    <button onClick={() => { setList(incomeCats); setOpen(true) }}
      className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1.5 rounded-full border border-gray-700 transition">
      ✏️
    </button>
  )

  function addCat() {
    const label = newLabel.trim(); if (!label) return
    const key = label.toLowerCase().replace(/[^a-z0-9]/g, '_') + '_' + Date.now()
    setList(prev => [...prev, { key, en: label, es: label, type: newType }]); setNew('')
  }

  async function save() {
    setSaving(true)
    try {
      await onSave(list)
      setOpen(false)
    } catch (e) {
      alert('태그 저장 실패: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="w-full bg-gray-800 rounded-xl p-3 space-y-2 mt-1">
      <div className="flex flex-wrap gap-1.5">
        {list.map(c => (
          <span key={c.key}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full ${
              (c.type ?? 'recurring') === 'oneoff'
                ? 'bg-amber-900/30 text-amber-300'
                : 'bg-emerald-900/30 text-emerald-300'}`}>
            {c[lang]}
            <span className="text-[10px] opacity-60">{(c.type ?? 'recurring') === 'oneoff' ? '1회' : '반복'}</span>
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
        <select className="bg-gray-700 rounded-lg px-2 py-1.5 text-xs"
          value={newType} onChange={e => setNewType(e.target.value as 'recurring' | 'oneoff')}>
          <option value="recurring">반복(예측반영)</option>
          <option value="oneoff">1회(잔고만)</option>
        </select>
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

// ── Fixed-routine name/time editor (exactly 3 blocks, no add/remove) ──────────
function StudyBlockEditor({ blocks, lang, onSave }: {
  blocks: StudyBlockCfg[]; lang: Lang; onSave: (blocks: StudyBlockCfg[]) => Promise<void>
}) {
  const [open, setOpen]     = useState(false)
  const [list, setList]     = useState<StudyBlockCfg[]>(blocks)
  const [saving, setSaving] = useState(false)

  useEffect(() => { setList(blocks) }, [blocks])

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="text-xs text-gray-600 hover:text-gray-400 px-2 py-1.5 rounded-full border border-gray-700 transition">
      ✏️
    </button>
  )

  async function save() {
    const cleaned = list.map(b => ({
      ...b,
      label: b.label.trim() || b.key,
      minutes: Math.max(0, Math.round(Number(b.minutes)) || 0),
    }))
    setSaving(true); await onSave(cleaned); setSaving(false); setOpen(false)
  }

  return (
    <div className="w-full bg-gray-800 rounded-xl p-3 space-y-2 mt-1">
      {list.map((b, i) => (
        <div key={b.key} className="flex items-center gap-2">
          <input type="text" className="bg-gray-700 rounded-lg px-3 py-1.5 text-sm flex-1 min-w-0"
            placeholder={lang === 'en' ? 'Routine name' : 'Nombre'} value={b.label}
            onChange={e => setList(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))} />
          <input type="number" inputMode="numeric" min={0}
            className="bg-gray-700 rounded-lg px-2 py-1.5 text-sm w-16 text-right tabular-nums" value={b.minutes}
            onChange={e => setList(prev => prev.map((x, j) => j === i ? { ...x, minutes: Number(e.target.value) } : x))} />
          <span className="text-xs text-gray-500">min</span>
        </div>
      ))}
      <div className="flex gap-2 pt-1">
        <button onClick={() => { setList(blocks); setOpen(false) }} className="flex-1 bg-gray-700 py-1.5 rounded-lg text-xs">Cancel</button>
        <button onClick={save} disabled={saving}
          className="flex-1 bg-blue-600 hover:bg-blue-500 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-50">
          {saving ? '…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

// ── History table ─────────────────────────────────────────────────────────────
function HistoryTable({ logs, dailyTargetKrw, fmt, lang, expenseCats, incomeCats, activityCats, studyBlocks, onUpdateLog, onDeleteLog }: {
  logs: DailyLog[]; dailyTargetKrw: number; fmt: (n: number) => string; lang: Lang
  expenseCats: ExpenseCat[]; incomeCats: IncomeCat[]; activityCats: ActivityCat[]
  studyBlocks: StudyBlockCfg[]
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
                {/* fixed routine (read-only summary) */}
                {((l.study_blocks && studyBlocks.some(b => l.study_blocks?.[b.key])) ||
                  (l.study_minutes && studyBlocks.some(b => (l.study_minutes?.[b.key] ?? 0) > 0))) && (
                  <div className="flex flex-wrap gap-1.5">
                    {studyBlocks.filter(b => l.study_blocks?.[b.key] || (l.study_minutes?.[b.key] ?? 0) > 0).map(b => {
                      const m = l.study_minutes?.[b.key] ?? 0
                      return (
                        <span key={b.key} className="bg-blue-900/30 text-blue-200 text-xs px-2.5 py-1 rounded-full">
                          {l.study_blocks?.[b.key] ? '✓ ' : ''}{b.label}{m > 0 ? ` · ${m}m` : ''}
                        </span>
                      )
                    })}
                  </div>
                )}
                {/* meta + memo — inline editable */}
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

      <button onClick={save} disabled={saving}
        className="text-xs bg-gray-700 hover:bg-gray-600 disabled:opacity-50 px-3 py-1.5 rounded-lg transition">
        {saving ? 'Saving…' : '💾 Save changes'}
      </button>
    </div>
  )
}

// ── 날짜 네비게이션 (◀ 날짜 ▶ + 달력 + 오늘) ──────────────────────
function DateNav({ selectedDate, today, lang, onChange }: {
  selectedDate: string
  today: string
  lang: Lang
  onChange: (d: string) => void
}) {
  const isToday = selectedDate === today
  const atFuture = selectedDate >= today   // 오늘보다 미래로는 못 감
  const weekday = (() => {
    const d = new Date(selectedDate + 'T12:00:00Z')
    const ko = ['일', '월', '화', '수', '목', '금', '토']
    const en = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return (lang === 'en' ? en : ko)[d.getUTCDay()]
  })()

  return (
    <div className="flex items-center justify-center gap-2">
      <button onClick={() => onChange(shiftDate(selectedDate, -1))}
        className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
        title={lang === 'en' ? 'Previous day' : '이전 날'}>◀</button>

      <label className="relative">
        <span className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-sm text-gray-100 cursor-pointer inline-flex items-center gap-2 transition">
          📅 {selectedDate} <span className="text-gray-500">({weekday})</span>
        </span>
        <input type="date" value={selectedDate} max={today}
          onChange={e => { if (e.target.value) onChange(e.target.value) }}
          className="absolute inset-0 opacity-0 cursor-pointer" />
      </label>

      <button onClick={() => onChange(shiftDate(selectedDate, 1))} disabled={atFuture}
        className={`w-9 h-9 rounded-lg transition ${atFuture ? 'bg-gray-900 text-gray-700 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}
        title={lang === 'en' ? 'Next day' : '다음 날'}>▶</button>

      {!isToday && (
        <button onClick={() => onChange(today)}
          className="px-3 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition">
          {lang === 'en' ? 'Today' : '오늘'}
        </button>
      )}
    </div>
  )
}
