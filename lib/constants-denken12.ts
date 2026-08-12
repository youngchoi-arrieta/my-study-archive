// 電験一種・二種 공통 구조 · 채점 · 라벨 (단일 소스)
// ===================================================================
// 三種과 결정적으로 다른 점 세 가지. 이 파일의 모든 설계는 여기서 나온다.
//
//   1) 연 1회 · 1차/2차 2단계
//      一次(8월, 마크시트 4과목) → 합격자만 二次(11월, 기술식 2과목).
//      一次 합격한 해의 二次에 떨어지면 다음 해 一次가 면제된다.
//      그래서 회차의 단위는 「실시 연월」이 아니라 「年度」다. (三種은 연 2회라 연월 라벨)
//
//   2) 一次는 A문제도 穴埋め(공란 채우기)라 채점 단위가 大問이 아니라 小問이다
//      三種: A문제=1문 1답, B문제=(a)(b) 2소문항 → 고정 구조
//      1·2종: 大問마다 小問이 5~10개, 大問 배점을 小問 수로 나눠 배분
//      → 채점 모델을 「大問 배점 + 小問 수 + 小問별 정오」로 일반화했다.
//        (三種 모델의 상위 호환. 三種은 여기에 A=1小問, B=2小問을 끼운 특수 케이스)
//
//   3) 二次는 記述式이라 자동 채점이 불가능하다
//      6문 중 4문(電力・管理), 4문 중 2문(機械・制御)을 골라 푸는 방식.
//      → 문제별 30점 만점 자기채점 점수를 직접 입력한다.
//
// 출처: 一般財団法人 電気技術者試験センター
//   https://www.shiken.or.jp/chief/first/qa/  ·  /chief/second/qa/
//   (배점은 실제 문제지 표지 문구 확인 —
//    2종 理論 "Ａ問題(配点は1問題当たり小問各3点，計15点)" / "Ｂ問題(…小問各2点，計10点)"
//    1종 理論 "Ａ問題(…小問各2点，計10点)" / "Ｂ問題(配点は1問題当たり計20点)")

// ── 종별 ────────────────────────────────────────────────────────────
export type Denken12Grade = 'first' | 'second'

export const GRADE_META: Record<Denken12Grade, {
  label: string; short: string; ja: string; accent: string; idPrefix: string
}> = {
  first:  { label: '第一種', short: '1종', ja: '電験一種', accent: '#e11d48', idPrefix: 'dk1' },
  second: { label: '第二種', short: '2종', ja: '電験二種', accent: '#0891b2', idPrefix: 'dk2' },
}

export const GRADES: Denken12Grade[] = ['second', 'first']  // 2종 먼저 (현실 순서)

// ── 단계 · 과목 ─────────────────────────────────────────────────────
export type Denken12Phase = 'ichiji' | 'niji'

export type IchijiSubject = '理論' | '電力' | '機械' | '法規'
export type NijiSubject   = '電力・管理' | '機械・制御'
export type Denken12Subject = IchijiSubject | NijiSubject

export const ICHIJI_SUBJECTS: IchijiSubject[] = ['理論', '電力', '機械', '法規']
export const NIJI_SUBJECTS:   NijiSubject[]   = ['電力・管理', '機械・制御']

export const ALL_SUBJECTS: Denken12Subject[] = [...ICHIJI_SUBJECTS, ...NIJI_SUBJECTS]

export const PHASE_META: Record<Denken12Phase, {
  label: string; ja: string; month: number; desc: string
}> = {
  ichiji: { label: '一次', ja: '一次試験', month: 8,  desc: '마크시트 4과목 · 과목합격 3년 유보' },
  niji:   { label: '二次', ja: '二次試験', month: 11, desc: '기술식 2과목 · 합산 판정 + 足切り' },
}

export function phaseOf(subject: Denken12Subject): Denken12Phase {
  return (NIJI_SUBJECTS as string[]).includes(subject) ? 'niji' : 'ichiji'
}

export function isNiji(subject: Denken12Subject): subject is NijiSubject {
  return phaseOf(subject) === 'niji'
}

