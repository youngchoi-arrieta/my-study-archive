// 電験三種 공통 구조 · 채점 · 연호 라벨 (4과목 공용 단일 소스)
// -------------------------------------------------------------------
// 시험 구조 (2024년 기준 공식 배점)
//   理論 : A 1~14 (5점) + B 15~18 (각 (a)5+(b)5) ── 17·18 선택 1문제
//   電力 : A 1~14 (5점) + B 15~17 (각 (a)5+(b)5) ── 선택 없음, 총 17문
//   機械 : A 1~14 (5점) + B 15~18 (각 (a)5+(b)5) ── 17·18 선택 1문제
//   法規 : A 1~10 (6점) + B 11~13 ── 선택 없음, 총 13문
//          B 배점: 問11·問12 = (a)6/(b)7, 問13 = (a)7/(b)7  (B 합계 40점)
// 시험 라벨은 연도.월(예: 2026.3)로만 표기 (일본식 연호 미사용)

export type DenkenSubject = '理論' | '電力' | '機械' | '法規'
export type Result = 'correct' | 'wrong' | null
export type Sub = 'a' | 'b'   // B문제 소문항

export const DENKEN_SUBJECTS: DenkenSubject[] = ['理論', '電力', '機械', '法規']

export const SUBJECT_ACCENT: Record<DenkenSubject, string> = {
  '理論': '#2563eb',
  '電力': '#059669',
  '機械': '#7c3aed',
  '法規': '#b45309',
}

// ── 과목별 시험 구조 ────────────────────────────────────────────────
export type SubQPoints = { a: number; b: number }

export type SubjectStructure = {
  subject: DenkenSubject
  totalQ: number
  aPoint: number                         // A문제 1문항 배점
  bStart: number                         // B영역 시작 문번
  bEnd: number                           // B영역 끝 문번
  selectPair: readonly [number, number] | null  // 선택문제 쌍 (없으면 null)
  bPoints: (q: number) => SubQPoints     // B문제 소문항 (a)/(b) 배점
}

const uniformB = (a: number, b: number) => (): SubQPoints => ({ a, b })

export const DENKEN_STRUCTURE: Record<DenkenSubject, SubjectStructure> = {
  '理論': { subject: '理論', totalQ: 18, aPoint: 5, bStart: 15, bEnd: 18, selectPair: [17, 18], bPoints: uniformB(5, 5) },
  '電力': { subject: '電力', totalQ: 17, aPoint: 5, bStart: 15, bEnd: 17, selectPair: null,     bPoints: uniformB(5, 5) },
  '機械': { subject: '機械', totalQ: 18, aPoint: 5, bStart: 15, bEnd: 18, selectPair: [17, 18], bPoints: uniformB(5, 5) },
  '法規': { subject: '法規', totalQ: 13, aPoint: 6, bStart: 11, bEnd: 13, selectPair: null,
            bPoints: (q) => (q === 13 ? { a: 7, b: 7 } : { a: 6, b: 7 }) },
}

export function structureOf(subject: DenkenSubject): SubjectStructure {
  return DENKEN_STRUCTURE[subject]
}

export function isBArea(subject: DenkenSubject, q: number): boolean {
  const s = DENKEN_STRUCTURE[subject]
  return q >= s.bStart && q <= s.bEnd
}

export function isSelectQ(subject: DenkenSubject, q: number): boolean {
  const p = DENKEN_STRUCTURE[subject].selectPair
  return !!p && (p[0] === q || p[1] === q)
}

// 채점 제외 여부: 선택문제는 '선택된 것'만 점수에 포함한다.
// (아직 아무것도 안 골랐으면 선택쌍 둘 다 제외 → 총점이 100을 넘지 않음)
export function isExcludedSelect(subject: DenkenSubject, q: number, selectedQ: number | null): boolean {
  return isSelectQ(subject, q) && q !== selectedQ
}

// 화면 흐림(dim) 여부: 선택을 실제로 한 뒤에만, 안 고른 쪽을 흐리게
export function isDimmedSelect(subject: DenkenSubject, q: number, selectedQ: number | null): boolean {
  return isSelectQ(subject, q) && selectedQ !== null && q !== selectedQ
}

// ── 채점 (단일 소스) ────────────────────────────────────────────────
export type ScorableAnswer = {
  q_num: number
  result: Result      // A문제용 단일 정오
  result_a: Result    // B문제 (a) 소문항
  result_b: Result    // B문제 (b) 소문항
}

