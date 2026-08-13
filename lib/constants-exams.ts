// 범용 시험 프레임 (에너지관리사 전기 · 기술사 1차 · 한국 기술고시)
// ===================================================================
// 세 시험을 각각 독립 허브로 두되, 화면·저장·채점 로직은 하나로 공유한다.
// 덴켄 1·2종에서 세운 두 축을 그대로 재사용한다:
//   · 마크시트 과목 → 「大問 배점 ÷ 小問 채점」 (correct 개수 비율 × 배점)
//   · 논술 과목     → 「선택 + 자기채점 점수」
// 시험마다 다른 건 (과목 목록 / 문항 수 / 배점 / 합격 기준)뿐이라,
// 그 차이를 SUBJECT_SPEC 하나에 몰아넣고 UI는 spec을 읽어 그린다.
//
// 출처
//   에너지관리사(전기): 省エネルギーセンター https://www.eccj.or.jp/mgr1/test_past/
//     必須 課目I(에너지종합관리·법규) + 選択(전기) 課目II 전기기초 / III 전기설비·기기 / IV 전력응용
//     각 과목 60% 합격 · 연 1회(8월) · 마크시트
//   기술사 1차(電気電子部門): 日本技術士会 https://www.engineer.or.jp/
//     基礎科目 15점(30문 출제·15문 선택) / 適性科目 15점(15문 전답) / 専門科目 50점(35문 출제·25문 선택, 1문 2점)
//     각 과목 50% 합격 · 연 1회(11월) · 마크시트
//   한국 기술고시 5급 공업(전기): 인사혁신처
//     2차 논술이 실질 시험. 현행(2025~) 필수 3과목: 전기자기학·회로이론·전기기기 (선택과목 폐지)
//     과목당 100점 · 논술 자기채점

export type ExamMode = 'marksheet' | 'essay'
export type Result = 'correct' | 'wrong' | null

export function cycleResult(r: Result): Result {
  return r === null ? 'correct' : r === 'correct' ? 'wrong' : null
}

// ── 과목 사양 ───────────────────────────────────────────────────────
// marksheet 과목: 大問 배열. 각 大問은 (배점 · 小問 수 · 선택응답 여부)를 가진다.
//   · 에관사는 大問이 크고 小問이 많음 → 大問 배점 ÷ 小問으로 배분
//   · 기술사는 문항이 잘게 쪼개져 있고 선택응답이 있음(35문 중 25문 등)
//     → 이 경우 "小問 = 개별 문항"으로 보고, 大問 하나에 小問을 촘촘히 넣는다
// essay 과목: 문제 수 · 문제당 배점만.

export type MarkGroup = {
  label: string          // 大問/블록 이름 (예: '課目II', '専門')
  point: number          // 이 블록 총 배점
  subCount: number       // 小問(또는 개별 문항) 수
  pickCount?: number     // 선택응답 수 (없으면 subCount 전부 채점)
}

export type EssayGroup = {
  totalQ: number         // 출제 문제 수
  pickCount: number      // 선택해 푸는 문제 수
  perQ: number           // 문제당 배점
}

export type SubjectSpec = {
  slug: string
  name: string           // 화면 표기 (예: '課目II 전기기초')
  short: string          // 짧은 라벨 (셀/탭용)
  accent: string
  mode: ExamMode
  fullMark: number       // 이 과목 만점
  passMark: number       // 이 과목 합격점
  mark?: MarkGroup[]      // marksheet 과목의 블록들
  essay?: EssayGroup      // essay 과목
  note?: string
}

// ── 시험 사양 ───────────────────────────────────────────────────────
export type ExamSpec = {
  slug: string           // 라우트 (/dashboard/exam/{slug})
  name: string
  emoji: string
  org: string
  accent: string
  scheduleNote: string
  cutNote: string        // 합격 규칙 요약
  yearLabel: (year: number) => string   // 회차 라벨
  examIdPrefix: string
  years: number[]        // 연도(내림차순)
  rounds?: number        // 연 실시 횟수. 2 이상이면 회차 ID에 회(回)가 붙는다
  subjects: SubjectSpec[]
  tableName: string      // supabase 테이블 접두
  intro: string
  pastPapers?: PastPaperLink[]   // 공식 과년도 배포 페이지
}

