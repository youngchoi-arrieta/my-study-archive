// ═══════════════════════════════════════════════════════════════
//  한국 공기업 채용 — 기업 · 가점 규칙 · 서류점수 계산
//
//  ⚠ 중요: 여기 들어 있는 배점은 공개된 과거 공고와 학원 자료를
//  모은 "출발점"이지 확정값이 아니다. 공기업 가점 구조는 해마다
//  바뀌고 직렬마다 다르다. 각 기업의 verified 필드에 근거와 시점을
//  적어 두었고, 앱에서 직접 고쳐 kp_rubrics 테이블에 저장한다.
//  실제 지원 전에는 반드시 그 회차 공고 원문으로 덮어쓸 것.
// ═══════════════════════════════════════════════════════════════

export type CertKind = 'tech' | 'lang' | 'history' | 'it' | 'etc'

export const KIND_LABELS: Record<CertKind, string> = {
  tech: '기술 자격증',
  lang: '어학',
  history: '한국사',
  it: 'IT · 사무',
  etc: '기타 가점',
}
export const ALL_KINDS = Object.keys(KIND_LABELS) as CertKind[]

/** bool = 있다/없다, score = 점수(토익 등), grade = 등급(1/2/3급) */
export type CertValue = 'bool' | 'score' | 'grade'

export interface CertDef {
  key: string
  label: string
  kind: CertKind
  value: CertValue
  hint?: string
}

export const CERT_CATALOG: CertDef[] = [
  // 기술
  { key: 'elec-gisa', label: '전기기사', kind: 'tech', value: 'bool' },
  { key: 'elec-gongsa-gisa', label: '전기공사기사', kind: 'tech', value: 'bool', hint: '전기기사와 묶어 "쌍기사"' },
  { key: 'elec-sanup', label: '전기산업기사', kind: 'tech', value: 'bool' },
  { key: 'elec-gongsa-sanup', label: '전기공사산업기사', kind: 'tech', value: 'bool' },
  { key: 'elec-gineungsa', label: '전기기능사', kind: 'tech', value: 'bool' },
  { key: 'elec-gineungjang', label: '전기기능장', kind: 'tech', value: 'bool' },
  { key: 'fire-elec-gisa', label: '소방설비기사(전기)', kind: 'tech', value: 'bool' },
  { key: 'safety-gisa', label: '산업안전기사', kind: 'tech', value: 'bool' },
  { key: 'energy-gisa', label: '에너지관리기사', kind: 'tech', value: 'bool' },
  { key: 'info-comm-gisa', label: '정보통신기사', kind: 'tech', value: 'bool' },
  { key: 'railway-safety', label: '철도교통안전관리자', kind: 'tech', value: 'bool' },
  { key: 'railway-signal', label: '철도신호기사·산업기사', kind: 'tech', value: 'bool' },
  { key: 'elec-vehicle-lic', label: '전기차량 운전면허', kind: 'tech', value: 'bool' },
  { key: 'pe', label: '기술사 (전기응용·발송배전 등)', kind: 'tech', value: 'bool', hint: '대개 최고 배점 · 서류 면제 사유가 되기도 함' },
  // 어학
  { key: 'toeic', label: 'TOEIC', kind: 'lang', value: 'score' },
  { key: 'toeic-speaking', label: 'TOEIC Speaking', kind: 'lang', value: 'grade', hint: 'AL / IH / IM3 …' },
  { key: 'opic', label: 'OPIc', kind: 'lang', value: 'grade' },
  { key: 'kbs-korean', label: 'KBS한국어능력시험', kind: 'lang', value: 'grade' },
  { key: 'korean-ability', label: '국어능력인증시험(ToKL)', kind: 'lang', value: 'grade' },
  // 한국사
  { key: 'kor-history', label: '한국사능력검정', kind: 'history', value: 'grade', hint: '1급 / 2급 / 3급' },
  // IT·사무
  { key: 'comp-act', label: '컴퓨터활용능력', kind: 'it', value: 'grade', hint: '대한상공회의소 발급만 인정하는 곳이 많음' },
  { key: 'itq', label: 'ITQ · 워드프로세서', kind: 'it', value: 'grade' },
  { key: 'info-processing', label: '정보처리기사', kind: 'it', value: 'bool' },
  // 기타
  { key: 'veteran', label: '취업지원대상자(보훈)', kind: 'etc', value: 'bool' },
  { key: 'local-talent', label: '이전지역인재', kind: 'etc', value: 'bool' },
  { key: 'disabled', label: '장애인', kind: 'etc', value: 'bool' },
  { key: 'social-equity', label: '기초생활수급 등 사회형평', kind: 'etc', value: 'bool' },
]

