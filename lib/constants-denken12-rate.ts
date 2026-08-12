// 電験一種・二種 회차별 난이도 — 단일 소스
// ===================================================================
// 출처: 一般財団法人 電気技術者試験センター 「試験結果と推移」
//   https://www.shiken.or.jp/chief/first/result/
//   https://www.shiken.or.jp/chief/second/result/
//   (令和8年1월 갱신본 기준. 受験者·合格者 실수만 공표된다)
//
// ⚠ 三種과 난이도 축이 다르다. 여기가 이 파일의 핵심 전제다.
//   三種  : 과목별 합격률이 공표된다 → 과목 단위로 난회차를 가른다
//   1·2종 : 과목별 합격률은 공표되지 않는다. 나오는 건
//             ① 一次 受験者/合格者  ② 二次 受験者/合格者  뿐이다.
//           (科目合格者 수는 나오지만 분모가 과목별이 아니라 사람 단위라 비율로 못 쓴다)
//   → 그래서 난이도 축을 「一次 전체 합격률」과「二次 합격률」 두 개로 잡았다.
//     과목별로 붉게 칠하는 대신, 회차 헤더에 두 단계의 배지를 단다.
//
// ⚠ 二次 합격률의 분모는 「二次 수험자」다. 一次를 뚫은 사람만 모인 모집단이라
//   숫자 자체가 三種 합격률과 같은 의미가 아니다. 절대 기준을 쓰면 전부 붉어진다.
//   → 一次·二次 각각 자기 중앙값 대비 배율로 판정한다 (三種 rate 파일과 같은 발상).

import type { Denken12Grade, Denken12Phase } from './constants-denken12'
import { makeExamId, wareki } from './constants-denken12'

// [年度, 一次受験, 一次合格, 二次受験, 二次合格]
type Row = [number, number | null, number | null, number | null, number | null]

// ── 第二種 ──────────────────────────────────────────────────────────
const SECOND_ROWS: Row[] = [
  [2026, null, null, null, null],   // 令和8年度 — 미실시/미발표
  [2025, 7211, 2524, 3692, 611],
  [2024, 7479, 2159, 2922, 553],
  [2023, 6318, 1545, 2682, 474],
  [2022, 6189, 2178, 2904, 698],
  [2021, 5979, 1539, 2407, 413],
  [2020, 6235, 1695, 2512, 701],
  [2019, 6915, 1633, 2513, 574],
  [2018, 6631, 1600, 2624, 381],
  [2017, 6570, 1737, 2435, 329],
  [2016, 6521, 1456, 2364, 459],
  [2015, 6418, 1557, 2406, 297],
  [2014, 6676, 1595, 2443, 350],
  [2013, 6452, 1550, 2503, 282],
  [2012, 7034, 1748, 2249, 304],
  [2011, 6659, 1047, 1942, 219],
  [2010, 6786, 1549, 2636, 411],
  [2009, 6743, 1805, 2490, 255],
]

// ── 第一種 ──────────────────────────────────────────────────────────
const FIRST_ROWS: Row[] = [
  [2026, null, null, null, null],
  [2025, 1569, 502, 772, 245],
  [2024, 1433, 428, 720, 112],
  [2023, 1469, 485, 719, 129],
  [2022, 1436, 442, 685, 143],
  [2021, 1225, 379, 899,  72],
  [2020, 1508, 759, 933, 134],
  [2019, 1566, 379, 598, 103],
  [2018, 1566, 378, 615,  84],
  [2017, 1567, 363, 569,  86],
  [2016, 1519, 331, 581,  75],
  [2015, 1563, 401, 608, 105],
  [2014, 1638, 337, 576,  75],
  [2013, 1624, 379, 641,  96],
  [2012, 1627, 371, 699,  68],
  [2011, 1632, 441, 707,  60],
  [2010, 1715, 417, 680, 132],
  [2009, 1721, 368, 608,  68],
]

export type PhaseRate = {
  takers: number | null
  passers: number | null
  rate: number | null       // %
}

export type Denken12Rate = {
  examId: string
  grade: Denken12Grade
  nendo: number
  nendoLabel: string        // '令和7年度'
  ichiji: PhaseRate
  niji: PhaseRate
  passMarkNiji: number | null   // 二次 합격기준점(180점 만점). 인하된 회차만 채워 넣는다
  note: string | null
  source: 'baseline' | 'override'
}

