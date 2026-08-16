// ═══════════════════════════════════════════════════════════════
//  자격증 레지스트리
//
//  홈은 「국가」가 아니라 「상태」를 축으로 잡는다.
//    active  진행 중  → 큰 카드
//    planned 예정     → 한 줄 압축 행
//    done    취득 완료 → 최소 행 (아카이브)
//
//  여기 defaultStatus 는 초기값일 뿐이고, 실제 상태는 Supabase
//  cert_status 테이블이 덮어쓴다(홈에서 직접 변경). 시험을 추가할
//  때만 이 배열에 한 줄 넣으면 된다.
// ═══════════════════════════════════════════════════════════════

export type CertStatus = 'active' | 'planned' | 'done'
export type Flag = '🇯🇵' | '🇰🇷'

export const STATUS_ORDER: CertStatus[] = ['active', 'planned', 'done']

export const STATUS_META: Record<CertStatus, { label: string; short: string; sub: string; chip: string }> = {
  active: {
    label: '📋 진행 중', short: '진행 중', sub: '지금 붙잡고 있는 것',
    chip: 'bg-blue-600/30 text-blue-400',
  },
  planned: {
    label: '🗂 예정', short: '예정', sub: '자리만 잡아둔 것 · 필요할 때 연다',
    chip: 'bg-gray-700/50 text-gray-400',
  },
  done: {
    label: '✅ 취득 완료', short: '취득', sub: '아카이브',
    chip: 'bg-green-900/50 text-green-400',
  },
}

export interface Cert {
  /** DB 키 — 절대 바꾸지 말 것 */
  slug: string
  href: string
  emoji: string
  flag: Flag
  org: string
  title: string
  /** 진행 중 카드에 쓰는 설명 */
  desc: string
  /** 예정 행에 쓰는 한 줄 정보 */
  meta: string
  defaultStatus: CertStatus
}

export const CERTS: Cert[] = [
  {
    slug: 'jlpt', href: '/dashboard/jlpt-n4', emoji: '🗣', flag: '🇯🇵',
    org: '일본어능력시험 · 목표 N2', title: 'JLPT',
    desc: '교재 진도 · 채굴 예문 플래시카드', meta: '연 2회 · N5→N3 단계 상승',
    defaultStatus: 'active',
  },
  {
    slug: 'denken3', href: '/dashboard/denken', emoji: '🏭', flag: '🇯🇵',
    org: '일본 경제산업성', title: '電験三種',
    desc: '20개년 기출 · 과목별 오답메모', meta: '연 2회 · 4과목 각 60점',
    defaultStatus: 'active',
  },
  {
    slug: 'denken12', href: '/dashboard/denken12', emoji: '🗼', flag: '🇯🇵',
    org: '일본 경제산업성', title: '電験一種・二種',
    desc: '一次 4과목 · 二次 記述式', meta: '연 1회 · 一次 4과목 / 二次 記述式',
    defaultStatus: 'active',
  },
  {
    slug: 'enekan', href: '/dashboard/exam/enekan', emoji: '⚡', flag: '🇯🇵',
    org: '일본 경제산업성', title: 'エネルギー管理士 (전기)',
    desc: '4과목 각 60%', meta: '연 1회 · 4과목 각 60%',
    defaultStatus: 'planned',
  },
  {
    slug: 'sekokan1', href: '/dashboard/exam/sekokan1', emoji: '🏗', flag: '🇯🇵',
    org: '일본 국토교통성', title: '1級電気工事施工管理技士',
    desc: '一次 足切り · 二次 経験記述', meta: '연 1회 · 一次 足切り / 二次 経験記述',
    defaultStatus: 'planned',
  },
  {
    slug: 'koutan', href: '/dashboard/exam/koutan', emoji: '🔗', flag: '🇯🇵',
    org: '일본 총무성', title: '工事担任者 (総合通信)',
    desc: '3과목 각 60점', meta: '연 2회 · 3과목 각 60점',
    defaultStatus: 'planned',
  },
  {
    slug: 'dentsu-shunin', href: '/dashboard/exam/dentsu-shunin', emoji: '📡', flag: '🇯🇵',
    org: '일본 총무성', title: '電気通信主任技術者',
    desc: '伝送交換 · 設備', meta: '연 2회 · 伝送交換 · 設備 150점중 90점',
    defaultStatus: 'planned',
  },
  {
    slug: 'gijutsushi', href: '/dashboard/exam/gijutsushi', emoji: '🎌', flag: '🇯🇵',
    org: '일본 문부과학성', title: '技術士 1차 (電気電子)',
    desc: '3과목 각 50%', meta: '연 1회 · 3과목 각 50%',
    defaultStatus: 'planned',
  },
  {
    slug: 'koreapub', href: '/dashboard/koreapub', emoji: '🏛', flag: '🇰🇷',
    org: '한국 공기업 전기직', title: '공기업 채용',
    desc: '기업별 가점 구조 · 서류점수 · NCS/전공',
    meta: '기업별 상시 · NCS + 전공',
    defaultStatus: 'planned',
  },
  {
    slug: 'gosi', href: '/dashboard/exam/gosi', emoji: '🎓', flag: '🇰🇷',
    org: '인사혁신처', title: '기술고시 전기직',
    desc: '2차 논술 3과목', meta: '5급 공채 · 2차 논술 3과목',
    defaultStatus: 'planned',
  },
  {
    slug: 'denkoshi-jitsugi', href: '/dashboard/denkoshi/jitsugi', emoji: '🔌', flag: '🇯🇵',
    org: '일본 경제산업성', title: '第二種電気工事士 실기',
    desc: '후보문제 · 작업 체크리스트', meta: '연 2회 · 候補問題 13문제',
    defaultStatus: 'done',
  },
  {
    slug: 'denkoshi-gakka', href: '/dashboard/denkoshi', emoji: '🗾', flag: '🇯🇵',
    org: '일본 경제산업성', title: '第二種電気工事士 학과',
    desc: '기출 · 단원별 정리', meta: '연 2회 · 50문제 중 30문제',
    defaultStatus: 'done',
  },
  {
    slug: 'kr-gisa', href: '/dashboard', emoji: '⚡', flag: '🇰🇷',
    org: '한국산업인력공단', title: '전기기사 실기',
    desc: '아카이브', meta: '연 3회 · 필답형',
    defaultStatus: 'done',
  },
  {
    slug: 'kr-gineungsa', href: '/dashboard', emoji: '🔧', flag: '🇰🇷',
    org: '한국산업인력공단', title: '전기기능사 실기',
    desc: '아카이브', meta: '연 4회 · 작업형',
    defaultStatus: 'done',
  },
]

export interface CertStatusRow {
  slug: string
  status: CertStatus
  sort: number | null
}

/** 기본값 + DB 덮어쓰기를 합쳐 slug → 상태 맵으로 */
export function resolveStatuses(overrides: CertStatusRow[]): Record<string, CertStatus> {
  const map: Record<string, CertStatus> = {}
  CERTS.forEach(c => { map[c.slug] = c.defaultStatus })
  overrides.forEach(o => {
    if (map[o.slug] !== undefined && STATUS_ORDER.includes(o.status)) map[o.slug] = o.status
  })
  return map
}

export const certsWith = (map: Record<string, CertStatus>, s: CertStatus) =>
  CERTS.filter(c => map[c.slug] === s)
