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
  income_krw: Record<string, number>   // NEW
  weight_kg: number | null             // NEW
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

// ── i18n ────────────────────────────────────────────────────────────────────
export type Lang = 'en' | 'es'

export const T = {
  // nav / tabs
  summary:   { en: 'Summary',    es: 'Resumen'    },
  milestones:{ en: 'Milestones', es: 'Hitos'      },
  log:       { en: 'Daily Log',  es: 'Registro'   },
  budget:    { en: 'Budget',     es: 'Presupuesto'},

  // daily log
  todayRecord:     { en: "Today's Log",        es: 'Registro de hoy'       },
  studyTime:       { en: 'Study time',          es: 'Tiempo de estudio'     },
  expense:         { en: 'Expenses',            es: 'Gastos'                },
  income:          { en: 'Income',              es: 'Ingresos'              },
  weight:          { en: 'Weight',              es: 'Peso'                  },
  condition:       { en: 'Condition',           es: 'Estado'                },
  memo:            { en: 'Memo',                es: 'Nota'                  },
  add:             { en: 'Add',                 es: 'Agregar'               },
  noRecord:        { en: 'No entries',          es: 'Sin registros'         },
  memoPlaceholder: { en: 'What went well? Any blockers?', es: '¿Qué salió bien? ¿Algún obstáculo?' },
  autoSave:        { en: '* Auto-saved on blur', es: '* Se guarda al salir' },
  recentTwo:       { en: 'Last 14 days',        es: 'Últimos 14 días'      },
  date:            { en: 'Date',                es: 'Fecha'                 },
  study:           { en: 'Study',               es: 'Estudio'              },

  // budget
  balance:         { en: 'Current Balance',     es: 'Saldo actual'         },
  totalSpent:      { en: 'Total Spent',         es: 'Total gastado'        },
  totalIncome:     { en: 'Total Income',        es: 'Total ingresos'       },
  netBurn:         { en: 'Net Daily Burn',      es: 'Quema diaria neta'    },
  daysLeft:        { en: 'Days Remaining',      es: 'Días restantes'       },
  survivalAt:      { en: 'Balance at Pivot',    es: 'Saldo en pivote'      },
  targetPace:      { en: 'Daily target',        es: 'Meta diaria'          },
  settings:        { en: 'Settings',            es: 'Ajustes'              },
  balanceTrajectory:{ en: 'Balance Trajectory', es: 'Trayectoria del saldo'},
  scenario:        { en: 'Scenario',            es: 'Escenario'            },
  scenarioIf:      { en: 'If you cut',          es: 'Si reduces'           },
  scenarioPer:     { en: '/day extra',          es: '/día adicional'       },
  scenarioSurvive: { en: 'you survive until',   es: 'llegas hasta'         },
  good: { en: '✅ On pace — spending', es: '✅ En ritmo — gastando' },
  warn: { en: '⚖️ Close to target.',  es: '⚖️ Cerca de la meta.'  },
  bad:  { en: '⚠️ Over pace — spending', es: '⚠️ Por encima — gastando' },
  underTarget: { en: 'under target/day', es: 'bajo la meta/día' },
  overTarget:  { en: 'over target/day',  es: 'por encima/día'   },

  // budget settings labels
  startBalance: { en: 'Starting balance (KRW)', es: 'Saldo inicial (KRW)' },
  startDate:    { en: 'Start date',             es: 'Fecha de inicio'     },
  dailyTarget:  { en: 'Daily spending target (KRW)', es: 'Meta de gasto diario (KRW)' },
  pivotDate:    { en: 'Pivot date (e.g. Lucy joins)', es: 'Fecha pivote (ej. llegada de Lucy)' },
  cancel:       { en: 'Cancel',   es: 'Cancelar' },
  save:         { en: 'Save',     es: 'Guardar'  },

  // summary
  todayStudy:   { en: "Today's study",   es: 'Estudio hoy'    },
  todayExpense: { en: "Today's expense", es: 'Gasto hoy'      },
  logDays:      { en: 'Days logged',     es: 'Días registrados'},
  quickLog:     { en: '➕ Log Today',    es: '➕ Registrar hoy'},
  quickLogSub:  { en: 'Study · Expense · Condition', es: 'Estudio · Gasto · Estado' },
  viewBudget:   { en: '📈 Budget Trajectory', es: '📈 Trayectoria' },
  viewBudgetSub:{ en: 'Projected pivot balance', es: 'Saldo proyectado en pivote' },
  upcomingMilestones: { en: 'Upcoming Milestones', es: 'Próximos hitos' },
  viewAll:      { en: 'View all →', es: 'Ver todos →' },
  noMilestones: { en: 'No upcoming milestones.', es: 'Sin hitos próximos.' },
  today:        { en: 'Today', es: 'Hoy' },
} as const

export function t(key: keyof typeof T, lang: Lang): string {
  return T[key][lang]
}

// ── Currency ─────────────────────────────────────────────────────────────────
export type Currency = 'KRW' | 'COP'

/** Edit this rate whenever COP/KRW rate changes */
export const EXCHANGE_RATES: Record<Currency, number> = {
  KRW: 1,
  COP: 0.42,  // 1 KRW ≈ 0.42 COP  (update as needed)
}

export function toDisplayAmount(krw: number, currency: Currency): number {
  return Math.round(krw * EXCHANGE_RATES[currency])
}

export function fromDisplayAmount(amount: number, currency: Currency): number {
  return Math.round(amount / EXCHANGE_RATES[currency])
}

export function formatAmount(krw: number, currency: Currency): string {
  const v = toDisplayAmount(krw, currency)
  if (currency === 'KRW') {
    return Math.abs(v) >= 10000
      ? (v / 10000).toFixed(0) + '만원'
      : v.toLocaleString('ko-KR') + '원'
  }
  // COP
  return v.toLocaleString('es-CO') + ' COP'
}

// ── Study subjects ───────────────────────────────────────────────────────────
export const STUDY_SUBJECTS = [
  '2종필기',
  'N4',
  '덴켄3종',
  '전기일본어',
  '기타',
] as const

// ── Expense / Income categories ──────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
  { key: 'food',    en: 'Food',          es: 'Comida'      },
  { key: 'rent',    en: 'Rent',          es: 'Alquiler'    },
  { key: 'books',   en: 'Books',         es: 'Libros'      },
  { key: 'transit', en: 'Transport',     es: 'Transporte'  },
  { key: 'exam',    en: 'Exam / Admin',  es: 'Examen / Admin' },
  { key: 'other',   en: 'Other',         es: 'Otro'        },
] as const

export const INCOME_CATEGORIES = [
  { key: 'tutoring', en: 'Tutoring',     es: 'Tutoría'     },
  { key: 'part_time',en: 'Part-time',    es: 'Trabajo parcial' },
  { key: 'transfer', en: 'Transfer',     es: 'Transferencia' },
  { key: 'other',    en: 'Other',        es: 'Otro'         },
] as const

export const KIND_META: Record<MilestoneKind, { label: string; color: string; icon: string }> = {
  exam:     { label: 'Exam',     color: 'bg-blue-600',    icon: '📝' },
  decision: { label: 'Decision', color: 'bg-amber-600',   icon: '🎯' },
  admin:    { label: 'Admin',    color: 'bg-slate-600',   icon: '📋' },
  apply:    { label: 'Apply',    color: 'bg-emerald-600', icon: '📮' },
  life:     { label: 'Life',     color: 'bg-rose-600',    icon: '🏠' },
}