function rateOf(takers: number | null, passers: number | null): number | null {
  if (takers === null || passers === null || takers <= 0) return null
  return Math.round((passers / takers) * 1000) / 10
}

function toRate(grade: Denken12Grade, r: Row): Denken12Rate {
  const [nendo, it, ip, nt, np] = r
  return {
    examId: makeExamId(grade, nendo),
    grade,
    nendo,
    nendoLabel: wareki(nendo),
    ichiji: { takers: it, passers: ip, rate: rateOf(it, ip) },
    niji:   { takers: nt, passers: np, rate: rateOf(nt, np) },
    passMarkNiji: null,
    note: null,
    source: 'baseline',
  }
}

export const DENKEN12_RATE_BASELINE: Denken12Rate[] = [
  ...SECOND_ROWS.map(r => toRate('second', r)),
  ...FIRST_ROWS.map(r => toRate('first', r)),
]

export const DENKEN12_RATE_MAP = new Map<string, Denken12Rate>(
  DENKEN12_RATE_BASELINE.map(e => [e.examId, e]),
)

// ── 난이도 등급 ─────────────────────────────────────────────────────
// 종·단계마다 합격률 수준이 완전히 다르다.
//   2종 一次 중앙값 ~24% vs 2종 二次 ~15% vs 1종 二次 ~14%
// 절대 기준을 하나로 쓰면 특정 칸만 통째로 붉어지므로, 세그먼트별 중앙값 대비 배율로 본다.
export type RateTier = 'hard' | 'mid' | 'easy' | 'none'

export const RATIO_THRESHOLD = { hard: 0.8, mid: 1.2 } as const

export const TIER_META: Record<RateTier, {
  label: string; color: string; bg: string; border: string
}> = {
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

export type PhaseMedians = Record<Denken12Phase, number | null>

export function computeMedians(list: Denken12Rate[]): PhaseMedians {
  return {
    ichiji: medianOf(list.map(e => e.ichiji.rate)),
    niji:   medianOf(list.map(e => e.niji.rate)),
  }
}

export function ratioOf(rate: number | null, median: number | null): number | null {
  if (rate === null || median === null || median <= 0) return null
  return Math.round((rate / median) * 100) / 100
}

export function tierOf(rate: number | null, median: number | null): RateTier {
  const ratio = ratioOf(rate, median)
  if (ratio === null) return 'none'
  if (ratio <= RATIO_THRESHOLD.hard) return 'hard'
  if (ratio <= RATIO_THRESHOLD.mid) return 'mid'
  return 'easy'
}

// ── Supabase 덮어쓰기 병합 ──────────────────────────────────────────
// 열 이름은 supabase/denken12_migration.sql 참고.
// 표에 없는 회차(미발표분)를 직접 채우거나, 기본 표의 오류를 앱에서 고칠 때 쓴다.
export type Denken12RateOverride = {
  exam_id: string
  ichiji_takers: number | null
  ichiji_passers: number | null
  niji_takers: number | null
  niji_passers: number | null
  pass_mark_niji: number | null
  note: string | null
}

const pick = <T,>(a: T | null | undefined, b: T | null) => (a === null || a === undefined ? b : a)

export function mergeRate(
  base: Denken12Rate | undefined,
  ov: Denken12RateOverride | undefined,
  examId: string,
  grade: Denken12Grade,
  nendo: number,
): Denken12Rate {
  const b: Denken12Rate = base ?? {
    examId, grade, nendo, nendoLabel: wareki(nendo),
    ichiji: { takers: null, passers: null, rate: null },
    niji:   { takers: null, passers: null, rate: null },
    passMarkNiji: null, note: null, source: 'baseline',
  }
  if (!ov) return b

  const it = pick(ov.ichiji_takers,  b.ichiji.takers)
  const ip = pick(ov.ichiji_passers, b.ichiji.passers)
  const nt = pick(ov.niji_takers,    b.niji.takers)
  const np = pick(ov.niji_passers,   b.niji.passers)

  return {
    ...b,
    ichiji: { takers: it, passers: ip, rate: rateOf(it, ip) },
    niji:   { takers: nt, passers: np, rate: rateOf(nt, np) },
    passMarkNiji: pick(ov.pass_mark_niji, b.passMarkNiji),
    note: ov.note ?? b.note,
    source: 'override',
  }
}
