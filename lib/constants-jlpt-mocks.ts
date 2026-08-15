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
  moji: number; moji_total: number
  bunpou: number; bunpou_total: number
  dokkai: number; dokkai_total: number
  choukai: number; choukai_total: number
}

export const areaScore = (m: MockRow, a: Area): { got: number; total: number } => ({
  got: m[a] as number,
  total: m[`${a}_total` as keyof MockRow] as number,
})

export const pct = (got: number, total: number) => (total === 0 ? 0 : (got / total) * 100)

/** 得点区分별 추정 점수 + 기준점 통과 여부 */
export function sectionScores(m: MockRow, spec: LevelSpec) {
  return spec.sections.map(s => {
    const got = s.areas.reduce((a, k) => a + areaScore(m, k).got, 0)
    const total = s.areas.reduce((a, k) => a + areaScore(m, k).total, 0)
    const rate = pct(got, total)
    const score = Math.round((rate / 100) * s.max)
    return { ...s, got, total, rate, score, passed: score >= s.min }
  })
}

export function verdict(m: MockRow, spec: LevelSpec) {
  const secs = sectionScores(m, spec)
  const total = secs.reduce((a, s) => a + s.score, 0)
  const allMin = secs.every(s => s.passed)
  return { secs, total, allMin, passed: allMin && total >= spec.passTotal }
}
