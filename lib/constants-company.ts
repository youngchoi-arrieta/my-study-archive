// 회사생활 섹션 공용 상수
// 컴포넌트들이 이 메타를 공유한다. 시드 자체는 supabase/company_migration.sql.

export type CoTab = 'today' | 'journal' | 'schedule' | 'compass' | 'portfolio' | 'people'

export const CO_TABS: { key: CoTab; label: string }[] = [
  { key: 'today', label: '🌅 오늘' },
  { key: 'journal', label: '📓 업무일지' },
  { key: 'schedule', label: '🗓 업무일정' },
  { key: 'compass', label: '🧭 나침반' },
  { key: 'portfolio', label: '🗂 포트폴리오' },
  { key: 'people', label: '🔒 사람' },
]

// ── 오늘 탭: co_items 그룹 ──────────────────────────────
export const ITEM_GROUPS = {
  north: { label: '북극성 — 단 하나의 기준', mode: 'remind' as const },
  prep: { label: '위생 · 준비', mode: 'check' as const },
  avoid: { label: '하지 말 것', mode: 'remind' as const },
  strive: { label: '하려 할 것', mode: 'remind' as const },
} as const
export type ItemGrp = keyof typeof ITEM_GROUPS

// ── 저녁 반성: 삼분법 ───────────────────────────────────
export const LOCUS = [
  { key: 'mine', label: '내 몫', color: '#f0997b' },
  { key: 'half', label: '반반', color: '#e0b341' },
  { key: 'theirs', label: '남의 몫', color: '#5dcaa5' },
] as const

// ── 업무일지: kind ─────────────────────────────────────
export const JOURNAL_KINDS = [
  { key: '지시', color: '#f472b6' },
  { key: '상호작용', color: '#85b7eb' },
  { key: '관찰', color: '#a78bfa' },
  { key: '메모', color: '#94a3b8' },
] as const

// ── 업무일정 간트: track ────────────────────────────────
export type CoTrack = 'onboard' | 'project' | 'delivery' | 'trip' | 'review' | 'etc'
export const CO_TRACKS: { key: CoTrack; label: string; color: string }[] = [
  { key: 'onboard', label: '온보딩', color: '#5dcaa5' },
  { key: 'project', label: '프로젝트', color: '#85b7eb' },
  { key: 'delivery', label: '납기 · 시운전', color: '#f0997b' },
  { key: 'trip', label: '출장', color: '#a78bfa' },
  { key: 'review', label: '평가 · 면담', color: '#e0b341' },
  { key: 'etc', label: '기타', color: '#94a3b8' },
]

// ── 목표 이력서: section / status / tag ─────────────────
export const RESUME_SECTIONS = [
  { key: 'output', label: '연구 · 오픈소스 산출물' },
  { key: 'field', label: '현장 · 실무 경험' },
  { key: 'cert', label: '자격' },
  { key: 'education', label: '정규 교육 이수' },
  { key: 'narrative', label: '학력 · 서사' },
] as const

export const RESUME_STATUS = {
  done: { mark: '✓', label: '확보', color: '#5dcaa5' },
  progress: { mark: '◐', label: '구축 중', color: '#e0b341' },
  target: { mark: '○', label: '목표', color: '#6b7280' },
} as const
export type ResumeStatus = keyof typeof RESUME_STATUS
export const RESUME_STATUS_CYCLE: ResumeStatus[] = ['target', 'progress', 'done']

export const RESUME_TAGS = {
  scholar: { label: '장학-서사', color: '#85b7eb' },
  life: { label: '생활', color: '#94a3b8' },
} as const

// ── 포트폴리오: 산출물 kind ─────────────────────────────
export const OUTPUT_KINDS = ['오픈소스', '문서', '테스트벤치', '기타'] as const
export const WATCH_LAYERS = ['제조', 'EPC', '운영', '정책'] as const

// 사람 탭 잠금 PIN. 화면 힐끗·자리비움 대비의 얇은 자물쇠.
// 규율(회사에서 안 열기)에 기댄 안전이라 강한 암호화는 아님 — 편할 때 바꿔 쓸 것.
export const PEOPLE_PIN = '0402'
