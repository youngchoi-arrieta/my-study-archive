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
    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: 20, background: '#fff' }}>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16, fontFamily: 'var(--font-sans)' }}>
        🔒 주어진 신호 &nbsp;·&nbsp; ✏️ 클릭해서 ON/OFF를 채우세요
      </p>

      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
        {/* 축 라벨 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
          <div style={{ width: 90, flexShrink: 0 }} />
          <div style={{ width: 24, flexShrink: 0 }} />
          {stepLabels.map((l, i) => (
            <div key={i} style={{ width: 44, fontSize: 10, color: '#9ca3af', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{l}</div>
          ))}
        </div>

        {signals.map((sig, si) => (
          <div key={si} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ width: 90, fontSize: 12, fontWeight: 500, color: '#374151', textAlign: 'right', paddingRight: 10, flexShrink: 0 }}>
              {sig.label}
            </div>
            <div style={{ width: 24, fontSize: 12, color: '#9ca3af', flexShrink: 0, textAlign: 'center' }}>
              {sig.locked ? '🔒' : '✏️'}
            </div>
            {Array.from({ length: steps }, (_, ti) => {
              const key = `${si}-${ti}`
              const isOn = sig.locked ? sig.pattern[ti] === 1 : !!answers[key]
              const prevOn = sig.locked ? sig.pattern[ti - 1] === 1 : !!answers[`${si}-${ti - 1}`]

              let bg = isOn
                ? (sig.locked ? '#bbf7d0' : '#dcfce7')
                : '#f9fafb'

              if (checked && !sig.locked) {
                const correct = (isOn ? 1 : 0) === sig.pattern[ti]
                if (!correct) bg = isOn ? '#fee2e2' : '#fff1f2'
              }

              const borderColor = sig.locked ? '#d1fae5' : '#e5e7eb'
              const borderStyle = sig.locked ? 'solid' : 'dashed'

              return (
                <div
                  key={ti}
                  onClick={() => !sig.locked && toggle(si, ti)}
                  style={{
                    width: 44, height: 32, background: bg,
                    borderTop: `1px ${borderStyle} ${borderColor}`,
                    borderBottom: `1px ${borderStyle} ${borderColor}`,
                    borderRight: `1px ${borderStyle} ${borderColor}`,
                    borderLeft: ti === 0 ? `1px ${borderStyle} ${borderColor}` : 'none',
                    cursor: sig.locked ? 'default' : 'pointer',
                    position: 'relative', transition: 'background .1s',
                  }}
                >
                  {isOn && (
                    <div style={{ position: 'absolute', top: 5, left: 0, right: 0, height: 2.5, background: sig.locked ? '#16a34a' : '#22c55e', borderRadius: 1 }} />
                  )}
                  {isOn && !prevOn && (
                    <div style={{ position: 'absolute', top: 5, left: 0, width: 2.5, height: '62%', background: sig.locked ? '#16a34a' : '#22c55e' }} />
                  )}
                  {!isOn && prevOn && (
                    <div style={{ position: 'absolute', top: 5, left: 0, width: 2.5, height: '62%', background: sig.locked ? '#16a34a' : '#22c55e' }} />
                  )}
                </div>
              )
            })}
          </div>
        ))}

        {/* 시간 축 */}
        <div style={{ display: 'flex', marginTop: 6 }}>
          <div style={{ width: 114, flexShrink: 0 }} />
          {stepLabels.map((l, i) => (
            <div key={i} style={{ width: 44, fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>{l}</div>
          ))}
          <div style={{ fontSize: 10, color: '#9ca3af', paddingLeft: 4 }}>t →</div>
        </div>
      </div>
    </div>
  )
}
