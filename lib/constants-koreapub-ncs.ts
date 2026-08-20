// ═══════════════════════════════════════════════════════════════
//  공기업 필기 — NCS 영역 매트릭스 + 시험시간
//
//  공기업마다 NCS 직업기초능력 10영역 중 몇 개만 골라 낸다.
//  어디가 뭘 내는지는 공고를 열어봐야 알고, 회차마다 바뀐다.
//  그래서 이 파일에는 "영역의 목록"만 두고,
//  기업별 채택 여부·문항수·시간은 전부 kp_ncs 테이블에 손으로 넣는다.
//
//  즉 여기 있는 값 중 사실 주장은 하나도 없다.
//  프리셋도 "3영역 세트" 같은 모양일 뿐, 특정 기업이 그렇다는 뜻이 아니다.
//  (supabase/koreapub_ncs_books_migration.sql)
// ═══════════════════════════════════════════════════════════════

export type NcsAreaKey =
  | 'comm' | 'math' | 'solve'
  | 'resource' | 'info' | 'tech' | 'org'
  | 'self' | 'people' | 'ethic'

export interface NcsArea {
  key: NcsAreaKey
  label: string
  /** 매트릭스 헤더용 짧은 이름 */
  short: string
  /** 세로 헤더 2줄용 */
  head: [string, string]
  /** 거의 모든 공기업이 내는 3영역 */
  core: boolean
}

export const NCS_AREAS: NcsArea[] = [
  { key: 'comm',     label: '의사소통능력', short: '의사소통', head: ['의사', '소통'], core: true },
  { key: 'math',     label: '수리능력',     short: '수리',     head: ['수리', ''],     core: true },
  { key: 'solve',    label: '문제해결능력', short: '문제해결', head: ['문제', '해결'], core: true },
  { key: 'resource', label: '자원관리능력', short: '자원관리', head: ['자원', '관리'], core: false },
  { key: 'info',     label: '정보능력',     short: '정보',     head: ['정보', ''],     core: false },
  { key: 'tech',     label: '기술능력',     short: '기술',     head: ['기술', ''],     core: false },
  { key: 'org',      label: '조직이해능력', short: '조직이해', head: ['조직', '이해'], core: false },
  { key: 'self',     label: '자기개발능력', short: '자기개발', head: ['자기', '개발'], core: false },
  { key: 'people',   label: '대인관계능력', short: '대인관계', head: ['대인', '관계'], core: false },
  { key: 'ethic',    label: '직업윤리',     short: '직업윤리', head: ['직업', '윤리'], core: false },
]

export const ALL_AREA_KEYS = NCS_AREAS.map(a => a.key)
export const ncsArea = (k: string) => NCS_AREAS.find(a => a.key === k)

/** 모양만 잡아주는 프리셋 — 특정 기업이 이렇다는 주장이 아니다 */
export const AREA_PRESETS: { label: string; desc: string; keys: NcsAreaKey[] }[] = [
  { label: '3영역', desc: '의사소통 · 수리 · 문제해결', keys: ['comm', 'math', 'solve'] },
  { label: '5영역', desc: '3영역 + 자원관리 · 정보', keys: ['comm', 'math', 'solve', 'resource', 'info'] },
  { label: '6영역', desc: '5영역 + 기술', keys: ['comm', 'math', 'solve', 'resource', 'info', 'tech'] },
  { label: '전체', desc: '10영역 모두', keys: ALL_AREA_KEYS },
]

// ── 행 ──────────────────────────────────────────────────────────
export interface NcsCell {
  on: boolean
  /** 영역별 문항수 — 공고에 안 나오는 경우가 더 많아서 없어도 된다 */
  q: number | null
}

export type NcsAreas = Partial<Record<NcsAreaKey, NcsCell>>

export interface NcsRow {
  company_id: string
  areas: NcsAreas
  /** NCS 직업기초 */
  ncs_q: number | null
  ncs_min: number | null
  /** 전공 (직무수행능력) */
  major_q: number | null
  major_min: number | null
  /** 제3과목 — 코레일 철도관련법령처럼 */
  extra_label: string | null
  extra_q: number | null
  extra_min: number | null
  /** NCS와 전공을 한 교시에 붙여 보는가 (시간이 통으로 주어지는 형태) */
  combined: boolean
  /** 통합 시간을 공고가 직접 못박은 경우 */
  total_min: number | null
  cutoff: string | null
  memo: string | null
}