export const certDef = (key: string) => CERT_CATALOG.find(c => c.key === key)
export const certLabel = (key: string) => certDef(key)?.label ?? key

// ── 가점 규칙 ────────────────────────────────────────────────────
export interface RuleOption { cert: string; points: number; cond?: string }

export interface RuleGroup {
  id: string
  label: string
  /** 이 그룹에서 받을 수 있는 상한 */
  max: number
  /** 몇 개까지 합산 인정하는가 (기본 1개) */
  pick: number
  options: RuleOption[]
  note?: string
}

export interface ExamPart { name: string; q: number | null; pt: number | null }

export interface Company {
  id: string
  name: string
  short: string
  sector: string
  /** 주 타깃인가 */
  target: boolean
  season: string
  /** 필기 구성 */
  exam: { parts: ExamPart[]; total: string; cutoff: string }
  /** 지원 자격 (가점이 아니라 문턱) */
  eligibility: string[]
  /** 가점 총 상한 */
  bonusMax: number
  groups: RuleGroup[]
  /** 이 데이터가 어디서 왔고 언제 것인지 */
  verified: string
}

export const COMPANIES: Company[] = [
  {
    id: 'kesco',
    name: '한국전기안전공사',
    short: 'KESCO',
    sector: '전기안전 · 검사',
    target: true,
    season: '통상 연 1~2회 · 하반기 중심',
    exam: {
      parts: [
        { name: 'NCS 직업기초', q: null, pt: null },
        { name: '전공 (전기)', q: null, pt: null },
      ],
      total: '공고별 상이',
      cutoff: '과목별 과락 있음 · 공고 확인',
    },
    eligibility: ['전기 분야 자격증 요구되는 회차 있음', '어학 요건은 회차별로 다름'],
    bonusMax: 50,
    groups: [
      {
        id: 'elec', label: '전기 분야 자격증', max: 50, pick: 2,
        note: '전기안전공사는 전기 자격증 배점이 유난히 큽니다. 쌍기사가 그대로 점수가 됩니다.',
        options: [
          { cert: 'pe', points: 50 },
          { cert: 'elec-gineungjang', points: 35 },
          { cert: 'elec-gisa', points: 30 },
          { cert: 'elec-gongsa-gisa', points: 20 },
          { cert: 'elec-sanup', points: 15 },
          { cert: 'elec-gongsa-sanup', points: 10 },
        ],
      },
      {
        id: 'etc', label: '기타 가점', max: 10, pick: 2,
        options: [
          { cert: 'kor-history', points: 3, cond: '1급 기준' },
          { cert: 'comp-act', points: 3, cond: '1급 기준' },
          { cert: 'safety-gisa', points: 3 },
          { cert: 'veteran', points: 5 },
        ],
      },
    ],
    verified: '전기기사 30점 / 전기공사기사 20점은 학원 공개자료(엔지니어랩) 기준. 회차·직렬별로 다르므로 공고로 확인 필요.',
  },
  {
    id: 'kps',
    name: '한전KPS',
    short: 'KPS',
    sector: '발전설비 정비',
    target: true,
    season: '통상 연 1~2회',
    exam: {
      parts: [
        { name: 'NCS 직업기초', q: null, pt: null },
        { name: '직무수행능력(전공)', q: null, pt: null },
      ],
      total: '150점',
      cutoff: '배점 대비 40% 미만(가점 제외) 불합격',
    },
    eligibility: [
      '영어성적 자격요건 있음 (G4/G3 등급별)',
      '직무능력기반지원서 적부판정 통과 필요',
    ],
    bonusMax: 9,
    groups: [
      {
        id: 'it', label: 'IT', max: 3, pick: 1,
        options: [
          { cert: 'comp-act', points: 3, cond: '1급 · 대한상의 발급만' },
          { cert: 'info-processing', points: 3 },
        ],
      },
      {
        id: 'history', label: '한국사', max: 3, pick: 1,
        options: [{ cert: 'kor-history', points: 3, cond: '급수별 차등' }],
      },
      {
        id: 'korean', label: '한국어', max: 3, pick: 1,
        options: [
          { cert: 'kbs-korean', points: 3 },
          { cert: 'korean-ability', points: 3 },
        ],
      },
      {
        id: 'english', label: '영어우수자', max: 3, pick: 1,
        options: [{ cert: 'toeic', points: 3, cond: '고득점 기준선 이상' }],
      },
    ],
    verified: '필기 150점·40% 과락, 가점 영역별 1개씩 최대 9점(IT/한국사/한국어/영어우수자)은 2024년 공고 기준. ★ 별도로 「고급자격증 소지자는 서류심사 배수외 합격」 조항이 있어 전기기사급이 서류를 통과시키는 열쇠가 됩니다.',
  },
  {
    id: 'korail',
    name: '한국철도공사',
    short: '코레일',
    sector: '철도 운영 · 전기통신',
    target: true,
    season: '통상 상·하반기 2회',
    exam: {
      parts: [
        { name: 'NCS 직업기초 (의사소통·수리·문제해결)', q: 30, pt: null },
        { name: '전공 (전기이론·전기기기 등)', q: 30, pt: null },
        { name: '철도관련법령', q: 10, pt: null },
      ],
      total: '70문항 / 70분',
      cutoff: '각 과목 40점 이상 · 필기는 최종 반영 50%',
    },
    eligibility: ['한국사 자격 요건화된 회차 있음', '전기통신직은 실기 시행 회차 있음'],
    bonusMax: 20,
    groups: [
      {
        id: 'job', label: '직렬 직무 자격증', max: 8, pick: 2,
        note: '공통 직무 + 직렬 직무에서 2개까지 조합. 쌍기사면 각 4점씩 8점 만점.',
        options: [
          { cert: 'elec-gisa', points: 4 },
          { cert: 'elec-gongsa-gisa', points: 4 },
          { cert: 'info-comm-gisa', points: 4 },
          { cert: 'railway-signal', points: 4 },
          { cert: 'elec-sanup', points: 2 },
          { cert: 'elec-gongsa-sanup', points: 2 },
        ],
      },
      {
        id: 'railway', label: '철도 직무 자격증', max: 8, pick: 2,
        note: '2026년부터 별도 신설된 항목. 철도교통안전관리자·전기차량 운전면허 등.',
        options: [
          { cert: 'railway-safety', points: 4 },
          { cert: 'elec-vehicle-lic', points: 4 },
        ],
      },
      {
        id: 'common', label: '공통 가점', max: 4, pick: 2,
        options: [
          { cert: 'kor-history', points: 2, cond: '급수별 차등' },
          { cert: 'comp-act', points: 2 },
          { cert: 'toeic', points: 2, cond: '기준 점수 이상' },
        ],
      },
    ],
    verified: '필기 70문항(NCS 30 + 전공 30 + 법령 10), 과목별 40점 과락, 필기 50% 반영은 2024~2025 공고 기준. 자격증 가점 최대 20점·조합 방식은 2026년부터 개편된 구조라 반드시 최신 공고로 확인.',
  },
  {
    id: 'kepco',
    name: '한국전력공사',
    short: '한전',
    sector: '송배전 · 발전 지주',
    target: false,
    season: '통상 상반기 2~4월 / 하반기 8~10월',
    exam: {
      parts: [
        { name: 'NCS 직업기초', q: 55, pt: 70 },
        { name: '전공 (전기)', q: 15, pt: 30 },
      ],
      total: '100점',
      cutoff: '영역별 과락 — 1개 영역만 미달해도 총점 무관 탈락',
    },
    eligibility: [
      '전기기사 또는 전기공사기사 (전기직 필수 수준)',
      'TOEIC 800 이상급 어학 요건',
      'TOEIC Speaking AL 등 말하기 성적 요구 회차 있음',
    ],
    bonusMax: 10,
    groups: [
      {
        id: 'lic', label: '자격증', max: 5, pick: 1,
        note: '전기직은 기사급이 사실상 지원 요건이라, 가점보다 문턱 통과가 먼저입니다.',
        options: [
          { cert: 'pe', points: 5 },
          { cert: 'elec-gisa', points: 3 },
          { cert: 'elec-gongsa-gisa', points: 3 },
        ],
      },
      {
        id: 'etc', label: '기타', max: 5, pick: 2,
        options: [
          { cert: 'kor-history', points: 2, cond: '1급' },
          { cert: 'comp-act', points: 2, cond: '1급' },
          { cert: 'kbs-korean', points: 2, cond: '3+급' },
          { cert: 'local-talent', points: 3 },
        ],
      },
    ],
    verified: 'NCS 70 + 전공 30(15문항), 영역별 과락은 합격 후기 다수 일치. 서류 커트라인·가점 세부는 회차 편차가 커서 참고용.',
  },
  {
    id: 'komipo',
    name: '한국중부발전 (발전5사)',
    short: '중부발전',
    sector: '발전',
    target: false,
    season: '통상 연 1~2회',
    exam: {
      parts: [
        { name: 'NCS 직업기초', q: null, pt: null },
        { name: '직무지식(전공)', q: null, pt: null },
        { name: '인성 · 상황판단', q: null, pt: null },
      ],
      total: '공고별 상이',
      cutoff: '과목별 과락 · 공고 확인',
    },
    eligibility: ['전기기사급 권장', '어학 요건 있음'],
    bonusMax: 10,
    groups: [
      {
        id: 'lic', label: '자격증', max: 6, pick: 2,
        options: [
          { cert: 'pe', points: 6 },
          { cert: 'elec-gisa', points: 4 },
          { cert: 'elec-gongsa-gisa', points: 2 },
          { cert: 'energy-gisa', points: 2 },
        ],
      },
      {
        id: 'etc', label: '기타', max: 4, pick: 2,
        options: [
          { cert: 'kor-history', points: 2 },
          { cert: 'local-talent', points: 2 },
          { cert: 'veteran', points: 4 },
        ],
      },
    ],
    verified: '발전 5사(남동·남부·동서·서부·중부)는 구조가 비슷하지만 배점은 제각각입니다. 지원할 회사의 공고로 덮어쓰세요.',
  },
  {
    id: 'humetro',
    name: '부산교통공사',
    short: '부교공',
    sector: '도시철도',
    target: false,
    season: '통상 연 1회 · 하반기',
    exam: {
      parts: [
        { name: 'NCS 직업기초', q: null, pt: null },
        { name: '전공 (전기일반)', q: null, pt: null },
      ],
      total: '공고별 상이',
      cutoff: '과목별 40% 과락이 일반적',
    },
    eligibility: ['부산 지역인재 가점 큼', '전기 자격증 요구 회차 있음'],
    bonusMax: 10,
    groups: [
      {
        id: 'lic', label: '자격증', max: 5, pick: 2,
        options: [
          { cert: 'elec-gisa', points: 3 },
          { cert: 'elec-gongsa-gisa', points: 2 },
          { cert: 'elec-sanup', points: 2 },
          { cert: 'railway-signal', points: 2 },
        ],
      },
      {
        id: 'etc', label: '기타', max: 5, pick: 2,
        options: [
          { cert: 'local-talent', points: 5, cond: '부산·울산·경남' },
          { cert: 'kor-history', points: 2 },
          { cert: 'veteran', points: 5 },
        ],
      },
    ],
    verified: '지역인재 비중이 큰 것으로 알려져 있으나 배점은 공고 확인 필요. 전기직 경쟁률이 특히 높은 편입니다.',
  },
]

