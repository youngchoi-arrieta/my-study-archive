// ═══════════════════════════════════════════════════════════════
//  한국 공기업 채용 — 서류 표준배점표 모델
//
//  공기업 서류배점은 대부분 이 형태다:
//    분야(한국사·한국어·IT·외국어·전공자격)별로 등급표가 있고,
//    각 분야에서 최상위 1개만 인정해 합산한다.
//  그래서 "자격증 → 점수" 단순 매핑이 아니라 tier 구조로 짰다.
//
//  KESCO(한국전기안전공사)만 실제 공고 붙임3 표를 그대로 옮긴 확정값이고,
//  나머지는 골격만 잡은 템플릿이다. 공고를 보고 앱에서 직접 고친다.
// ═══════════════════════════════════════════════════════════════

export type CertKind = 'tech' | 'it' | 'history' | 'korean' | 'lang' | 'etc'

export const KIND_LABELS: Record<CertKind, string> = {
  tech: '전공 자격증',
  it: 'IT',
  history: '한국사',
  korean: '한국어',
  lang: '외국어',
  etc: '기타',
}
export const ALL_KINDS = Object.keys(KIND_LABELS) as CertKind[]

export type CertValue = 'bool' | 'score' | 'grade'

export interface CertDef {
  key: string
  label: string
  kind: CertKind
  value: CertValue
  /** 내 스펙 탭에 체크박스로 띄울 것인가.
   *  false 여도 배점표에는 이름이 표시된다(공고 원문 유지). */
  mine: boolean
  hint?: string
  /** grade 타입일 때 고를 수 있는 값 */
  grades?: string[]
}

export const CERT_CATALOG: CertDef[] = [
  // ── 내가 실제로 가질 수 있는 것 ──
  { key: 'elec-gisa', label: '전기기사', kind: 'tech', value: 'bool', mine: true },
  { key: 'elec-gineungsa', label: '전기기능사', kind: 'tech', value: 'bool', mine: true },
  { key: 'info-processing', label: '정보처리기사', kind: 'it', value: 'bool', mine: true },
  {
    key: 'kor-history', label: '한국사능력검정', kind: 'history', value: 'grade', mine: true,
    grades: ['1급', '2급', '3급'],
  },
  { key: 'toeic', label: 'TOEIC', kind: 'lang', value: 'score', mine: true, hint: '점수 그대로' },
  {
    key: 'kbs-korean', label: 'KBS한국어능력시험', kind: 'korean', value: 'grade', mine: true,
    hint: '상대평가 — 2+급 상위 1% · 2-급 상위 5%',
    grades: ['1급', '2+급', '2-급', '3+급', '3-급', '4+급'],
  },
  {
    key: 'opic', label: 'OPIc', kind: 'lang', value: 'grade', mine: true,
    grades: ['AL', 'IH', 'IM3', 'IM2', 'IM1'],
  },
  { key: 'toefl', label: 'TOEFL iBT', kind: 'lang', value: 'score', mine: true, hint: 'TOEIC 환산은 비공식 근사치' },
  {
    key: 'toeic-speaking', label: 'TOEIC Speaking', kind: 'lang', value: 'grade', mine: true,
    grades: ['AH', 'AM', 'AL', 'IH', 'IM3', 'IM2'],
  },
  { key: 'teps', label: 'TEPS', kind: 'lang', value: 'score', mine: true },
  { key: 'veteran', label: '취업지원 대상자(보훈)', kind: 'etc', value: 'bool', mine: true },
  { key: 'local-talent', label: '이전지역인재', kind: 'etc', value: 'bool', mine: true },

  // ── 배점표에 이름만 나오는 것들 (체크 대상 아님) ──
  { key: 'elec-gongsa-gisa', label: '전기공사기사', kind: 'tech', value: 'bool', mine: false },
  { key: 'elec-sanup', label: '전기산업기사', kind: 'tech', value: 'bool', mine: false },
  { key: 'elec-gongsa-sanup', label: '전기공사산업기사', kind: 'tech', value: 'bool', mine: false },
  { key: 'elec-gineungjang', label: '전기기능장', kind: 'tech', value: 'bool', mine: false },
  { key: 'elec-rail-gisa', label: '전기철도기사', kind: 'tech', value: 'bool', mine: false },
  { key: 'rail-signal-gisa', label: '철도신호기사', kind: 'tech', value: 'bool', mine: false },
  { key: 'elec-rail-sanup', label: '전기철도산업기사', kind: 'tech', value: 'bool', mine: false },
  { key: 'rail-signal-sanup', label: '철도신호산업기사', kind: 'tech', value: 'bool', mine: false },
  { key: 'rail-elec-gineungsa', label: '철도전기신호기능사', kind: 'tech', value: 'bool', mine: false },
  { key: 'pe-elec', label: '전기 기술사', kind: 'tech', value: 'bool', mine: false, hint: '경력 요건 때문에 당장은 무의미' },
  { key: 'comp-act-1', label: '컴퓨터활용능력 1급', kind: 'it', value: 'bool', mine: false },
  { key: 'comp-act-2', label: '컴퓨터활용능력 2급', kind: 'it', value: 'bool', mine: false },
  { key: 'bigdata-gisa', label: '빅데이터분석기사', kind: 'it', value: 'bool', mine: false },
  { key: 'info-processing-sanup', label: '정보처리산업기사', kind: 'it', value: 'bool', mine: false },
  { key: 'office-auto-sanup', label: '사무자동화산업기사', kind: 'it', value: 'bool', mine: false },
  { key: 'prog-gineungsa', label: '프로그래밍기능사', kind: 'it', value: 'bool', mine: false },

  { key: 'paper-sci', label: 'SCI(E) 제1저자 논문', kind: 'etc', value: 'bool', mine: false, hint: '연구직군 배점표에만 등장' },
  { key: 'phd', label: '박사학위', kind: 'etc', value: 'bool', mine: false },
  { key: 'kesco-intern', label: '체험형 인턴 수료', kind: 'etc', value: 'bool', mine: false },
]

