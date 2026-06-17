'use client'
import { useEffect, useState } from 'react'
import {
  DailyLog, Lang,
  STUDY_BLOCKS, STUDY_TOTAL_MIN, studyStreak,
} from '../types'

interface Props {
  logs: DailyLog[]
  todayLog: DailyLog | null
  today: string                      // YYYY-MM-DD (UTC, same as DailyLogView)
  onUpsertToday: (patch: Partial<DailyLog>) => Promise<void>
  lang: Lang
}

// last n dates ending at `today`, matching the app's UTC date keys
function lastNDates(today: string, n: number): string[] {
  const out: string[] = []
  const base = new Date(today + 'T00:00:00Z')
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base)
    d.setUTCDate(base.getUTCDate() - i)
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export default function StudyBlocksView({ logs, todayLog, today, onUpsertToday, lang }: Props) {
  const [blocks, setBlocks] = useState<Record<string, boolean>>(todayLog?.study_blocks ?? {})
  const [saving, setSaving] = useState(false)

  // resync when the day rolls over or props refresh
  useEffect(() => {
    setBlocks(todayLog?.study_blocks ?? {})
  }, [todayLog])

  const toggle = async (key: string) => {
    const next = { ...blocks, [key]: !blocks[key] }
    setBlocks(next)                  // optimistic
    setSaving(true)
    try {
      await onUpsertToday({ study_blocks: next })
    } finally {
      setSaving(false)
    }
  }

  const doneCount = STUDY_BLOCKS.filter(b => blocks[b.key]).length
  const doneMin   = STUDY_BLOCKS.filter(b => blocks[b.key]).reduce((s, b) => s + b.minutes, 0)
  const pct       = Math.round((doneMin / STUDY_TOTAL_MIN) * 100)
  const streak    = studyStreak(logs)
  const week      = lastNDates(today, 7)

  const byDate = new Map(logs.map(l => [l.log_date, l.study_blocks ?? {}]))
  const countDone = (sb: Record<string, boolean>) => STUDY_BLOCKS.filter(b => sb[b.key]).length

  const allDone = doneCount === STUDY_BLOCKS.length

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-100">
            {lang === 'en' ? 'Fixed routine' : 'Rutina fija'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {lang === 'en' ? 'Non-negotiable 4 h, like a workout' : '4 h innegociables, como entrenar'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">
            {doneCount}<span className="text-base font-normal text-gray-500">/{STUDY_BLOCKS.length}</span>
          </p>
          {streak > 0 && <p className="text-xs font-medium text-amber-400">🔥 {streak}{lang === 'en' ? ' days' : ' días'}</p>}
        </div>
      </div>

      {/* progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{doneMin} min</span>
          <span>{STUDY_TOTAL_MIN} min</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-800">
          <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* block toggles */}
      <div className="space-y-2.5">
        {STUDY_BLOCKS.map(b => {
          const done = !!blocks[b.key]
          return (
            <button
              key={b.key}
              type="button"
              disabled={saving}
              onClick={() => toggle(b.key)}
              className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition disabled:opacity-60 ${
                done ? `${b.accent} text-white` : 'bg-gray-800 hover:bg-gray-700 text-gray-100'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                done ? 'bg-white/20' : 'bg-gray-900 text-gray-400'
              }`}>
                {done ? '✓' : `${b.minutes}'`}
              </span>
              <span className="min-w-0 flex-1 font-medium">{b[lang]}</span>
              <span className={`shrink-0 text-sm tabular-nums ${done ? 'text-white/80' : 'text-gray-500'}`}>
                {b.minutes} min
              </span>
            </button>
          )
        })}
      </div>

      {/* 7-day strip */}
      <div className="flex items-center justify-between gap-1.5">
        {week.map(d => {
          const c = countDone(byDate.get(d) ?? {})
          const isToday = d === today
          const color = c >= STUDY_BLOCKS.length ? 'bg-blue-600' : c > 0 ? 'bg-blue-600/40' : 'bg-gray-800'
          return (
            <div key={d} className="flex flex-1 flex-col items-center gap-1" title={`${d} · ${c}/${STUDY_BLOCKS.length}`}>
              <div className={`h-6 w-full rounded-md ${color} ${isToday ? 'ring-2 ring-blue-400/60' : ''}`} />
              <span className="text-[10px] text-gray-600">{Number(d.slice(8, 10))}</span>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-500 border-t border-gray-800 pt-3">
        {allDone
          ? (lang === 'en' ? 'Done. The rest of the day is yours — movement, rest, leisure.'
                           : 'Listo. El resto del día es tuyo — movimiento, descanso, ocio.')
          : (lang === 'en' ? 'Only these 4 h are fixed. The rest stays open.'
                           : 'Solo estas 4 h son fijas. El resto queda libre.')}
      </p>
    </div>
  )
}
