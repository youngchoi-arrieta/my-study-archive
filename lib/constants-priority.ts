// 주요 일정 및 우선순위 · 3층 보드
// -------------------------------------------------------------------
// 층은 입력하지 않는다. 항목과 경로 태그만 넣으면 자리가 정해진다.
// 손으로 층을 옮길 수 있게 만들면 결국 마인드맵과 같아진다.

export type PathStatus = 'active' | 'hold' | 'dropped'

export interface PrPath {
  id: string
  label: string
  status: PathStatus
  color: string
  note: string | null
  sort_order: number
}

export interface PrItem {
  id: string
  title: string
  note: string | null
  fixed: boolean
  daily: boolean
  expires_on: string | null
  decide_by: string | null
  done: boolean
  sort_order: number
}

export interface PrReview {
  id: string
  reviewed_on: string
  note: string | null
}

export const PATH_STATUS_ORDER: PathStatus[] = ['active', 'hold', 'dropped']

export const PATH_STATUS_META: Record<PathStatus, {
  label: string; short: string; chip: string; dot: string
}> = {
  active:  { label: '확정',  short: '확정', chip: 'bg-blue-600 text-white',    dot: 'bg-blue-400' },
  hold:    { label: '보류',  short: '보류', chip: 'bg-gray-700 text-gray-200', dot: 'bg-gray-500' },
  dropped: { label: '접음',  short: '접음', chip: 'bg-red-900 text-red-300',   dot: 'bg-red-800' },
}

// ── 층 ─────────────────────────────────────────────────────────────
export type Layer = 'fixed' | 'expiring' | 'shared' | 'single' | 'orphan' | 'daily'

export const LAYER_META: Record<Layer, {
  n: string; label: string; blurb: string; accent: string
}> = {
  fixed: {
    n: '0', label: '경계조건',
    blurb: '우선순위 대상이 아니라 나머지를 푸는 조건. 여기 있는 것은 배경으로만 둔다.',
    accent: 'text-gray-500',
  },
  expiring: {
    n: '1', label: '시효',
    blurb: '지금이 아니면 사라지는 것. 만료일보다 결정시점이 중요하다.',
    accent: 'text-amber-400',
  },
  shared: {
    n: '2', label: '공통분모',
    blurb: '여러 경로에 동시에 쓰이는 것. 아무것도 확정 못 한 달에도 이 칸은 굴린다.',
    accent: 'text-blue-400',
  },
  single: {
    n: '3', label: '단일용도',
    blurb: '경로 하나에만 쓰이는 것. 그 경로가 확정되기 전까지는 잠가둔다.',
    accent: 'text-gray-500',
  },
  orphan: {
    n: '·', label: '미분류',
    blurb: '경로를 하나도 안 달았다. 어디에 쓰는지 모르는 채로 굴리고 있다는 뜻이다.',
    accent: 'text-red-400',
  },
  daily: {
    n: '—', label: '축적 트랙',
    blurb: '위 네 층과 자원을 다투지 않는다. 자격은 하나 — 매일 20분으로 성립하는가.',
    accent: 'text-green-400',
  },
}

/** 2층으로 올라가는 최소 걸침 수 */
export const SHARED_MIN = 2

/**
 * 살아있는 경로 수. 접은 경로는 세지 않는다.
 * 그래야 경로 하나를 접었을 때 2층 항목이 3층으로 내려앉는 게 보인다.
 */
export function liveCount(
  itemId: string,
  links: { item_id: string; path_id: string }[],
  paths: PrPath[],
): number {
  const alive = new Set(paths.filter(p => p.status !== 'dropped').map(p => p.id))
  return links.filter(l => l.item_id === itemId && alive.has(l.path_id)).length
}

/** 층은 계산된다. 순서가 곧 규칙이다. */
export function layerOf(item: PrItem, live: number): Layer {
  if (item.daily) return 'daily'
  if (item.fixed) return 'fixed'
  if (item.expires_on || item.decide_by) return 'expiring'
  if (live >= SHARED_MIN) return 'shared'
  if (live === 1) return 'single'
  return 'orphan'
}

/**
 * 3층 항목의 잠금 상태.
 *   open   경로가 확정됐다 → 지금 해도 된다
 *   locked 아직 보류 중이다 → 확정 전엔 손대지 않는다
 *   sunk   경로를 접었다 → 매몰
 */
export type LockState = 'open' | 'locked' | 'sunk'

export function lockOf(
  itemId: string,
  links: { item_id: string; path_id: string }[],
  paths: PrPath[],
): LockState {
  const mine = links.filter(l => l.item_id === itemId).map(l => l.path_id)
  const st = paths.filter(p => mine.includes(p.id)).map(p => p.status)
  if (st.some(s => s === 'active')) return 'open'
  if (st.length > 0 && st.every(s => s === 'dropped')) return 'sunk'
  return 'locked'
}

