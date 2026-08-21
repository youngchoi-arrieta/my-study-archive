// 한국 기술사 (전기·전자 분야) — 종목 레지스트리
// ===================================================================
// 일본 시험들과 왜 허브를 나누는가
//   덴켄·에관사·시공관리는 「과목별 점수 → 과목 합격」 구조라 범용 프레임
//   (lib/constants-exams.ts)에 다 들어갔다. 한국 기술사는 구조 자체가 다르다.
//
//     · 과목이 없다. 하루 4교시, 전 교시 합산 60점 이상이면 끝.
//     · 선택제다. 1교시 13문 중 10문, 2~4교시 각 6문 중 4문.
//       총 31문 중 9문을 버릴 수 있으니 「전 범위 커버」가 목표가 아니다.
//     · 전부 논술이라 채점이 아니라 답안 작성 자체가 훈련 대상이다.
//
//   그래서 여기서 관리하는 건 점수가 아니라 「어느 주제로 무엇이 나왔는가」다.
//   화면의 축도 회차가 아니라 토픽(lib/constants-topics.ts)이 된다.
//
// 종목 추가
//   아래 GISULSA_SPECS 에 한 줄 넣고 lib/data-gisulsa-*.ts 에 시드를 만들면
//   /dashboard/gisulsa/{slug} 가 바로 생긴다. 시드가 없어도 화면은 열리고,
//   앱에서 회차별 PDF를 올리고 문항을 직접 태깅해 채워 나갈 수 있다.

export type GisulsaSlug = 'balsong' | 'geonchuk' | 'eungyong' | 'anjeon'

/** 한 교시의 구조 — 출제 문항 수 중 몇 개를 골라 쓰는가 */
export interface SessionSpec {
  session: number        // 교시 (1~4)
  total: number          // 출제 문항 수
  pick: number           // 선택해 푸는 문항 수
  points: number         // 문항당 배점
  minutes: number
  note: string
}

/** 기술사 공통 교시 구조 — 전 종목 동일 */
export const SESSION_SPECS: SessionSpec[] = [
  { session: 1, total: 13, pick: 10, points: 10, minutes: 100, note: '용어형 단답 · 문항당 10분 · 1페이지' },
  { session: 2, total: 6,  pick: 4,  points: 25, minutes: 100, note: '논술 · 문항당 25분 · 2~3페이지' },
  { session: 3, total: 6,  pick: 4,  points: 25, minutes: 100, note: '논술 · 문항당 25분 · 2~3페이지' },
  { session: 4, total: 6,  pick: 4,  points: 25, minutes: 100, note: '논술 · 문항당 25분 · 2~3페이지' },
]

/** 한 회차에서 실제로 써야 하는 문항 수 · 총점 */
export const PICK_TOTAL = SESSION_SPECS.reduce((a, s) => a + s.pick, 0)          // 22문
export const DROP_TOTAL = SESSION_SPECS.reduce((a, s) => a + (s.total - s.pick), 0) // 9문
export const FULL_MARK  = SESSION_SPECS.reduce((a, s) => a + s.pick * s.points, 0)  // 400점
export const PASS_MARK  = 240   // 60%

export interface PastPaperLink {
  label: string
  url: string
  coverage: string
  note?: string
}

export interface GisulsaSpec {
  slug: GisulsaSlug
  name: string
  short: string
  emoji: string
  accent: string
  /** 종목 성격 한 줄 */
  intro: string
  /** 시드가 들어 있는 회차 범위 설명. 비어 있으면 '기출 미입력' */
  seedNote: string
  /** 이 종목에서 중심이 되는 토픽 그룹 (허브 카드 힌트) */
  focus: string[]
  pastPapers: PastPaperLink[]
}

