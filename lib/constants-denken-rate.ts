// 電験三種 회차별 난이도 (과목별 합격률 · 합격기준점) — 단일 소스
// -------------------------------------------------------------------
// 출처: 一般財団法人 電気技術者試験センター 프레스릴리스
//   https://www.shiken.or.jp/ecee-overview/press/exam/
//   (추이 정리본: https://denken111.com/den3-goukaku/)
//
// ⚠ 표기 주의 — 일본 시험은 「年度」 기준, 이 앱의 exam_id 는 「실시 연월」 기준.
//   2025年度上期 = 2025년 8월 실시 = dk_2025_2
//   2025年度下期 = 2026년 3월 실시 = dk_2026_1
//   즉 年度 라벨과 앱 라벨이 한 칸씩 어긋나므로 반드시 examId 로 매칭할 것.
//
// 수정 방법: 아래 BASELINE 표를 직접 고쳐도 되고,
//   허브 → 난이도 탭에서 회차별로 덮어쓰면 Supabase(denken_exam_rates)에 저장된다.
//   (덮어쓴 값이 우선, 비워두면 이 표의 값으로 되돌아감)

import type { DenkenSubject } from './constants-denken'

export type SubjectRate = {
  rate: number | null // 과목별 합격률 (%)
  pass: number | null // 합격기준점 (원칙 60, 난이도 조정 시 인하)
}

export type ExamRate = {
  examId: string
  nendo: string // 일본식 年度 라벨 ('2025年度上期')
  overall: number | null // 전체(4과목) 합격률 %
  applicants: number | null // 수험자 수
  subjects: Record<DenkenSubject, SubjectRate>
  manual: boolean // true = 미발표/직접 입력 대상
  note: string | null
  source: 'baseline' | 'override' // 값의 출처 (UI 표시용)
}

// [examId, 年度, 전체합격률, 수험자수, 理·電·機·法 합격률, 理·電·機·法 합격기준점]
type Row = [
  string, string,
  number | null, number | null,
  number | null, number | null, number | null, number | null,
  number | null, number | null, number | null, number | null,
]

const ROWS: Row[] = [
  // ── 미발표 / 직접 입력 구간 ──────────────────────────────────────
  ['dk_2026_2', '2026年度上期', null, null, null, null, null, null, null, null, null, null],
  ['dk_2026_1', '2025年度下期', null, null, null, null, null, null, null, null, null, null],
  // ── 발표분 ─────────────────────────────────────────────────────
  ['dk_2025_2', '2025年度上期', 12.9, 24766, 14.0, 17.4,  9.9, 11.8, 60, 60, 55, 60],
  ['dk_2025_1', '2024年度下期', 16.8, 24547, 20.8, 16.0, 12.7, 10.9, 60, 55, 60, 60],
  ['dk_2024_2', '2024年度上期', 16.0, 25416, 16.7, 16.6, 13.3, 13.1, 60, 60, 60, 60],
  ['dk_2024_1', '2023年度下期', 21.2, 24567, 21.7, 23.0, 14.2, 13.7, 60, 60, 60, 60],
  ['dk_2023_2', '2023年度上期', 16.6, 28168, 18.5, 17.8, 13.9, 13.0, 60, 60, 60, 60],
  ['dk_2023_1', '2022年度下期', 15.7, 28785, 17.7, 16.3, 14.9,  6.6, 60, 60, 60, 60],
  ['dk_2022_0', '2022年度上期',  8.3, 33786, 17.1, 20.0,  6.9,  9.4, 60, 60, 55, 54],
  ['dk_2021_0', '2021年度',     11.8, 37765,  6.7, 24.8, 13.8, 14.1, 60, 60, 60, 60],
  ['dk_2020_0', '2020年度',      9.8, 39010, 19.2, 12.2,  6.7, 12.6, 60, 60, 60, 60],
  ['dk_2019_0', '2019年度',      9.3, 41543, 13.7, 13.7, 20.1,  9.6, 55, 60, 60, 49],
  ['dk_2018_0', '2018年度',      9.1, 42976, 11.6, 17.8, 13.8,  6.6, 55, 55, 55, 51],
  ['dk_2017_0', '2017年度',      8.1, 45720, 15.5,  9.1, 11.6,  9.3, 55, 55, 55, 55],
  ['dk_2016_0', '2016年度',      8.5, 46552, 14.6,  8.7, 17.0,  9.0, 55, 55, 55, 54],
  ['dk_2015_0', '2015年度',      7.7, 45311, 14.4, 15.1,  6.2, 13.7, 55, 55, 55, 55],
  ['dk_2014_0', '2014年度',      8.4, 48681, 13.4, 16.4, 10.4, 11.6, 54.38, 58, 54.39, 58],
  ['dk_2013_0', '2013年度',      8.7, 49575, 14.3, 12.4, 17.1, 19.4, 57.73, 56.32, 54.57, 58],
  ['dk_2012_0', '2012年度',      5.9, 49452, 18.4, 24.8, 10.0,  9.8, 55, 55, 50.56, 51.35],
  ['dk_2011_0', '2011年度',      5.5, 48864, 11.9, 14.5, 17.6, 12.1, 52.44, 55, 55, 54.2],
  ['dk_2010_0', '2010年度',      7.2, 50794, 19.6, 12.7, 11.6, 20.4, 55, 52.75, 47.65, 55],
  ['dk_2009_0', '2009年度',      9.6, 47593, 18.8, 23.3, 19.7, 28.3, 53.9, 55, 49.17, 55],
  ['dk_2008_0', '2008年度',     10.9, 40140, 18.0, 19.8, 21.9, 36.3, 60, 60, 55, 60],
]