export const certDef = (k: string) => CERT_CATALOG.find(c => c.key === k)
export const certLabel = (k: string) => certDef(k)?.label ?? k
export const MY_CERTS = CERT_CATALOG.filter(c => c.mine)

// ── 어학 환산 (KESCO 붙임2 기준) ────────────────────────────────
export const OPIC_TO_TOEIC: Record<string, number> = {
  AL: 979.5, IH: 935.8, IM3: 860.9, IM2: 765.8, IM1: 700,
}
export const TOEICS_TO_TOEIC: Record<string, number> = {
  AH: 990, AM: 982, AL: 936.7, IH: 871.3, IM3: 773.5, IM2: 703.5,
}
/** TEPS → TOEIC (붙임2 표를 구간으로 압축) */
const TEPS_BANDS: [number, number][] = [
  [558, 990], [526, 985], [504, 980], [486, 975], [471, 970], [458, 965], [446, 960],
  [437, 955], [428, 950], [420, 945], [412, 940], [406, 935], [400, 930], [394, 925],
  [389, 920], [384, 915], [379, 910], [375, 905], [370, 900], [366, 895], [362, 890],
  [359, 885], [355, 880], [352, 875], [348, 870], [345, 865], [342, 860], [339, 855],
  [336, 850], [333, 845], [330, 840], [327, 835], [324, 830], [322, 825], [319, 820],
  [316, 815], [314, 810], [311, 805], [309, 800], [306, 795], [304, 790], [301, 785],
  [299, 780], [297, 775], [294, 770], [292, 765], [290, 760], [288, 755], [285, 750],
  [283, 745], [281, 740], [279, 735], [277, 730], [274, 725], [272, 720], [270, 715],
  [268, 710], [266, 705], [264, 700],
]
/** TOEFL iBT → TOEIC — 공고 표에 없는 비공식 근사치 */
const TOEFL_BANDS: [number, number][] = [
  [110, 970], [105, 945], [100, 900], [95, 870], [90, 830],
  [85, 800], [80, 770], [75, 740], [70, 700],
]

const fromBands = (v: number, bands: [number, number][]) => {
  for (const [min, out] of bands) if (v >= min) return out
  return 0
}

export interface LangSource { key: string; label: string; toeic: number; official: boolean }

