// N제 교재 트래커 - 과목/단원 정의

export type TextbookStatus = 'untouched' | 'correct' | 'wrong' | 'unsure'

export const TB_STATUS_META: Record<TextbookStatus, { ko: string; mark: string; accent: string; dot: string }> = {
  untouched: { ko: '미착수',   mark: '·', accent: '#6b7280', dot: '#374151' },
  correct:   { ko: '맞음',     mark: '○', accent: '#10b981', dot: '#10b981' },
  wrong:     { ko: '틀림',     mark: '✕', accent: '#ef4444', dot: '#ef4444' },
  unsure:    { ko: '모르겠음', mark: '?', accent: '#eab308', dot: '#eab308' },
}

// 토글 순서: 미착수 → 맞음 → 틀림 → 모르겠음 → 미착수
export const TB_STATUS_CYCLE: TextbookStatus[] = ['untouched', 'correct', 'wrong', 'unsure']
export const TB_STATUS_ORDER: TextbookStatus[] = ['correct', 'wrong', 'unsure', 'untouched']

export type TextbookChapter = {
  slug: string
  name: string
  start: number
  end: number
  accent: string
}

export type TextbookSubject = {
  slug: string
  name: string
  emoji: string
  desc: string
  accent: string
  chapters: TextbookChapter[]
}

// ── 機械 단원 ──────────────────────────────────────────────────
const KIKAI_CHAPTERS: TextbookChapter[] = [
  { slug: 'dc',       name: '직류기',   start: 1,   end: 22,  accent: '#0369a1' },
  { slug: 'trans',    name: '변압기',   start: 23,  end: 41,  accent: '#047857' },
  { slug: 'induction',name: '유도기',   start: 42,  end: 61,  accent: '#6d28d9' },
  { slug: 'sync',     name: '동기기',   start: 62,  end: 84,  accent: '#be123c' },
  { slug: 'power-e',  name: '전력전자', start: 85,  end: 103, accent: '#c2410c' },
  { slug: 'control',  name: '자동제어', start: 104, end: 113, accent: '#0f766e' },
  { slug: 'info',     name: '정보',     start: 114, end: 122, accent: '#4338ca' },
  { slug: 'light',    name: '조명',     start: 123, end: 128, accent: '#a16207' },
  { slug: 'heat',     name: '전열',     start: 129, end: 137, accent: '#991b1b' },
  { slug: 'motor-app',name: '전동기응용', start: 138, end: 146, accent: '#0e7490' },
  { slug: 'electrochem', name: '전기화학', start: 147, end: 157, accent: '#4d7c0f' },
]

// ── 法規 단원 ──────────────────────────────────────────────────
// 法規는 같은 '전기설비기술기준'이라도 암기형(조문 수치)과 계산형(수요율·
// 절연저항·풍압하중 등)이 성격이 완전히 달라서, 교재 구성대로 분리해 둔다.
const HOKI_CHAPTERS: TextbookChapter[] = [
  { slug: 'jigyoho',      name: '전기사업법',                start: 1,  end: 15,  accent: '#b45309' },
  { slug: 'other-laws',   name: '그 외의 전기관련법규',      start: 16, end: 20,  accent: '#a16207' },
  { slug: 'gijutsu-memo', name: '전기설비기술기준 (암기형)', start: 21, end: 43,  accent: '#c2410c' },
  { slug: 'gijutsu-calc', name: '전기설비기술기준 (계산형)', start: 44, end: 66,  accent: '#7c3aed' },
  { slug: 'wind-solar',   name: '풍력발전과 태양전지발전기준', start: 67, end: 69, accent: '#0f766e' },
  { slug: 'facility',     name: '전기시설관리',              start: 70, end: 103, accent: '#0369a1' },
]

export const TEXTBOOK_SUBJECTS: TextbookSubject[] = [
  {
    slug: 'kikai',
    name: '機械',
    emoji: '⚙️',
    desc: '직류기·변압기·유도기·동기기·전력전자·자동제어·정보·조명·전열·전동기응용·전기화학',
    accent: '#6d28d9',
    chapters: KIKAI_CHAPTERS,
  },
  {
    slug: 'hoki',
    name: '法規',
    emoji: '⚖️',
    desc: '전기사업법·기타법규·기술기준(암기/계산)·풍력태양전지·전기시설관리',
    accent: '#b45309',
    chapters: HOKI_CHAPTERS,
  },
  // 추후: 理論 / 電力 동일 패턴으로 추가
]

export const TB_SUBJECT_MAP = new Map<string, TextbookSubject>(
  TEXTBOOK_SUBJECTS.map(s => [s.slug, s])
)

export function getChapter(subject: TextbookSubject, chapterSlug: string): TextbookChapter | undefined {
  return subject.chapters.find(c => c.slug === chapterSlug)
}

export function chapterQNums(ch: TextbookChapter): number[] {
  const out: number[] = []
  for (let i = ch.start; i <= ch.end; i++) out.push(i)
  return out
}

// ── 문제 유형 (빈칸채우기/계산/정오판별/기타) ──────────────────────
export type ProblemType = 'fill' | 'calc' | 'truefalse' | 'etc'

export const PROBLEM_TYPE_META: Record<ProblemType, { ko: string; short: string; accent: string }> = {
  fill:      { ko: '빈칸채우기', short: '빈칸', accent: '#0891b2' },
  calc:      { ko: '계산',       short: '계산', accent: '#7c3aed' },
  truefalse: { ko: '정오판별',   short: '정오', accent: '#c2410c' },
  etc:       { ko: '기타',       short: '기타', accent: '#6b7280' },
}

export const PROBLEM_TYPE_ORDER: ProblemType[] = ['fill', 'calc', 'truefalse', 'etc']