export const emptyNcsRow = (company_id: string): NcsRow => ({
  company_id, areas: {},
  ncs_q: null, ncs_min: null,
  major_q: null, major_min: null,
  extra_label: null, extra_q: null, extra_min: null,
  combined: false, total_min: null, cutoff: null, memo: null,
})

/** DB에서 온 느슨한 jsonb를 안전한 모양으로 */
export function normalizeAreas(v: unknown): NcsAreas {
  if (!v || typeof v !== 'object') return {}
  const out: NcsAreas = {}
  for (const k of ALL_AREA_KEYS) {
    const raw = (v as Record<string, unknown>)[k]
    if (raw === undefined || raw === null) continue
    if (typeof raw === 'boolean') { if (raw) out[k] = { on: true, q: null }; continue }
    if (typeof raw === 'number') { out[k] = { on: true, q: raw }; continue }
    if (typeof raw === 'object') {
      const o = raw as { on?: unknown; q?: unknown }
      const on = o.on !== false
      const q = typeof o.q === 'number' && o.q > 0 ? o.q : null
      if (on || q !== null) out[k] = { on, q }
    }
  }
  return out
}

export const normalizeNcsRow = (r: Partial<NcsRow> & { company_id: string }): NcsRow => ({
  ...emptyNcsRow(r.company_id),
  ...r,
  areas: normalizeAreas(r.areas),
})

// ── 파생값 ──────────────────────────────────────────────────────
export const isOn = (row: NcsRow | undefined, k: NcsAreaKey) => !!row?.areas[k]?.on
export const cellQ = (row: NcsRow | undefined, k: NcsAreaKey) => row?.areas[k]?.q ?? null

export const pickedAreas = (row: NcsRow | undefined): NcsAreaKey[] =>
  row ? ALL_AREA_KEYS.filter(k => row.areas[k]?.on) : []

/** 영역별 문항수를 다 넣었으면 그 합, 아니면 ncs_q */
export function ncsQuestions(row: NcsRow | undefined): number | null {
  if (!row) return null
  const picked = pickedAreas(row)
  const qs = picked.map(k => row.areas[k]?.q ?? null)
  if (picked.length > 0 && qs.every(q => q !== null)) {
    return qs.reduce((a: number, q) => a + (q as number), 0)
  }
  return row.ncs_q
}

export const sumOrNull = (...xs: (number | null)[]) => {
  const vals = xs.filter((x): x is number => typeof x === 'number' && x > 0)
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null
}

export const totalQuestions = (row: NcsRow | undefined) =>
  row ? sumOrNull(ncsQuestions(row), row.major_q, row.extra_q) : null

export function totalMinutes(row: NcsRow | undefined): number | null {
  if (!row) return null
  if (row.total_min && row.total_min > 0) return row.total_min
  return sumOrNull(row.ncs_min, row.major_min, row.extra_min)
}

/** 문항당 몇 초를 쓸 수 있는가 — 페이스 감각이 여기서 나온다 */
export function secondsPerQuestion(row: NcsRow | undefined): number | null {
  const q = totalQuestions(row), m = totalMinutes(row)
  if (!q || !m) return null
  return Math.round((m * 60) / q)
}

/** 페이스가 빡빡한지 — 60초 미만이면 속도 시험이다 */
export function paceTone(sec: number | null): string {
  if (sec === null) return 'text-gray-600'
  if (sec < 50) return 'text-red-400'
  if (sec < 65) return 'text-amber-400'
  return 'text-green-400'
}

/** 지원 기업들 사이에서 각 영역이 몇 번 나오는가 — 공부 우선순위 신호 */
export function areaFrequency(rows: NcsRow[]): Record<NcsAreaKey, number> {
  const out = Object.fromEntries(ALL_AREA_KEYS.map(k => [k, 0])) as Record<NcsAreaKey, number>
  rows.forEach(r => ALL_AREA_KEYS.forEach(k => { if (r.areas[k]?.on) out[k] += 1 }))
  return out
}