/** 내 어학 성적들을 TOEIC 환산으로 모아 최고값을 찾는다 */
export function langSources(spec: SpecMap): LangSource[] {
  const out: LangSource[] = []
  const val = (k: string) => spec[k]?.value ?? ''
  const num = (k: string) => Number(val(k) || 0)

  if (num('toeic') > 0) out.push({ key: 'toeic', label: `TOEIC ${num('toeic')}`, toeic: num('toeic'), official: true })
  if (val('opic') && OPIC_TO_TOEIC[val('opic')])
    out.push({ key: 'opic', label: `OPIc ${val('opic')}`, toeic: OPIC_TO_TOEIC[val('opic')], official: true })
  if (val('toeic-speaking') && TOEICS_TO_TOEIC[val('toeic-speaking')])
    out.push({ key: 'toeic-speaking', label: `TOEIC-S ${val('toeic-speaking')}`, toeic: TOEICS_TO_TOEIC[val('toeic-speaking')], official: true })
  if (num('teps') > 0)
    out.push({ key: 'teps', label: `TEPS ${num('teps')}`, toeic: fromBands(num('teps'), TEPS_BANDS), official: true })
  if (num('toefl') > 0)
    out.push({ key: 'toefl', label: `TOEFL ${num('toefl')}`, toeic: fromBands(num('toefl'), TOEFL_BANDS), official: false })

  return out.sort((a, b) => b.toeic - a.toeic)
}

export const bestToeic = (spec: SpecMap) => langSources(spec)[0]?.toeic ?? 0

// ── 배점 구조 ────────────────────────────────────────────────────
export type GroupMode = 'top1' | 'sum'

export interface RuleTier {
  points: number
  /** 공고 원문의 그 줄 그대로 */
  label: string
  /** 이 등급에 해당하는 자격증들 */
  certs?: string[]
  /** 어학: TOEIC 환산 하한 */
  toeicMin?: number
  /** 한국사 등: 이 급수 이상이면 충족 (1급이 가장 상위 = 숫자 1) */
  gradeAtMost?: number
  /** KBS한국어처럼 문자열 급수를 쓰는 경우 */
  gradeIn?: string[]
}

export interface RuleGroup {
  id: string
  label: string
  max: number
  /** top1 = 분야별 최상위 1개만 인정 (공기업 표준) */
  mode: GroupMode
  tiers: RuleTier[]
  note?: string
}

export interface ExamPart { name: string; q: number | null; pt: number | null }

export interface Company {
  id: string
  name: string
  short: string
  sector: string
  target: boolean
  season: string
  exam: { parts: ExamPart[]; total: string; cutoff: string }
  eligibility: string[]
  /** 서류 합계 만점 */
  docTotal: number
  groups: RuleGroup[]
  /** 별도가점 (합계 밖) */
  extra?: RuleGroup
  /** 동점자 처리 순서 */
  tiebreak?: string[]
  /** 실제 공고로 확인된 값인가 */
  confirmed: boolean
  verified: string
  essayPrompts?: string[]
}

