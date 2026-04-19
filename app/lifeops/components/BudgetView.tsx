'use client'
import { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import { DailyLog, BudgetConfig } from '../types'

interface Props {
  logs: DailyLog[]
  config: BudgetConfig
  onUpdateConfig: (patch: Partial<BudgetConfig>) => Promise<void>
}

function formatKRW(n: number): string {
  if (Math.abs(n) >= 10000) {
    return (n / 10000).toFixed(0) + '만원'
  }
  return n.toLocaleString('ko-KR') + '원'
}

function sumExpense(e: Record<string, number>): number {
  return Object.values(e).reduce((a, b) => a + (b || 0), 0)
}

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00').getTime()
  const db = new Date(b + 'T00:00:00').getTime()
  return Math.round((db - da) / 86400000)
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function BudgetView({ logs, config, onUpdateConfig }: Props) {
  const today = todayStr()

  // 일자별 지출 맵
  const expenseByDate = useMemo(() => {
    const m = new Map<string, number>()
    logs.forEach(l => m.set(l.log_date, sumExpense(l.expense_krw)))
    return m
  }, [logs])

  // 실제 누적 지출
  const totalSpent = useMemo(
    () => logs.reduce((s, l) => s + sumExpense(l.expense_krw), 0),
    [logs]
  )

  const daysSinceStart = daysBetween(config.start_date, today)
  const actualBalance = config.start_balance_krw - totalSpent
  const actualDailyRate = daysSinceStart > 0 ? totalSpent / daysSinceStart : 0

  // 피봇 시점 예측
  const daysToPivot = config.pivot_date ? daysBetween(today, config.pivot_date) : 0
  const projectedAtPivotActualRate = actualBalance - (actualDailyRate * daysToPivot)
  const projectedAtPivotTargetRate = actualBalance - (config.daily_target_krw * daysToPivot)

  // 차트 데이터: start_date부터 pivot_date까지
  // - 목표 라인 (target): 시작잔액 - daily_target * 경과일
  // - 실제 라인 (actual): 날짜별 누적 실제 잔액, 오늘까지만
  // - 예측 라인 (forecast): 오늘 이후 현재 페이스로 연장
  const chartData = useMemo(() => {
    if (!config.pivot_date) return []
    const start = config.start_date
    const end = config.pivot_date
    const totalDays = daysBetween(start, end)
    if (totalDays <= 0) return []

    // 누적 실제 지출을 날짜별로 계산
    let cumActual = 0
    const actualByDate = new Map<string, number>()
    const sortedDates = [...expenseByDate.keys()].sort()
    for (const d of sortedDates) {
      cumActual += expenseByDate.get(d) || 0
      actualByDate.set(d, cumActual)
    }

    const data: Array<{ date: string; target: number; actual: number | null; forecast: number | null }> = []

    // 데이터 샘플링: 날이 많으면 2-3일 간격
    const step = totalDays > 90 ? 3 : totalDays > 30 ? 1 : 1

    for (let i = 0; i <= totalDays; i += step) {
      const d = addDays(start, i)
      const target = config.start_balance_krw - config.daily_target_krw * i

      let actual: number | null = null
      let forecast: number | null = null

      if (d <= today) {
        // 해당 날짜까지의 누적 실제 지출 찾기 (그 날짜 이전의 가장 최근 값)
        let last = 0
        for (const [dt, v] of actualByDate) {
          if (dt <= d) last = v
          else break
        }
        actual = config.start_balance_krw - last
      } else {
        // 미래: 현재 페이스로 예측
        const daysAhead = daysBetween(today, d)
        forecast = actualBalance - actualDailyRate * daysAhead
      }

      data.push({ date: d.slice(5), target, actual, forecast })
    }

    // 오늘 시점을 명확히 포함하고 연결점 만들기
    // 예측선이 오늘의 실제 값에서 시작하도록
    const todayIdx = data.findIndex(p => {
      const pDate = addDays(start, data.indexOf(p) * step)
      return pDate >= today
    })
    if (todayIdx >= 0 && data[todayIdx]) {
      // 현재 점에 forecast 값도 넣어 연결
      if (data[todayIdx].actual !== null) {
        data[todayIdx].forecast = data[todayIdx].actual
      }
    }

    return data
  }, [config, expenseByDate, today, actualBalance, actualDailyRate])

  const [settingsOpen, setSettingsOpen] = useState(false)

  // 현재 상태 판정
  const pace = actualDailyRate - config.daily_target_krw
  const paceStatus: 'good' | 'warn' | 'bad' =
    pace < -5000 ? 'good' : pace > 5000 ? 'bad' : 'warn'

  return (
    <div className="space-y-5">

      {/* 핵심 수치 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="현재 잔액"
          value={formatKRW(actualBalance)}
          sub={`시작 ${formatKRW(config.start_balance_krw)}`}
        />
        <StatCard
          label="누적 지출"
          value={formatKRW(totalSpent)}
          sub={`${daysSinceStart}일 경과`}
        />
        <StatCard
          label="실제 일평균"
          value={formatKRW(Math.round(actualDailyRate))}
          sub={`목표 ${formatKRW(config.daily_target_krw)}`}
          tone={paceStatus === 'good' ? 'green' : paceStatus === 'bad' ? 'red' : 'amber'}
        />
        {config.pivot_date && (
          <StatCard
            label={`피봇 시점 예상 잔액`}
            value={formatKRW(Math.round(projectedAtPivotActualRate))}
            sub={`D-${daysToPivot} · ${config.pivot_date}`}
            tone={projectedAtPivotActualRate < 3000000 ? 'red' : 'green'}
          />
        )}
      </div>

      {/* 페이스 요약 */}
      <div className={`rounded-2xl p-4 ${
        paceStatus === 'good' ? 'bg-green-900/20 border border-green-800/40' :
        paceStatus === 'bad'  ? 'bg-red-900/20 border border-red-800/40' :
                                'bg-amber-900/20 border border-amber-800/40'
      }`}>
        <p className="text-sm">
          {paceStatus === 'good' && (
            <>✅ 목표 페이스보다 <span className="font-bold text-green-400">{formatKRW(Math.round(-pace))}</span> 적게 쓰고 있습니다. 이 페이스 유지 시 피봇 시점 잔액은 목표 페이스 대비 <span className="font-bold">{formatKRW(Math.round(projectedAtPivotActualRate - projectedAtPivotTargetRate))}</span> 여유.</>
          )}
          {paceStatus === 'warn' && (
            <>⚖️ 목표 페이스에 거의 맞춰 쓰고 있습니다. 약간의 여유는 있지만 이벤트성 지출(시험, 이동)에 대비가 필요합니다.</>
          )}
          {paceStatus === 'bad' && (
            <>⚠️ 목표 페이스보다 <span className="font-bold text-red-400">{formatKRW(Math.round(pace))}</span> 초과 중입니다. 이 페이스 유지 시 피봇 시점 잔액이 목표 대비 <span className="font-bold">{formatKRW(Math.round(projectedAtPivotTargetRate - projectedAtPivotActualRate))}</span> 부족.</>
          )}
        </p>
      </div>

      {/* 차트 */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">잔액 궤적</h3>
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-xs text-gray-400 hover:text-white"
            >
              ⚙️ 설정
            </button>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" stroke="#6b7280" style={{ fontSize: 11 }} />
                <YAxis
                  stroke="#6b7280"
                  style={{ fontSize: 11 }}
                  tickFormatter={v => (v / 10000).toFixed(0) + '만'}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  formatter={(v) => typeof v === 'number' ? formatKRW(Math.round(v)) : '-'}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine y={0} stroke="#ef4444" strokeDasharray="3 3" />
                <Line
                  type="monotone" dataKey="target" name="목표 페이스"
                  stroke="#6b7280" strokeDasharray="4 4" dot={false} strokeWidth={1.5}
                />
                <Line
                  type="monotone" dataKey="actual" name="실제 잔액"
                  stroke="#3b82f6" dot={false} strokeWidth={2}
                  connectNulls={false}
                />
                <Line
                  type="monotone" dataKey="forecast" name="현재 페이스 예측"
                  stroke="#f59e0b" strokeDasharray="2 2" dot={false} strokeWidth={2}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!config.pivot_date && (
        <div className="bg-gray-900 rounded-2xl p-4 text-center">
          <p className="text-gray-400 text-sm mb-3">피봇 목표일이 설정되지 않았습니다.</p>
          <button
            onClick={() => setSettingsOpen(true)}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm"
          >예산 설정</button>
        </div>
      )}

      {settingsOpen && (
        <BudgetSettingsModal
          config={config}
          onSave={async (patch) => { await onUpdateConfig(patch); setSettingsOpen(false) }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}

function StatCard({
  label, value, sub, tone,
}: {
  label: string; value: string; sub?: string; tone?: 'green' | 'red' | 'amber'
}) {
  const toneCls =
    tone === 'green' ? 'text-green-400' :
    tone === 'red'   ? 'text-red-400' :
    tone === 'amber' ? 'text-amber-400' :
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
  config, onSave, onClose,
}: {
  config: BudgetConfig
  onSave: (p: Partial<BudgetConfig>) => Promise<void>
  onClose: () => void
}) {
  const [startBal, setStartBal] = useState(String(config.start_balance_krw))
  const [startDate, setStartDate] = useState(config.start_date)
  const [target, setTarget] = useState(String(config.daily_target_krw))
  const [pivotDate, setPivotDate] = useState(config.pivot_date || '')

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">예산 설정</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">시작 잔액 (원)</label>
            <input
              type="number"
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm"
              value={startBal}
              onChange={e => setStartBal(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">시작 날짜</label>
            <input
              type="date"
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">일일 목표 지출 (원)</label>
            <input
              type="number"
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm"
              value={target}
              onChange={e => setTarget(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">피봇 목표일 (예: 아내 합류일)</label>
            <input
              type="date"
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm"
              value={pivotDate}
              onChange={e => setPivotDate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg">취소</button>
          <button
            onClick={() => onSave({
              start_balance_krw: parseInt(startBal) || 0,
              start_date: startDate,
              daily_target_krw: parseInt(target) || 0,
              pivot_date: pivotDate || null,
            })}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg"
          >저장</button>
        </div>
      </div>
    </div>
  )
}
