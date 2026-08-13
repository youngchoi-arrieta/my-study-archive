// 범용 시험 난이도 (에관사·기술사·기술고시 공용)
// ===================================================================
// 세 시험 모두 과목별 합격률은 안정적으로 공표되지 않는다.
//   · 에관사: 열·전기 합산 전체 합격률만 공표 (전기 단독 없음)
//   · 기술사 1차: 부문별 회차 합격률 공표되나 연도별 편차 큼
//   · 기술고시: 최종 합격 인원만, 합격률 개념이 약함
// → 회차 전체 합격률 하나만 배지로 쓰고, 없는 값은 빈칸 + Supabase 오버라이드.
// 판정은 시험별 자기 중앙값 대비 배율(덴켄 rate와 동일 발상).
//
// 아래 BASELINE 은 확보된 공개 실적만 넣었다. 비어 있는 회차가 많은 게 정상이며,
// 사용자가 실제로 채점할 회차의 값은 앱에서 오버라이드로 채워 넣는 흐름을 전제한다.

export type ExamRate = {
  examId: string
  year: number
  rate: number | null      // 회차 전체 합격률 %
  note: string | null
}

// examIdPrefix → { year: rate }
const BASELINE: Record<string, Record<number, number>> = {
  // 에너지관리사(열·전기 합산 공식 합격률)
  enk: {
    2024: 36.8, 2023: 32.1, 2022: 32.7, 2021: 33.5,
    2020: 36.7, 2019: 32.6, 2018: 27.9, 2017: 28.4,
    2016: 20.1, 2015: 23.3, 2014: 21.5, 2013: 27.9,
  },
  // 技術士 1차 電気電子部門 (부문 합격률 · 공개 실적 근사)
  gjs: {
    2024: 43.7, 2023: 41.2, 2022: 42.1, 2021: 38.9,
    2020: 45.0, 2019: 40.5,
  },
  // 기술고시는 합격률 개념이 약해 baseline 없음 (전량 오버라이드/빈칸)
  gosi: {},
}

export function baselineRate(prefix: string, year: number): number | null {
  return BASELINE[prefix]?.[year] ?? null
}

// ── 오버라이드 병합 ─────────────────────────────────────────────────
export type RateOverride = { exam_id: string; rate: number | null; note: string | null }

export function buildRate(
  prefix: string, examId: string, year: number, ov: RateOverride | undefined,
): ExamRate {
  const base = baselineRate(prefix, year)
  return {
    examId, year,
    rate: ov && ov.rate !== null && ov.rate !== undefined ? ov.rate : base,
    note: ov?.note ?? null,
  }
}

// ── 난이도 등급 (중앙값 대비 배율) ──────────────────────────────────
export type RateTier = 'hard' | 'mid' | 'easy' | 'none'

export const RATIO_THRESHOLD = { hard: 0.8, mid: 1.2 } as const

export const TIER_META: Record<RateTier, { label: string; color: string; bg: string; border: string }> = {
  hard: { label: '난회차', color: '#f87171', bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.35)' },
  mid:  { label: '보통',   color: '#facc15', bg: 'rgba(234,179,8,0.14)',  border: 'rgba(234,179,8,0.35)' },
  easy: { label: '순회차', color: '#4ade80', bg: 'rgba(34,197,94,0.14)',  border: 'rgba(34,197,94,0.35)' },
  none: { label: '미발표', color: '#6b7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.28)' },
}

export function medianOf(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null).sort((a, b) => a - b)
  if (v.length === 0) return null
  const mid = Math.floor(v.length / 2)
  const m = v.length % 2 === 1 ? v[mid] : (v[mid - 1] + v[mid]) / 2
  return Math.round(m * 10) / 10
}

export function ratioOf(rate: number | null, median: number | null): number | null {
  if (rate === null || median === null || median <= 0) return null
  return Math.round((rate / median) * 100) / 100
}

export function tierOf(rate: number | null, median: number | null): RateTier {
  const r = ratioOf(rate, median)
  if (r === null) return 'none'
  if (r <= RATIO_THRESHOLD.hard) return 'hard'
  if (r <= RATIO_THRESHOLD.mid) return 'mid'
  return 'easy'
}