// 공식 시험기관의 과년도 문제·정답 배포 페이지
// coverage 는 "그 페이지에서 실제로 몇 년치를 받을 수 있는가".
// 여기가 중요한 이유: 기관마다 공개 범위가 천차만별이라
// 링크만 걸어두면 헛걸음한다. 시공관리는 공식이 최근분만 올린다.
export type PastPaperLink = {
  label: string
  url: string
  coverage: string
  note?: string
}

// 서기 → 일본 연호
function wareki(y: number): string {
  if (y >= 2019) { const n = y - 2018; return n === 1 ? '令和元年度' : `令和${n}年度` }
  return `平成${y - 1988}年度`
}
function jpLabel(y: number): string { return `${y}년도 (${wareki(y)})` }
function krLabel(y: number): string { return `${y}년도` }

function yearsDesc(from: number, to: number): number[] {
  const out: number[] = []
  for (let y = from; y >= to; y--) out.push(y)
  return out
}

// ── 에너지관리사 (전기분야) ─────────────────────────────────────────
// 必須 I + 選択(전기) II·III·IV. 각 과목 60% 합격.
// 과목별 만점은 공식 배점표가 회차마다 조금씩 달라 100점으로 정규화(비율만 의미 있음).
const ENEKAN_MARK = (label: string, subCount: number): MarkGroup[] =>
  [{ label, point: 100, subCount }]

const ENEKAN_SUBJECTS: SubjectSpec[] = [
  {
    slug: 'kamoku1', name: '課目I 에너지종합관리·법규', short: 'I 법규', accent: '#b45309',
    mode: 'marksheet', fullMark: 100, passMark: 60, mark: ENEKAN_MARK('課目I', 20),
    note: '必須基礎 · 전 분야 공통',
  },
  {
    slug: 'kamoku2', name: '課目II 전기의 기초', short: 'II 기초', accent: '#2563eb',
    mode: 'marksheet', fullMark: 100, passMark: 60, mark: ENEKAN_MARK('課目II', 20),
    note: '選択(전기) · 회로·전자기',
  },
  {
    slug: 'kamoku3', name: '課目III 전기설비·기기', short: 'III 설비', accent: '#7c3aed',
    mode: 'marksheet', fullMark: 100, passMark: 60, mark: ENEKAN_MARK('課目III', 20),
    note: '選択(전기) · 변압기·전동기·조명',
  },
  {
    slug: 'kamoku4', name: '課目IV 전력응용', short: 'IV 응용', accent: '#059669',
    mode: 'marksheet', fullMark: 100, passMark: 60, mark: ENEKAN_MARK('課目IV', 20),
    note: '選択(전기) · 전동력·전열·전기화학',
  },
]

// ── 기술사 1차 (電気電子部門) ───────────────────────────────────────
// 基礎 15점(30문 출제·15문 선택) / 適性 15점(15문 전답) / 専門 50점(35문 출제·25문 선택, 1문 2점)
// 각 과목 50% 합격.
const GIJUTSUSHI_SUBJECTS: SubjectSpec[] = [
  {
    slug: 'kiso', name: '基礎科目', short: '基礎', accent: '#0891b2',
    mode: 'marksheet', fullMark: 15, passMark: 8,
    mark: [{ label: '基礎', point: 15, subCount: 30, pickCount: 15 }],
    note: '5분야 각 6문 출제 · 각 분야 3문 선택 = 15문 · 1문 1점',
  },
  {
    slug: 'tekisei', name: '適性科目', short: '適性', accent: '#65a30d',
    mode: 'marksheet', fullMark: 15, passMark: 8,
    mark: [{ label: '適性', point: 15, subCount: 15 }],
    note: '기술사법 4장 준수 적성 · 15문 전답 · 1문 1점',
  },
  {
    slug: 'senmon', name: '専門科目 (電気電子)', short: '専門', accent: '#e11d48',
    mode: 'marksheet', fullMark: 50, passMark: 25,
    mark: [{ label: '専門', point: 50, subCount: 35, pickCount: 25 }],
    note: '전기전자부문 35문 출제 · 25문 선택 · 1문 2점',
  },
]

