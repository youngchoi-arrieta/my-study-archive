'use client'
import { Job, STAGES, CAT_LABELS, CAT_COLORS, daysLeft } from '../types'

type Props = {
  jobs: Job[]
  onCard: (job: Job) => void
}

export default function KanbanView({ jobs, onCard }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {STAGES.map(stage => {
        const cards = jobs.filter(j => j.stage === stage.id)
        return (
          <div key={stage.id} className="bg-gray-900 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-sm font-semibold ${stage.color}`}>{stage.label}</span>
              <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">
                {cards.length}
              </span>
            </div>

            <div className="space-y-2">
              {cards.map(job => {
                const dl = daysLeft(job.deadline)
                const dlText = dl === null ? '' : dl < 0 ? '마감' : `D-${dl}`
                const dlColor = dl !== null && dl <= 3 ? 'text-red-400' : 'text-gray-500'
                return (
                  <div
                    key={job.id}
                    onClick={() => onCard(job)}
                    className="bg-gray-800 hover:bg-gray-700 rounded-xl p-3 cursor-pointer transition"
                  >
                    <p className="text-sm font-semibold text-white mb-0.5 leading-tight">{job.company}</p>
                    <p className="text-xs text-gray-400 mb-2 leading-tight">{job.role || '직무 미입력'}</p>
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[job.cat]}`}>
                        {CAT_LABELS[job.cat]}
                      </span>
                      {job.priority === 'high' && (
                        <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                      )}
                      {job.priority === 'mid' && (
                        <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
                      )}
                      {dlText && (
                        <span className={`text-xs ml-auto ${dlColor}`}>{dlText}</span>
                      )}
                    </div>
                    {(job.jp_score || job.blind_score) ? (
                      <p className="text-xs text-yellow-600 mt-1">
                        {job.jp_score ? `잡플 ${job.jp_score}` : ''}
                        {job.jp_score && job.blind_score ? ' · ' : ''}
                        {job.blind_score ? `블라 ${job.blind_score}` : ''}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