export const SUBJECT_ACCENT: Record<Denken12Subject, string> = {
  '理論':      '#2563eb',
  '電力':      '#059669',
  '機械':      '#7c3aed',
  '法規':      '#b45309',
  '電力・管理': '#0d9488',
  '機械・制御': '#9333ea',
}

// ── 채점 결과 ───────────────────────────────────────────────────────
export type Result = 'correct' | 'wrong' | null

export function cycleResult(r: Result): Result {
  return r === null ? 'correct' : r === 'correct' ? 'wrong' : null
}

// ── 一次 시험 구조 ──────────────────────────────────────────────────
// 두 종 모두 A問題 4題 + B問題. B에만 선택문제가 붙고, 그것도 理論·機械뿐이다.
//
//   2종: A 15点(小問5×3点) ×4 + B 10点(小問5×2点) ×3          = 90点 / 합격 54点
//   1종: A 10点(小問5×2点) ×4 + B 20点(小問 수 가변) ×2        = 80点 / 합격 48点
//
// ⚠ 1종 B문제는 小問 수가 회차·문제마다 5~10으로 달라진다(小問당 20/n点).
//   그래서 subCount 를 회차별로 고쳐 쓸 수 있게 열어 뒀다 (아래 clampSubCount).
//   2종은 小問 5개로 사실상 고정이지만 같은 경로로 처리한다.

export type IchijiStructure = {
  grade: Denken12Grade
  subject: IchijiSubject
  totalQ: number                                  // 문제지에 실린 大問 수(선택문제 포함)
  bStart: number                                  // B영역 시작 문번
  aPoint: number                                  // A 大問 배점
  bPoint: number                                  // B 大問 배점
  aSubCount: number                               // A 小問 수 (고정)
  bSubCount: number                               // B 小問 수 (기본값)
  bSubVariable: boolean                           // B 小問 수가 회차마다 달라지는가
  selectPair: readonly [number, number] | null    // 선택문제 쌍
  fullMark: number
  passMark: number                                // 원칙 만점의 60%
}

const ICHIJI_SPEC = {
  second: { aPoint: 15, bPoint: 10, aSub: 5, bSub: 5, bVar: false, full: 90, pass: 54, bCount: 3 },
  first:  { aPoint: 10, bPoint: 20, aSub: 5, bSub: 5, bVar: true,  full: 80, pass: 48, bCount: 2 },
} as const

function buildIchiji(grade: Denken12Grade, subject: IchijiSubject): IchijiStructure {
  const s = ICHIJI_SPEC[grade]
  // 理論·機械만 B 마지막에 선택쌍이 하나 더 붙어 大問이 1개 많다
  const hasSelect = subject === '理論' || subject === '機械'
  const bStart = 5
  const answeredB = s.bCount
  const totalQ = 4 + answeredB + (hasSelect ? 1 : 0)
  const selectPair = hasSelect
    ? ([totalQ - 1, totalQ] as const)
    : null
  return {
    grade, subject, totalQ, bStart,
    aPoint: s.aPoint, bPoint: s.bPoint,
    aSubCount: s.aSub, bSubCount: s.bSub, bSubVariable: s.bVar,
    selectPair,
    fullMark: s.full, passMark: s.pass,
  }
}

export const ICHIJI_STRUCTURE: Record<Denken12Grade, Record<IchijiSubject, IchijiStructure>> = {
  first: {
    '理論': buildIchiji('first', '理論'),
    '電力': buildIchiji('first', '電力'),
    '機械': buildIchiji('first', '機械'),
    '法規': buildIchiji('first', '法規'),
  },
  second: {
    '理論': buildIchiji('second', '理論'),
    '電力': buildIchiji('second', '電力'),
    '機械': buildIchiji('second', '機械'),
    '法規': buildIchiji('second', '法規'),
  },
}

export function ichijiStructure(grade: Denken12Grade, subject: IchijiSubject): IchijiStructure {
  return ICHIJI_STRUCTURE[grade][subject]
}

export function isBArea(st: IchijiStructure, q: number): boolean {
  return q >= st.bStart
}