// ── 한국 기술고시 5급 공업(전기) ────────────────────────────────────
// 2차 논술이 실질 시험. 현행(2025~) 필수 3과목. 과목당 100점, 4문 내외 논술.
// 이전 회차 기출은 선택과목까지 있으므로 참고용 과목을 뒤에 유지한다.
const GOSI_ESSAY = (perQ: number, totalQ: number): EssayGroup =>
  ({ totalQ, pickCount: totalQ, perQ })   // 논술은 전 문제 필수

const GOSI_SUBJECTS: SubjectSpec[] = [
  {
    slug: 'jagi', name: '전기자기학', short: '자기', accent: '#2563eb',
    mode: 'essay', fullMark: 100, passMark: 60, essay: GOSI_ESSAY(25, 4),
    note: '필수 (현행)',
  },
  {
    slug: 'hoero', name: '회로이론', short: '회로', accent: '#059669',
    mode: 'essay', fullMark: 100, passMark: 60, essay: GOSI_ESSAY(25, 4),
    note: '필수 (현행)',
  },
  {
    slug: 'gigi', name: '전기기기', short: '기기', accent: '#7c3aed',
    mode: 'essay', fullMark: 100, passMark: 60, essay: GOSI_ESSAY(25, 4),
    note: '필수 (현행)',
  },
  // ── 이하 참고용: 구 체제 선택/추가 과목 (2024년 이전 기출 대응) ──
  { slug: 'jadong',    name: '자동제어',     short: '제어',   accent: '#0891b2', mode: 'essay', fullMark: 100, passMark: 60, essay: GOSI_ESSAY(25, 4), note: '참고 (구 체제)' },
  { slug: 'jeonryeok', name: '전력전자',     short: '전력전자', accent: '#db2777', mode: 'essay', fullMark: 100, passMark: 60, essay: GOSI_ESSAY(25, 4), note: '참고 (구 체제)' },
  { slug: 'gyetong',   name: '전력계통공학', short: '계통',   accent: '#ca8a04', mode: 'essay', fullMark: 100, passMark: 60, essay: GOSI_ESSAY(25, 4), note: '참고 (구 체제)' },
  { slug: 'jeonja',    name: '전자회로',     short: '전자',   accent: '#0d9488', mode: 'essay', fullMark: 100, passMark: 60, essay: GOSI_ESSAY(25, 4), note: '참고 (구 체제)' },
  { slug: 'digital',   name: '디지털공학',   short: '디지털', accent: '#9333ea', mode: 'essay', fullMark: 100, passMark: 60, essay: GOSI_ESSAY(25, 4), note: '참고 (구 체제)' },
]

// ── 1級電気工事施工管理技士 ─────────────────────────────────────────
// 一次検定: 마크시트. 全89~92問 출제 중 60問을 골라 해답.
//   합격 = 60問 중 36問(60%) 이상 정답  AND  応用能力 6問 중 3問 이상 정답(足切り)
//   → 일반 블록(54문 해답)과 応用能力 블록(6문)을 나눠 둔다. 応用能力는 pickCount 없이 전문 채점.
// 二次検定: 経験記述 중심 기술식 → essay 모드(자기채점).
// 출처: 建設業振興基金 / TAC 시험개요
const SEKOKAN1_SUBJECTS: SubjectSpec[] = [
  {
    slug: 'ichiji', name: '第一次検定', short: '一次', accent: '#0d9488',
    mode: 'marksheet', fullMark: 60, passMark: 36,
    mark: [
      // 전체 89문 중 54문을 골라 해답(응용능력 6문 제외분)
      { label: '일반(선택)', point: 54, subCount: 83, pickCount: 54 },
      // 施工管理法 応用能力 6문 — 전문 필수, 3문 이상 足切り
      { label: '応用能力', point: 6, subCount: 6 },
    ],
    note: '89問 출제 · 60問 해답 · 36問 이상 정답 + 応用能力 6問중 3問 이상(足切り)',
  },
  {
    slug: 'niji', name: '第二次検定', short: '二次', accent: '#b45309',
    mode: 'essay', fullMark: 100, passMark: 60,
    essay: { totalQ: 5, pickCount: 5, perQ: 20 },
    note: '経験記述 + 시공관리 기술식 · 자기채점',
  },
]

