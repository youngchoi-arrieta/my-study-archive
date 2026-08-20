// ═══════════════════════════════════════════════════════════════
//  JLPT 교재 상태
//
//  3단 축(진행중/예정/완료) 자체는 공기업 교재 트래커와 공유하므로
//  lib/constants-book-status.ts 로 옮겼다. 여기는 재수출만 한다.
//  (기존 import 경로를 그대로 살리기 위한 얇은 껍데기)
// ═══════════════════════════════════════════════════════════════

export type { BookStatus } from './constants-book-status'
export {
  BOOK_STATUS_ORDER,
  BOOK_STATUS_META,
  BOOK_STATUS_NEXT,
  BOOK_COLORS,
  normalizeBookStatus,
} from './constants-book-status'
