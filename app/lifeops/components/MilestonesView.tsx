'use client'
import { useState } from 'react'
import { Milestone, KIND_META, MilestoneKind } from '../types'

interface Props {
  milestones: Milestone[]
  onSave: (m: Partial<Milestone>, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onToggleDone: (id: string, done: boolean) => Promise<void>
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(dateStr + 'T00:00:00')
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

export default function MilestonesView({ milestones, onSave, onDelete, onToggleDone }: Props) {
  const [modalOpen, setModalOpen] = useState(false)
  const [edit, setEdit] = useState<Milestone | null>(null)

  // 날짜순 정렬
  const sorted = [...milestones].sort((a, b) => a.date.localeCompare(b.date))

  // 과거 / 오늘~미래 분리
  const upcoming = sorted.filter(m => daysUntil(m.date) >= 0)
  const past = sorted.filter(m => daysUntil(m.date) < 0).reverse()

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-gray-400 text-sm">
          다가오는 일정 <span className="text-white font-semibold">{upcoming.length}</span>개 · 지난 일정 {past.length}개
        </p>
        <button
          onClick={() => { setEdit(null); setModalOpen(true) }}
          className="bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded-lg text-sm transition"
        >
          + 마일스톤
        </button>
      </div>

      {/* 다가오는 일정 */}
      <div className="space-y-2 mb-8">
        {upcoming.length === 0 && (
          <p className="text-gray-600 text-center py-8 text-sm">예정된 마일스톤이 없습니다.</p>
        )}
        {upcoming.map(m => {
          const d = daysUntil(m.date)
          const meta = KIND_META[m.kind]
          const urgent = d <= 7
          return (
            <div
              key={m.id}
              className={`bg-gray-900 rounded-2xl p-4 flex items-center gap-4 border ${
                urgent ? 'border-red-600/40' : 'border-transparent'
              }`}
            >
              <button
                onClick={() => onToggleDone(m.id, !m.done)}
                className={`w-5 h-5 rounded border-2 flex-shrink-0 transition ${
                  m.done
                    ? 'bg-green-600 border-green-600'
                    : 'border-gray-600 hover:border-gray-400'
                }`}
                title={m.done ? '완료됨' : '완료로 표시'}
              >
                {m.done && <span className="text-white text-xs">✓</span>}
              </button>

              <div className={`px-2 py-1 rounded-lg text-xs font-medium flex-shrink-0 ${meta.color}`}>
                {meta.icon} {meta.label}
              </div>

              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${m.done ? 'line-through text-gray-500' : ''}`}>
                  {m.title}
                </p>
                {m.note && <p className="text-xs text-gray-500 mt-0.5 truncate">{m.note}</p>}
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-xs text-gray-500">{m.date}</p>
                <p className={`text-lg font-bold ${
                  urgent ? 'text-red-400' : d === 0 ? 'text-yellow-400' : 'text-white'
                }`}>
                  {d === 0 ? '오늘' : `D-${d}`}
                </p>
              </div>

              <button
                onClick={() => { setEdit(m); setModalOpen(true) }}
                className="text-gray-500 hover:text-white text-sm px-2"
              >
                ⋯
              </button>
            </div>
          )
        })}
      </div>

      {/* 지난 일정 */}
      {past.length > 0 && (
        <>
          <h3 className="text-xs text-gray-600 uppercase tracking-widest font-semibold mb-3">지난 일정</h3>
          <div className="space-y-2">
            {past.slice(0, 10).map(m => {
              const meta = KIND_META[m.kind]
              return (
                <div key={m.id} className="bg-gray-900/50 rounded-2xl p-3 flex items-center gap-3 opacity-60">
                  <div className={`px-2 py-0.5 rounded text-xs ${meta.color}`}>{meta.icon}</div>
                  <p className="flex-1 text-sm text-gray-400 truncate">{m.title}</p>
                  <p className="text-xs text-gray-600">{m.date}</p>
                </div>
              )
            })}
          </div>
        </>
      )}

      {modalOpen && (
        <MilestoneModal
          milestone={edit}
          onSave={async (payload) => { await onSave(payload, edit?.id); setModalOpen(false); setEdit(null) }}
          onDelete={edit ? async () => { await onDelete(edit.id); setModalOpen(false); setEdit(null) } : undefined}
          onClose={() => { setModalOpen(false); setEdit(null) }}
        />
      )}
    </div>
  )
}

function MilestoneModal({
  milestone,
  onSave,
  onDelete,
  onClose,
}: {
  milestone: Milestone | null
  onSave: (p: Partial<Milestone>) => Promise<void>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const [title, setTitle] = useState(milestone?.title || '')
  const [date, setDate] = useState(milestone?.date || new Date().toISOString().slice(0, 10))
  const [kind, setKind] = useState<MilestoneKind>(milestone?.kind || 'exam')
  const [note, setNote] = useState(milestone?.note || '')

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold mb-4">{milestone ? '마일스톤 수정' : '마일스톤 추가'}</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">제목</label>
            <input
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm"
              value={title} onChange={e => setTitle(e.target.value)}
              placeholder="예: JLPT N3 시험"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">날짜</label>
              <input
                type="date"
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm"
                value={date} onChange={e => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">종류</label>
              <select
                className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm"
                value={kind} onChange={e => setKind(e.target.value as MilestoneKind)}
              >
                {(Object.keys(KIND_META) as MilestoneKind[]).map(k => (
                  <option key={k} value={k}>{KIND_META[k].icon} {KIND_META[k].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">메모 (선택)</label>
            <textarea
              className="w-full bg-gray-800 rounded-lg px-3 py-2 text-sm resize-none"
              rows={2}
              value={note} onChange={e => setNote(e.target.value)}
              placeholder="시험장 정보, 접수번호 등"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-5 justify-end">
          {onDelete && (
            <button
              onClick={() => { if (confirm('삭제하시겠습니까?')) onDelete() }}
              className="px-3 py-2 text-sm text-red-400 hover:text-red-300"
            >삭제</button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg">
            취소
          </button>
          <button
            onClick={() => onSave({ title: title.trim(), date, kind, note: note.trim() || null })}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  )
}
