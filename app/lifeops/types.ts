export type MilestoneKind = 'exam' | 'decision' | 'admin' | 'life' | 'apply'

export interface Milestone {
  id: string
  created_at: string
  title: string
  date: string
  kind: MilestoneKind
  note: string | null
  done: boolean
}

export interface DailyLog {
  id: string
  created_at: string
  log_date: string
  expense_krw: Record<string, number>
  income_krw: Record<string, number>
  weight_kg: number | null
  condition: number | null
  memo: string | null
  reflection: string | null
  study_minutes?: Record<string, number>
}

// ── Custom category types ─────────────────────────────────────────────────────
export interface ExpenseCat {
  key: string
  en: string
  es: string
  type: 'daily' | 'fixed' | 'invest'
}
export interface IncomeCat {
  key: string
  en: string
  es: string
}

export interface BudgetConfig {
  id: 1
  updated_at: string
  start_balance_krw: number
  start_date: string
  daily_target_krw: number
  monthly_fixed_krw: number
  pivot_date: string | null
  cop_per_krw: number
  expense_cats: ExpenseCat[] | null
  income_cats: IncomeCat[] | null
}

// ── Default categories (used when DB has none) ────────────────────────────────
export const DEFAULT_EXPENSE_CATS: ExpenseCat[] = [
  { key: 'food',    en: '🍚 Food',      es: '🍚 Comida',     type: 'daily'  },
  { key: 'transit', en: '🚌 Transport', es: '🚌 Transporte',  type: 'daily'  },
  { key: 'daily',   en: '🛒 Daily',     es: '🛒 Diario',      type: 'daily'  },
  { key: 'fixed',   en: '🏠 Fixed',     es: '🏠 Fijo',        type: 'fixed'  },
  { key: 'invest',  en: '🚀 Invest',    es: '🚀 Inversión',   type: 'invest' },
  { key: 'other',   en: '· Other',      es: '· Otro',         type: 'daily'  },
]
export const DEFAULT_INCOME_CATS: IncomeCat[] = [
  { key: 'tutoring', en: '📚 Tutoring', es: '📚 Tutoría'       },
  { key: 'transfer', en: '💸 Transfer', es: '💸 Transferencia'  },
  { key: 'other',    en: '· Other',     es: '· Otro'            },
]

// ── i18n ──────────────────────────────────────────────────────────────────────
export type Lang = 'en' | 'es'

export const T = {
  log:        { en: 'Log',          es: 'Registro'    },
  budget:     { en: 'Budget',       es: 'Presupuesto' },
  milestones: { en: 'Milestones',   es: 'Hitos'       },
  expense:    { en: 'Expenses',     es: 'Gastos'      },
  income:     { en: 'Income',       es: 'Ingresos'    },
  weight:     { en: 'Weight',       es: 'Peso'        },
  condition:  { en: 'Condition',    es: 'Estado'      },
  memo:       { en: 'Note',         es: 'Nota'        },
  memoPlaceholder: { en: 'Anything notable today?', es: '¿Algo notable hoy?' },
  balance:    { en: 'Balance',      es: 'Saldo'       },
  netBurn:    { en: 'Net burn/day', es: 'Quema neta/día' },
  totalSpent: { en: 'Spent',        es: 'Gastado'     },
  totalIncome:{ en: 'Income',       es: 'Ingresos'    },
  settings:   { en: 'Settings',     es: 'Ajustes'     },
  save:       { en: 'Save',         es: 'Guardar'     },
  cancel:     { en: 'Cancel',       es: 'Cancelar'    },
  today:      { en: 'Today',        es: 'Hoy'         },
  noMilestones: { en: 'No upcoming milestones.', es: 'Sin hitos próximos.' },
  viewAll:    { en: 'View all →',   es: 'Ver todos →' },
} as const

export function t(key: keyof typeof T, lang: Lang): string {
  return T[key][lang]
}

// ── Currency ──────────────────────────────────────────────────────────────────
export type Currency = 'KRW' | 'COP'

export function formatAmount(krw: number, currency: Currency, copPerKrw: number): string {
  if (currency === 'KRW') {
    const abs = Math.abs(krw)
    const sign = krw < 0 ? '-' : ''
    return abs >= 10000
      ? sign + (abs / 10000).toFixed(1).replace(/\.0$/, '') + '만원'
      : sign + abs.toLocaleString('ko-KR') + '원'
  }
  const cop = Math.round(krw * copPerKrw)
  return cop.toLocaleString('es-CO') + ' COP'
}

export function parseToKrw(raw: string, currency: Currency, copPerKrw: number): number {
  const n = parseFloat(raw.replace(/,/g, ''))
  if (!n || isNaN(n) || n <= 0) return 0
  return currency === 'KRW' ? Math.round(n) : Math.round(n / copPerKrw)
}

export const KIND_META: Record<MilestoneKind, { label: string; color: string; icon: string }> = {
  exam:     { label: 'Exam',     color: 'bg-blue-600',    icon: '📝' },
  decision: { label: 'Decision', color: 'bg-amber-600',   icon: '🎯' },
  admin:    { label: 'Admin',    color: 'bg-slate-600',   icon: '📋' },
  apply:    { label: 'Apply',    color: 'bg-emerald-600', icon: '📮' },
  life:     { label: 'Life',     color: 'bg-rose-600',    icon: '🏠' },
}
