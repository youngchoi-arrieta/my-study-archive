'use client'
import { useEffect, useState } from 'react'
import {
  DailyLog, BudgetConfig, Lang,
  StudyBlockCfg, DEFAULT_STUDY_BLOCKS, studyStreak,
} from '../types'

interface Props {
  logs: DailyLog[]
  todayLog: DailyLog | null
  blocks: StudyBlockCfg[]            // config.study_blocks_cfg ?? DEFAULT_STUDY_BLOCKS
  onUpsertToday: (patch: Partial<DailyLog>) => Promise<void>
  onUpdateConfig: (patch: Partial<BudgetConfig>) => Promise<void>
  lang: Lang
}

export default function StudyBlocksView({ logs, todayLog, blocks, onUpsertToday, onUpdateConfig, lang }: Props) {
  const [done, setDone] = useState<Record<string, boolean>>(todayLog?.study_blocks ?? {})
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<StudyBlockCfg[]>(blocks)

  // resync completion when the day rolls over / props refresh
  useEffect(() => { setDone(todayLog?.study_blocks ?? {}) }, [todayLog])
  // resync draft when config changes
  useEffect(() => { setDraft(blocks) }, [blocks])

  const toggle = async (key: string) => {
    if (editing) return
    const next = { ...done, [key]: !done[key] }
    setDone(next)                              // optimistic
    setSaving(true)
    try { await onUpsertToday({ study_blocks: next }) }
    finally { setSaving(false) }
  }

  const saveConfig = async () => {
    const cleaned = draft.map(b => ({
      ...b,
      label: b.label.trim() || b.key,
      minutes: Math.max(0, Math.round(b.minutes) || 0),
    }))
    setEditing(false)
    await onUpdateConfig({ study_blocks_cfg: cleaned })
  }

  const totalMin  = blocks.reduce((s, b) => s + b.minutes, 0)
  const doneCount = blocks.filter(b => done[b.key]).length
  const doneMin   = blocks.filter(b => done[b.key]).reduce((s, b) => s + b.minutes, 0)
  const pct       = totalMin > 0 ? Math.round((doneMin / totalMin) * 100) : 0
  const streak    = studyStreak(logs, blocks)
  const allDone   = blocks.length > 0 && doneCount === blocks.length

  return (
    <div className="bg-gray-900 rounded-2xl p-5 space-y-4">
      {/* header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-100">
            {lang === 'en' ? 'Fixed routine' : 'Rutina fija'}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {lang === 'en' ? 'Non-negotiable, like a workout' : 'Innegociable, como entrenar'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!editing && (
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums leading-none">
                {doneCount}<span className="text-base font-normal text-gray-500">/{blocks.length}</span>
              </p>
              {streak > 0 && <p className="text-xs font-medium text-amber-400 mt-0.5">🔥 {streak}{lang === 'en' ? ' days' : ' días'}</p>}
            </div>
          )}
          <button
            type="button"
            onClick={() => (editing ? setEditing(false) : setEditing(true))}
            className="text-xs text-gray-500 hover:text-gray-300 transition"
            title={lang === 'en' ? 'Edit names' : 'Editar nombres'}
          >
            {editing ? '✕' : '✏️'}
          </button>
        </div>
      </div>

      {/* progress bar (hidden while editing) */}
      {!editing && (
        <div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>{doneMin} min</span>
            <span>{totalMin} min</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-800">
            <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* rows */}
      {editing ? (
        <div className="space-y-2.5">
          {draft.map((b, i) => (
            <div key={b.key} className="flex items-center gap-2 bg-gray-800 rounded-xl px-3 py-2">
              <input
                value={b.label}
                onChange={e => setDraft(d => d.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                placeholder={lang === 'en' ? 'Routine name' : 'Nombre'}
                className="min-w-0 flex-1 bg-transparent text-gray-100 font-medium outline-none placeholder:text-gray-600"
              />
              <input
                type="number" inputMode="numeric" min={0}
                value={b.minutes}
                onChange={e => setDraft(d => d.map((x, j) => j === i ? { ...x, minutes: Number(e.target.value) } : x))}
                className="w-16 bg-gray-900 rounded-lg px-2 py-1 text-right text-sm tabular-nums text-gray-200 outline-none"
              />
              <span className="text-xs text-gray-500">min</span>
            </div>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setDraft(blocks); setEditing(false) }}
              className="flex-1 py-2 rounded-lg bg-gray-800 text-sm">
              {lang === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button type="button" onClick={saveConfig}
              className="flex-1 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold">
              {lang === 'en' ? 'Save' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          {blocks.map(b => {
            const isDone = !!done[b.key]
            return (
              <button
                key={b.key}
                type="button"
                disabled={saving}
                onClick={() => toggle(b.key)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition disabled:opacity-60 ${
                  isDone ? `${b.accent} text-white` : 'bg-gray-800 hover:bg-gray-700 text-gray-100'
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                  isDone ? 'bg-white/20' : 'bg-gray-900 text-gray-400'
                }`}>
                  {isDone ? '✓' : `${b.minutes}'`}
                </span>
                <span className="min-w-0 flex-1 font-medium truncate">{b.label}</span>
                <span className={`shrink-0 text-sm tabular-nums ${isDone ? 'text-white/80' : 'text-gray-500'}`}>
                  {b.minutes} min
                </span>
              </button>
            )
          })}
        </div>
      )}

      {!editing && (
        <p className="text-xs text-gray-500 border-t border-gray-800 pt-3">
          {allDone
            ? (lang === 'en' ? 'Done. The rest of the day is yours — not tracked.'
                             : 'Listo. El resto del día es tuyo — sin registrar.')
            : (lang === 'en' ? 'Only these are fixed. The rest of the day is not tracked.'
                             : 'Solo esto es fijo. El resto del día no se registra.')}
        </p>
      )}
    </div>
  )
}