function rowToExamRate(r: Row): ExamRate {
  const [examId, nendo, overall, applicants, rR, rD, rK, rH, pR, pD, pK, pH] = r
  return {
    examId,
    nendo,
    overall,
    applicants,
    subjects: {
      '理論': { rate: rR, pass: pR },
      '電力': { rate: rD, pass: pD },
      '機械': { rate: rK, pass: pK },
      '法規': { rate: rH, pass: pH },
    },
    manual: overall === null && rR === null,
    note: null,
    source: 'baseline',
  }
}

export const DENKEN_RATE_BASELINE: ExamRate[] = ROWS.map(rowToExamRate)

export const DENKEN_RATE_MAP = new Map<string, ExamRate>(
  DENKEN_RATE_BASELINE.map(e => [e.examId, e]),
)

// ── 난이도 등급 ─────────────────────────────────────────────────────
// 과목별 합격률은 절대값으로 비교하면 안 된다.
//   · 과목차: 機械 중앙값 13.8% vs 理論 16.7% → 같은 15% 기준을 대면 機械만 붉어진다
//   · 시대차: 2022년도 2회화 이후 모집단이 바뀌어 전반적으로 합격률이 올랐다
// 그래서 과목별 합격률은 "그 과목의 중앙값 대비 몇 배인가"로 판정한다.
// 평균이 아니라 중앙값을 쓰는 이유: 法規 36.3%(2008年度) 같은 극단값이 평균을 끌어올린다.
export type RateTier = 'hard' | 'mid' | 'easy' | 'none'

// 과목별 상대 기준 (중앙값 대비 배율)
export const RATIO_THRESHOLD = { hard: 0.75, mid: 1.15 } as const

// 회차 전체 합격률용 절대 기준 (과목 비교가 아니라 시대 흐름을 보는 지표라 절대값이 맞다)
export const OVERALL_THRESHOLD = { hard: 10, mid: 15 } as const

export function overallTier(rate: number | null | undefined): RateTier {
  if (rate === null || rate === undefined) return 'none'
  if (rate <= OVERALL_THRESHOLD.hard) return 'hard'
  if (rate <= OVERALL_THRESHOLD.mid) return 'mid'
  return 'easy'
}

// 합격기준점 60점 미만 = 시험센터가 난이도를 인정하고 인하한 회차 (표시용 판정)
export function isAdjusted(pass: number | null | undefined): boolean {
  return pass !== null && pass !== undefined && pass < 60
}

// ⚠ 기준점 인하를 "난이도 신호"로 쓸 수 있는 건 60점이 표준이 된 2020年度 이후뿐이다.
//   그 이전에는 55점 안팎의 인하가 사실상 상시라 신호가 되지 못한다.
//   (예: 2008年度 機械는 합격률 21.9%로 역대 최고인데 기준점은 55점이었다)
export const PASS_SIGNAL_FROM_NENDO = 2020

export function nendoYear(nendo: string): number {
  const m = /^(\d{4})/.exec(nendo)
  return m ? Number(m[1]) : 0
}

export function isAdjustSignal(pass: number | null | undefined, nendo?: string): boolean {
  if (!isAdjusted(pass)) return false
  if (!nendo) return false
  return nendoYear(nendo) >= PASS_SIGNAL_FROM_NENDO
}

