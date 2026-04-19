'use client'
import { useState, useMemo, useEffect } from 'react'
import { DailyLog, STUDY_SUBJECTS, EXPENSE_CATEGORIES } from '../types'

interface Props {
  logs: DailyLog[]
  onUpsertToday: (patch: Partial<DailyLog>) => Promise<void>
  dailyTargetKrw: number
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function sumMinutes(m: Record<string, number>): number {
  return Object.values(m).reduce((a, b) => a + (b || 0), 0)
}

function sumExpense(e: Record<string, number>): number {
  return Object.values(e).reduce((a, b) => a + (b || 0), 0)
}

export default function DailyLogView({ logs, onUpsertToday, dailyTargetKrw }: Props) {
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
      <TodayCard log={todayLog} onUpsert={onUpsertToday} dailyTargetKrw={dailyTargetKrw} />
      <HistoryTable logs={recent} dailyTargetKrw={dailyTargetKrw} />
    </div>
  )
}

function TodayCard({
  log,
  onUpsert,
  dailyTargetKrw,
}: {
  log: DailyLog | null
  onUpsert: (patch: Partial<DailyLog>) => Promise<void>
  dailyTargetKrw: number
}) {
  const study = log?.study_minutes || {}
  const expense = log?.expense_krw || {}

  // 빠른 추가 입력 상태
  const [addSubject, setAddSubject] = useState<string>(STUDY_SUBJECTS[0])
  const [addMin, setAddMin] = useState<string>('')
  const [addCat, setAddCat] = useState<string>(EXPENSE_CATEGORIES[0].key)
  const [addKrw, setAddKrw] = useState<string>('')
  const [condition, setCondition] = useState<number>(log?.condition || 3)
  const [memo, setMemo] = useState<string>(log?.memo || '')

  // log prop 변경 시 로컬 state 동기화
  useEffect(() => {
    if (log) {
      setCondition(log.condition || 3)
      setMemo(log.memo || '')
    }
  }, [log])

  const totalStudyMin = sumMinutes(study)
  const totalExpense = sumExpense(expense)
  const overBudget = totalExpense > dailyTargetKrw

  async function addStudy() {
    const m = parseInt(addMin)
    if (!m || m <= 0) return
    const next = { ...study, [addSubject]: (study[addSubject] || 0) + m }
    await onUpsert({ study_minutes: next })
    setAddMin('')
  }

  async function addExpense() {
    const k = parseInt(addKrw.replace(/,/g, ''))
    if (!k || k <= 0) return
    const next = { ...expense, [addCat]: (expense[addCat] || 0) + k }
    await onUpsert({ expense_krw: next })
    setAddKrw('')
  }

  async function removeStudy(subject: string) {
    const next = { ...study }
    delete next[subject]
    await onUpsert({ study_minutes: next })
  }

  async function removeExpense(cat: string) {
    const next = { ...expense }
    delete next[cat]
    await onUpsert({ expense_krw: next })
  }

  async function saveMeta() {
    await onUpsert({ condition, memo: memo.trim() || null })
  }

  return (
    <div className="bg-gray-900 rounded-2xl p-5">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-lg font-bold">오늘의 기록</h3>
        <p className="text-xs text-gray-500">{todayStr()}</p>
      </div>

      {/* 요약 스탯 */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gray-950 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">총 공부 시간</p>
          <p className="text-2xl font-bold">
            {Math.floor(totalStudyMin / 60)}
            <span className="text-sm text-gray-400 font-normal">시간 </span>
            {totalStudyMin % 60}
            <span className="text-sm text-gray-400 font-normal">분</span>
          </p>
        </div>
        <div className="bg-gray-950 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-1">
            지출 / 목표 {formatKRW(dailyTargetKrw)}
          </p>
          <p className={`text-2xl font-bold ${overBudget ? 'text-red-400' : 'text-green-400'}`}>
            {formatKRW(totalExpense)}
          </p>
        </div>
      </div>

      {/* 공부 섹션 */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-300">📚 공부</h4>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
          {Object.entries(study).map(([sub, min]) => (
            <button
              key={sub}
              onClick={() => removeStudy(sub)}
              className="bg-blue-900/40 hover:bg-red-900/40 text-blue-200 hover:text-red-200 text-xs px-2.5 py-1 rounded-full transition"
              title="클릭하여 삭제"
            >
              {sub} · {min}분 ×
            </button>
          ))}
          {Object.keys(study).length === 0 && (
            <p className="text-xs text-gray-600 py-1">기록 없음</p>
          )}
        </div>
        <div className="flex gap-2">
          <select
            className="bg-gray-800 rounded-lg px-2 py-1.5 text-sm flex-1"
            value={addSubject}
            onChange={e => setAddSubject(e.target.value)}
          >
            {STUDY_SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <input
            type="number"
            inputMode="numeric"
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm w-24"
            placeholder="분"
            value={addMin}
            onChange={e => setAddMin(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addStudy()}
          />
          <button
            onClick={addStudy}
            className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-sm"
          >추가</button>
        </div>
      </div>

      {/* 지출 섹션 */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-gray-300">💸 지출</h4>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[28px]">
          {Object.entries(expense).map(([cat, krw]) => {
            const label = EXPENSE_CATEGORIES.find(c => c.key === cat)?.label || cat
            return (
              <button
                key={cat}
                onClick={() => removeExpense(cat)}
                className="bg-amber-900/40 hover:bg-red-900/40 text-amber-200 hover:text-red-200 text-xs px-2.5 py-1 rounded-full transition"
                title="클릭하여 삭제"
              >
                {label} · {formatKRW(krw)} ×
              </button>
            )
          })}
          {Object.keys(expense).length === 0 && (
            <p className="text-xs text-gray-600 py-1">기록 없음</p>
          )}
        </div>
        <div className="flex gap-2">
          <select
            className="bg-gray-800 rounded-lg px-2 py-1.5 text-sm flex-1"
            value={addCat}
            onChange={e => setAddCat(e.target.value)}
          >
            {EXPENSE_CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input
            type="text"
            inputMode="numeric"
            className="bg-gray-800 rounded-lg px-3 py-1.5 text-sm w-28"
            placeholder="원"
            value={addKrw}
            onChange={e => setAddKrw(e.target.value.replace(/[^0-9,]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && addExpense()}
          />
          <button
            onClick={addExpense}
            className="bg-amber-600 hover:bg-amber-500 px-3 py-1.5 rounded-lg text-sm"
          >추가</button>
        </div>
      </div>

      {/* 컨디션 + 메모 */}
      <div className="border-t border-gray-800 pt-4">
        <div className="flex items-center gap-4 mb-3">
          <span className="text-xs text-gray-400">컨디션</span>
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
        <textarea
          className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm resize-none"
          rows={2}
          placeholder="한 줄 메모 (무엇이 잘 됐나? 막힌 지점은?)"
          value={memo}
          onChange={e => setMemo(e.target.value)}
          onBlur={saveMeta}
        />
        <p className="text-xs text-gray-600 mt-1">* 입력 칸 밖 클릭 시 자동 저장</p>
      </div>
    </div>
  )
}

function HistoryTable({ logs, dailyTargetKrw }: { logs: DailyLog[]; dailyTargetKrw: number }) {
  if (logs.length === 0) return null

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-widest">최근 2주</h3>
      <div className="bg-gray-900 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-950 text-xs text-gray-500">
            <tr>
              <th className="text-left px-3 py-2">날짜</th>
              <th className="text-right px-3 py-2">공부</th>
              <th className="text-right px-3 py-2">지출</th>
              <th className="text-center px-3 py-2">컨디션</th>
              <th className="text-left px-3 py-2 hidden md:table-cell">메모</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => {
              const study = sumMinutes(l.study_minutes)
              const expense = sumExpense(l.expense_krw)
              const over = expense > dailyTargetKrw
              return (
                <tr key={l.id} className="border-t border-gray-800">
                  <td className="px-3 py-2 text-gray-400">{l.log_date.slice(5)}</td>
                  <td className="px-3 py-2 text-right">
                    {Math.floor(study / 60)}h {study % 60}m
                  </td>
                  <td className={`px-3 py-2 text-right ${over ? 'text-red-400' : ''}`}>
                    {formatKRW(expense)}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-400">
                    {l.condition || '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs truncate max-w-xs hidden md:table-cell">
                    {l.memo || ''}
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
