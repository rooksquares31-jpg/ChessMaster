import { BookOpen, Users, Calendar, Target, Layers, CheckCircle } from 'lucide-react'
import Button from '../../../components/ui/Button'
import Badge from '../../../components/ui/Badge'
import { format } from 'date-fns'
import styles from './Steps.module.css'

const SummaryRow = ({ icon, label, value, variant }) => (
  <div className={styles.summaryRow}>
    <div className={styles.summaryIcon}>{icon}</div>
    <div className={styles.summaryLabel}>{label}</div>
    <div className={styles.summaryValue}><Badge variant={variant || 'blue'}>{value}</Badge></div>
  </div>
)

export default function Step5Publish({ details, positions, assignedStudents, onPublish, saving }) {
  const totalPoints = positions.reduce((a, p) => a + (p.points || 10), 0)
  const completed = positions.filter((p) => p.fen && p.correctMove).length

  return (
    <div className={styles.step}>
      <h2 className={styles.stepTitle}>Review & Publish</h2>
      <p className={styles.stepDesc}>Review your homework before publishing it to students.</p>

      <div className={styles.summaryCard}>
        <div className={styles.summaryTitle}>
          <CheckCircle size={20} className={styles.summaryCheck} />
          Homework Summary
        </div>
        <div className={styles.summaryRows}>
          <SummaryRow icon={<BookOpen size={16} />} label="Title" value={details.title} variant="blue" />
          <SummaryRow icon={<Target size={16} />} label="Category" value={details.category} variant="purple" />
          <SummaryRow icon={<Layers size={16} />} label="Difficulty" value={details.difficulty}
            variant={details.difficulty === 'beginner' ? 'green' : details.difficulty === 'intermediate' ? 'yellow' : 'red'} />
          <SummaryRow icon={<BookOpen size={16} />} label="Positions" value={`${completed} / ${positions.length} ready`}
            variant={completed === positions.length ? 'green' : 'yellow'} />
          <SummaryRow icon={<Target size={16} />} label="Total Points" value={totalPoints} variant="purple" />
          <SummaryRow icon={<Users size={16} />} label="Students" value={assignedStudents.length || 'None (assign later)'}
            variant={assignedStudents.length > 0 ? 'green' : 'yellow'} />
          <SummaryRow icon={<Calendar size={16} />} label="Due Date"
            value={details.dueDate ? format(new Date(details.dueDate), 'PPP p') : '—'} variant="blue" />
        </div>
      </div>

      {completed < positions.length && (
        <div className={styles.warnBanner}>
          ⚠️ {positions.length - completed} position(s) are incomplete (missing FEN or correct move). You can still publish and complete them later.
        </div>
      )}

      <div className={styles.publishBtns}>
        <Button size="lg" loading={saving} onClick={onPublish} icon={<CheckCircle size={18} />}>
          Publish Homework
        </Button>
      </div>
    </div>
  )
}
