'use client'
import { Job, STAGES, CAT_LABELS, CAT_COLORS, daysLeft } from '../types'

type Props = {
  job: Job
  onClose: () => void
  onEdit: (job: Job) => void
  onDelete: (id: string) => Promise<void>
  onStageChange: (id: string, stage: Job['stage']) => void
}

export default function JobDetailModal({ job, onClose, onEdit, onDelete, onStageChange }: Props) {
  const dl = daysLeft(job.deadline)
  const dlText = dl === null ? '없음' : dl < 0 ? '마감됨' : `D-${dl}`
  const dlColor = dl !== null && dl < 0 ? 'text-red-400' : dl !== null && dl <= 3 ? 'text-yellow-400' : 'text-gray-400'

  async function handleDelete() {
    if (!confirm('삭제할까요?')) return
    await onDelete(job.id)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">

        {/* 헤더 */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{job.company}</h2>
            <p className="text-gray-400 text-sm mt-0.5">{job.role || '직무 미입력'}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${CAT_COLORS[job.cat]}`}>
            {CAT_LABELS[job.cat]}
          </span>
        </div>

        {/* 단계 변경 */}
        <div className="mb-4">
          <p className="text-xs text-gray-500 mb-1">진행 단계</p>
          <select
            className="bg-gray-800 rounded-lg px-3 py-2 text-sm text-white"
            value={job.stage}
            onChange={e => onStageChange(job.id, e.target.value as Job['stage'])}
          >
            {STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* 메타 정보 */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">우선순위</p>
            <p className="text-sm text-white">
              {job.priority === 'high' ? '🔴 높음' : job.priority === 'mid' ? '🟡 보통' : '🟢 낮음'}
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">마감일</p>
            <p className="text-sm text-white">{job.deadline || '없음'}</p>
            {job.deadline && <p className={`text-xs mt-0.5 ${dlColor}`}>{dlText}</p>}
          </div>
          {job.jp_score ? (
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">잡플래닛</p>
              <p className="text-sm text-yellow-400 font-semibold">{job.jp_score} / 5.0</p>
            </div>
          ) : null}
          {job.blind_score ? (
            <div className="bg-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-500 mb-1">블라인드</p>
              <p className="text-sm text-yellow-400 font-semibold">{job.blind_score} / 5.0</p>
            </div>
          ) : null}
        </div>

        {/* 공고 링크 */}
        {job.url && (
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-1">공고 링크</p>
            <a href={job.url} target="_blank" rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 text-sm break-all transition">
              {job.url}
            </a>
          </div>
        )}

        {/* 메모 */}
        <div className="mb-5">
          <p className="text-xs text-gray-500 mb-1">메모</p>
          <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
            {job.memo || '없음'}
          </p>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleDelete}
            className="px-4 py-2 text-sm text-red-400 hover:text-red-300 transition"
          >
            삭제
          </button>
          <button
            onClick={() => onEdit(job)}
            className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition"
          >
            수정
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