export const company = (id: string) => COMPANIES.find(c => c.id === id)

// ── 내 스펙 ──────────────────────────────────────────────────────
export interface SpecRow {
  cert_key: string
  has: boolean
  value: string | null   // 토익 점수, 한국사 급수 등
}

export type SpecMap = Record<string, SpecRow>

export const toSpecMap = (rows: SpecRow[]): SpecMap =>
  Object.fromEntries(rows.filter(r => r.has).map(r => [r.cert_key, r]))

// ── 점수 계산 ────────────────────────────────────────────────────
export interface GroupResult {
  group: RuleGroup
  earned: number
  used: RuleOption[]
  /** 아직 없어서 못 받은 것 중 배점이 높은 것 */
  missing: RuleOption[]
}

export interface CompanyResult {
  company: Company
  groups: GroupResult[]
  earned: number
  max: number
  /** 이걸 더 따면 몇 점 오르는가 */
  upside: { cert: string; gain: number }[]
}

function scoreGroup(g: RuleGroup, spec: SpecMap): GroupResult {
  const owned = g.options.filter(o => spec[o.cert]).sort((a, b) => b.points - a.points)
  const used = owned.slice(0, g.pick)
  const earned = Math.min(used.reduce((a, o) => a + o.points, 0), g.max)
  const missing = g.options
    .filter(o => !spec[o.cert])
    .sort((a, b) => b.points - a.points)
  return { group: g, earned, used, missing }
}

