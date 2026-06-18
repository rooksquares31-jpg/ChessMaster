import styles from './Select.module.css'

export default function Select({ label, error, options = [], className = '', id, required, ...props }) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-')
  return (
    <div className={[styles.wrapper, className].join(' ')}>
      {label && (
        <label htmlFor={selectId} className={styles.label}>
          {label}{required && <span className={styles.required}>*</span>}
        </label>
      )}
      <select id={selectId} className={[styles.select, error ? styles.errored : ''].join(' ')} {...props}>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}
