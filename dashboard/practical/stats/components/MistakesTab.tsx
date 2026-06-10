import styles from '../page.module.css'

type Props = {
  topMistakes: [string, number][]
}

export default function MistakesTab({ topMistakes }: Props) {
  if (topMistakes.length === 0) {
    return <div className={styles.empty}>기록된 실수가 없어요 🎉</div>
  }

  return (
    <div className={styles.mistakeStatList}>
      {topMistakes.map(([m, cnt], i) => (
        <div key={i} className={styles.mistakeStatRow}>
          <span className={styles.mistakeRank}>#{i + 1}</span>
          <span className={styles.mistakeName}>{m}</span>
          <div className={styles.mistakeBarWrap}>
            <div className={styles.mistakeBar}>
              <div className={styles.mistakeBarFill} style={{ width: `${(cnt / topMistakes[0][1]) * 100}%` }} />
            </div>
            <span className={styles.mistakeCnt}>{cnt}회</span>
          </div>
        </div>
      ))}
    </div>
  )
}
