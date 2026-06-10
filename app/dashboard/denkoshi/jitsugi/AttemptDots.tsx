'use client'

import type { JitsugiAttempt } from '@/lib/constants-denkoshi-jitsugi'

// 한 문제의 회차별 합/불 dot. 오래된 → 최신 순.
export default function AttemptDots({
  attempts,
  size = 10,
}: {
  attempts: JitsugiAttempt[]   // 해당 문제의 attempts (정렬 무관, 내부에서 오래된순 정렬)
  size?: number
}) {
  const ordered = [...attempts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )

  if (ordered.length === 0) {
    return <span className="text-[11px] text-gray-600">미연습</span>
  }

  return (
    <span className="inline-flex items-center gap-1 flex-wrap">
      {ordered.map((a, i) => (
        <span
          key={a.id}
          title={`${i + 1}회차 · ${a.passed_self ? '합격' : '불합격'}`}
          style={{
            width: size, height: size, borderRadius: '50%',
            background: a.passed_self ? '#22c55e' : '#ef4444',
            display: 'inline-block',
          }}
        />
      ))}
    </span>
  )
}
