import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Trophy, CheckCircle, XCircle, HelpCircle, BookOpen,
  Calendar, Clock, Play, Eye, ChevronRight, BarChart2,
  Award, Filter, Minus,
} from 'lucide-react'
import { format, isPast } from 'date-fns'
import { useAuthStore } from '../../store/authStore'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import styles from './StudentResults.module.css'

// Map annotation quality → status label
function qualityToStatus(quality) {
  if (quality === 'excellent') return 'correct'
  if (quality === 'mistake' || quality === 'blunder') return 'wrong'
  if (quality === 'inaccuracy' || quality === 'good') return 'review'
  return 'unchecked'
}

/**
 * Derive per-student effective status from own sub + correction.
 * NEVER use hw.status — it's shared across all students and flips
 * to 'corrected' as soon as ANY student gets corrected.
 */
function getEffectiveStatus(sub, corr, hw) {
  if (corr) return 'corrected'
  if (sub)  return 'submitted'
  if (isPast(new Date(hw.dueDate))) return 'overdue'
  return 'assigned'
}

const FILTERS = [
  { key: 'all',       label: 'All Homework' },
  { key: 'corrected', label: 'Corrected' },
  { key: 'submitted', label: 'Awaiting Review' },
  { key: 'assigned',  label: 'Pending' },
]

