// ═══════════════════════════════════════════════════════════════
//  교재 상태 — 3단 축 (공용)
//
//  원래 JLPT 교재 전용(lib/constants-jlpt-books.ts)이었는데,
//  공기업 교재 트래커도 같은 축을 쓰게 되면서 여기로 뽑아냈다.
//  JLPT 쪽은 이 파일을 재수출만 하므로 기존 import는 그대로 산다.
//
//    active  진행 중 → 큰 카드 (진도 바까지 보인다)
//    planned 예정    → 한 줄 압축 행 (사두었지만 아직 안 여는 것)
//    done    완료    → 최소 행 (아카이브)
//
//  저장 위치
//    JLPT   jp_books.status   (supabase/jp_books_status_migration.sql)
//    공기업 kp_books.status   (supabase/koreapub_ncs_books_migration.sql)
// ═══════════════════════════════════════════════════════════════

export type BookStatus = 'active' | 'planned' | 'done'

export const BOOK_STATUS_ORDER: BookStatus[] = ['active', 'planned', 'done']

export const BOOK_STATUS_META: Record<
  BookStatus,
  { label: string; short: string; sub: string; chip: string }
> = {
  active: {
    label: '📖 진행 중',
    short: '진행중',
    sub: '지금 실제로 펴고 있는 교재',
    chip: 'bg-blue-600/30 text-blue-400',
  },
  planned: {
    label: '🗂 예정',
    short: '예정',
    sub: '자리만 잡아둔 것 · 필요할 때 연다',
    chip: 'bg-gray-700/50 text-gray-400',
  },
  done: {
    label: '✅ 완료',
    short: '완료',
    sub: '한 바퀴 끝낸 교재 · 아카이브',
    chip: 'bg-green-900/50 text-green-400',
  },
}

/** 칩을 누르면 진행중 → 예정 → 완료 → 진행중 으로 순환 */
export const BOOK_STATUS_NEXT: Record<BookStatus, BookStatus> = {
  active: 'planned',
  planned: 'done',
  done: 'active',
}

/** 마이그레이션 전 데이터(status 없음)나 오타를 진행중으로 흡수 */
export function normalizeBookStatus(v: unknown): BookStatus {
  return BOOK_STATUS_ORDER.includes(v as BookStatus) ? (v as BookStatus) : 'active'
}

/** 교재 색 팔레트 — JLPT·공기업이 같은 걸 쓴다 */
export const BOOK_COLORS = ['#2563eb', '#7c3aed', '#059669', '#b45309', '#db2777', '#0891b2']
