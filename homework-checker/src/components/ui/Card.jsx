import styles from './Card.module.css'

export default function Card({ children, className = '', onClick, hover = false, glass = false, ...rest }) {
  return (
    <div
      className={[styles.card, hover ? styles.hover : '', glass ? styles.glass : '', onClick ? styles.clickable : '', className].join(' ')}
      onClick={onClick}
      {...rest}
    >
      {children}
    </div>
  )
}