export default function StudentResults() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [filter, setFilter] = useState('all')

  // All homework assigned to this student
  const { data: hwData, isLoading: loadingHw } = useQuery({
    queryKey: ['my-homework'],
    queryFn: () => api.get('/homework?limit=100').then((r) => r.data.data),
  })

  // All my submissions (with correction populated)
  const { data: subsData, isLoading: loadingSubs } = useQuery({
    queryKey: ['my-submissions-all'],
    queryFn: () => api.get('/submissions?limit=100').then((r) => r.data.data),
  })

  const allHomework = hwData || []
  const submissions = subsData || []

  // Map submissions by homeworkId for quick lookup
  const subMap = {}
  submissions.forEach((s) => {
    const hwId = s.homeworkId?._id || s.homeworkId
    subMap[hwId] = s
  })

  // Build enriched homework list using per-student effective status
  const enriched = allHomework.map((hw) => {
    const sub  = subMap[hw._id]
    const corr = sub?.correction
    const effectiveStatus = getEffectiveStatus(sub, corr, hw)
    const coachPositions = corr?.moveAnnotations?.length > 0
      ? corr.moveAnnotations.map((ann) => qualityToStatus(ann.quality))
      : []
    const correct = coachPositions.filter((s) => s === 'correct').length
    const wrong   = coachPositions.filter((s) => s === 'wrong').length
    const review  = coachPositions.filter((s) => s === 'review').length
    return { hw, sub, corr, effectiveStatus, coachPositions, correct, wrong, review }
  })

  const counts = {
    all:       enriched.length,
    corrected: enriched.filter((e) => e.effectiveStatus === 'corrected').length,
    submitted: enriched.filter((e) => e.effectiveStatus === 'submitted').length,
    assigned:  enriched.filter((e) => e.effectiveStatus === 'assigned' || e.effectiveStatus === 'overdue').length,
  }

  const filtered = enriched.filter((e) => {
    if (filter === 'all')      return true
    if (filter === 'assigned') return e.effectiveStatus === 'assigned' || e.effectiveStatus === 'overdue'
    return e.effectiveStatus === filter
  })

  const totalScore = enriched
    .filter((e) => e.corr)
    .reduce((sum, e) => sum + (e.corr.score || 0), 0)
  const correctedCount = counts.corrected
  const avgScore = correctedCount > 0 ? Math.round(totalScore / correctedCount) : null

  const isLoading = loadingHw || loadingSubs

  if (isLoading) return (
    <div className={styles.loadingWrap}>
      <div className={styles.spinner} />
      Loading your results…
    </div>
  )

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Results</h1>
          <p className={styles.subtitle}>
            {user?.firstName || user?.username}'s homework — all assignments &amp; corrections
          </p>
        </div>
        {avgScore !== null && (
          <div className={styles.avgBadge}>
            <Trophy size={18} />
            <span>Average Score: <strong>{avgScore}%</strong></span>
          </div>
        )}
      </div>

      {/* ── Overview stats strip ── */}
      <div className={styles.statsStrip}>
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: 'var(--text-primary)' }}>{counts.all}</div>
          <div className={styles.statLbl}>Total Assigned</div>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: 'var(--green)' }}>{counts.corrected}</div>
          <div className={styles.statLbl}>Corrected</div>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: 'var(--accent)' }}>{counts.submitted}</div>
          <div className={styles.statLbl}>Awaiting Review</div>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <div className={styles.statNum} style={{ color: 'var(--yellow)' }}>{counts.assigned}</div>
          <div className={styles.statLbl}>Pending</div>
        </div>
        {avgScore !== null && (
          <>
            <div className={styles.statDivider} />
            <div className={styles.statItem}>
              <div className={styles.statNum} style={{
                color: avgScore >= 80 ? 'var(--green)' : avgScore >= 60 ? 'var(--yellow)' : 'var(--red)'
              }}>
                {avgScore}%
              </div>
              <div className={styles.statLbl}>Avg Score</div>
            </div>
          </>
        )}
      </div>

      {/* ── Filter tabs ── */}
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

      {/* ── Homework list ── */}
      {filtered.length === 0 ? (
        <Card className={styles.empty}>
          <BookOpen size={48} className={styles.emptyIcon} />
          <h3>{filter === 'all' ? 'No homework yet' : `No ${filter} homework`}</h3>
          <p>
            {filter === 'all'
              ? "Your coach hasn't assigned any homework yet."
              : `You have no homework with "${FILTERS.find((f) => f.key === filter)?.label}" status.`}
          </p>
          {filter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>View All</Button>
          )}
        </Card>
      ) : (
        <div className={styles.list}>
          {filtered.map(({ hw, sub, corr, effectiveStatus, coachPositions, correct, wrong, review }) => {
            const isCorrected = effectiveStatus === 'corrected'
            const isSubmitted = effectiveStatus === 'submitted'
            const overdue     = effectiveStatus === 'overdue'
            const pct         = corr?.score ?? null
            const grade       = corr?.grade ?? null

            return (
              <div
                key={hw._id}
                className={[
                  styles.row,
                  isCorrected ? styles.rowCorrected : isSubmitted ? styles.rowSubmitted : '',
                ].join(' ')}
              >
                {/* Left color strip */}
                <div className={styles.strip} style={{
                  background: isCorrected ? 'var(--green)'
                    : isSubmitted ? 'var(--accent)'
                    : overdue ? 'var(--red)'
                    : 'var(--yellow)',
                }} />

                {/* Main body */}
                <div className={styles.body}>

                  {/* Top row: badges + status */}
                  <div className={styles.topRow}>
                    <div className={styles.badgeRow}>
                      <Badge variant="purple" size="sm">{hw.category}</Badge>
                      <Badge
                        variant={hw.difficulty === 'beginner' ? 'green' : hw.difficulty === 'intermediate' ? 'yellow' : 'red'}
                        size="sm"
                      >
                        {hw.difficulty}
                      </Badge>
                    </div>
                    <Badge
                      variant={isCorrected ? 'green' : isSubmitted ? 'blue' : overdue ? 'red' : 'yellow'}
                      size="sm"
                      dot
                    >
                      {isCorrected ? 'Corrected ✓' : isSubmitted ? 'Awaiting Review' : overdue ? 'Overdue' : 'Pending'}
                    </Badge>
                  </div>

                  {/* Title */}
                  <h3 className={styles.hwTitle}>{hw.title}</h3>
                  {hw.description && <p className={styles.hwDesc}>{hw.description}</p>}

                  {/* Meta row */}
                  <div className={styles.metaRow}>
                    <div className={[styles.dateChip, overdue ? styles.dateOverdue : ''].join(' ')}>
                      {overdue ? <Award size={13} /> : <Calendar size={13} />}
                      <span>{overdue ? 'Overdue · ' : ''}{format(new Date(hw.dueDate), 'PPP')}</span>
                    </div>
                    {hw.maxScore && (
                      <div className={styles.metaChip}>
                        <BookOpen size={13} /><span>{hw.maxScore} pts</span>
                      </div>
                    )}
                  </div>

                  {/* ── Correction result block ── */}
                  {isCorrected && corr && (
                    <div className={styles.correctionBlock}>
                      {/* Score + grade */}
                      <div className={styles.scoreRow}>
                        <div className={styles.scoreBox} style={{
                          background: pct >= 80 ? 'var(--green-dim)' : pct >= 60 ? 'var(--yellow-dim)' : 'var(--red-dim)',
                          border: `1px solid ${pct >= 80 ? 'rgba(34,197,94,0.3)' : pct >= 60 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                          color: pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)',
                        }}>
                          <Trophy size={14} />
                          <span className={styles.scoreVal}>{pct}%</span>
                          <span className={styles.gradeVal}>Grade {grade}</span>
                        </div>

                        {coachPositions.length > 0 && (
                          <div className={styles.posCountRow}>
                            <span className={styles.posCount} style={{ color: 'var(--green)' }}>
                              <CheckCircle size={12} /> {correct} Correct
                            </span>
                            <span className={styles.posCount} style={{ color: 'var(--red)' }}>
                              <XCircle size={12} /> {wrong} Wrong
                            </span>
                            {review > 0 && (
                              <span className={styles.posCount} style={{ color: 'var(--yellow)' }}>
                                <HelpCircle size={12} /> {review} Review
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Position mini-grid */}
                      {coachPositions.length > 0 && (
                        <div className={styles.miniGrid}>
                          {coachPositions.map((status, i) => (
                            <div
                              key={i}
                              className={[
                                styles.miniCell,
                                status === 'correct'  ? styles.miniCorrect  :
                                status === 'wrong'    ? styles.miniWrong    :
                                status === 'review'   ? styles.miniReview   :
                                                        styles.miniUnchecked,
                              ].join(' ')}
                              title={`Position ${i + 1}: ${status}`}
                            >
                              <span className={styles.miniNum}>{i + 1}</span>
                              <span className={styles.miniIcon}>
                                {status === 'correct' ? '✅' :
                                 status === 'wrong'   ? '❌' :
                                 status === 'review'  ? '❓' : <Minus size={10} />}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Coach feedback snippet */}
                      {corr.feedback && (
                        <div className={styles.feedbackSnippet}>
                          <span className={styles.feedbackLabel}>Coach:</span>
                          <span className={styles.feedbackText}>{corr.feedback}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Awaiting review note */}
                  {isSubmitted && (
                    <div className={styles.awaitingNote}>
                      <Clock size={13} /> Your submission is being reviewed by the coach
                    </div>
                  )}
                </div>

                {/* Right action area */}
                <div className={styles.actions}>
                  {isCorrected ? (
                    <Button
                      size="sm"
                      variant="success"
                      icon={<Eye size={14} />}
                      onClick={() => navigate(`/student/homework/${hw._id}/result`)}
                    >
                      Full Result
                    </Button>
                  ) : isSubmitted ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Clock size={14} />}
                      onClick={() => navigate(`/student/homework/${hw._id}/result`)}
                    >
                      View
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