// ── 기업 ─────────────────────────────────────────────────────────
export const COMPANIES: Company[] = [
  {
    id: 'kesco',
    name: '한국전기안전공사',
    short: 'KESCO',
    sector: '전기안전 · 검사',
    target: true,
    season: '통상 연 1~2회',
    exam: {
      parts: [
        { name: 'NCS 직업기초', q: null, pt: null },
        { name: '전공 (전기)', q: null, pt: null },
      ],
      total: '공고별 상이',
      cutoff: '공고 확인',
    },
    eligibility: ['서류심사 100점 + 별도가점 15점', '블라인드 채용 (학교·나이·지역 기재 금지)'],
    docTotal: 100,
    tiebreak: ['취업지원 대상자', '전공자격', '외국어', 'IT'],
    groups: [
      {
        id: 'major', label: '전공자격', max: 35, mode: 'top1',
        tiers: [
          { points: 35, label: '전기기사, 전기기능장', certs: ['elec-gisa', 'elec-gineungjang'] },
          { points: 30, label: '전기산업기사, 전기공사기사', certs: ['elec-sanup', 'elec-gongsa-gisa'] },
          { points: 25, label: '전기공사산업기사, 전기철도기사, 철도신호기사', certs: ['elec-gongsa-sanup', 'elec-rail-gisa', 'rail-signal-gisa'] },
          { points: 20, label: '전기기능사, 전기철도산업기사, 철도신호산업기사', certs: ['elec-gineungsa', 'elec-rail-sanup', 'rail-signal-sanup'] },
          { points: 15, label: '철도전기신호기능사', certs: ['rail-elec-gineungsa'] },
        ],
      },
      {
        id: 'lang', label: '외국어', max: 20, mode: 'top1',
        note: 'TOEIC · TEPS · TOEIC Speaking · OPIc 중 1개. 나머지는 붙임2 환산기준표로 TOEIC 환산.',
        tiers: [
          { points: 20, label: 'TOEIC 850 이상', toeicMin: 850 },
          { points: 15, label: 'TOEIC 800 이상 850 미만', toeicMin: 800 },
          { points: 10, label: 'TOEIC 750 이상 800 미만', toeicMin: 750 },
          { points: 5, label: 'TOEIC 700 이상 750 미만', toeicMin: 700 },
        ],
      },
      {
        id: 'history', label: '한국사', max: 15, mode: 'top1',
        tiers: [
          { points: 15, label: '한국사능력검정 1급', gradeAtMost: 1 },
          { points: 10, label: '한국사능력검정 2급', gradeAtMost: 2 },
          { points: 5, label: '한국사능력검정 3급', gradeAtMost: 3 },
        ],
      },
      {
        id: 'korean', label: '한국어', max: 15, mode: 'top1',
        tiers: [
          { points: 15, label: 'KBS한국어능력시험 2⊕급 이상', gradeIn: ['1급', '2+급'] },
          { points: 10, label: 'KBS한국어능력시험 2⊖급', gradeIn: ['2-급'] },
          { points: 5, label: 'KBS한국어능력시험 3⊕급', gradeIn: ['3+급'] },
        ],
      },
      {
        id: 'it', label: 'IT', max: 15, mode: 'top1',
        tiers: [
          { points: 15, label: '컴퓨터활용능력 1급, 정보처리기사, 빅데이터분석기사', certs: ['comp-act-1', 'info-processing', 'bigdata-gisa'] },
          { points: 10, label: '정보처리산업기사, 사무자동화산업기사', certs: ['info-processing-sanup', 'office-auto-sanup'] },
          { points: 5, label: '컴퓨터활용능력 2급, 프로그래밍기능사', certs: ['comp-act-2', 'prog-gineungsa'] },
        ],
      },
    ],
    extra: {
      id: 'extra', label: '별도가점', max: 15, mode: 'sum',
      tiers: [
        { points: 10, label: '취업지원 대상자 (본인 가점비율에 따름)', certs: ['veteran'] },
        { points: 5, label: '우리공사 체험형 인턴 수료자', certs: ['kesco-intern'] },
      ],
    },
    confirmed: true,
    verified: '2026년 공고 붙임3 「서류심사 표준배점표 — 신입(기술)」 원문 그대로. 붙임2 외국어 환산기준도 반영.',
    essayPrompts: [
      '한국전기안전공사의 핵심가치(안전·도전·상생·혁신) 중 본인을 제일 잘 나타내는 가치를 한 가지 선택하고, 구체적인 사례(경험)를 들어 그 이유를 기술하여 주십시오.',
      '한국전기안전공사의 인재상(화합인·창조인·전문인) 중 본인이 제일 부합하는 인재상을 선택하고, 구체적인 사례(경험)를 들어 그 이유를 기술하여 주십시오.',
      '본인이 속한 조직 또는 집단의 목표를 달성하는 과정에서 어려움 및 갈등이 발생했을 때, 이를 극복했던 경험을 구체적인 사례(본인의 역할, 해결방법, 경험을 통해 얻은 교훈 등)를 들어 기술하여 주십시오.',
      '본인의 전문성을 키우기 위한 노력(교육·경험·경력 등)을 기술하고, 이를 바탕으로 입사 후 포부에 대해 기술하여 주십시오.',
    ],
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
      '영어성적 자격요건 있음 (등급별)',
      '★ 고급자격증 소지자는 서류심사 배수외 합격 — 전기기사가 서류를 여는 열쇠',
    ],
    docTotal: 9,
    groups: [
      { id: 'it', label: 'IT', max: 3, mode: 'top1', tiers: [{ points: 3, label: '컴활 1급(대한상의) 또는 정보처리기사', certs: ['comp-act-1', 'info-processing'] }] },
      { id: 'history', label: '한국사', max: 3, mode: 'top1', tiers: [{ points: 3, label: '한국사능력검정 (급수별 차등)', gradeAtMost: 2 }] },
      { id: 'korean', label: '한국어', max: 3, mode: 'top1', tiers: [{ points: 3, label: 'KBS한국어 등', gradeIn: ['1급', '2+급', '2-급'] }] },
      { id: 'lang', label: '영어우수자', max: 3, mode: 'top1', tiers: [{ points: 3, label: 'TOEIC 고득점 기준선 이상', toeicMin: 850 }] },
    ],
    confirmed: false,
    verified: '필기 150점·40% 과락, 가점 영역별 1개씩 최대 9점(IT/한국사/한국어/영어우수자)은 2024년 공고 기준. 기준선 숫자는 미확인이니 공고로 덮어쓸 것.',
  },
  {
    id: 'korail',
    name: '한국철도공사',
    short: '코레일',
    sector: '철도 · 전기통신',
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
    eligibility: ['한국사 자격 요건화된 회차 있음', '전기통신직 실기 시행 회차 있음'],
    docTotal: 20,
    groups: [
      {
        id: 'major', label: '직렬 직무 자격증', max: 8, mode: 'sum',
        note: '공통 직무 + 직렬 직무에서 2개까지 조합. 정확한 조합 규칙은 공고 확인.',
        tiers: [
          { points: 4, label: '전기기사', certs: ['elec-gisa'] },
          { points: 4, label: '전기공사기사', certs: ['elec-gongsa-gisa'] },
        ],
      },
      { id: 'history', label: '한국사', max: 2, mode: 'top1', tiers: [{ points: 2, label: '한국사능력검정 (급수별 차등)', gradeAtMost: 2 }] },
      { id: 'it', label: 'IT', max: 2, mode: 'top1', tiers: [{ points: 2, label: '정보처리기사 등', certs: ['info-processing', 'comp-act-1'] }] },
      { id: 'lang', label: '외국어', max: 2, mode: 'top1', tiers: [{ points: 2, label: 'TOEIC 기준 이상', toeicMin: 800 }] },
    ],
    confirmed: false,
    verified: '필기 70문항(NCS 30 + 전공 30 + 법령 10), 과목별 40점 과락, 필기 50% 반영은 2024~2025 공고 기준. 자격증 가점은 2026년부터 개편됐다는 자료가 있어 최신 공고 확인 필수.',
  },
  {
    id: 'kepco',
    name: '한국전력공사',
    short: '한전',
    sector: '송배전',
    target: false,
    season: '상반기 2~4월 / 하반기 8~10월',
    exam: {
      parts: [
        { name: 'NCS 직업기초', q: 55, pt: 70 },
        { name: '전공 (전기)', q: 15, pt: 30 },
      ],
      total: '100점',
      cutoff: '영역별 과락 — 1개만 미달해도 총점 무관 탈락',
    },
    eligibility: ['전기(공사)기사 사실상 필수', 'TOEIC 800급 어학 요건', '말하기 성적 요구 회차 있음'],
    docTotal: 10,
    groups: [
      {
        id: 'major', label: '자격증', max: 5, mode: 'top1',
        tiers: [
          { points: 5, label: '기술사', certs: ['pe-elec'] },
          { points: 3, label: '전기기사 / 전기공사기사', certs: ['elec-gisa', 'elec-gongsa-gisa'] },
        ],
      },
      { id: 'history', label: '한국사', max: 2, mode: 'top1', tiers: [{ points: 2, label: '한국사능력검정 1급', gradeAtMost: 1 }] },
      { id: 'it', label: 'IT', max: 2, mode: 'top1', tiers: [{ points: 2, label: '컴활 1급 / 정보처리기사', certs: ['comp-act-1', 'info-processing'] }] },
      { id: 'local', label: '지역인재', max: 3, mode: 'top1', tiers: [{ points: 3, label: '이전지역인재', certs: ['local-talent'] }] },
    ],
    confirmed: false,
    verified: 'NCS 70 + 전공 30(15문항), 영역별 과락은 후기 다수 일치. 가점 세부는 미확인 — 레퍼런스로만 볼 것.',
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
      ],
      total: '공고별 상이',
      cutoff: '과목별 과락',
    },
    eligibility: ['전기기사급 권장', '어학 요건 있음'],
    docTotal: 10,
    groups: [
      {
        id: 'major', label: '자격증', max: 6, mode: 'top1',
        tiers: [
          { points: 6, label: '기술사', certs: ['pe-elec'] },
          { points: 4, label: '전기기사', certs: ['elec-gisa'] },
          { points: 2, label: '전기산업기사', certs: ['elec-sanup'] },
        ],
      },
      { id: 'history', label: '한국사', max: 2, mode: 'top1', tiers: [{ points: 2, label: '한국사능력검정', gradeAtMost: 2 }] },
      { id: 'local', label: '지역인재', max: 2, mode: 'top1', tiers: [{ points: 2, label: '이전지역인재', certs: ['local-talent'] }] },
    ],
    confirmed: false,
    verified: '발전 5사는 구조가 비슷하지만 배점은 제각각. 지원할 회사 공고로 덮어쓸 것.',
  },
  {
    id: 'humetro',
    name: '부산교통공사',
    short: '부교공',
    sector: '도시철도',
    target: false,
    season: '통상 연 1회',
    exam: {
      parts: [
        { name: 'NCS 직업기초', q: null, pt: null },
        { name: '전공 (전기일반)', q: null, pt: null },
      ],
      total: '공고별 상이',
      cutoff: '과목별 40% 과락이 일반적',
    },
    eligibility: ['부산·울산·경남 지역인재 가점 비중 큼'],
    docTotal: 10,
    groups: [
      {
        id: 'major', label: '자격증', max: 5, mode: 'top1',
        tiers: [
          { points: 3, label: '전기기사', certs: ['elec-gisa'] },
          { points: 2, label: '전기산업기사', certs: ['elec-sanup'] },
        ],
      },
      { id: 'local', label: '지역인재', max: 5, mode: 'top1', tiers: [{ points: 5, label: '부산·울산·경남 지역인재', certs: ['local-talent'] }] },
      { id: 'history', label: '한국사', max: 2, mode: 'top1', tiers: [{ points: 2, label: '한국사능력검정', gradeAtMost: 2 }] },
    ],
    confirmed: false,
    verified: '지역인재 비중이 큰 것으로 알려져 있으나 배점 미확인.',
  },
]

