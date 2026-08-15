// ═══════════════════════════════════════════════════════════════
//  JLPT 모의고사 채점 기준
//
//  주의: 실제 JLPT는 원점수가 아니라 등화(尺度得点) 처리된 점수로
//  채점된다. 여기서 계산하는 180점 환산은 "정답률 × 배점"의 추정치이고,
//  실제 성적표와는 어긋날 수 있다. 회차 간 추이를 보는 용도.
// ═══════════════════════════════════════════════════════════════

export type Level = 'n5' | 'n4' | 'n3'
export type Area = 'moji' | 'bunpou' | 'dokkai' | 'choukai'

export const AREAS: Area[] = ['moji', 'bunpou', 'dokkai', 'choukai']

export const AREA_LABELS: Record<Area, string> = {
  moji: '문자·어휘',
  bunpou: '문법',
  dokkai: '독해',
  choukai: '청해',
}

export const AREA_JA: Record<Area, string> = {
  moji: '文字・語彙',
  bunpou: '文法',
  dokkai: '読解',
  choukai: '聴解',
}

export const AREA_COLORS: Record<Area, string> = {
  moji: '#60a5fa',    // blue
  bunpou: '#a78bfa',  // violet
  dokkai: '#34d399',  // emerald
  choukai: '#fbbf24', // amber
}

/** 得点区分 — JLPT가 실제로 합격/불합격을 가르는 단위 */
export interface Section {
  label: string
  areas: Area[]
  max: number   // 배점
  min: number   // 기준점 (이걸 못 넘으면 총점과 무관하게 불합격)
}

export interface LevelSpec {
  level: Level
  label: string
  /** 교재 기본 문항수 — 입력 시 초기값으로만 쓰이고 회차마다 수정 가능 */
  defaults: Record<Area, number>
  sections: Section[]
  passTotal: number  // 180점 만점 중 합격선
}

export const LEVELS: LevelSpec[] = [
  {
    level: 'n5',
    label: 'N5',
    defaults: { moji: 21, bunpou: 17, dokkai: 5, choukai: 23 },
    sections: [
      { label: '言語知識・読解', areas: ['moji', 'bunpou', 'dokkai'], max: 120, min: 38 },
      { label: '聴解', areas: ['choukai'], max: 60, min: 19 },
    ],
    passTotal: 80,
  },
  {
    level: 'n4',
    label: 'N4',
    defaults: { moji: 25, bunpou: 25, dokkai: 10, choukai: 28 },
    sections: [
      { label: '言語知識・読解', areas: ['moji', 'bunpou', 'dokkai'], max: 120, min: 38 },
      { label: '聴解', areas: ['choukai'], max: 60, min: 19 },
    ],
    passTotal: 90,
  },
  {
    level: 'n3',
    label: 'N3',
    defaults: { moji: 35, bunpou: 23, dokkai: 16, choukai: 28 },
    sections: [
      { label: '言語知識', areas: ['moji', 'bunpou'], max: 60, min: 19 },
      { label: '読解', areas: ['dokkai'], max: 60, min: 19 },
      { label: '聴解', areas: ['choukai'], max: 60, min: 19 },
    ],
    passTotal: 95,
  },
]

export const levelSpec = (l: Level) => LEVELS.find(x => x.level === l)!

export interface MockRow {
  id: string
  level: Level
  title: string
  taken_on: string
  moji: number; moji_total: number; moji_sure: number | null
  bunpou: number; bunpou_total: number; bunpou_sure: number | null
  dokkai: number; dokkai_total: number; dokkai_sure: number | null
  choukai: number; choukai_total: number; choukai_sure: number | null
}

/**
 * 4지선다에서 완전히 찍으면 25%가 그냥 나온다.
 * 청해는 即時応答처럼 3지선다가 섞여 있어 바닥이 조금 더 높다.
 * 「확신 정답수」를 입력하지 않았을 때 참고로만 쓰는 값.
 */
export const CHANCE_FLOOR: Record<Area, number> = {
  moji: 0.25, bunpou: 0.25, dokkai: 0.25, choukai: 0.29,
}

/** 우연 보정 정답률 — (실제률 − 바닥) / (1 − 바닥) */
export function corrected(rate: number, a: Area): number {
  const f = CHANCE_FLOOR[a] * 100
  return Math.max(0, ((rate - f) / (100 - f)) * 100)
}

export const areaScore = (m: MockRow, a: Area): { got: number; total: number; sure: number | null } => ({
  got: m[a] as number,
  total: m[`${a}_total` as keyof MockRow] as number,
  sure: (m[`${a}_sure` as keyof MockRow] ?? null) as number | null,
})

/** 확신 정답이 하나라도 입력된 기록인가 */
export const hasSure = (m: MockRow) => AREAS.some(a => areaScore(m, a).sure !== null)

export const pct = (got: number, total: number) => (total === 0 ? 0 : (got / total) * 100)

/**
 * 得点区分별 추정 점수 + 기준점 통과 여부.
 * useSure = true 면 「확신 정답」만 세어 실력 하한을 본다.
 * (확신값이 없는 영역은 정답수를 그대로 쓴다)
 */
export function sectionScores(m: MockRow, spec: LevelSpec, useSure = false) {
  return spec.sections.map(s => {
    const got = s.areas.reduce((a, k) => {
      const v = areaScore(m, k)
      return a + (useSure && v.sure !== null ? v.sure : v.got)
    }, 0)
    const total = s.areas.reduce((a, k) => a + areaScore(m, k).total, 0)
    const rate = pct(got, total)
    const score = Math.round((rate / 100) * s.max)
    return { ...s, got, total, rate, score, passed: score >= s.min }
  })
}

export function verdict(m: MockRow, spec: LevelSpec, useSure = false) {
  const secs = sectionScores(m, spec, useSure)
  const total = secs.reduce((a, s) => a + s.score, 0)
  const allMin = secs.every(s => s.passed)
  return { secs, total, allMin, passed: allMin && total >= spec.passTotal }
}