export function ratioOf(rate: number | null | undefined, median: number | null | undefined): number | null {
  if (rate === null || rate === undefined) return null
  if (median === null || median === undefined || median <= 0) return null
  return Math.round((rate / median) * 100) / 100
}

export function subjectTier(
  rate: number | null | undefined,
  pass: number | null | undefined,
  median: number | null | undefined,
  nendo?: string,
): RateTier {
  if (rate === null || rate === undefined) return 'none'
  if (isAdjustSignal(pass, nendo)) return 'hard'   // 2020年度 이후의 기준점 인하 = 난회차 확정
  const ratio = ratioOf(rate, median)
  if (ratio === null) return 'none'
  if (ratio <= RATIO_THRESHOLD.hard) return 'hard'
  if (ratio <= RATIO_THRESHOLD.mid) return 'mid'
  return 'easy'
}

export const TIER_META: Record<RateTier, {
  label: string; color: string; bg: string; border: string
}> = {
  hard: { label: '난회차', color: '#f87171', bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.35)' },
  mid:  { label: '보통',   color: '#facc15', bg: 'rgba(234,179,8,0.14)',  border: 'rgba(234,179,8,0.35)' },
  easy: { label: '순회차', color: '#4ade80', bg: 'rgba(34,197,94,0.14)',  border: 'rgba(34,197,94,0.35)' },
  none: { label: '미발표', color: '#6b7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.28)' },
}

// ── Supabase 덮어쓰기 병합 ──────────────────────────────────────────
// 열 이름은 supabase/denken_exam_rates_migration.sql 참고.
export type RateOverrideRow = {
  exam_id: string
  overall_rate: number | null
  applicants: number | null
  rate_riron: number | null
  rate_denryoku: number | null
  rate_kikai: number | null
  rate_hoki: number | null
  pass_riron: number | null
  pass_denryoku: number | null
  pass_kikai: number | null
  pass_hoki: number | null
  note: string | null
}

const pick = (a: number | null, b: number | null) => (a === null || a === undefined ? b : a)

export function mergeRate(base: ExamRate | undefined, ov: RateOverrideRow | undefined, examId: string, nendo?: string): ExamRate {
  const b: ExamRate = base ?? {
    examId, nendo: nendo ?? examId, overall: null, applicants: null,
    subjects: {
      '理論': { rate: null, pass: null }, '電力': { rate: null, pass: null },
      '機械': { rate: null, pass: null }, '法規': { rate: null, pass: null },
    },
    manual: true, note: null, source: 'baseline',
  }
  if (!ov) return b

  const merged: ExamRate = {
    ...b,
    overall: pick(ov.overall_rate, b.overall),
    applicants: pick(ov.applicants, b.applicants),
    subjects: {
      '理論': { rate: pick(ov.rate_riron, b.subjects['理論'].rate),       pass: pick(ov.pass_riron, b.subjects['理論'].pass) },
      '電力': { rate: pick(ov.rate_denryoku, b.subjects['電力'].rate),    pass: pick(ov.pass_denryoku, b.subjects['電力'].pass) },
      '機械': { rate: pick(ov.rate_kikai, b.subjects['機械'].rate),       pass: pick(ov.pass_kikai, b.subjects['機械'].pass) },
      '法規': { rate: pick(ov.rate_hoki, b.subjects['法規'].rate),        pass: pick(ov.pass_hoki, b.subjects['法規'].pass) },
    },
    note: ov.note ?? b.note,
    source: 'override',
  }
  merged.manual = merged.overall === null && merged.subjects['理論'].rate === null
  return merged
}

// ── 과목별 중앙값 (난이도 판정 기준선) ─────────────────────────────
// 값이 있는 회차만 사용. 덮어쓴 값이 반영되므로 표를 고치면 기준선도 따라 움직인다.
export function subjectMedian(list: ExamRate[], subject: DenkenSubject): number | null {
  const vals = list
    .map(e => e.subjects[subject].rate)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b)
  if (vals.length === 0) return null
  const mid = Math.floor(vals.length / 2)
  const m = vals.length % 2 === 1 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
  return Math.round(m * 10) / 10
}

export type SubjectMedians = Record<DenkenSubject, number | null>

export function computeMedians(list: ExamRate[]): SubjectMedians {
  return {
    '理論': subjectMedian(list, '理論'),
    '電力': subjectMedian(list, '電力'),
    '機械': subjectMedian(list, '機械'),
    '法規': subjectMedian(list, '法規'),
  }
}