export const company = (id: string) => COMPANIES.find(c => c.id === id)

// ── 기업 추가/숨김 ───────────────────────────────────────────────
export interface CompanyRow {
  id: string
  hidden: boolean
  /** 주 타깃 여부 덮어쓰기 — null이면 기본값을 따른다 */
  target: boolean | null
  /** 사용자가 직접 추가한 기업이면 Company 전체, 내장 기업이면 null */
  data: Company | null
  sort_order: number
}

/** 내장 목록 + 사용자 추가분을 합치고, 숨김·주타깃 덮어쓰기를 적용한다 */
export function mergeCompanies(rows: CompanyRow[]): Company[] {
  const byId = new Map(rows.map(r => [r.id, r]))
  const withTarget = (c: Company): Company => {
    const t = byId.get(c.id)?.target
    return t === null || t === undefined ? c : { ...c, target: t }
  }
  const builtins = COMPANIES
    .filter(c => !byId.get(c.id)?.hidden)
    .map(withTarget)
  const custom = rows
    .filter(r => r.data && !r.hidden)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(r => withTarget(r.data as Company))
  return [...builtins, ...custom]
}

/** 새 기업의 빈 껍데기 — 배점은 편집기로 채운다 */
export function blankCompany(id: string, name: string): Company {
  return {
    id, name, short: name.slice(0, 6), sector: '', target: false, season: '',
    exam: { parts: [{ name: 'NCS 직업기초', q: null, pt: null }, { name: '전공', q: null, pt: null }], total: '공고별 상이', cutoff: '공고 확인' },
    eligibility: [], docTotal: 100, groups: [], confirmed: false,
    verified: '직접 추가한 기업입니다. 「배점 편집」에서 공고의 서류심사 표준배점표를 옮겨 넣으세요.',
  }
}

