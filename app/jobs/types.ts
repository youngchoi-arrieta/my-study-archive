export type Job = {
  id: string
  company: string
  role: string
  cat: 'top' | 'foreign' | 'sme' | 'dc'
  priority: 'high' | 'mid' | 'low'
  stage: 'watch' | 'apply' | 'submitted' | 'interview' | 'offer' | 'pass'
  deadline: string | null
  url: string
  memo: string
  jp_score: number | null
  blind_score: number | null
  created_at: string
}

export const STAGES: { id: Job['stage']; label: string; color: string }[] = [
  { id: 'watch',     label: '관심',      color: 'text-gray-400' },
  { id: 'apply',     label: '지원 예정', color: 'text-blue-400' },
  { id: 'submitted', label: '서류 제출', color: 'text-yellow-400' },
  { id: 'interview', label: '면접',      color: 'text-teal-400' },
  { id: 'offer',     label: '오퍼',      color: 'text-green-400' },
  { id: 'pass',      label: '탈락',      color: 'text-red-500' },
]

export const CAT_LABELS: Record<Job['cat'], string> = {
  top: 'Top company',
  foreign: '외국계',
  sme: '중소기업',
  dc: '데이터센터',
}

export const CAT_COLORS: Record<Job['cat'], string> = {
  top:     'bg-blue-900 text-blue-300',
  foreign: 'bg-teal-900 text-teal-300',
  sme:     'bg-yellow-900 text-yellow-300',
  dc:      'bg-purple-900 text-purple-300',
}

export function daysLeft(deadline: string | null): number | null {
  if (!deadline) return null
  return Math.ceil((new Date(deadline).getTime() - new Date().getTime()) / 86400000)
}