export function scoreCompany(c: Company, spec: SpecMap): CompanyResult {
  const groups = c.groups.map(g => scoreGroup(g, spec))
  const earned = Math.min(groups.reduce((a, g) => a + g.earned, 0), c.bonusMax)

  // 하나씩 더 가졌다고 가정했을 때의 증가분
  const upside: { cert: string; gain: number }[] = []
  const seen = new Set<string>()
  for (const gr of groups) {
    for (const m of gr.missing) {
      if (seen.has(m.cert)) continue
      seen.add(m.cert)
      const trial: SpecMap = { ...spec, [m.cert]: { cert_key: m.cert, has: true, value: null } }
      const after = Math.min(
        c.groups.map(g => scoreGroup(g, trial).earned).reduce((a, b) => a + b, 0),
        c.bonusMax,
      )
      const gain = after - earned
      if (gain > 0) upside.push({ cert: m.cert, gain })
    }
  }
  upside.sort((a, b) => b.gain - a.gain)

  return { company: c, groups, earned, max: c.bonusMax, upside: upside.slice(0, 4) }
}

// ── 모의고사 ─────────────────────────────────────────────────────
export interface MockRow {
  id: string
  company_id: string | null   // null = 일반 교재
  title: string
  taken_on: string
  ncs: number | null; ncs_total: number | null
  major: number | null; major_total: number | null
  law: number | null; law_total: number | null
}

export const MOCK_PARTS = [
  { key: 'ncs', label: 'NCS 직업기초', color: '#60a5fa' },
  { key: 'major', label: '전공', color: '#34d399' },
  { key: 'law', label: '법령', color: '#fbbf24' },
] as const

export const pct = (got: number, total: number) => (total === 0 ? 0 : (got / total) * 100)