export const GISULSA_SPECS: GisulsaSpec[] = [
  {
    slug: 'balsong', name: '발송배전기술사', short: '발송배전', emoji: '🔌', accent: '#2563eb',
    intro: '발전·송전·변전·배전 전 계통. 계통해석과 보호계전이 배점의 중심이고, 최신 제도(연계기술기준·전력망 특별법)가 매 회차 2~4문항 섞인다.',
    seedNote: '제130~139회 10개 회차 · 310문항 태깅 완료',
    focus: ['계통해석', '계통운용', '보호', '송변전'],
    pastPapers: [{
      label: 'Q-net · 국가기술자격 기술사 기출문제',
      url: 'https://www.q-net.or.kr/',
      coverage: '자료실 → 기출문제 (종목별 회차 PDF)',
      note: '기준답안·채점기준은 정보공개법 제9조 제1항 제5호로 비공개. 문제지만 나온다',
    }],
  },
  {
    slug: 'geonchuk', name: '건축전기설비기술사', short: '건축전기', emoji: '🏢', accent: '#7c3aed',
    intro: '건축물 수변전·간선·조명·방재·정보통신 설비. 발송배전과 수전설비(E4)·접지(G4)·전력품질(H)에서 겹치고, 조명·전열은 오히려 電験 機械 쪽과 붙는다.',
    seedNote: '기출 미입력 — 회차별 PDF를 올리고 문항을 태깅하면 같은 보드에 합쳐진다',
    focus: ['배전', '접지', '전력품질', '전기기기'],
    pastPapers: [{
      label: 'Q-net · 국가기술자격 기술사 기출문제',
      url: 'https://www.q-net.or.kr/',
      coverage: '자료실 → 기출문제 (종목별 회차 PDF)',
    }],
  },
  {
    slug: 'eungyong', name: '전기응용기술사', short: '전기응용', emoji: '⚙️', accent: '#059669',
    intro: '전동력응용·조명·전열·전기화학·전력전자. 네 종목 중 電験 機械와 가장 많이 겹치는 종목이라, B4~B7(직류기·전력전자·조명전열·자동제어) 서브노트가 여기서 쓰인다.',
    seedNote: '기출 미입력 — 회차별 PDF를 올리고 문항을 태깅하면 같은 보드에 합쳐진다',
    focus: ['전기기기'],
    pastPapers: [{
      label: 'Q-net · 국가기술자격 기술사 기출문제',
      url: 'https://www.q-net.or.kr/',
      coverage: '자료실 → 기출문제 (종목별 회차 PDF)',
    }],
  },
  {
    slug: 'anjeon', name: '전기안전기술사', short: '전기안전', emoji: '🦺', accent: '#ca8a04',
    intro: '감전·전기화재·정전기·낙뢰 방호와 안전관리 체계. 접지(G4)와 절연협조(D5)에서 발송배전과 정면으로 겹치고, 나머지는 한국 법규(I5) 비중이 크다.',
    seedNote: '기출 미입력 — 회차별 PDF를 올리고 문항을 태깅하면 같은 보드에 합쳐진다',
    focus: ['접지', '송변전', '제도·신기술'],
    pastPapers: [{
      label: 'Q-net · 국가기술자격 기술사 기출문제',
      url: 'https://www.q-net.or.kr/',
      coverage: '자료실 → 기출문제 (종목별 회차 PDF)',
    }],
  },
]

export const GISULSA_MAP = new Map<string, GisulsaSpec>(GISULSA_SPECS.map(s => [s.slug, s]))

// ── 문항 ────────────────────────────────────────────────────────────
export interface GisulsaQuestion {
  jong: GisulsaSlug
  exam: number           // 회차 (예: 136)
  session: number        // 교시
  no: number             // 문항 번호
  points: number
  topics: string[]       // lib/constants-topics.ts 의 코드
  title: string
  /** seed = 코드에 박힌 시드 · db = 앱에서 추가한 것 */
  source: 'seed' | 'db'
  id?: string            // db 행일 때만
}

/** 문항 고유키 — 시드와 DB를 합칠 때 중복 판정에 쓴다 */
export const qKey = (q: { jong: string; exam: number; session: number; no: number }) =>
  `${q.jong}_${q.exam}_${q.session}_${q.no}`

/** 회차 문서 저장용 id (denken_exam_docs 와 같은 규약) */
export const examDocId = (jong: GisulsaSlug, exam: number) => `gs_${jong}_${exam}`

/** 시험 시행 연도 추정 — 기술사는 연 3회(대략 1·5·7월 시행) */
export function examYearHint(exam: number): string {
  // 130회 = 2023년 상반기 기준. 회차 3개당 1년.
  const y = 2023 + Math.floor((exam - 130) / 3)
  return `${y}년 무렵`
}
