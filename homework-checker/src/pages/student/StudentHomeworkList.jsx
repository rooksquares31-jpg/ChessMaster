import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Calendar, Clock, BookOpen, CheckCircle, AlertTriangle,
  Trophy, Eye, Play, ChevronRight, Filter,
} from 'lucide-react'
import { format, isPast } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import styles from './StudentHomework.module.css'

/**
 * Derive the per-student effective status from the student's OWN
 * submission + correction — NOT from hw.status (which is global and
 * gets set to 'corrected' the moment ANY student is graded).
 */
function getEffectiveStatus(sub, corr, hw) {
  if (corr)                                             return 'corrected'
  if (sub)                                              return 'submitted'
  if (isPast(new Date(hw.dueDate)))                     return 'overdue'
  return 'assigned'
}

function statusColor(effectiveStatus) {
  if (effectiveStatus === 'corrected') return 'green'
  if (effectiveStatus === 'submitted') return 'blue'
  if (effectiveStatus === 'overdue')   return 'red'
  return 'yellow'
}

function statusLabel(effectiveStatus) {
  if (effectiveStatus === 'corrected') return 'Corrected ✓'
  if (effectiveStatus === 'submitted') return 'Submitted'
  if (effectiveStatus === 'overdue')   return 'Overdue'
  return 'Pending'
}

const FILTERS = [
  { key: 'all',       label: 'All' },
  { key: 'assigned',  label: 'Pending' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'corrected', label: 'Corrected' },
]

