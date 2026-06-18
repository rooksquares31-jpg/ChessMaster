import styles from './Steps.module.css'

const OPTIONS = [5, 10, 15, 20, 25, 30, 40, 50]

export default function Step2Positions({ count, setCount }) {
  return (
    <div className={styles.step}>
      <h2 className={styles.stepTitle}>Number of Positions</h2>
      <p className={styles.stepDesc}>How many chess positions should this homework contain?</p>

      <div className={styles.countGrid}>
        {OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            className={[styles.countCard, count === n ? styles.countActive : ''].join(' ')}
            onClick={() => setCount(n)}
          >
            <span className={styles.countNum}>{n}</span>
            <span className={styles.countSub}>positions</span>
          </button>
        ))}
      </div>

      <div className={styles.customCount}>
        <label className={styles.label}>Or enter a custom number:</label>
        <div className={styles.customRow}>
          <input
            type="number"
            min={1}
            max={100}
            className={styles.customInput}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
          />
          <span className={styles.customSub}>positions (max 100)</span>
        </div>
      </div>

      <div className={styles.posInfo}>
        <div className={styles.posInfoCard}>
          <strong>{count}</strong> position cards will be generated in the next step.
          You can set unique FEN, correct move, explanation, and points for each one.
        </div>
      </div>
    </div>
  )
}
