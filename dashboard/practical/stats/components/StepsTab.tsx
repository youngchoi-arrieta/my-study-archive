import { fmtTime, type Session, type Step } from '@/lib/constants-practical'
import styles from '../page.module.css'

type StepWithAvg = Step & { avg: number }

type Props = {
  filtered: Session[]
  stepAvg: StepWithAvg[]
}

export default function StepsTab({ filtered, stepAvg }: Props) {
  if (filtered.length === 0) return null

  return (
    <div className={styles.stepStatList}>
      {stepAvg.map((s, i) => {
        const ratio = s.avg > 0 ? s.avg / s.target : 0
        const barColor = ratio > 1 ? 'var(--red)' : ratio > 0.85 ? 'var(--yellow)' : 'var(--green)'
        return (
          <div key={i} className={styles.stepStatCard}>
            <div className={styles.stepStatTop}>
              <span className={styles.stepStatName}>{s.name}</span>
              <span className={styles.stepStatTimes}>
                목표 {fmtTime(s.target)} | 평균{' '}
                <span style={{ color: ratio > 1 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>
                  {s.avg ? fmtTime(s.avg) : '-'}
                </span>
              </span>
            </div>
            {s.avg > 0 && (
              <div className={styles.bar}>
                <div className={styles.barFill} style={{ width: `${Math.min(ratio * 100, 100)}%`, background: barColor }} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