export default function StudentHomeworkList() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')

  const { data, isLoading } = useQuery({
    queryKey: ['my-homework'],
    queryFn: () => api.get('/homework?limit=100').then((r) => r.data.data),
  })

  // Load my submissions so we can derive per-student status
  const { data: submissionsData } = useQuery({
    queryKey: ['my-submissions-all'],
    queryFn: () => api.get('/submissions?limit=100').then((r) => r.data.data),
  })

  // Map submissions by homeworkId for quick lookup
  const submissionMap = {}
  ;(submissionsData || []).forEach((s) => {
    const hwId = s.homeworkId?._id || s.homeworkId
    submissionMap[hwId] = s
  })

  const allHomework = data || []

  // Enrich each homework with per-student effective status
  const enriched = allHomework.map((hw) => {
    const sub  = submissionMap[hw._id]
    const corr = sub?.correction || null
    const effectiveStatus = getEffectiveStatus(sub, corr, hw)
    return { hw, sub, corr, effectiveStatus }
  })

  const counts = {
    all:       enriched.length,
    assigned:  enriched.filter((e) => e.effectiveStatus === 'assigned' || e.effectiveStatus === 'overdue').length,
    submitted: enriched.filter((e) => e.effectiveStatus === 'submitted').length,
    corrected: enriched.filter((e) => e.effectiveStatus === 'corrected').length,
  }

  const filtered = enriched.filter(({ effectiveStatus }) => {
    if (filter === 'all')       return true
    if (filter === 'assigned')  return effectiveStatus === 'assigned' || effectiveStatus === 'overdue'
    return effectiveStatus === filter
  })

  if (isLoading) return (
    <div className={styles.loadingWrap}>
      <div className={styles.spinner} />
      Loading your homework…
    </div>
  )

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Homework</h1>
          <p className={styles.subtitle}>
            {allHomework.length} assignment{allHomework.length !== 1 ? 's' : ''} assigned
            {counts.corrected > 0 && ` · ${counts.corrected} corrected`}
          </p>
        </div>
      </div>

      {/* Status summary strip */}
      <div className={styles.summaryStrip}>
        <div className={styles.summaryItem}>
          <div className={styles.summaryNum} style={{ color: 'var(--yellow)' }}>{counts.assigned}</div>
          <div className={styles.summaryLbl}>Pending</div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <div className={styles.summaryNum} style={{ color: 'var(--accent)' }}>{counts.submitted}</div>
          <div className={styles.summaryLbl}>Submitted</div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <div className={styles.summaryNum} style={{ color: 'var(--green)' }}>{counts.corrected}</div>
          <div className={styles.summaryLbl}>Corrected</div>
        </div>
        <div className={styles.summaryDivider} />
        <div className={styles.summaryItem}>
          <div className={styles.summaryNum} style={{ color: 'var(--text-primary)' }}>{counts.all}</div>
          <div className={styles.summaryLbl}>Total</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className={styles.filterRow}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        <div className={styles.filterGroup}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={[styles.filterBtn, filter === f.key ? styles.filterBtnActive : ''].join(' ')}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              {counts[f.key] > 0 && (
                <span className={styles.filterCount}>{counts[f.key]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className={styles.empty}>
          <BookOpen size={48} className={styles.emptyIcon} />
          <h3>{filter === 'all' ? 'No homework yet' : `No ${filter} homework`}</h3>
          <p>
            {filter === 'all'
              ? "Your coach hasn't assigned any homework yet. Check back soon!"
              : `You have no homework with "${FILTERS.find(f => f.key === filter)?.label}" status.`}
          </p>
          {filter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>View All</Button>
          )}
        </Card>
      ) : (
        <div className={styles.hwList2}>
          {filtered.map(({ hw, sub, corr, effectiveStatus }) => {
            const isCorrected = effectiveStatus === 'corrected'
            const isSubmitted = effectiveStatus === 'submitted'
            const overdue     = effectiveStatus === 'overdue'
            const color       = statusColor(effectiveStatus)

            return (
              <div key={hw._id} className={styles.hwRow2}>
                {/* Status color strip */}
                <div
                  className={styles.hwStrip}
                  style={{
                    background: isCorrected
                      ? 'var(--green)'
                      : isSubmitted
                      ? 'var(--accent)'
                      : overdue
                      ? 'var(--red)'
                      : 'var(--yellow)',
                  }}
                />

                {/* Main content */}
                <div className={styles.hwContent}>
                  <div className={styles.hwTopRow}>
                    <div className={styles.hwBadges}>
                      <Badge variant="purple" size="sm">{hw.category}</Badge>
                      <Badge
                        variant={hw.difficulty === 'beginner' ? 'green' : hw.difficulty === 'intermediate' ? 'yellow' : 'red'}
                        size="sm"
                      >
                        {hw.difficulty}
                      </Badge>
                    </div>
                    <Badge variant={color} size="sm" dot>{statusLabel(effectiveStatus)}</Badge>
                  </div>

                  <h3 className={styles.hwTitle2}>{hw.title}</h3>
                  {hw.description && (
                    <p className={styles.hwDesc2}>{hw.description}</p>
                  )}

                  <div className={styles.hwMeta2}>
                    <div className={[styles.hwDate2, overdue ? styles.hwDateOverdue : ''].join(' ')}>
                      {overdue ? <AlertTriangle size={13} /> : <Calendar size={13} />}
                      <span>{overdue ? 'Overdue · ' : ''}{format(new Date(hw.dueDate), 'PPP')}</span>
                    </div>
                    {hw.maxScore && (
                      <div className={styles.hwPoints2}>
                        <BookOpen size={13} />
                        <span>{hw.maxScore} pts</span>
                      </div>
                    )}

                    {/* Show score if THIS student is corrected */}
                    {isCorrected && corr && (
                      <div className={styles.scoreChip}>
                        <Trophy size={13} />
                        <span>
                          Score: <strong>{corr.score}/100</strong>
                        </span>
                        <span className={styles.gradeChip}>
                          Grade {corr.grade}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className={styles.hwActions}>
                  {isCorrected ? (
                    <Button
                      size="sm"
                      variant="success"
                      icon={<Eye size={14} />}
                      onClick={() => navigate(`/student/homework/${hw._id}/result`)}
                    >
                      View Score
                    </Button>
                  ) : isSubmitted ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Clock size={14} />}
                      onClick={() => navigate(`/student/homework/${hw._id}/result`)}
                    >
                      Awaiting Review
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      icon={<Play size={14} />}
                      onClick={() => navigate(`/student/homework/${hw._id}`)}
                    >
                      {overdue ? 'Submit Late' : 'Start'}
                    </Button>
                  )}
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
