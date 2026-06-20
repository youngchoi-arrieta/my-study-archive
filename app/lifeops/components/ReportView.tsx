'use client'
import { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { DailyLog, BudgetConfig, Lang, Currency, formatAmount, DEFAULT_EXPENSE_CATS, DEFAULT_STUDY_BLOCKS } from '../types'

interface Props {
  logs: DailyLog[]
  config: BudgetConfig
  lang: Lang
  currency: Currency
}

type Period = 'week' | 'month' | 'all'

function todayStr() {
  const kst = new Date(Date.now() + 9 * 3600 * 1000)
  return kst.toISOString().slice(0, 10)
}
function addDays(d: string, n: number) {
  const dt = new Date(d + 'T00:00:00'); dt.setDate(dt.getDate() + n)
  return dt.toISOString().slice(0, 10)
}
function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000)
}

// period+offset → [start, end] (week/month/all 공용)
function rangeFor(period: Period, offset: number, today: string): { start: string; end: string } {
  if (period === 'all') return { start: '0000-01-01', end: today }
  if (period === 'week') {
    const d = new Date(today + 'T00:00:00')
    const dow = (d.getDay() + 6) % 7
    const thisMon = addDays(today, -dow)
    const start = addDays(thisMon, offset * 7)
    const end = addDays(start, 6)
    return { start, end: end > today && offset === 0 ? today : end }
  }
  const base = new Date(today + 'T00:00:00')
  const mDate = new Date(base.getFullYear(), base.getMonth() + offset, 1)
  const start = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}-01`
  const last = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0)
  const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  return { start, end: end > today && offset === 0 ? today : end }
}

// 공용 기간 토글 + ◀▶ 네비
function PeriodNav({ period, offset, setPeriod, setOffset, lang, rangeLabel }: {
  period: Period; offset: number
  setPeriod: (p: Period) => void; setOffset: (fn: (o: number) => number) => void
  lang: Lang; rangeLabel: string
}) {
  const btns: { k: Period; label: string }[] = [
    { k: 'week',  label: lang === 'en' ? 'Week'  : '주' },
    { k: 'month', label: lang === 'en' ? 'Month' : '월' },
    { k: 'all',   label: lang === 'en' ? 'All' : '전체' },
  ]
  return (
    <>
      <div className="flex gap-1.5 mb-2">
        {btns.map(b => (
          <button key={b.k} onClick={() => { setPeriod(b.k); setOffset(() => 0) }}
            className={`text-xs px-3 py-1.5 rounded-lg transition ${
              period === b.k ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {b.label}
          </button>
        ))}
      </div>
      {period !== 'all' && (
        <div className="flex items-center gap-2 mb-1.5">
          <button onClick={() => setOffset(o => o - 1)}
            className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition">◀</button>
          <span className="text-xs text-gray-300 min-w-[70px] text-center">{rangeLabel}</span>
          <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0}
            className={`w-7 h-7 rounded-lg text-sm transition ${offset >= 0 ? 'bg-gray-900 text-gray-700 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>▶</button>
          {offset !== 0 && (
            <button onClick={() => setOffset(() => 0)}
              className="text-[11px] px-2 h-7 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white transition">
              {lang === 'en' ? 'Now' : '현재'}
            </button>
          )}
        </div>
      )}
    </>
  )
}

export default function ReportView({ logs, config, lang, currency }: Props) {
  const copPerKrw = config.cop_per_krw ?? 0.42
  const fmt = (krw: number) => formatAmount(krw, currency, copPerKrw)

  const catType = useMemo(() => {
    const cats = config.expense_cats ?? DEFAULT_EXPENSE_CATS
    const m = new Map<string, 'daily' | 'fixed' | 'invest'>()
    cats.forEach(c => m.set(c.key, c.type))
    return m
  }, [config.expense_cats])

  const weightData = useMemo(() =>
    [...logs].filter(l => l.weight_kg != null)
      .sort((a, b) => a.log_date.localeCompare(b.log_date))
      .map(l => ({ date: l.log_date.slice(5), kg: l.weight_kg as number })),
    [logs])

  return (
    <div className="space-y-4">
      {/* 체중 */}
      {weightData.length >= 2 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <h3 className="text-sm font-semibold mb-3">⚖️ {lang === 'en' ? 'Weight' : '체중'}</h3>
          <div style={{ width: '100%', height: 160 }}>
            <ResponsiveContainer>
              <LineChart data={weightData} margin={{ top: 4, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: 10 }} />
                <YAxis stroke="#6b7280" style={{ fontSize: 10 }}
                  domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={v => `${v}kg`} />
                <Tooltip contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => [`${v} kg`, '']} />
                <Line type="monotone" dataKey="kg" stroke="#a78bfa" dot={{ r: 3 }} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <ExpenseReport logs={logs} config={config} lang={lang} fmt={fmt} catType={catType} />
      <StudyReport logs={logs} config={config} lang={lang} />
    </div>
  )
}

// ── 소비 리포트 ──────────────────────────────────────────────────────
function ExpenseReport({ logs, config, lang, fmt, catType }: {
  logs: DailyLog[]; config: BudgetConfig; lang: Lang
  fmt: (n: number) => string
  catType: Map<string, 'daily' | 'fixed' | 'invest'>
}) {
  const [period, setPeriod] = useState<Period>('month')
  const [offset, setOffset] = useState(0)   // 0=현재, -1=직전, ... (week/month 단위)
  const [openCat, setOpenCat] = useState<string | null>(null)
  const cats = config.expense_cats ?? DEFAULT_EXPENSE_CATS
  const catLabel = (key: string) => {
    const c = cats.find(c => c.key === key)
    return c ? (lang === 'en' ? c.en : c.es) : key
  }

  const today = todayStr()
  // period+offset → [start, end] 범위
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (period === 'all') return { rangeStart: '0000-01-01', rangeEnd: today }
    if (period === 'week') {
      const d = new Date(today + 'T00:00:00')
      const dow = (d.getDay() + 6) % 7   // 월=0
      const thisMon = addDays(today, -dow)
      const start = addDays(thisMon, offset * 7)
      const end = addDays(start, 6)
      return { rangeStart: start, rangeEnd: end > today && offset === 0 ? today : end }
    }
    // month: offset 만큼 달 이동
    const base = new Date(today + 'T00:00:00')
    const mDate = new Date(base.getFullYear(), base.getMonth() + offset, 1)
    const start = `${mDate.getFullYear()}-${String(mDate.getMonth() + 1).padStart(2, '0')}-01`
    const last = new Date(mDate.getFullYear(), mDate.getMonth() + 1, 0)
    const end = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
    return { rangeStart: start, rangeEnd: end > today && offset === 0 ? today : end }
  }, [period, offset, today])

  const report = useMemo(() => {
    const inRange = logs.filter(l => l.log_date >= rangeStart && l.log_date <= rangeEnd)
    const byCat = new Map<string, number>()
    const byTag = new Map<string, Map<string, number>>()  // cat → (tag → amt)
    let totalOp = 0, totalLump = 0
    const loggedDates = new Set<string>()
    for (const l of inRange) {
      let dayHas = false
      for (const [key, amt] of Object.entries(l.expense_krw || {})) {
        const [catKey, ...rest] = key.split(':')
        const tag = rest.join(':') || (lang === 'en' ? '(no memo)' : '(메모 없음)')
        byCat.set(catKey, (byCat.get(catKey) || 0) + amt)
        if (!byTag.has(catKey)) byTag.set(catKey, new Map())
        const tm = byTag.get(catKey)!
        tm.set(tag, (tm.get(tag) || 0) + amt)
        const type = catType.get(catKey) ?? 'daily'
        if (type === 'daily') totalOp += amt; else totalLump += amt
        dayHas = true
      }
      if (dayHas) loggedDates.add(l.log_date)
    }
    const total = totalOp + totalLump
    const rows = Array.from(byCat.entries())
      .map(([key, amt]) => ({
        key, label: catLabel(key), amt, pct: total ? amt / total * 100 : 0,
        tags: Array.from(byTag.get(key)?.entries() ?? [])
          .map(([tag, a]) => ({ tag, amt: a })).sort((x, y) => y.amt - x.amt),
      }))
      .sort((a, b) => b.amt - a.amt)
    const actualStart = period === 'all' ? (inRange.length ? inRange.reduce((m, l) => l.log_date < m ? l.log_date : m, inRange[0].log_date) : today) : rangeStart
    const spanDays = Math.max(1, daysBetween(actualStart, rangeEnd) + 1)
    const avgOp = totalOp / spanDays
    const target = config.daily_target_krw ?? 0
    let overDays = 0
    for (const l of inRange) {
      let op = 0
      for (const [key, amt] of Object.entries(l.expense_krw || {})) {
        if ((catType.get(key.split(':')[0]) ?? 'daily') === 'daily') op += amt
      }
      if (op > target) overDays++
    }
    return { rows, total, totalOp, totalLump, avgOp, target, overDays, loggedCount: loggedDates.size, actualStart, rangeEnd, spanDays }
  }, [logs, rangeStart, rangeEnd, today, catType, period, config.daily_target_krw, cats, lang])  // eslint-disable-line react-hooks/exhaustive-deps

  const periodBtns: { k: Period; label: string }[] = [
    { k: 'week',  label: lang === 'en' ? 'Week'  : '주' },
    { k: 'month', label: lang === 'en' ? 'Month' : '월' },
    { k: 'all',   label: lang === 'en' ? 'All' : '전체' },
  ]
  // 기간 라벨 (offset 반영)
  const offsetLabel = period === 'week'
    ? (offset === 0 ? (lang === 'en' ? 'This week' : '이번 주') : `${offset > 0 ? '+' : ''}${offset}${lang === 'en' ? 'w' : '주'}`)
    : period === 'month'
    ? (offset === 0 ? (lang === 'en' ? 'This month' : '이번 달') : report.actualStart.slice(0, 7))
    : (lang === 'en' ? 'All time' : '전체')

  return (
    <div className="bg-gray-900 rounded-2xl p-5">
      <p className="font-bold mb-3">💸 {lang === 'en' ? 'Expense Report' : '소비 리포트'}</p>

      {/* 기간 토글 */}
      <div className="flex gap-1.5 mb-2">
        {periodBtns.map(b => (
          <button key={b.k} onClick={() => { setPeriod(b.k); setOffset(0) }}
            className={`text-xs px-3 py-1.5 rounded-lg transition ${
              period === b.k ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>
            {b.label}
          </button>
        ))}
      </div>

      {/* ◀ 기간 ▶ 네비 (all 제외) */}
      {period !== 'all' && (
        <div className="flex items-center gap-2 mb-1.5">
          <button onClick={() => setOffset(o => o - 1)}
            className="w-7 h-7 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition">◀</button>
          <span className="text-xs text-gray-300 min-w-[70px] text-center">{offsetLabel}</span>
          <button onClick={() => setOffset(o => Math.min(0, o + 1))} disabled={offset >= 0}
            className={`w-7 h-7 rounded-lg text-sm transition ${offset >= 0 ? 'bg-gray-900 text-gray-700 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>▶</button>
          {offset !== 0 && (
            <button onClick={() => setOffset(0)}
              className="text-[11px] px-2 h-7 rounded-lg bg-blue-600/80 hover:bg-blue-500 text-white transition">
              {lang === 'en' ? 'Now' : '현재'}
            </button>
          )}
        </div>
      )}
      {/* 집계 기간 명시 */}
      <p className="text-[11px] text-gray-500 mb-4">
        📅 {report.actualStart} ~ {report.rangeEnd} · {report.spanDays}{lang === 'en' ? ' days' : '일간'}
      </p>

      {/* 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        <Mini label={lang === 'en' ? 'Total' : '총지출'} val={fmt(report.total)} />
        <Mini label={lang === 'en' ? 'Daily avg (op)' : '일평균(운영)'} val={fmt(Math.round(report.avgOp))}
          tone={report.target > 0 ? (report.avgOp <= report.target ? 'green' : 'red') : 'neutral'} />
        <Mini label={lang === 'en' ? 'Over target' : '목표초과일'} val={`${report.overDays}${lang === 'en' ? 'd' : '일'}`} tone="red" />
        <Mini label={lang === 'en' ? 'Logged days' : '기록일수'} val={`${report.loggedCount}${lang === 'en' ? 'd' : '일'}`} />
      </div>

      {/* 운영비 vs 일시불 */}
      {report.total > 0 && (
        <div className="mb-5">
          <div className="flex h-3 rounded-full overflow-hidden bg-gray-800">
            <div style={{ width: `${report.total ? report.totalOp / report.total * 100 : 0}%` }} className="bg-sky-500" />
            <div style={{ width: `${report.total ? report.totalLump / report.total * 100 : 0}%` }} className="bg-amber-500" />
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 mt-1">
            <span>🔵 {lang === 'en' ? 'Operating' : '운영비'} {fmt(report.totalOp)}</span>
            <span>🟡 {lang === 'en' ? 'Lump' : '일시불'} {fmt(report.totalLump)}</span>
          </div>
        </div>
      )}

      {/* 카테고리 비중 + 드릴다운 */}
      <p className="text-xs text-gray-500 mb-2">{lang === 'en' ? 'By category (tap to expand tags)' : '카테고리별 (탭하면 태그 펼침)'}</p>
      {report.rows.length === 0 && (
        <p className="text-gray-600 text-sm">{lang === 'en' ? 'No expenses in this period.' : '이 기간 지출 없음.'}</p>
      )}
      <div className="space-y-1.5">
        {report.rows.map(r => {
          const expanded = openCat === r.key
          return (
            <div key={r.key}>
              <button onClick={() => setOpenCat(expanded ? null : r.key)}
                className="w-full flex items-center gap-2 hover:bg-gray-800/40 rounded-lg px-1 py-0.5 transition">
                <span className="text-[10px] text-gray-600 w-3 shrink-0">{expanded ? '▾' : '▸'}</span>
                <span className="text-xs text-gray-300 w-24 truncate shrink-0 text-left">{r.label}</span>
                <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-600 flex items-center justify-end pr-1.5"
                    style={{ width: `${Math.max(r.pct, 4)}%` }}>
                    <span className="text-[9px] text-white/90">{r.pct.toFixed(0)}%</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400 w-20 text-right tabular-nums shrink-0">{fmt(r.amt)}</span>
              </button>

              {/* 태그 드릴다운 — 큰 지출 순 */}
              {expanded && (
                <div className="ml-8 mt-1 mb-2 space-y-1">
                  {r.tags.map((tg, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="text-gray-500 w-4 text-right shrink-0">{i + 1}.</span>
                      <span className="text-gray-300 flex-1 truncate">{tg.tag}</span>
                      <span className="text-gray-400 tabular-nums shrink-0">{fmt(tg.amt)}</span>
                      <span className="text-gray-600 w-10 text-right shrink-0">{r.amt ? (tg.amt / r.amt * 100).toFixed(0) : 0}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 공부/루틴 리포트 ────────────────────────────────────────────────
function StudyReport({ logs, config, lang }: {
  logs: DailyLog[]; config: BudgetConfig; lang: Lang
}) {
  const [period, setPeriod] = useState<Period>('week')
  const [offset, setOffset] = useState(0)
  const blocks = config.study_blocks_cfg ?? DEFAULT_STUDY_BLOCKS
  const today = todayStr()
  const { start, end } = useMemo(() => rangeFor(period, offset, today), [period, offset, today])

  const fmtH = (min: number) => {
    const h = Math.floor(min / 60), m = min % 60
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const data = useMemo(() => {
    const inRange = logs.filter(l => l.log_date >= start && l.log_date <= end)
    // 항목별 누적 분
    const perBlock = new Map<string, number>()
    // 요일별 합계(0=월…6=일)
    const perDow = new Array(7).fill(0)
    // streak: 하루라도 study_minutes>0 또는 study_blocks true면 "공부한 날"
    const studiedDates = new Set<string>()
    let grandTotal = 0
    for (const l of inRange) {
      const mins = l.study_minutes || {}
      const done = l.study_blocks || {}
      let dayTotal = 0
      for (const b of blocks) {
        const m = mins[b.key] || 0
        if (m > 0) { perBlock.set(b.key, (perBlock.get(b.key) || 0) + m); dayTotal += m }
      }
      if (dayTotal > 0 || blocks.some(b => done[b.key])) studiedDates.add(l.log_date)
      grandTotal += dayTotal
      if (dayTotal > 0) {
        const d = new Date(l.log_date + 'T00:00:00')
        const dow = (d.getDay() + 6) % 7
        perDow[dow] += dayTotal
      }
    }
    // 현재 streak (오늘부터 거꾸로 연속 공부일)
    let streak = 0
    for (let i = 0; ; i++) {
      const d = addDays(today, -i)
      if (studiedDates.has(d)) streak++
      else if (i === 0) continue   // 오늘 아직 안 했어도 어제부터 셈
      else break
      if (i > 400) break
    }
    const blockRows = blocks.map(b => {
      const acc = perBlock.get(b.key) || 0
      const spanDays = Math.max(1, daysBetween(period === 'all' && inRange.length ? inRange[0].log_date : start, end) + 1)
      const goalTotal = b.minutes * spanDays
      return { key: b.key, label: b.label, acc, goal: b.minutes, goalTotal, pct: goalTotal ? Math.min(100, acc / goalTotal * 100) : 0 }
    })
    return { blockRows, perDow, grandTotal, studiedCount: studiedDates.size, streak }
  }, [logs, start, end, blocks, period, today])

  const rangeLabel = period === 'week'
    ? (offset === 0 ? (lang === 'en' ? 'This week' : '이번 주') : `${offset}${lang === 'en' ? 'w' : '주'}`)
    : period === 'month'
    ? (offset === 0 ? (lang === 'en' ? 'This month' : '이번 달') : start.slice(0, 7))
    : (lang === 'en' ? 'All' : '전체')

  const dowLabels = lang === 'en' ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['월', '화', '수', '목', '금', '토', '일']
  const maxDow = Math.max(1, ...data.perDow)

  return (
    <div className="bg-gray-900 rounded-2xl p-5">
      <p className="font-bold mb-3">📚 {lang === 'en' ? 'Study Report' : '공부 리포트'}</p>

      <PeriodNav period={period} offset={offset} setPeriod={setPeriod} setOffset={setOffset} lang={lang} rangeLabel={rangeLabel} />
      <p className="text-[11px] text-gray-500 mb-4">📅 {start} ~ {end}</p>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        <Mini label={lang === 'en' ? 'Total time' : '총 시간'} val={fmtH(data.grandTotal)} />
        <Mini label={lang === 'en' ? 'Study days' : '공부일'} val={`${data.studiedCount}${lang === 'en' ? 'd' : '일'}`} />
        <Mini label={lang === 'en' ? 'Streak' : '연속'} val={`${data.streak}${lang === 'en' ? 'd' : '일'}`}
          tone={data.streak >= 3 ? 'green' : 'neutral'} />
      </div>

      {/* 항목별 누적 + 달성률 */}
      <p className="text-xs text-gray-500 mb-2">{lang === 'en' ? 'By item (vs goal)' : '항목별 (목표 대비)'}</p>
      <div className="space-y-2 mb-5">
        {data.blockRows.map(r => (
          <div key={r.key} className="flex items-center gap-2">
            <span className="text-xs text-gray-300 w-28 truncate shrink-0">{r.label}</span>
            <div className="flex-1 bg-gray-800 rounded-full h-4 overflow-hidden">
              <div className={`h-full rounded-full flex items-center justify-end pr-1.5 ${r.pct >= 100 ? 'bg-emerald-600' : 'bg-blue-600'}`}
                style={{ width: `${Math.max(r.pct, 4)}%` }}>
                <span className="text-[9px] text-white/90">{r.pct.toFixed(0)}%</span>
              </div>
            </div>
            <span className="text-xs text-gray-400 w-16 text-right tabular-nums shrink-0">{fmtH(r.acc)}</span>
          </div>
        ))}
        {data.grandTotal === 0 && (
          <p className="text-gray-600 text-sm">{lang === 'en' ? 'No study time logged in this period.' : '이 기간 기록된 공부 시간 없음.'}</p>
        )}
      </div>

      {/* 요일별 패턴 */}
      {data.grandTotal > 0 && (
        <>
          <p className="text-xs text-gray-500 mb-2">{lang === 'en' ? 'By weekday' : '요일별 집중'}</p>
          <div className="flex items-end gap-1.5 h-24">
            {data.perDow.map((v, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <span className="text-[9px] text-gray-500 mb-0.5">{v > 0 ? fmtH(v) : ''}</span>
                <div className="w-full rounded-t bg-indigo-500/80"
                  style={{ height: `${(v / maxDow) * 100}%`, minHeight: v > 0 ? 4 : 0 }} />
                <span className="text-[10px] text-gray-400 mt-1">{dowLabels[i]}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Mini({ label, val, tone = 'neutral' }: { label: string; val: string; tone?: 'neutral' | 'green' | 'red' }) {
  const color = tone === 'green' ? 'text-green-400' : tone === 'red' ? 'text-red-400' : 'text-gray-100'
  return (
    <div className="bg-gray-800/50 rounded-xl p-3">
      <p className="text-[11px] text-gray-500 mb-1">{label}</p>
      <p className={`text-base font-bold tabular-nums ${color}`}>{val}</p>
    </div>
  )
}
