// 電験三種 機械 과목 전용 constants

export type KikaiTag = {
  id: number
  ja: string
  ko: string
  color: string        // tailwind bg class
  accent: string       // hex for inline style
}

export const KIKAI_TAGS: KikaiTag[] = [
  { id: 1,  ja: '直流機',       ko: '직류기',      color: 'bg-sky-700',      accent: '#0369a1' },
  { id: 2,  ja: '変圧器',       ko: '변압기',      color: 'bg-emerald-700',  accent: '#047857' },
  { id: 3,  ja: '誘導機',       ko: '유도기',      color: 'bg-violet-700',   accent: '#6d28d9' },
  { id: 4,  ja: '同期機',       ko: '동기기',      color: 'bg-rose-700',     accent: '#be123c' },
  { id: 5,  ja: '電力電子',     ko: '전력전자',    color: 'bg-orange-700',   accent: '#c2410c' },
  { id: 6,  ja: '自動制御',     ko: '자동제어',    color: 'bg-teal-700',     accent: '#0f766e' },
  { id: 7,  ja: '情報',         ko: '정보',        color: 'bg-indigo-700',   accent: '#4338ca' },
  { id: 8,  ja: '照明',         ko: '조명',        color: 'bg-yellow-700',   accent: '#a16207' },
  { id: 9,  ja: '電熱',         ko: '전열',        color: 'bg-red-800',      accent: '#991b1b' },
  { id: 10, ja: '電動機応用',   ko: '전동기응용',  color: 'bg-cyan-700',     accent: '#0e7490' },
  { id: 11, ja: '電気化学',     ko: '전기화학',    color: 'bg-lime-700',     accent: '#4d7c0f' },
]

export const KIKAI_TAG_MAP = new Map<number, KikaiTag>(
  KIKAI_TAGS.map(t => [t.id, t])
)

// 기출 메타데이터 (機械 과목)
// 2023년부터 연 2회 (上期/下期), 2022 이전 연 1회
export type KikaiExam = {
  id: string
  year: number
  term: '上期' | '下期' | ''
  label: string
  totalQ: 18   // A문제 14 + B문제 4 = 18문제 (17/18번은 선택)
}

export const KIKAI_EXAMS: KikaiExam[] = [
  // 2023~ 연 2회 (上期=8월, 下期=翌年3월)
  { id: 'dk_2026_1', year: 2026, term: '上期', label: '2026년도 상반기 (2026.8)', totalQ: 18 },
  { id: 'dk_2025_2', year: 2025, term: '下期', label: '2025년도 하반기 (2026.3)', totalQ: 18 },
  { id: 'dk_2025_1', year: 2025, term: '上期', label: '2025년도 상반기 (2025.8)', totalQ: 18 },
  { id: 'dk_2024_2', year: 2024, term: '下期', label: '2024년도 하반기 (2025.3)', totalQ: 18 },
  { id: 'dk_2024_1', year: 2024, term: '上期', label: '2024년도 상반기 (2024.8)', totalQ: 18 },
  { id: 'dk_2023_2', year: 2023, term: '下期', label: '2023년도 하반기 (2024.3)', totalQ: 18 },
  { id: 'dk_2023_1', year: 2023, term: '上期', label: '2023년도 상반기 (2023.8)', totalQ: 18 },
  // 2022 이전 연 1회
  { id: 'dk_2022_0', year: 2022, term: '', label: '2022년도',   totalQ: 18 },
  { id: 'dk_2021_0', year: 2021, term: '', label: '2021년도',   totalQ: 18 },
  { id: 'dk_2020_0', year: 2020, term: '', label: '2020년도',   totalQ: 18 },
  { id: 'dk_2019_0', year: 2019, term: '', label: '2019년도',  totalQ: 18 },
  { id: 'dk_2018_0', year: 2018, term: '', label: '2018년도',  totalQ: 18 },
  { id: 'dk_2017_0', year: 2017, term: '', label: '2017년도',  totalQ: 18 },
  { id: 'dk_2016_0', year: 2016, term: '', label: '2016년도',  totalQ: 18 },
  { id: 'dk_2015_0', year: 2015, term: '', label: '2015년도',  totalQ: 18 },
  { id: 'dk_2014_0', year: 2014, term: '', label: '2014년도',  totalQ: 18 },
]

// 문제번호별 기본 정보
// A문제: 1~14 (5점×14=70점), B문제: 15~18 (10점×4문제, 단 17/18 선택)
// 실질 점수: A 5점×14 + B 10점×3(선택 1문제) = 70+30 = 100점
export const Q_TOTAL = 18
export const Q_SELECT_PAIR = [17, 18] as const  // 이 중 하나만 선택

export function isQSelectPair(q: number): boolean {
  return Q_SELECT_PAIR.includes(q as 17 | 18)
}

export function scoreForQ(q: number): number {
  return q <= 14 ? 5 : 10   // A문제 5점, B문제 10점
}