export function isSelectQ(st: IchijiStructure, q: number): boolean {
  const p = st.selectPair
  return !!p && (p[0] === q || p[1] === q)
}

// 채점 제외: 선택쌍 중 고르지 않은 쪽 (아직 안 골랐으면 둘 다 제외 → 만점 초과 방지)
export function isExcludedSelect(st: IchijiStructure, q: number, selectedQ: number | null): boolean {
  return isSelectQ(st, q) && q !== selectedQ
}

// 화면 흐림: 실제로 하나를 고른 뒤에만 반대쪽을 흐리게
export function isDimmedSelect(st: IchijiStructure, q: number, selectedQ: number | null): boolean {
  return isSelectQ(st, q) && selectedQ !== null && q !== selectedQ
}

export function pointOf(st: IchijiStructure, q: number): number {
  return isBArea(st, q) ? st.bPoint : st.aPoint
}

export function defaultSubCount(st: IchijiStructure, q: number): number {
  return isBArea(st, q) ? st.bSubCount : st.aSubCount
}

export const SUB_COUNT_MIN = 2
export const SUB_COUNT_MAX = 12

export function clampSubCount(n: number): number {
  if (!Number.isFinite(n)) return 5
  return Math.min(SUB_COUNT_MAX, Math.max(SUB_COUNT_MIN, Math.round(n)))
}

// ── 一次 채점 ───────────────────────────────────────────────────────
// 大問 점수 = (맞은 小問 수 / 小問 수) × 大問 배점
// 小問 배점이 나누어떨어지지 않는 경우가 있어(1종 B의 20/6 등) 소수점 1자리까지 남긴다.

export type IchijiAnswer = {
  q_num: number
  subCount: number
  subs: Result[]        // 길이 = subCount
  memo: string
}

export function normalizeSubs(subs: Result[], subCount: number): Result[] {
  const out = subs.slice(0, subCount)
  while (out.length < subCount) out.push(null)
  return out
}

export function correctCount(a: IchijiAnswer): number {
  return a.subs.filter(r => r === 'correct').length
}

export function gradedSubCount(a: IchijiAnswer): number {
  return a.subs.filter(r => r !== null).length
}

export function questionScore(st: IchijiStructure, a: IchijiAnswer): number {
  if (a.subCount <= 0) return 0
  return (correctCount(a) / a.subCount) * pointOf(st, a.q_num)
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function scoreIchiji(
  st: IchijiStructure,
  answers: IchijiAnswer[],
  selectedQ: number | null,
): number {
  let total = 0
  for (const a of answers) {
    if (isExcludedSelect(st, a.q_num, selectedQ)) continue
    total += questionScore(st, a)
  }
  return round1(total)
}

// 大問 단위 '채점 완료' 여부 (小問을 전부 찍었는가)
export function isGraded(a: IchijiAnswer): boolean {
  return a.subCount > 0 && gradedSubCount(a) === a.subCount
}

export function answerableCount(st: IchijiStructure, selectedQ: number | null): number {
  let n = 0
  for (let q = 1; q <= st.totalQ; q++) {
    if (isExcludedSelect(st, q, selectedQ)) continue
    n++
  }
  return n
}

export function gradedCount(
  st: IchijiStructure,
  answers: IchijiAnswer[],
  selectedQ: number | null,
): number {
  return answers.filter(a => !isExcludedSelect(st, a.q_num, selectedQ) && isGraded(a)).length
}

// 大問 단위 정오 (목록·헤더 색상용): 小問 전부 맞으면 correct, 하나라도 틀리면 wrong
export function questionStatus(a: IchijiAnswer): Result {
  if (a.subs.some(r => r === 'wrong')) return 'wrong'
  if (isGraded(a)) return 'correct'
  return null
}

// ── 二次 시험 구조 ──────────────────────────────────────────────────
// 記述式. 1종·2종 모두 동일한 형식이다.
//   電力・管理 : 6問中4問選択 × 30点 = 120点
//   機械・制御 : 4問中2問選択 × 30点 =  60点
//   합계 180点 · 합격 108点(60%) + 각 과목 평균점 이상(足切り)
//   난이도가 높으면 105点 → 102点 식으로 3점 단위로 인하된다.

export type NijiStructure = {
  subject: NijiSubject
  totalQ: number      // 출제 문제 수
  pickCount: number   // 선택해서 푸는 문제 수
  perQ: number        // 문제당 배점
  fullMark: number
}

export const NIJI_STRUCTURE: Record<NijiSubject, NijiStructure> = {
  '電力・管理': { subject: '電力・管理', totalQ: 6, pickCount: 4, perQ: 30, fullMark: 120 },
  '機械・制御': { subject: '機械・制御', totalQ: 4, pickCount: 2, perQ: 30, fullMark: 60 },
}

export const NIJI_FULL_MARK = 180
export const NIJI_PASS_MARK = 108          // 60% (난회차에는 105 → 102로 인하)
export const NIJI_PASS_STEP = 3

export type NijiAnswer = {
  q_num: number
  selected: boolean
  score: number | null   // 자기채점 0~30
  memo: string
}

export function scoreNiji(st: NijiStructure, answers: NijiAnswer[]): number {
  // 선택 개수를 초과해 입력했더라도 상위 pickCount개만 인정한다 (실제 채점과 동일)
  const picked = answers.filter(a => a.selected && a.score !== null)
    .map(a => a.score as number)
    .sort((x, y) => y - x)
    .slice(0, st.pickCount)
  return round1(picked.reduce((s, v) => s + v, 0))
}

export function nijiPickedCount(answers: NijiAnswer[]): number {
  return answers.filter(a => a.selected).length
}

export function clampNijiScore(n: number, st: NijiStructure): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(st.perQ, Math.max(0, Math.round(n * 2) / 2))   // 0.5점 단위
}

