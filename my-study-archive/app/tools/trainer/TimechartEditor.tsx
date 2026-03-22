'use client'

import type { Problem } from '@/types/trainer'

interface Props {
  problem: Problem
  answers: Record<string, 0 | 1>
  setAnswers: (a: Record<string, 0 | 1>) => void
  checked: boolean
}

export default function TimechartEditor({ problem, answers, setAnswers, checked }: Props) {
  const { steps, stepLabels, signals } = problem.timechart

  const toggle = (si: number, ti: number) => {
    if (checked) return
    const key = `${si}-${ti}`
    setAnswers({ ...answers, [key]: answers[key] ? 0 : 1 })
  }

  return (
    <div className="flex-1 overflow-auto p-4 bg-gray-950">
      <p className="text-gray-500 mb-4" style={{ fontSize: 11 }}>
        🔒 주어진 신호 · ✏️ 빈 신호 — 구간 클릭으로 ON/OFF 토글
      </p>

      <div className="inline-flex flex-col gap-0" style={{ minWidth: '100%' }}>
        {/* 축 라벨 */}
        <div className="flex items-center mb-1">
          <div style={{ width: 90, flexShrink: 0 }} />
          <div style={{ width: 28, flexShrink: 0 }} />
          {stepLabels.map((l, i) => (
            <div key={i} style={{ width: 44, fontSize: 9, color: '#6b7280', textAlign: 'center' }}>{l}</div>
          ))}
        </div>

        {signals.map((sig, si) => (
          <div key={si} className="flex items-center mb-1">
            {/* 라벨 */}
            <div style={{ width: 90, fontSize: 11, fontWeight: 500, color: '#9ca3af', textAlign: 'right', paddingRight: 10, flexShrink: 0 }}>
              {sig.label}
            </div>
            <div style={{ width: 28, fontSize: 11, color: '#6b7280', flexShrink: 0, textAlign: 'center' }}>
              {sig.locked ? '🔒' : '✏️'}
            </div>

            {/* 셀들 */}
            {Array.from({ length: steps }, (_, ti) => {
              const key = `${si}-${ti}`
              const isOn = sig.locked ? sig.pattern[ti] === 1 : !!answers[key]
              const prevOn = sig.locked ? sig.pattern[ti - 1] === 1 : !!answers[`${si}-${ti - 1}`]

              let bg = isOn
                ? (sig.locked ? '#065f46' : '#064e3b')
                : '#111827'

              if (checked && !sig.locked) {
                const correct = (isOn ? 1 : 0) === sig.pattern[ti]
                if (!correct) bg = isOn ? '#450a0a' : '#1c0a0a'
              }

              const borderColor = sig.locked ? '#1f2937' : '#374151'

              return (
                <div key={ti} onClick={() => !sig.locked && toggle(si, ti)}
                  style={{
                    width: 44, height: 28, background: bg,
                    borderTop: `0.5px solid ${borderColor}`,
                    borderBottom: `0.5px solid ${borderColor}`,
                    borderRight: `0.5px solid ${borderColor}`,
                    borderLeft: ti === 0 ? `0.5px solid ${borderColor}` : 'none',
                    borderStyle: sig.locked ? 'solid' : 'dashed',
                    cursor: sig.locked ? 'default' : 'pointer',
                    position: 'relative', transition: 'background .1s',
                  }}>
                  {/* 상단 파형선 */}
                  {isOn && (
                    <div style={{ position: 'absolute', top: 4, left: 0, right: 0, height: 2, background: sig.locked ? '#34d399' : '#10b981', borderRadius: 1 }} />
                  )}
                  {/* 상승/하강 엣지 */}
                  {isOn && !prevOn && (
                    <div style={{ position: 'absolute', top: 4, left: 0, width: 2, height: '70%', background: sig.locked ? '#34d399' : '#10b981' }} />
                  )}
                  {!isOn && prevOn && (
                    <div style={{ position: 'absolute', top: 4, left: 0, width: 2, height: '70%', background: sig.locked ? '#34d399' : '#10b981' }} />
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* 시간축 */}
        <div className="flex items-center mt-2">
          <div style={{ width: 118, flexShrink: 0 }} />
          {stepLabels.map((l, i) => (
            <div key={i} style={{ width: 44, fontSize: 9, color: '#4b5563', textAlign: 'center' }}>{l}</div>
          ))}
          <div style={{ fontSize: 9, color: '#4b5563', paddingLeft: 4 }}>t →</div>
        </div>
      </div>
    </div>
  )
}