// ── 電気通信主任技術者 (伝送交換) ───────────────────────────────────
// 연 2회. 마크시트 3과목(2021년도 이후 専門科目 폐지).
//   電気通信システム : 100点 만점 / 60点 · 20문
//   伝送交換設備及び設備管理 : 150点 만점 / 90点 · 60문
//   法規 : 100点 만점 / 60点 · 32문 전후(회차마다 다름)
// 출처: 日本データ通信協会 전기통신국가시험센터 (합격기준·과목)
const DENTSU_SHUNIN_SUBJECTS: SubjectSpec[] = [
  {
    slug: 'system', name: '電気通信システム', short: 'システム', accent: '#2563eb',
    mode: 'marksheet', fullMark: 100, passMark: 60,
    mark: [{ label: 'システム', point: 100, subCount: 20 }],
    note: '공통과목 · 20문 · 100점 만점 60점 합격',
  },
  {
    slug: 'setsubi', name: '伝送交換設備及び設備管理', short: '設備', accent: '#7c3aed',
    mode: 'marksheet', fullMark: 150, passMark: 90,
    mark: [{ label: '設備·設備管理', point: 150, subCount: 60 }],
    note: '전문 핵심 · 60문 · 150점 만점 90점 합격',
  },
  {
    slug: 'houki', name: '法規', short: '法規', accent: '#b45309',
    mode: 'marksheet', fullMark: 100, passMark: 60,
    mark: [{ label: '法規', point: 100, subCount: 32 }],
    note: '회차마다 문항수 변동(32문 전후) · 100점 만점 60점 합격',
  },
]

// ── 工事担任者 (総合通信) ───────────────────────────────────────────
// 연 2회. 3과목, 각 100점 만점 60점 합격. 과목마다 大問 5문 구성.
// 출처: 日本データ通信協会 전기통신국가시험센터
const KOUTAN_SUBJECTS: SubjectSpec[] = [
  {
    slug: 'kiso', name: '基礎', short: '基礎', accent: '#0891b2',
    mode: 'marksheet', fullMark: 100, passMark: 60,
    mark: [{ label: '基礎', point: 100, subCount: 25 }],
    note: '전기회로·전자회로·논리회로·전송이론 · 大問 5문',
  },
  {
    slug: 'gijutsu', name: '技術及び理論', short: '技術', accent: '#059669',
    mode: 'marksheet', fullMark: 100, passMark: 60,
    mark: [{ label: '技術·理論', point: 100, subCount: 25 }],
    note: '단말설비·네트워크·정보보안 · 大問 5문',
  },
  {
    slug: 'houki', name: '法規', short: '法規', accent: '#b45309',
    mode: 'marksheet', fullMark: 100, passMark: 60,
    mark: [{ label: '法規', point: 100, subCount: 25 }],
    note: '전기통신사업법·공사담임자규칙 등 · 大問 5문',
  },
]

