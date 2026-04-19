export type MilestoneKind = 'exam' | 'decision' | 'admin' | 'life' | 'apply'

export interface Milestone {
  id: string
  created_at: string
  title: string
  date: string           // YYYY-MM-DD
  kind: MilestoneKind
  note: string | null
  done: boolean
}

export interface DailyLog {
  id: string
  created_at: string
  log_date: string       // YYYY-MM-DD
  study_minutes: Record<string, number>
  expense_krw: Record<string, number>
  condition: number | null
  memo: string | null
}

export interface BudgetConfig {
  id: 1
  updated_at: string
  start_balance_krw: number
  start_date: string
  daily_target_krw: number
  pivot_date: string | null
}

export const STUDY_SUBJECTS = [
  '2종필기',
  'N4',
  '덴켄3종',
  '전기일본어',
  '기타',
] as const

export const EXPENSE_CATEGORIES = [
  { key: 'food',    label: '식비' },
  { key: 'rent',    label: '주거' },
  { key: 'books',   label: '교재' },
  { key: 'transit', label: '교통' },
  { key: 'exam',    label: '시험·행정' },
  { key: 'other',   label: '기타' },
] as const

export const KIND_META: Record<MilestoneKind, { label: string; color: string; icon: string }> = {
  exam:     { label: '시험',     color: 'bg-blue-600',    icon: '📝' },
  decision: { label: '결정',     color: 'bg-amber-600',   icon: '🎯' },
  admin:    { label: '행정',     color: 'bg-slate-600',   icon: '📋' },
  apply:    { label: '지원',     color: 'bg-emerald-600', icon: '📮' },
  life:     { label: '생활',     color: 'bg-rose-600',    icon: '🏠' },
}