// ── 회차(年度) 목록 · 라벨 ──────────────────────────────────────────
// ID 규칙: {dk1|dk2}_{年度}   예) dk2_2025 = 令和7年度 第二種
// 1·2종은 연 1회 · 一次(8월)/二次(11월)가 같은 年度에 묶이므로 회차 단위가 年度다.

export type Denken12Exam = { id: string; grade: Denken12Grade; nendo: number }

export function makeExamId(grade: Denken12Grade, nendo: number): string {
  return `${GRADE_META[grade].idPrefix}_${nendo}`
}

export function parseExamId(id: string): { grade: Denken12Grade; nendo: number } | null {
  const m = /^dk([12])_(\d{4})$/.exec(id)
  if (!m) return null
  return { grade: m[1] === '1' ? 'first' : 'second', nendo: Number(m[2]) }
}

// 서기 → 일본 연호 (1989~ 平成, 2019~ 令和)
export function wareki(nendo: number): string {
  if (nendo >= 2019) {
    const n = nendo - 2018
    return n === 1 ? '令和元年度' : `令和${n}年度`
  }
  const n = nendo - 1988
  return `平成${n}年度`
}

export function examLabel(id: string): string {
  const p = parseExamId(id)
  return p ? `${p.nendo}年度` : id
}

// 응시 예정 포함 최신 年度. 늘릴 때 이 상수만 올리면 회차가 따라 생긴다.
export const DENKEN12_LATEST_NENDO = 2026
export const DENKEN12_EARLIEST_NENDO = 2009

export const DENKEN12_NENDOS: number[] = Array.from(
  { length: DENKEN12_LATEST_NENDO - DENKEN12_EARLIEST_NENDO + 1 },
  (_, i) => DENKEN12_LATEST_NENDO - i,        // 내림차순
)

export function examsOf(grade: Denken12Grade): Denken12Exam[] {
  return DENKEN12_NENDOS.map(nendo => ({ id: makeExamId(grade, nendo), grade, nendo }))
}

// 시행일 안내 (연 1회 고정 일정 — 8월 하순 / 11월 중순)
export function scheduleNote(phase: Denken12Phase): string {
  return phase === 'ichiji' ? '8월 하순 (일)' : '11월 중순 (일)'
}