// ── 시험 레지스트리 ─────────────────────────────────────────────────
export const EXAM_SPECS: ExamSpec[] = [
  {
    slug: 'enekan', name: 'エネルギー管理士 (전기)', emoji: '⚡',
    org: '省エネルギーセンター', accent: '#d97706',
    scheduleNote: '연 1회 · 8월 초 (일)',
    cutNote: '과목별 60% 이상 · 과목합격 유보(연 단위)',
    yearLabel: jpLabel, examIdPrefix: 'enk', years: yearsDesc(2026, 2010),
    subjects: ENEKAN_SUBJECTS, tableName: 'enekan',
    intro: '必須 課目I + 選択(전기) 課目II·III·IV · 마크시트 · 각 과목 60% 합격. 전기 分野 4과목만 다룬다.',
    pastPapers: [{
      label: '省エネルギーセンター · 過去の試験問題',
      url: 'https://www.eccj.or.jp/mgr1/test_past/index.html',
      coverage: '平成22년도 ~ 최신 (약 16년치)',
      note: '課目별로 問題/解答 PDF가 따로. 개인 이용 범위 내 사용 가능',
    }],
  },
  {
    slug: 'gijutsushi', name: '技術士 1차 (電気電子)', emoji: '🎌',
    org: '日本技術士会', accent: '#dc2626',
    scheduleNote: '연 1회 · 11월 (일)',
    cutNote: '각 과목 50% 이상 (총점 기준 없음)',
    yearLabel: jpLabel, examIdPrefix: 'gjs', years: yearsDesc(2026, 2010),
    subjects: GIJUTSUSHI_SUBJECTS, tableName: 'gijutsushi',
    intro: '基礎·適性·専門(電気電子) 3과목 마크시트 · 각 과목 50% 합격. 専門은 35문 중 25문 선택.',
    pastPapers: [
      {
        label: '日本技術士会 · 過去問題(第一次試験)',
        url: 'https://www.engineer.or.jp/c_categories/index02021.html',
        coverage: '令和元년도(再) ~ 최신',
        note: '전 부문 한 PDF에 묶여 있음 · 저작권 문제로 일부 생략·개변된 문항 있음',
      },
      {
        label: '日本技術士会 · 択一式問題の正答',
        url: 'https://www.engineer.or.jp/c_categories/index02012.html',
        coverage: '정답표 별도 페이지',
      },
    ],
  },
  {
    slug: 'gosi', name: '기술고시 전기직', emoji: '🎓',
    org: '인사혁신처 5급 공채', accent: '#7c3aed',
    scheduleNote: '2차 논술 · 6~7월',
    cutNote: '과목별 자기채점 · 실질 커트 60% 내외',
    yearLabel: krLabel, examIdPrefix: 'gosi', years: yearsDesc(2026, 2002),
    subjects: GOSI_SUBJECTS, tableName: 'gosi',
    intro: '2차 논술 필수 3과목(전기자기학·회로이론·전기기기) 자기채점. 구 체제 기출용 참고 과목 5개를 뒤에 유지.',
    pastPapers: [{
      label: '사이버국가고시센터 · 기출문제',
      url: 'https://www.gosi.kr/',
      coverage: '자료실 → 기출문제 (5급 공채 과목별)',
      note: '유일하게 일본 기관이 아님 · 2차 논술은 정답 미공개',
    }],
  },
  {
    slug: 'sekokan1', name: '1級電気工事施工管理技士', emoji: '🏗',
    org: '建設業振興基金', accent: '#0d9488',
    scheduleNote: '연 1회 · 一次 7월 / 二次 10월',
    cutNote: '一次 60問중 36問 + 応用能力 6問중 3問(足切り) · 二次 60%',
    yearLabel: jpLabel, examIdPrefix: 'sk1', years: yearsDesc(2026, 2018),
    subjects: SEKOKAN1_SUBJECTS, tableName: 'sekokan1',
    intro: '一次(마크시트 선택해답 + 応用能力 足切り) → 二次(経験記述). 令和8~平成30 9년치.',
    pastPapers: [{
      label: '建設業振興基金 · 過去の検定問題・合格基準',
      url: 'https://www.fcip-shiken.jp/about/kako.html',
      coverage: '⚠ 공식은 최근 1~2년치만 상시 공개',
      note: '9년치를 한 번에 받으려면 TAC 등 민간 정리 페이지를 병용해야 한다',
    }],
  },
  {
    slug: 'dentsu-shunin', name: '電気通信主任技術者 (伝送交換)', emoji: '📡',
    org: '日本データ通信協会', accent: '#0369a1',
    scheduleNote: '연 2회 · 7월 / 1월',
    cutNote: 'システム·法規 100점중 60점 · 設備 150점중 90점',
    yearLabel: jpLabel, examIdPrefix: 'dts', years: yearsDesc(2026, 2021), rounds: 2,
    subjects: DENTSU_SHUNIN_SUBJECTS, tableName: 'dentsu',
    intro: '네트워크 공사·유지·운용의 감독책임자. 2021년도 専門科目 폐지 후 3과목 체제라 회차를 2021~로 잡았다.',
    pastPapers: [{
      label: '日本データ通信協会 · 試験問題・正答',
      url: 'https://www.dekyo.or.jp/shiken/chief/exam',
      coverage: '회차별(제1·2회) 과목별 問題/正答 PDF',
      note: '수험 목적이면 다운로드·인쇄 자유 · 허락·사용료 불필요',
    }],
  },
  {
    slug: 'koutan', name: '工事担任者 (総合通信)', emoji: '🔗',
    org: '日本データ通信協会', accent: '#65a30d',
    scheduleNote: '연 2회 · 5월 / 11월',
    cutNote: '3과목 각 100점중 60점 · 과목합격 3년 유보',
    yearLabel: jpLabel, examIdPrefix: 'ktn', years: yearsDesc(2026, 2021), rounds: 2,
    subjects: KOUTAN_SUBJECTS, tableName: 'koutan',
    intro: '基礎·技術及び理論·法規 3과목 마크시트. 総合通信은 아날로그·디지털 전 범위를 다루는 최상위 종별.',
    pastPapers: [{
      label: '日本データ通信協会 · 試験問題・正答',
      url: 'https://www.dekyo.or.jp/shiken/charge/exam',
      coverage: '회차별 · 種別(総合通信 등)마다 問題/正答 PDF',
      note: '수험 목적이면 다운로드·인쇄 자유',
    }],
  },
]