export function scoreDenken(
  subject: DenkenSubject,
  answers: ScorableAnswer[],
  selectedQ: number | null,
): number {
  const s = DENKEN_STRUCTURE[subject]
  let total = 0
  for (const a of answers) {
    if (isBArea(subject, a.q_num)) {
      if (isExcludedSelect(subject, a.q_num, selectedQ)) continue
      const p = s.bPoints(a.q_num)
      if (a.result_a === 'correct') total += p.a
      if (a.result_b === 'correct') total += p.b
    } else {
      if (a.result === 'correct') total += s.aPoint
    }
  }
  return total
}

// 문제 단위 '채점 완료' 여부 (A=result, B=소문항 둘 다)
export function isGraded(subject: DenkenSubject, a: ScorableAnswer): boolean {
  if (isBArea(subject, a.q_num)) return a.result_a !== null && a.result_b !== null
  return a.result !== null
}

// 채점 대상 문제 수 (미선택 선택문제 제외)
export function answerableCount(subject: DenkenSubject, selectedQ: number | null): number {
  const s = DENKEN_STRUCTURE[subject]
  let n = 0
  for (let q = 1; q <= s.totalQ; q++) {
    if (isExcludedSelect(subject, q, selectedQ)) continue
    n++
  }
  return n
}

export function gradedCount(
  subject: DenkenSubject,
  answers: ScorableAnswer[],
  selectedQ: number | null,
): number {
  return answers.filter(
    a => !isExcludedSelect(subject, a.q_num, selectedQ) && isGraded(subject, a),
  ).length
}

// ── 시험 라벨: 연도.월 표기 (일본식 연호 미사용) ───────────────────
// ID 규칙: dk_{Y}_{n}  →  n=1: Y년 3월 / n=2: Y년 8월 / n=0: 연 1회(연도만 표기)
export function deriveDenkenExam(id: string): { year: number; month: number | null } {
  const m = /^dk_(\d{4})_(\d)$/.exec(id)
  if (!m) return { year: 0, month: null }
  const Y = Number(m[1]), n = Number(m[2])
  if (n === 1) return { year: Y, month: 3 }
  if (n === 2) return { year: Y, month: 8 }
  return { year: Y, month: null }
}

// 헤더/목록 라벨: "2026.3" / "2025.8" / "2022"
export function examLabelFromId(id: string): string {
  const { year, month } = deriveDenkenExam(id)
  if (year === 0) return id
  return month === null ? `${year}` : `${year}.${month}`
}

// 정렬키 (내림차순: 2026.3 → 2025.8 → 2025.3 → 2024.8 → …)
export function denkenHeldKey(id: string): number {
  const { year, month } = deriveDenkenExam(id)
  return year * 100 + (month ?? 9)
}

// ── 시험 목록 (단일 소스) ───────────────────────────────────────────
export type DenkenExam = { id: string; year: number; month: number | null }

// ⚠ 이 배열이 앱 전체의 기출 목록 단일 소스다.
//   허브 목록 · 機械 상세 · 理論/電力/法規 상세가 모두 여기서 파생된다.
//   따로 목록을 복사해두면 화면마다 있는 회차/없는 회차가 갈려서
//   "허브에는 보이는데 눌러 들어가면 없다"는 상태가 된다.
// id 값은 절대 변경 금지(사용자 저장 데이터와 연결). year/month는 ID에서 유도.
export const DENKEN_EXAM_IDS = [
  // 연 2회 체제 (앱 라벨 기준: _1 = 3월, _2 = 8월)
  'dk_2026_1', 'dk_2025_2', 'dk_2025_1', 'dk_2024_2', 'dk_2024_1', 'dk_2023_2', 'dk_2023_1',
  // 연 1회 체제
  'dk_2022_0', 'dk_2021_0', 'dk_2020_0', 'dk_2019_0', 'dk_2018_0', 'dk_2017_0',
  'dk_2016_0', 'dk_2015_0', 'dk_2014_0', 'dk_2013_0', 'dk_2012_0', 'dk_2011_0',
  'dk_2010_0', 'dk_2009_0', 'dk_2008_0',
]

export const DENKEN_EXAMS: DenkenExam[] = DENKEN_EXAM_IDS.map(id => ({ id, ...deriveDenkenExam(id) }))

export const DENKEN_EXAM_MAP = new Map<string, DenkenExam>(
  DENKEN_EXAMS.map(e => [e.id, e]),
)
