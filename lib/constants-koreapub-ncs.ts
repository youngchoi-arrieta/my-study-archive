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

// 「3영역 / 5영역 / 6영역」 같은 개수 프리셋은 뺐다.
// 같은 6영역이어도 어느 6개인지가 기업마다 달라서, 개수만 맞춰봐야
// 결국 전부 다시 고쳐야 했다. 기업별 실제 구성은
// lib/constants-koreapub-presets.ts 에 있다.

// ── 행 ──────────────────────────────────────────────────────────
export interface NcsCell {
  on: boolean
  /**
   * @deprecated 영역별 문항수 — 화면에서 뺐다.
   * PSAT형·피듈형은 공고가 영역별 문항수를 아예 안 밝히고, 안다 해도 결국
   * 전 영역을 다 공부해야 한다. 빈칸만 남는 자리였다.
   * 예전에 넣어둔 값을 읽기 위해서만 남겨둔다.
   */
  q: number | null
}

export type NcsAreas = Partial<Record<NcsAreaKey, NcsCell>>

/** 과목 한 줄 — NCS·전공 말고 추가로 보는 것들 */
export interface ExtraSubject {
  label: string
  q: number | null
  min: number | null
  /** 배점 — 문항수 비율과 다른 경우가 흔하다 */
  score: number | null
}

export interface NcsRow {
  company_id: string
  areas: NcsAreas
  /** NCS 직업기초 — 기업마다 이름이 다르다(직무능력검사, 직업기초능력평가 …) */
  ncs_label: string | null
  ncs_q: number | null
  ncs_min: number | null
  /**
   * 필기 반영비율. 공고에 적힌 숫자를 그대로 넣는다 —
   * 40/60 처럼 %로 넣어도 되고 100/50 처럼 배점으로 넣어도 된다.
   * 어차피 합계로 나눠 비율을 내므로 단위는 상관없다.
   *
   * 문항수 비율과 어긋나는 경우가 흔하다. 한전KPS 는 NCS 50문·전공 50문(1:1)인데
   * 반영은 100:50(2:1)이다. 문항수만 보고 시간을 반씩 쓰면 손해다.
   */
  ncs_score: number | null
  /** 전공 (직무수행능력) — 이것도 이름이 제각각이다 */
  major_label: string | null
  major_q: number | null
  major_min: number | null
  major_score: number | null
  /** 추가 과목 — 한국사·회사상식·철도법령처럼. 개수 제한 없음 */
  extras: ExtraSubject[]
  /** @deprecated extras 로 옮겨감. 예전 데이터를 읽기 위해서만 남겨둔다 */
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
  ncs_label: null, ncs_q: null, ncs_min: null, ncs_score: null,
  major_label: null, major_q: null, major_min: null, major_score: null,
  extras: [],
  extra_label: null, extra_q: null, extra_min: null,
  combined: false, total_min: null, cutoff: null, memo: null,
})

export const NCS_LABEL_DEFAULT = 'NCS 직업기초'
export const MAJOR_LABEL_DEFAULT = '전공 (직무수행)'
export const ncsLabel = (r: NcsRow | undefined) => r?.ncs_label?.trim() || NCS_LABEL_DEFAULT
export const majorLabel = (r: NcsRow | undefined) => r?.major_label?.trim() || MAJOR_LABEL_DEFAULT

/** DB의 느슨한 jsonb를 과목 배열로 */
function normalizeExtras(v: unknown): ExtraSubject[] {
  if (!Array.isArray(v)) return []
  return v.flatMap(raw => {
    if (!raw || typeof raw !== 'object') return []
    const o = raw as { label?: unknown; q?: unknown; min?: unknown; score?: unknown }
    const label = typeof o.label === 'string' ? o.label : ''
    const q = typeof o.q === 'number' && o.q > 0 ? o.q : null
    const min = typeof o.min === 'number' && o.min > 0 ? o.min : null
    const score = typeof o.score === 'number' && o.score > 0 ? o.score : null
    if (!label && q === null && min === null && score === null) return []
    return [{ label, q, min, score }]
  })
}

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