// ── 후보 기업 ────────────────────────────────────────────────────
export type SuggestTag = 'practice' | 'grid' | 'life'

export const SUGGEST_TAGS: Record<SuggestTag, { label: string; desc: string }> = {
  practice: { label: '전기 실무', desc: '수전·발전설비를 직접 만지는 곳 — 電験 실무경력으로 이어짐' },
  grid: { label: '계통·설계', desc: '산출물형 직무 — 물리·수학 배경이 살아나는 쪽' },
  life: { label: '생활 + 공부', desc: '교대·대기시간이 있어 병행이 가능하다고 알려진 곳' },
}

export interface Suggestion {
  name: string; short: string; sector: string; tag: SuggestTag; why: string
}

export const SUGGESTIONS: Suggestion[] = [
  { name: '한국수력원자력', short: 'KHNP', sector: '원자력 발전', tag: 'practice',
    why: '전기직 채용 규모가 크고 발전소 전기설비 실무가 그대로 쌓입니다. 다만 원전 특유의 절차·보안 업무 비중이 큽니다.' },
  { name: '한국남동발전 / 남부 / 동서 / 서부발전', short: '발전4사', sector: '발전', tag: 'practice',
    why: '중부발전과 구조가 거의 같습니다. 한 회사만 넣지 말고 회차마다 열리는 곳에 다 넣는 게 정석입니다.' },
  { name: '한국지역난방공사', short: '한난', sector: '집단에너지', tag: 'practice',
    why: '열병합 발전과 수전설비를 함께 다룹니다. 발전사보다 채용이 적지만 근무지가 수도권에 몰려 있습니다.' },
  { name: '한국가스공사', short: '가스공사', sector: '가스 설비', tag: 'practice',
    why: '생산기지 전기설비 운영. 처우가 좋은 편이고 교대 비중이 있습니다.' },
  { name: '전력거래소', short: 'KPX', sector: '계통 운영 · 급전', tag: 'grid',
    why: '전력계통 운영의 심장부라 계통해석·조류계산이 실무 그 자체입니다. 물리 배경이 가장 잘 살아나는 곳이지만 채용 인원이 한 자릿수~십수 명이라 경쟁이 극심하고, 중앙급전소는 교대근무입니다.' },
  { name: '한국전력기술', short: 'KEPCO E&C', sector: '발전·송변전 설계', tag: 'grid',
    why: '설계 산출물이 남는 직무. 일본에서도 설계 경력은 통하지만, 신입 경쟁이 특히 치열합니다.' },
  { name: '한전KDN', short: 'KDN', sector: '전력 IT · 계통보호', tag: 'grid',
    why: '전기와 IT가 겹치는 자리. 정보처리기사를 딸 계획이라면 두 자격이 동시에 값을 합니다.' },
  { name: '국가철도공단', short: '철도공단', sector: '전철전력 설계·감리', tag: 'grid',
    why: '코레일이 운영이라면 여기는 건설·감리 쪽. 산출물형 경력이 남습니다.' },
  { name: '서울교통공사', short: '서교공', sector: '도시철도', tag: 'life',
    why: '전기직 채용 규모가 도시철도 중 가장 큽니다. 야간 대기시간이 있어 공부를 병행했다는 사례가 많은 곳입니다.' },
  { name: '인천국제공항공사', short: '인국공', sector: '공항 시설', tag: 'life',
    why: '시설 전기직. 처우가 좋아 경쟁률이 높지만 근무 패턴상 자기 시간 확보가 되는 편입니다.' },
  { name: '한국공항공사', short: 'KAC', sector: '공항 시설', tag: 'life',
    why: '인국공보다 문턱이 낮고 지방공항 근무지가 많아 선택지가 넓습니다.' },
  { name: '서울시설공단 / 지방 도시관리공사', short: '시설공단', sector: '공공시설 관리', tag: 'life',
    why: '업무 강도가 가장 낮은 축. 처우는 낮지만 「경유지」로 삼아 자격 공부에 시간을 쓰기에는 가장 무난합니다.' },
]

