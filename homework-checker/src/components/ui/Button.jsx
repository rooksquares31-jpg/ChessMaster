import styles from './Button.module.css'

const variants = { primary: 'primary', secondary: 'secondary', ghost: 'ghost', danger: 'danger', success: 'success' }
const sizes = { sm: 'sm', md: 'md', lg: 'lg' }

export default function Button({
  children, variant = 'primary', size = 'md',
  loading = false, disabled = false, icon, iconRight,
  className = '', onClick, type = 'button', fullWidth = false, ...rest
}) {
  return (
    <button
      type={type}
      className={[
        styles.btn,
        styles[variants[variant] || 'primary'],
        styles[sizes[size] || 'md'],
        fullWidth ? styles.full : '',
        loading ? styles.loading : '',
        className,
      ].join(' ')}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : icon ? (
        <span className={styles.iconLeft}>{icon}</span>
      ) : null}
      <span>{children}</span>
      {iconRight && !loading && <span className={styles.iconRight}>{iconRight}</span>}
    </button>
  )
}
