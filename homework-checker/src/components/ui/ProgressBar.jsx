import styles from './ProgressBar.module.css'

export default function ProgressBar({ value = 0, max = 100, color = 'blue', label, showPercent = false, height = 8 }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className={styles.wrapper}>
      {(label || showPercent) && (
        <div className={styles.meta}>
          {label && <span className={styles.label}>{label}</span>}
          {showPercent && <span className={styles.pct}>{Math.round(pct)}%</span>}
        </div>
      )}
      <div className={styles.track} style={{ height }}>
        <div className={[styles.fill, styles[color]].join(' ')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
