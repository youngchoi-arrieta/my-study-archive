'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { Milestone, DailyLog, BudgetConfig } from './types'
import MilestonesView from './components/MilestonesView'
import DailyLogView from './components/DailyLogView'
import BudgetView from './components/BudgetView'

type Tab = 'summary' | 'milestones' | 'log' | 'budget'

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

function formatKRW(n: number): string {
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(0) + '만원'
  return n.toLocaleString('ko-KR') + '원'
}

export default function LifeOpsDashboard() {
  const [tab, setTab] = useState<Tab>('summary')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [config, setConfig] = useState<BudgetConfig | null>(null)
  const [loading, setLoading] = useState(true)

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

  // === Milestones handlers ===
  async function saveMilestone(patch: Partial<Milestone>, id?: string) {
    if (id) {
      await supabase.from('milestones').update(patch).eq('id', id)
    } else {
      await supabase.from('milestones').insert(patch)
    }
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

  // === Daily log upsert (오늘 행에 머지) ===
  async function upsertToday(patch: Partial<DailyLog>) {
    const today = todayStr()
    const existing = logs.find(l => l.log_date === today)
    if (existing) {
      const merged = {
        ...existing,
        ...patch,
        study_minutes: patch.study_minutes !== undefined ? patch.study_minutes : existing.study_minutes,
        expense_krw:   patch.expense_krw   !== undefined ? patch.expense_krw   : existing.expense_krw,
      }
      await supabase.from('daily_logs').update(merged).eq('id', existing.id)
      setLogs(prev => prev.map(l => l.id === existing.id ? merged as DailyLog : l))
    } else {
      const insert = {
        log_date: today,
        study_minutes: patch.study_minutes || {},
        expense_krw: patch.expense_krw || {},
        condition: patch.condition ?? null,
        memo: patch.memo ?? null,
      }
      const { data } = await supabase.from('daily_logs').insert(insert).select().single()
      if (data) setLogs(prev => [...prev, data])
    }
  }

  // === Budget config update ===
  async function updateConfig(patch: Partial<BudgetConfig>) {
    await supabase.from('budget_config').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
    setConfig(prev => prev ? { ...prev, ...patch } as BudgetConfig : prev)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-6">
        <p className="text-gray-500 text-center py-20">불러오는 중...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-white text-sm transition">← 홈</Link>
          <h1 className="text-3xl font-bold">🧭 생활 작전실</h1>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 border-b border-gray-800 mb-5 overflow-x-auto">
          {([
            { id: 'summary',    label: '오늘 한눈에' },
            { id: 'milestones', label: '마일스톤' },
            { id: 'log',        label: '일일 로그' },
            { id: 'budget',     label: '예산' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-white text-white font-medium'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'summary' && config && (
          <SummaryView
            milestones={milestones} logs={logs} config={config}
            onJumpTab={setTab}
          />
        )}
        {tab === 'milestones' && (
          <MilestonesView
            milestones={milestones}
            onSave={saveMilestone}
            onDelete={deleteMilestone}
            onToggleDone={toggleDone}
          />
        )}
        {tab === 'log' && config && (
          <DailyLogView
            logs={logs}
            onUpsertToday={upsertToday}
            dailyTargetKrw={config.daily_target_krw}
          />
        )}
        {tab === 'budget' && config && (
          <BudgetView
            logs={logs}
            config={config}
            onUpdateConfig={updateConfig}
          />
        )}

      </div>
    </main>
  )
}

// ===== Summary: 한눈에 =====
function SummaryView({
  milestones, logs, config, onJumpTab,
}: {
  milestones: Milestone[]
  logs: DailyLog[]
  config: BudgetConfig
  onJumpTab: (t: Tab) => void
}) {
  const today = todayStr()
  const todayLog = logs.find(l => l.log_date === today)

  const studyToday = todayLog
    ? Object.values(todayLog.study_minutes || {}).reduce((a, b) => a + (b || 0), 0)
    : 0
  const expenseToday = todayLog
    ? Object.values(todayLog.expense_krw || {}).reduce((a, b) => a + (b || 0), 0)
    : 0

  const totalSpent = logs.reduce(
    (s, l) => s + Object.values(l.expense_krw || {}).reduce((a, b) => a + (b || 0), 0),
    0
  )
  const balance = config.start_balance_krw - totalSpent

  // 다가오는 마일스톤 3개
  const upcoming = [...milestones]
    .filter(m => !m.done && daysUntil(m.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)

  return (
    <div className="space-y-5">
      {/* 오늘 스냅샷 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">오늘 공부</p>
          <p className="text-xl font-bold">
            {Math.floor(studyToday / 60)}h {studyToday % 60}m
          </p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">오늘 지출</p>
          <p className={`text-xl font-bold ${expenseToday > config.daily_target_krw ? 'text-red-400' : 'text-green-400'}`}>
            {formatKRW(expenseToday)}
          </p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">잔액</p>
          <p className="text-xl font-bold">{formatKRW(balance)}</p>
        </div>
        <div className="bg-gray-900 rounded-2xl p-4">
          <p className="text-xs text-gray-500 mb-1">기록일</p>
          <p className="text-xl font-bold">{logs.length}<span className="text-sm text-gray-400 font-normal">일</span></p>
        </div>
      </div>

      {/* 빠른 진입 */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onJumpTab('log')}
          className="bg-blue-900/30 hover:bg-blue-900/50 border border-blue-800/40 rounded-2xl p-4 text-left transition"
        >
          <p className="text-sm font-semibold mb-1">➕ 오늘 기록하기</p>
          <p className="text-xs text-gray-400">공부 시간 · 지출 · 컨디션</p>
        </button>
        <button
          onClick={() => onJumpTab('budget')}
          className="bg-amber-900/30 hover:bg-amber-900/50 border border-amber-800/40 rounded-2xl p-4 text-left transition"
        >
          <p className="text-sm font-semibold mb-1">📈 예산 궤적 보기</p>
          <p className="text-xs text-gray-400">피봇 시점 잔액 예측</p>
        </button>
      </div>

      {/* 다가오는 마일스톤 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">다가오는 마일스톤</h3>
          <button
            onClick={() => onJumpTab('milestones')}
            className="text-xs text-gray-500 hover:text-white"
          >전체 보기 →</button>
        </div>
        <div className="space-y-2">
          {upcoming.length === 0 && (
            <p className="text-gray-600 text-center py-6 text-sm">예정된 마일스톤이 없습니다.</p>
          )}
          {upcoming.map(m => {
            const d = daysUntil(m.date)
            const urgent = d <= 7
            return (
              <div key={m.id} className="bg-gray-900 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{m.title}</p>
                  <p className="text-xs text-gray-500">{m.date}{m.note ? ` · ${m.note}` : ''}</p>
                </div>
                <p className={`text-2xl font-bold ${urgent ? 'text-red-400' : 'text-white'}`}>
                  {d === 0 ? '오늘' : `D-${d}`}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
