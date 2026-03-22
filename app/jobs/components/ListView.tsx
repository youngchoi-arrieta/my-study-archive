'use client'
import { useState } from 'react'
import { Job, STAGES, CAT_LABELS, CAT_COLORS, daysLeft } from '../types'

type Props = {
  jobs: Job[]
  onCard: (job: Job) => void
  onStageChange: (id: string, stage: Job['stage']) => void
}

export default function ListView({ jobs, onCard, onStageChange }: Props) {
  const [stageFilter, setStageFilter] = useState<Job['stage'] | ''>('')

  const filtered = stageFilter ? jobs.filter(j => j.stage === stageFilter) : jobs

  return (
    <div>
      {/* 단계 필터 탭 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setStageFilter('')}
          className={`px-3 py-1 rounded-full text-sm transition ${
            stageFilter === '' ? 'bg-white text-gray-900 font-medium' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
          }`}
        >
          전체 {stageFilter === '' && <span className="ml-1 text-gray-500">{jobs.length}</span>}
        </button>
        {STAGES.map(s => {
          const count = jobs.filter(j => j.stage === s.id).length
          return (
            <button
              key={s.id}
              onClick={() => setStageFilter(stageFilter === s.id ? '' : s.id)}
              className={`px-3 py-1 rounded-full text-sm transition ${
                stageFilter === s.id
                  ? 'bg-gray-200 text-gray-900 font-medium'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <span className={stageFilter === s.id ? 'text-gray-900' : s.color}>{s.label}</span>
              <span className="ml-1 text-gray-500 text-xs">{count}</span>
            </button>
          )
        })}
      </div>

      {/* 테이블 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">📭</p>
          <p>해당 단계의 공고가 없어요</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(job => {
            const dl = daysLeft(job.deadline)
            const dlText = dl === null ? '-' : dl < 0 ? '마감됨' : `D-${dl}`
            const dlColor = dl !== null && dl < 0 ? 'text-red-400' : dl !== null && dl <= 3 ? 'text-yellow-400' : 'text-gray-500'
            return (
              <div
                key={job.id}
                className="bg-gray-900 hover:bg-gray-800 rounded-2xl px-5 py-4 transition grid gap-y-1"
                style={{ gridTemplateColumns: '1fr auto' }}
              >
                {/* 왼쪽: 회사/직무/배지 */}
                <div
                  className="cursor-pointer min-w-0"
                  onClick={() => onCard(job)}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white">{job.company}</span>
                    <span className="text-gray-400 text-sm">{job.role || '직무 미입력'}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[job.cat]}`}>
                      {CAT_LABELS[job.cat]}
                    </span>
                    {job.priority === 'high' && <span className="w-2 h-2 rounded-full bg-red-500 inline-block shrink-0" />}
                    {job.priority === 'mid' && <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block shrink-0" />}
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className={`text-xs ${dlColor}`}>{dlText}</span>
                    {(job.jp_score || job.blind_score) && (
                      <span className="text-xs text-yellow-600">
                        {job.jp_score ? `잡플 ${job.jp_score}` : ''}
                        {job.jp_score && job.blind_score ? ' · ' : ''}
                        {job.blind_score ? `블라 ${job.blind_score}` : ''}
                      </span>
                    )}
                    {job.memo && (
                      <span className="text-xs text-gray-600 truncate max-w-xs">{job.memo}</span>
                    )}
                  </div>
                </div>

                {/* 오른쪽: 단계 드롭다운 */}
                <div className="flex items-center ml-4">
                  <select
                    value={job.stage}
                    onChange={e => onStageChange(job.id, e.target.value as Job['stage'])}
                    onClick={e => e.stopPropagation()}
                    className="bg-gray-800 text-sm rounded-lg px-3 py-1.5 text-white border border-gray-700 hover:border-gray-500 transition cursor-pointer"
                  >
                    {STAGES.map(s => (
                      <option key={s.id} value={s.id}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