// ── 내 스펙 ──────────────────────────────────────────────────────
export interface SpecRow { cert_key: string; has: boolean; value: string | null }
export type SpecMap = Record<string, SpecRow>
export const toSpecMap = (rows: SpecRow[]): SpecMap =>
  Object.fromEntries(rows.filter(r => r.has).map(r => [r.cert_key, r]))

// ── 점수 계산 ────────────────────────────────────────────────────
const gradeNum = (v: string) => {
  const m = v.match(/(\d+)/)
  return m ? Number(m[1]) : 99
}

export function tierMet(t: RuleTier, spec: SpecMap, toeic: number): boolean {
  if (t.toeicMin !== undefined) return toeic >= t.toeicMin
  if (t.gradeAtMost !== undefined) {
    const v = spec['kor-history']?.value
    return !!v && gradeNum(v) <= t.gradeAtMost
  }
  if (t.gradeIn) {
    const v = spec['kbs-korean']?.value
    return !!v && t.gradeIn.includes(v)
  }
  return (t.certs ?? []).some(c => !!spec[c])
}

export interface GroupResult {
  group: RuleGroup
  earned: number
  metTiers: RuleTier[]
  /** top1에서 실제로 점수를 준 등급 */
  hitTier: RuleTier | null
}

export function scoreGroup(g: RuleGroup, spec: SpecMap, toeic: number): GroupResult {
  const met = g.tiers.filter(t => tierMet(t, spec, toeic))
  if (g.mode === 'top1') {
    const hit = met.sort((a, b) => b.points - a.points)[0] ?? null
    return { group: g, earned: Math.min(hit?.points ?? 0, g.max), metTiers: met, hitTier: hit }
  }
  const sum = met.reduce((a, t) => a + t.points, 0)
  return { group: g, earned: Math.min(sum, g.max), metTiers: met, hitTier: null }
}