// ── 날짜 ───────────────────────────────────────────────────────────
export const todayStr = () => new Date().toISOString().slice(0, 10)

export function dday(d: string | null): number | null {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - new Date(todayStr()).getTime()) / 86400000)
}

export function ddayLabel(n: number | null): string {
  if (n === null) return ''
  if (n === 0) return 'D-DAY'
  return n > 0 ? `D-${n}` : `D+${-n}`
}

// ── 월간 점검 ──────────────────────────────────────────────────────
export interface Flags {
  overdue: number      // 결정시점이 지났는데 그대로 있는 것
  undecided: number    // 만료일은 있는데 결정시점이 비어 있는 것
  locked: number       // 3층에 잠겨 있는 것
  orphan: number       // 경로가 안 달린 것
  daysSinceReview: number | null
}

export function collectFlags(
  items: PrItem[],
  links: { item_id: string; path_id: string }[],
  paths: PrPath[],
  lastReview: string | null,
): Flags {
  const live = items.filter(i => !i.done)
  let overdue = 0, undecided = 0, locked = 0, orphan = 0
  for (const it of live) {
    const l = layerOf(it, liveCount(it.id, links, paths))
    if (l === 'expiring') {
      const d = dday(it.decide_by)
      if (d !== null && d < 0) overdue++
      if (!it.decide_by && it.expires_on) undecided++
    }
    if (l === 'single' && lockOf(it.id, links, paths) === 'locked') locked++
    if (l === 'orphan') orphan++
  }
  const daysSinceReview = lastReview
    ? Math.floor((new Date(todayStr()).getTime() - new Date(lastReview).getTime()) / 86400000)
    : null
  return { overdue, undecided, locked, orphan, daysSinceReview }
}

// ── 시범 데이터 ────────────────────────────────────────────────────
// 보드가 비어 있을 때만 한 번 넣는 용도. 프레임이 안 맞으면 지우면 된다.

export const SEED_PATHS: Omit<PrPath, 'note'>[] = [
  { id: 'kps',    label: '한전KPS · 공기업', status: 'hold', color: '#f472b6', sort_order: 1 },
  { id: 'minkan', label: '민간 전기직',      status: 'hold', color: '#fb923c', sort_order: 2 },
  { id: 'knu',    label: '경북대 편입',      status: 'hold', color: '#a78bfa', sort_order: 3 },
  { id: 'japan',  label: '일본',            status: 'hold', color: '#60a5fa', sort_order: 4 },
  { id: 'canada', label: '캐나다',          status: 'hold', color: '#34d399', sort_order: 5 },
]

export interface SeedItem {
  title: string
  note?: string
  fixed?: boolean
  daily?: boolean
  expires_on?: string
  decide_by?: string
  paths: string[]
}

export const SEED_ITEMS: SeedItem[] = [
  // 0층 — 경계조건. 날짜가 밖에서 온다.
  { title: 'F6 비자 소득요건', note: '통제 가능한 부분만 적을 것', fixed: true, paths: [] },
  { title: '아내 합류 시기 · 항공권', fixed: true, paths: [] },
  { title: '9월 중순 거주지', fixed: true, paths: [] },

  // 1층 — 시효. 결정시점은 일부러 비워둔 것이 있다.
  { title: '캐나다 워홀 초청장', note: '만료일과 결정시점이 다르다', expires_on: '2027-05-31', paths: ['canada'] },
  { title: '덴켄 3종 다음 회차', expires_on: '2027-03-31', paths: ['japan'] },
  { title: 'JLPT N4 12월 회차', expires_on: '2026-12-06', paths: ['japan'] },
  { title: '한전KPS 공고', paths: ['kps'], decide_by: '2026-10-31' },
  { title: '경북대 편입 원서', paths: ['knu'], decide_by: '2026-11-30' },

  // 2층 — 공통분모. 지도에서 "포폴 병목" 한 줄이던 것.
  { title: '전기 실무 포트폴리오', note: '민간 · 공기업 · 일본에 모두 쓰인다', paths: ['kps', 'minkan', 'japan'] },
  { title: '전기기사 실무 이력 만들기', paths: ['kps', 'minkan', 'canada'] },

  // 3층 — 단일용도. 경로가 확정되기 전엔 잠긴다.
  { title: 'NCS', paths: ['kps'] },
  { title: '한국사 · IT 가점', paths: ['kps'] },
  { title: 'C언어', paths: ['knu'] },
  { title: '논리회로', paths: ['knu'] },
  { title: '공조냉동기사', note: '데이터센터 설비보전', paths: ['minkan'] },
  { title: '전기공사사 1·2종 도식', paths: ['japan'] },
  { title: 'Automation technician 조사', paths: ['canada'] },

  // 옆줄 — 매일 20분으로 성립하는 것만.
  { title: '체력 · 수면', note: '나머지 셋을 굴리는 연료', daily: true, paths: [] },
  { title: '일본어 감각 유지', daily: true, paths: ['japan'] },
]
