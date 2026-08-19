'use client'

import { BookStatus, BOOK_STATUS_META } from '@/lib/constants-jlpt-books'

// 교재 상태 칩 — JLPT 허브와 교재 목록이 같은 것을 쓴다.
// 두 화면에 각각 만들어두면 한쪽만 고치는 사고가 반드시 난다.
export default function BookStatusChip({ status, onCycle, size = 'md' }: {
  status: BookStatus
  onCycle: () => void
  size?: 'sm' | 'md'
}) {
  const m = BOOK_STATUS_META[status]
  return (
    <button
      onClick={e => { e.preventDefault(); e.stopPropagation(); onCycle() }}
      title="눌러서 상태 바꾸기 (진행중 → 예정 → 완료)"
      className={`shrink-0 rounded-full font-bold transition hover:brightness-125 ${m.chip} ${
        size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
      }`}
    >
      {m.short}
    </button>
  )
}
