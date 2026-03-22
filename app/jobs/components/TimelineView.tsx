'use client'
import { Job, CAT_LABELS, CAT_COLORS, daysLeft } from '../types'

type Props = {
  jobs: Job[]
  onCard: (job: Job) => void
}

const DAYS_KO = ['일', '월', '화', '수', '목', '금', '토']

export default function TimelineView({ jobs, onCard }: Props) {
  const withDeadline = jobs
    .filter(j => j.deadline && j.stage !== 'pass')
    .sort((a, b) => (a.deadline || '').localeCompare(b.deadline || ''))

  if (!withDeadline.length) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-5xl mb-4">📅</p>
        <p>마감일이 설정된 공고가 없어요</p>
      </div>
    )
  }

  const months: Record<string, Job[]> = {}
  withDeadline.forEach(j => {
    const d = new Date(j.deadline!)
    const key = `${d.getFullYear()}년 ${d.getMonth() + 1}월`
    if (!months[key]) months[key] = []
    months[key].push(j)
  })

  return (
    <div className="space-y-8">
      {Object.entries(months).map(([month, list]) => (
        <div key={month}>
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">{month}</p>
          <div className="space-y-2">
            {list.map(job => {
              const d = new Date(job.deadline!)
              const dl = daysLeft(job.deadline)
              const dlText = dl === null ? '' : dl < 0 ? '마감됨' : `D-${dl}`
              const dlColor = dl === null ? '' : dl < 0 ? 'text-red-500' : dl <= 3 ? 'text-yellow-400' : 'text-green-400'
              return (
                <div
                  key={job.id}
                  onClick={() => onCard(job)}
                  className="flex items-center gap-4 bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 cursor-pointer transition"
                >
                  <div className="text-center bg-gray-800 rounded-xl px-3 py-2 min-w-[48px]">
                    <p className="text-lg font-bold leading-none">{d.getDate()}</p>
                    <p className="text-xs text-gray-500">{DAYS_KO[d.getDay()]}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white">{job.company}</p>
                    <p className="text-sm text-gray-400 truncate">{job.role || ''}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${CAT_COLORS[job.cat]}`}>
                      {CAT_LABELS[job.cat]}
                    </span>
                    {dlText && <span className={`text-xs font-semibold ${dlColor}`}>{dlText}</span>}
                    {(job.jp_score || job.blind_score) ? (
                      <span className="text-xs text-yellow-600">
                        {job.jp_score ? `잡플 ${job.jp_score}` : ''}
                        {job.jp_score && job.blind_score ? ' · ' : ''}
                        {job.blind_score ? `블라 ${job.blind_score}` : ''}
                      </span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
