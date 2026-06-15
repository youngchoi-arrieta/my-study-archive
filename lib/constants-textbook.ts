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
  { slug: 'info',     name: '정보',     start: 114, end: 123, accent: '#4338ca' },
]

export const TEXTBOOK_SUBJECTS: TextbookSubject[] = [
  {
    slug: 'kikai',
    name: '機械',
    emoji: '⚙️',
    desc: '직류기·변압기·유도기·동기기·전력전자·자동제어·정보',
    accent: '#6d28d9',
    chapters: KIKAI_CHAPTERS,
  },
  // 추후: 理論 / 電力 / 法規 동일 패턴으로 추가
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
