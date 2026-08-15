// ═══════════════════════════════════════════════════════════════
//  JLPT 테마 트레이너 레지스트리
//
//  트레이너를 추가할 때 여기 한 줄만 넣으면 허브 메뉴가 알아서
//  갱신된다. 허브 page.tsx를 다시 건드릴 필요 없음.
// ═══════════════════════════════════════════════════════════════

export type TrainerGroup = 'conj' | 'quant' | 'social' | 'lex' | 'speed'

export const TRAINER_GROUPS: { key: TrainerGroup; label: string; hint: string }[] = [
  { key: 'conj', label: '활용·문법', hint: '형태 변환 규칙' },
  { key: 'quant', label: '수량·표기', hint: '숫자와 그 읽기' },
  { key: 'social', label: '호칭·경어', hint: 'うち／そと 축' },
  { key: 'lex', label: '어휘·한자', hint: '음 대응과 페어' },
  { key: 'speed', label: '속도·인지', hint: '아는 것을 빠르게' },
]

export interface Trainer {
  slug: string
  icon: string
  ja: string
  ko: string
  group: TrainerGroup
  /** 검색용 키워드 */
  tags: string[]
}

export const TRAINERS: Trainer[] = [
  {
    slug: 'verb-practice', icon: '⚡', ja: '動詞活用練習',
    ko: '동사 활용형 반사신경', group: 'conj',
    tags: ['동사', '활용', 'ます', 'て형', '사역', '수동', 'conjugation'],
  },
  {
    slug: 'transitivity', icon: '🔀', ja: '自他動詞練習',
    ko: '자동사·타동사 페어와 조사', group: 'conj',
    tags: ['자동사', '타동사', '페어', 'が', 'を', 'てある', 'ている'],
  },
  {
    slug: 'number-practice', icon: '🔢', ja: '数詞・助数詞練習',
    ko: '숫자·조수사·날짜·시간·금액·和暦', group: 'quant',
    tags: ['숫자', '조수사', '날짜', '시간', '금액', '和暦', '카운터'],
  },
  {
    slug: 'family-terms', icon: '👨‍👩‍👧‍👦', ja: '親族呼称練習',
    ko: '대가족 관계 호칭 · うち／そと', group: 'social',
    tags: ['가족', '친족', '호칭', 'うち', 'そと', '겸양', '존경'],
  },
  {
    slug: 'business-titles', icon: '🏢', ja: '役職・呼称練習',
    ko: '회사 직급 서열 · 社内／社外', group: 'social',
    tags: ['직급', '회사', '역직', '弊社', '御社', '비즈니스'],
  },
  {
    slug: 'keigo-practice', icon: '🙇', ja: '敬語練習',
    ko: '尊敬·謙譲·丁寧 3축 변환', group: 'social',
    tags: ['경어', '존경어', '겸양어', '정중어', '召し上がる', '伺う'],
  },
  {
    slug: 'kanji-reading', icon: '🈷', ja: '漢字音対応',
    ko: '한국 한자음 → 일본 음독 대응', group: 'lex',
    tags: ['한자', '음독', '한자음', '받침', '촉음', '한자어'],
  },
  {
    slug: 'katakana-flash', icon: '⚡', ja: 'カタカナ速読',
    ko: '순간노출 반응속도 · 전기 외래어', group: 'speed',
    tags: ['가타카나', 'カタカナ', '속독', '순간노출', 'シ', 'ツ', '외래어', '전기', '플래시'],
  },
]

export const trainersByGroup = (g: TrainerGroup) => TRAINERS.filter(t => t.group === g)
