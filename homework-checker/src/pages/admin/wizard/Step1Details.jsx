import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import styles from './Steps.module.css'

const CATEGORIES = [
  { value: 'tactics', label: '⚡ Tactics' },
  { value: 'mate-in-one', label: '♟ Mate in One' },
  { value: 'mate-in-two', label: '♚ Mate in Two' },
  { value: 'opening', label: '📖 Opening' },
  { value: 'middlegame', label: '⚔️ Middlegame' },
  { value: 'endgame', label: '🏁 Endgame' },
  { value: 'strategy', label: '🎯 Strategy' },
  { value: 'calculation', label: '🧮 Calculation' },
]

const DIFFICULTIES = [
  { value: 'beginner', label: '🟢 Beginner' },
  { value: 'intermediate', label: '🟡 Intermediate' },
  { value: 'advanced', label: '🔴 Advanced' },
]

export default function Step1Details({ details, setDetails }) {
  const set = (field) => (e) => setDetails((d) => ({ ...d, [field]: e.target.value }))

  return (
    <div className={styles.step}>
      <h2 className={styles.stepTitle}>Homework Details</h2>
      <p className={styles.stepDesc}>Set the title, topic, category and schedule for this assignment.</p>

      <div className={styles.grid2}>
        <Input
          label="Homework Title"
          placeholder="e.g. Mate in One - Week 3"
          value={details.title}
          onChange={set('title')}
          required
        />
        <Input
          label="Topic / Theme"
          placeholder="e.g. Back rank mates, Pin tactics"
          value={details.topic}
          onChange={set('topic')}
        />
      </div>

      <div className={styles.grid2}>
        <Select
          label="Category"
          options={CATEGORIES}
          value={details.category}
          onChange={set('category')}
          required
        />
        <Select
          label="Difficulty"
          options={DIFFICULTIES}
          value={details.difficulty}
          onChange={set('difficulty')}
          required
        />
      </div>

      <Input
        label="Due Date"
        type="datetime-local"
        value={details.dueDate}
        onChange={set('dueDate')}
        required
        hint="Students must submit before this date/time"
      />

      {/* Category preview cards */}
      <div className={styles.catPreview}>
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            type="button"
            className={[styles.catCard, details.category === c.value ? styles.catActive : ''].join(' ')}
            onClick={() => setDetails((d) => ({ ...d, category: c.value }))}
          >
            <span className={styles.catEmoji}>{c.label.split(' ')[0]}</span>
            <span className={styles.catName}>{c.label.slice(c.label.indexOf(' ') + 1)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
