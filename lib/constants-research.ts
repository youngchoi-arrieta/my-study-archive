// 심화 연구 섹션 - 트랙 정의
// 덴켄 1종/2종 1차·2차 + 한국 기술고시

export type ResearchStatus = 'untouched' | 'studying' | 'understood'

export const STATUS_META: Record<ResearchStatus, { ko: string; color: string; accent: string; dot: string }> = {
  untouched:  { ko: '미착수',   color: 'text-gray-500',    accent: '#6b7280', dot: '#374151' },
  studying:   { ko: '연구중',   color: 'text-yellow-400',  accent: '#eab308', dot: '#eab308' },
  understood: { ko: '이해완료', color: 'text-emerald-400', accent: '#10b981', dot: '#10b981' },
}

export const STATUS_ORDER: ResearchStatus[] = ['untouched', 'studying', 'understood']

export type ResearchExam = {
  id: string
  label: string
}

export type ResearchTrack = {
  slug: string          // URL용
  name: string          // 표시명
  emoji: string
  org: string
  accent: string        // hex
  desc: string
  exams: ResearchExam[]
}

// ── 회차 생성 헬퍼 ──────────────────────────────────────────────
// 덴켄: 2차는 연 1회. 1차는 2023~ 연 2회지만 논술 연구용은 회차만 단순 표기
function reiwaExams(startYear: number, endYear: number, prefix: string): ResearchExam[] {
  const out: ResearchExam[] = []
  for (let y = startYear; y >= endYear; y--) {
    const r = y - 2018  // 令和 = 西暦 - 2018
    const era = r >= 1 ? `令和${r === 1 ? '元' : r}年度` : `平成${y - 1988}年度`
    out.push({ id: `${prefix}_${y}`, label: `${y}년도 (${era})` })
  }
  return out
}

// 한국 기술고시: 연도별
function gosiExams(startYear: number, endYear: number): ResearchExam[] {
  const out: ResearchExam[] = []
  for (let y = startYear; y >= endYear; y--) {
    out.push({ id: `gosi_${y}`, label: `${y}년도` })
  }
  return out
}

export const RESEARCH_TRACKS: ResearchTrack[] = [
  {
    slug: 'denken2-1ji',
    name: '電験二種 一次',
    emoji: '📘',
    org: '일본 경제산업성',
    accent: '#0369a1',
    desc: '理論·電力·機械·法規 (객관식)',
    exams: reiwaExams(2025, 2014, 'd2_1ji'),
  },
  {
    slug: 'denken2-2ji',
    name: '電験二種 二次',
    emoji: '📕',
    org: '일본 경제산업성',
    accent: '#be123c',
    desc: '電力·管理 / 機械·制御 (기술식 논술)',
    exams: reiwaExams(2025, 2014, 'd2_2ji'),
  },
  {
    slug: 'denken1-1ji',
    name: '電験一種 一次',
    emoji: '📗',
    org: '일본 경제산업성',
    accent: '#047857',
    desc: '理論·電力·機械·法規 (객관식)',
    exams: reiwaExams(2025, 2014, 'd1_1ji'),
  },
  {
    slug: 'denken1-2ji',
    name: '電験一種 二次',
    emoji: '📙',
    org: '일본 경제산업성',
    accent: '#c2410c',
    desc: '電力·管理 / 機械·制御 (기술식 논술)',
    exams: reiwaExams(2025, 2014, 'd1_2ji'),
  },
  {
    slug: 'gosi-jeongi',
    name: '기술고시 전기직',
    emoji: '🎓',
    org: '인사혁신처 5급 공채',
    accent: '#7c3aed',
    desc: '전기자기학·회로이론·전기기기·자동제어·전력전자 (논술)',
    exams: gosiExams(2025, 2010),
  },
]

export const TRACK_MAP = new Map<string, ResearchTrack>(
  RESEARCH_TRACKS.map(t => [t.slug, t])
)
