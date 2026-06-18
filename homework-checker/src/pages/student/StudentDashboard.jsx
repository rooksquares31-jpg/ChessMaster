import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BookOpen, CheckCircle, Clock, TrendingUp, ArrowRight } from 'lucide-react'
import { isPast } from 'date-fns'
import api from '../../lib/api'
import { useAuthStore } from '../../store/authStore'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ProgressBar from '../../components/ui/ProgressBar'
import styles from './StudentDashboard.module.css'

/** Derive per-student effective status — never use hw.status directly */
function getEffectiveStatus(sub, corr, hw) {
  if (corr) return 'corrected'
  if (sub)  return 'submitted'
  if (isPast(new Date(hw.dueDate))) return 'overdue'
  return 'assigned'
}

export default function StudentDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { data } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data.data),
  })
  const { data: hwData } = useQuery({
    queryKey: ['my-homework'],
    queryFn: () => api.get('/homework?limit=5').then((r) => r.data.data),
  })
  // Also load submissions so we can derive per-student status
  const { data: subsData } = useQuery({
    queryKey: ['my-submissions-all'],
    queryFn: () => api.get('/submissions?limit=100').then((r) => r.data.data),
  })
  const homework = hwData || []
  const report = data?.report || {}

  // Build submission map for per-student status derivation
  const subMap = {}
  ;(subsData || []).forEach((s) => {
    const hwId = s.homeworkId?._id || s.homeworkId
    subMap[hwId] = s
  })
  const completionRate = report.totalHomework > 0
    ? Math.round((report.completedHomework / report.totalHomework) * 100) : 0

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          Welcome back, {user?.firstName || user?.username}! ♟
        </h1>
        <p className={styles.subtitle}>Here's your chess learning progress</p>
      </div>

      <div className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}><BookOpen size={20} /></div>
          <div className={styles.statVal}>{report.totalHomework || 0}</div>
          <div className={styles.statLbl}>Total Assigned</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--green-dim)', color: 'var(--green)' }}><CheckCircle size={20} /></div>
          <div className={styles.statVal}>{report.completedHomework || 0}</div>
          <div className={styles.statLbl}>Completed</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}><Clock size={20} /></div>
          <div className={styles.statVal}>{data?.pendingHomework || 0}</div>
          <div className={styles.statLbl}>Pending</div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}><TrendingUp size={20} /></div>
          <div className={styles.statVal}>{report.averageScore || 0}%</div>
          <div className={styles.statLbl}>Avg Score</div>
        </Card>
      </div>

      <div className={styles.mainRow}>
        <Card className={styles.progressCard}>
          <h3 className={styles.cardTitle}>Your Progress</h3>
          <div className={styles.bigProgress}>
            <div className={styles.progressCircleWrap}>
              <svg width={140} height={140} viewBox="0 0 140 140">
                <circle cx={70} cy={70} r={56} fill="none" stroke="var(--border)" strokeWidth={10} />
                <circle cx={70} cy={70} r={56} fill="none" stroke="var(--accent)" strokeWidth={10}
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - completionRate / 100)}`}
                  strokeLinecap="round" transform="rotate(-90 70 70)" />
              </svg>
              <div className={styles.progressCircleText}>
                <div className={styles.progressPct}>{completionRate}%</div>
                <div className={styles.progressSub}>Complete</div>
              </div>
            </div>
            <div className={styles.progressDetails}>
              <ProgressBar value={report.completedHomework || 0} max={report.totalHomework || 1} color="green" label="Completion" showPercent />
              <ProgressBar value={report.averageScore || 0} max={100} color="blue" label="Avg Score" showPercent />
              {data?.overdueHomework > 0 && (
                <ProgressBar value={data.overdueHomework} max={report.totalHomework || 1} color="red" label="Overdue" showPercent />
              )}
            </div>
          </div>
        </Card>

        <Card>
          <div className={styles.hwHeader}>
            <h3 className={styles.cardTitle}>Recent Homework</h3>
            <Button variant="ghost" size="sm" iconRight={<ArrowRight size={14} />} onClick={() => navigate('/student/homework')}>
              View All
            </Button>
          </div>
          {homework.length === 0 ? (
            <div className={styles.empty}>No homework assigned yet</div>
          ) : (
            <div className={styles.hwList}>
              {homework.map((hw) => {
                const sub  = subMap[hw._id]
                const corr = sub?.correction
                const effectiveStatus = getEffectiveStatus(sub, corr, hw)
                return (
                  <div key={hw._id} className={styles.hwRow} onClick={() => navigate(`/student/homework/${hw._id}`)}>
                    <div className={styles.hwInfo}>
                      <div className={styles.hwTitle}>{hw.title}</div>
                      <div className={styles.hwMeta}>
                        <Badge variant="purple" size="sm">{hw.category}</Badge>
                        <span className={styles.hwDue}>Due {new Date(hw.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Badge
                      variant={effectiveStatus === 'corrected' ? 'green' : effectiveStatus === 'submitted' ? 'blue' : effectiveStatus === 'overdue' ? 'red' : 'yellow'}
                      size="sm"
                    >
                      {effectiveStatus === 'corrected' ? 'Corrected ✓' : effectiveStatus === 'submitted' ? 'Submitted' : effectiveStatus === 'overdue' ? 'Overdue' : 'Pending'}
                    </Badge>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