export const normalizeNcsRow = (r: Partial<NcsRow> & { company_id: string }): NcsRow => {
  const extras = normalizeExtras(r.extras)
  // 예전 단일 extra_* 칸에만 값이 있는 행은 배열 첫 칸으로 옮겨 읽는다
  if (extras.length === 0 && (r.extra_label || r.extra_q || r.extra_min)) {
    extras.push({ label: r.extra_label ?? '', q: r.extra_q ?? null, min: r.extra_min ?? null, score: null })
  }
  return { ...emptyNcsRow(r.company_id), ...r, extras, areas: normalizeAreas(r.areas) }
}

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
  row ? sumOrNull(ncsQuestions(row), row.major_q, ...row.extras.map(e => e.q)) : null

export function totalMinutes(row: NcsRow | undefined): number | null {
  if (!row) return null
  if (row.total_min && row.total_min > 0) return row.total_min
  return sumOrNull(row.ncs_min, row.major_min, ...row.extras.map(e => e.min))
}

// ── 반영비율 ────────────────────────────────────────────────────
// 문항수 비율과 반영비율이 어긋나는 기업이 있다.
// 한전KPS 는 NCS 50문·전공 50문(문항수 1:1)인데 배점은 100점:50점(2:1)이다.
// 이럴 때 시간과 노력은 문항수가 아니라 배점을 따라가야 한다.

export interface SubjectWeight {
  label: string
  q: number | null
  score: number | null
  /** 문항 하나가 몇 점인가 (반영비율을 점수로 볼 때) */
  perQ: number | null
  /** 필기 전체에서 이 과목이 차지하는 반영비율(%) */
  sharePct: number | null
  /** 전체 문항수에서 차지하는 비율(%) — sharePct 와 벌어지면 그게 신호다 */
  qPct: number | null
}

export const totalScore = (row: NcsRow | undefined) =>
  row ? sumOrNull(row.ncs_score, row.major_score, ...row.extras.map(e => e.score)) : null

export function subjectWeights(row: NcsRow | undefined): SubjectWeight[] {
  if (!row) return []
  const list: SubjectWeight[] = [
    { label: ncsLabel(row), q: ncsQuestions(row), score: row.ncs_score, perQ: null, sharePct: null, qPct: null },
    { label: majorLabel(row), q: row.major_q, score: row.major_score, perQ: null, sharePct: null, qPct: null },
    ...row.extras.filter(e => e.label || e.q || e.score).map(e => ({
      label: e.label || '기타', q: e.q, score: e.score, perQ: null, sharePct: null, qPct: null,
    })),
  ].filter(x => x.q !== null || x.score !== null)

  const sT = list.reduce((a, x) => a + (x.score ?? 0), 0)
  const qT = list.reduce((a, x) => a + (x.q ?? 0), 0)
  list.forEach(x => {
    x.perQ = x.score && x.q ? Math.round((x.score / x.q) * 100) / 100 : null
    x.sharePct = x.score && sT > 0 ? Math.round((x.score / sT) * 1000) / 10 : null
    x.qPct = x.q && qT > 0 ? Math.round((x.q / qT) * 1000) / 10 : null
  })
  return list
}

/**
 * 문항수 비율과 반영비율이 갈리는가.
 * 갈리면 시험장에서 시간을 어디에 쓸지가 바뀌므로 화면에서 눈에 띄게 알린다.
 * 기준은 5%포인트.
 */
export function weightDiverges(row: NcsRow | undefined): boolean {
  const w = subjectWeights(row).filter(x => x.qPct !== null && x.sharePct !== null)
  if (w.length < 2) return false
  return w.some(x => Math.abs((x.qPct as number) - (x.sharePct as number)) > 5)
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
