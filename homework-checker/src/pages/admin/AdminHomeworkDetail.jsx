import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, Users, CheckSquare, Calendar, BookOpen,
  Trophy, Clock, CheckCircle, XCircle, AlertCircle,
  ChevronRight, BarChart2,
} from 'lucide-react'
import { format } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import styles from './AdminHomeworkDetail.module.css'

export default function AdminHomeworkDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  // Fetch homework detail with assigned students
  const { data: hw, isLoading: loadingHw } = useQuery({
    queryKey: ['admin-hw-detail', id],
    queryFn: () => api.get(`/homework/${id}`).then((r) => r.data.data),
  })

  // Fetch all submissions for this homework (to show per-student status)
  const { data: subsData, isLoading: loadingSubs } = useQuery({
    queryKey: ['hw-submissions', id],
    queryFn: () => api.get(`/submissions?homeworkId=${id}&limit=100`).then((r) => r.data.data),
    enabled: !!id,
  })

  const submissions = subsData || []

  // Build a map: studentId → submission
  const subMap = {}
  submissions.forEach((s) => {
    const sid = s.studentId?._id || s.studentId
    subMap[sid?.toString()] = s
  })

  const assignedStudents = hw?.assignedStudents || []

  const handleCorrect = (student) => {
    // Navigate to correction page, pre-selecting this student + homework
    navigate('/admin/corrections', {
      state: {
        preStudent: student,
        preHomework: hw,
      },
    })
  }

  if (loadingHw) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.spinner} />
        Loading homework…
      </div>
    )
  }

  if (!hw) {
    return (
      <div className={styles.notFound}>
        <BookOpen size={48} style={{ opacity: 0.3 }} />
        <h3>Homework not found</h3>
        <Button variant="secondary" icon={<ArrowLeft size={15} />} onClick={() => navigate('/admin/homework')}>
          Back to Homework
        </Button>
      </div>
    )
  }

  const corrected  = assignedStudents.filter((s) => subMap[(s._id || s)?.toString()]?.correction).length
  const submitted  = assignedStudents.filter((s) => {
    const sub = subMap[(s._id || s)?.toString()]
    return sub && !sub.correction
  }).length
  const pending    = assignedStudents.length - corrected - submitted

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/admin/homework')}>
          <ArrowLeft size={16} />
          Back to Homework
        </button>
        <div className={styles.hwMeta}>
          <h1 className={styles.title}>{hw.title}</h1>
          {hw.description && <p className={styles.subtitle}>{hw.description}</p>}
          <div className={styles.metaBadges}>
            <Badge variant="purple" size="sm">{hw.category}</Badge>
            <Badge
              variant={hw.difficulty === 'beginner' ? 'green' : hw.difficulty === 'intermediate' ? 'yellow' : 'red'}
              size="sm"
            >
              {hw.difficulty}
            </Badge>
            <Badge
              variant={hw.status === 'corrected' ? 'green' : hw.status === 'submitted' ? 'blue' : 'yellow'}
              size="sm" dot
            >
              {hw.status}
            </Badge>
            {hw.dueDate && (
              <span className={styles.dueDate}>
                <Calendar size={13} />
                Due {format(new Date(hw.dueDate), 'PPP')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Stats strip ── */}
      <div className={styles.statsStrip}>
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: 'var(--accent)' }}>{assignedStudents.length}</div>
          <div className={styles.statLbl}>Assigned</div>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: 'var(--green)' }}>{corrected}</div>
          <div className={styles.statLbl}>Corrected</div>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: 'var(--blue, #3b82f6)' }}>{submitted}</div>
          <div className={styles.statLbl}>Submitted</div>
        </div>
        <div className={styles.statDiv} />
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: 'var(--yellow)' }}>{pending}</div>
          <div className={styles.statLbl}>Pending</div>
        </div>
      </div>

      {/* ── Student list ── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Users size={16} />
          <h2 className={styles.sectionTitle}>Assigned Students</h2>
          <span className={styles.sectionCount}>{assignedStudents.length}</span>
        </div>

        {assignedStudents.length === 0 ? (
          <Card className={styles.empty}>
            <Users size={40} style={{ opacity: 0.3 }} />
            <p>No students assigned to this homework yet.</p>
          </Card>
        ) : (
          <div className={styles.studentList}>
            {loadingSubs && (
              <div className={styles.subsLoading}>Loading submission data…</div>
            )}
            {assignedStudents.map((s) => {
              const sid = (s._id || s)?.toString()
              const sub = subMap[sid]
              const hasCorrected = !!sub?.correction
              const hasSubmitted = !!sub && !hasCorrected
              const statusVariant = hasCorrected ? 'green' : hasSubmitted ? 'blue' : 'yellow'
              const statusLabel   = hasCorrected ? 'Corrected ✓' : hasSubmitted ? 'Submitted' : 'Pending'
              const score = sub?.correction?.score
              const grade = sub?.correction?.grade

              return (
                <div key={sid} className={styles.studentRow}>
                  {/* Left status strip */}
                  <div
                    className={styles.studentStrip}
                    style={{
                      background: hasCorrected ? 'var(--green)'
                        : hasSubmitted ? 'var(--accent)'
                        : 'var(--yellow)',
                    }}
                  />

                  {/* Avatar */}
                  <div
                    className={styles.avatar}
                    style={{
                      background: hasCorrected
                        ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                        : 'linear-gradient(135deg, #4f8ef7, #a855f7)',
                    }}
                  >
                    {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className={styles.studentInfo}>
                    <div className={styles.studentName}>
                      {s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : s.username}
                    </div>
                    <div className={styles.studentEmail}>{s.email}</div>
                  </div>

                  {/* Score chip (if corrected) */}
                  {hasCorrected && (
                    <div className={styles.scoreChip}>
                      <Trophy size={13} />
                      <span><strong>{score}%</strong></span>
                      <span className={styles.gradeChip}>Grade {grade}</span>
                    </div>
                  )}

                  {/* Status badge */}
                  <Badge variant={statusVariant} size="sm" dot>
                    {statusLabel}
                  </Badge>

                  {/* Correct button */}
                  <Button
                    size="sm"
                    variant={hasCorrected ? 'secondary' : 'primary'}
                    icon={<CheckSquare size={14} />}
                    onClick={() => handleCorrect(s)}
                  >
                    {hasCorrected ? 'Update Correction' : hasSubmitted ? 'Correct Now' : 'Pre-Grade'}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