export const EXAM_MAP = new Map<string, ExamSpec>(EXAM_SPECS.map(e => [e.slug, e]))

export function getSubjectSpec(exam: ExamSpec, slug: string): SubjectSpec | undefined {
  return exam.subjects.find(s => s.slug === slug)
}

// ── 회차(연도 + 실시회) ─────────────────────────────────────────────
// 연 1회 시험: enk_2026        (round 생략)
// 연 2회 시험: dts_2026_1      (제1회) / dts_2026_2 (제2회)
export type ExamRound = { year: number; round: number | null; id: string; label: string }

export function makeExamId(exam: ExamSpec, year: number, round?: number | null): string {
  return round ? `${exam.examIdPrefix}_${year}_${round}` : `${exam.examIdPrefix}_${year}`
}

export function parseExamRound(exam: ExamSpec, examId: string): { year: number; round: number | null } | null {
  const m = new RegExp(`^${exam.examIdPrefix}_(\\d{4})(?:_([12]))?$`).exec(examId)
  if (!m) return null
  return { year: Number(m[1]), round: m[2] ? Number(m[2]) : null }
}

// 하위 호환 — 기존 호출부에서 연도만 필요할 때
export function parseYear(exam: ExamSpec, examId: string): number | null {
  return parseExamRound(exam, examId)?.year ?? null
}

// 허브가 그릴 회차 목록 (최신순)
export function examRounds(exam: ExamSpec): ExamRound[] {
  const out: ExamRound[] = []
  for (const y of exam.years) {
    if (exam.rounds && exam.rounds > 1) {
      // 제2회가 나중이므로 최신순으로는 2 → 1
      for (let r = exam.rounds; r >= 1; r--) {
        out.push({ year: y, round: r, id: makeExamId(exam, y, r), label: `${exam.yearLabel(y)} 제${r}회` })
      }
    } else {
      out.push({ year: y, round: null, id: makeExamId(exam, y), label: exam.yearLabel(y) })
    }
  }
  return out
}