export interface CompanyResult {
  company: Company
  groups: GroupResult[]
  extra: GroupResult | null
  earned: number
  max: number
  extraEarned: number
  /** 이걸 채우면 몇 점 오르는가 */
  upside: { label: string; gain: number; how: string }[]
}

export function scoreCompany(c: Company, spec: SpecMap): CompanyResult {
  const toeic = bestToeic(spec)
  const groups = c.groups.map(g => scoreGroup(g, spec, toeic))
  const earned = groups.reduce((a, g) => a + g.earned, 0)
  const extra = c.extra ? scoreGroup(c.extra, spec, toeic) : null

  // 각 분야에서 아직 못 받은 상위 등급 = 다음 한 수
  const upside: { label: string; gain: number; how: string }[] = []
  groups.forEach(g => {
    const better = g.group.tiers
      .filter(t => t.points > g.earned && !tierMet(t, spec, toeic))
      .sort((a, b) => a.points - b.points)[0]
    if (better) {
      upside.push({
        label: g.group.label,
        gain: Math.min(better.points, g.group.max) - g.earned,
        how: better.label,
      })
    }
  })
  upside.sort((a, b) => b.gain - a.gain)

  return {
    company: c, groups, extra, earned,
    max: c.groups.reduce((a, g) => a + g.max, 0),
    extraEarned: extra?.earned ?? 0,
    upside,
  }
}

// ── 모의고사 ─────────────────────────────────────────────────────
export interface MockRow {
  id: string
  company_id: string | null
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

// ── 자기소개서 ───────────────────────────────────────────────────
export interface EssayRow {
  id: string
  company_id: string
  idx: number
  prompt: string
  body: string | null
  min_chars: number | null
  max_chars: number | null
}

// ── 기업별 자료 ──────────────────────────────────────────────────
export type DocKind = 'notice' | 'jd' | 'rubric' | 'lang' | 'essay' | 'etc'

export const DOC_KINDS: { key: DocKind; label: string; icon: string; color: string }[] = [
  { key: 'notice', label: '채용공고',   icon: '📢', color: '#60a5fa' },
  { key: 'jd',     label: '직무기술서', icon: '🧰', color: '#34d399' },
  { key: 'rubric', label: '배점표',     icon: '📊', color: '#fbbf24' },
  { key: 'lang',   label: '어학 환산',  icon: '🌐', color: '#a78bfa' },
  { key: 'essay',  label: '자소서 문항', icon: '✍️', color: '#f472b6' },
  { key: 'etc',    label: '기타',       icon: '📎', color: '#94a3b8' },
]
export const docKind = (k: string) => DOC_KINDS.find(d => d.key === k) ?? DOC_KINDS[DOC_KINDS.length - 1]

export interface DocRow {
  id: string
  company_id: string
  kind: DocKind
  title: string
  url: string
  note: string | null
  sort_order: number
}

/** 구글 드라이브 공유 링크를 iframe 미리보기 주소로 */
export function toPreviewUrl(url: string): string | null {
  if (!url) return null
  const m = url.match(/\/file\/d\/([^/]+)/)
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`
  const id = url.match(/[?&]id=([^&]+)/)
  if (id) return `https://drive.google.com/file/d/${id[1]}/preview`
  if (url.includes('drive.google.com')) return url.replace('/view', '/preview')
  if (url.endsWith('.pdf')) return url
  return url
}

export const pct = (got: number, total: number) => (total === 0 ? 0 : (got / total) * 100)
