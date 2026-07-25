// 電験三種 복습 태깅 — 채점(정오)과 독립된 축
// -------------------------------------------------------------------
// 정오만으로는 복습 대상을 못 고른다.
//   · 맞았지만 찍었거나 근거가 흐린 문제 → 복습 필요
//   · 틀렸지만 원인이 명확하고 이미 이해한 문제 → 복습 불필요
// 그래서 정오와 별개로 사용자가 직접 표시하는 플래그를 둔다.
//
// 상태 순환: 없음 → 복습 필요(todo) → 복습 완료(done) → 없음

export type ReviewState = 'todo' | 'done' | null

export function cycleReview(r: ReviewState): ReviewState {
  return r === null ? 'todo' : r === 'todo' ? 'done' : null
}

export const REVIEW_META: Record<'todo' | 'done', {
  label: string; short: string; icon: string; color: string; bg: string; border: string
}> = {
  todo: {
    label: '복습 필요', short: '복습', icon: '🔖',
    color: '#fbbf24', bg: 'rgba(251,191,36,0.16)', border: 'rgba(251,191,36,0.45)',
  },
  done: {
    label: '복습 완료', short: '완료', icon: '✓',
    color: '#34d399', bg: 'rgba(52,211,153,0.14)', border: 'rgba(52,211,153,0.38)',
  },
}

export function isTodo(r: ReviewState): boolean { return r === 'todo' }
export function isDone(r: ReviewState): boolean { return r === 'done' }

// ── 허브 집계 ───────────────────────────────────────────────────────
export type ReviewCount = { todo: number; done: number }

export const EMPTY_REVIEW_COUNT: ReviewCount = { todo: 0, done: 0 }

export function addReview(c: ReviewCount, r: ReviewState): ReviewCount {
  if (r === 'todo') return { ...c, todo: c.todo + 1 }
  if (r === 'done') return { ...c, done: c.done + 1 }
  return c
}

export function totalReview(c: ReviewCount): number { return c.todo + c.done }

// 대기 건수 → 히트맵 강도 (0~1). 4건 이상이면 최대.
export const REVIEW_HEAT_MAX = 4

export function reviewHeat(todo: number): number {
  if (todo <= 0) return 0
  return Math.min(1, todo / REVIEW_HEAT_MAX)
}

// 히트맵 셀 배경 (호박색 계열, 대기 건수가 많을수록 진하게)
export function reviewHeatStyle(todo: number): { backgroundColor: string; borderColor: string } {
  const h = reviewHeat(todo)
  if (h === 0) return { backgroundColor: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.05)' }
  return {
    backgroundColor: `rgba(251,191,36,${0.10 + h * 0.32})`,
    borderColor: `rgba(251,191,36,${0.25 + h * 0.4})`,
  }
}