// ── 채점 ────────────────────────────────────────────────────────────
export function round1(n: number): number { return Math.round(n * 10) / 10 }

// marksheet: 블록별로 (맞은 小問 / (pickCount ?? subCount)) × 배점
export type MarkAnswer = { subs: Result[] }   // 블록별 小問 정오 배열

export function markGroupScore(g: MarkGroup, subs: Result[]): number {
  const denom = g.pickCount ?? g.subCount
  if (denom <= 0) return 0
  const correct = subs.filter(r => r === 'correct').length
  // 선택응답이면 초과 정답은 인정 안 함 (상위 denom개만)
  return (Math.min(correct, denom) / denom) * g.point
}

export function markSubjectScore(spec: SubjectSpec, groupSubs: Result[][]): number {
  if (!spec.mark) return 0
  let total = 0
  spec.mark.forEach((g, i) => { total += markGroupScore(g, groupSubs[i] ?? []) })
  return round1(total)
}

export function markGradedCount(spec: SubjectSpec, groupSubs: Result[][]): number {
  if (!spec.mark) return 0
  let graded = 0
  spec.mark.forEach((g, i) => {
    graded += (groupSubs[i] ?? []).filter(r => r !== null).length
  })
  return graded
}

export function markTotalSub(spec: SubjectSpec): number {
  return (spec.mark ?? []).reduce((s, g) => s + g.subCount, 0)
}

export function markAnswerable(spec: SubjectSpec): number {
  return (spec.mark ?? []).reduce((s, g) => s + (g.pickCount ?? g.subCount), 0)
}

// ── 足切り (블록별 최소 정답 요건) ──────────────────────────────────
// 시공관리 1급 一次의 応用能力 6問중 3問 이상이 대표 사례.
// 총점이 합격선을 넘어도 이 요건을 못 채우면 불합격이라 별도로 본다.
export const MIN_CORRECT: Record<string, Record<string, number>> = {
  // exam slug → 블록 label → 최소 정답수
  sekokan1: { '応用能力': 3 },
}

export type CutCheck = { label: string; need: number; got: number; ok: boolean }

export function cutChecks(examSlug: string, spec: SubjectSpec, groupSubs: Result[][]): CutCheck[] {
  const rule = MIN_CORRECT[examSlug]
  if (!rule || !spec.mark) return []
  const out: CutCheck[] = []
  spec.mark.forEach((g, i) => {
    const need = rule[g.label]
    if (need === undefined) return
    const got = (groupSubs[i] ?? []).filter(r => r === 'correct').length
    out.push({ label: g.label, need, got, ok: got >= need })
  })
  return out
}

// 총점 + 足切り 모두 충족해야 합격
export function isPassed(examSlug: string, spec: SubjectSpec, score: number, groupSubs: Result[][]): boolean {
  if (score < spec.passMark) return false
  return cutChecks(examSlug, spec, groupSubs).every(c => c.ok)
}

// essay: 선택 문제 점수 상위 pickCount개 합
export type EssayAnswer = { q_num: number; selected: boolean; score: number | null }

export function essayScore(g: EssayGroup, answers: EssayAnswer[]): number {
  const picked = answers.filter(a => a.selected && a.score !== null)
    .map(a => a.score as number).sort((x, y) => y - x).slice(0, g.pickCount)
  return round1(picked.reduce((s, v) => s + v, 0))
}

export function essayPicked(answers: EssayAnswer[]): number {
  return answers.filter(a => a.selected).length
}

export function clampEssayScore(n: number, g: EssayGroup): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(g.perQ, Math.max(0, Math.round(n * 2) / 2))
}

export function normalizeSubs(subs: Result[], n: number): Result[] {
  const out = subs.slice(0, n)
  while (out.length < n) out.push(null)
  return out
}
