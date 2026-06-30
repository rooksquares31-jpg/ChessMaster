import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle, XCircle, HelpCircle, Trophy, RotateCcw, ArrowLeft,
  Star, MessageSquare, Clock, BookOpen, Calendar, Award,
} from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { useAuthStore } from '../../store/authStore'
import { format } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ProgressBar from '../../components/ui/ProgressBar'
import styles from './HomeworkResult.module.css'

// Parse the starting position offset from the description (e.g. "Positions 51-100")
function getHomeworkOffset(hw) {
  if (!hw || !hw.description) return 0
  const match = hw.description.match(/Positions (\d+)-\d+/)
  if (match && match[1]) {
    return parseInt(match[1], 10) - 1
  }
  return 0
}

export default function HomeworkResult() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuthStore()

  // State passed from SolveHomework flow (immediate results)
  const stateAnswers = location.state?.answers || null
  const statePositions = location.state?.positions || []
  const stateHw = location.state?.hw

  // Always load submission from API (works for both direct nav & post-solve)
  const { data: submissions, isLoading: loadingSubmissions } = useQuery({
    queryKey: ['my-submissions', id],
    queryFn: () => api.get(`/submissions?homeworkId=${id}`).then((r) => r.data.data),
  })

  // Also load homework details if we don't have them from state
  const { data: hwData, isLoading: loadingHw } = useQuery({
    queryKey: ['homework', id],
    queryFn: () => api.get(`/homework/${id}`).then((r) => r.data.data),
    enabled: !stateHw,
  })

  const hw = stateHw || hwData
  const submission = submissions?.[0]
  const correction = submission?.correction
  const isLoading = !stateHw && loadingHw
  const baseOffset = getHomeworkOffset(hw)

  // Determine score data
  // Priority: correction score (coach reviewed) > state answers (immediate solve) > submission data
  const hasCorrection = !!correction
  const hasSolveState = !!stateAnswers && statePositions.length > 0

  // Helper: map annotation quality back to correct/wrong/review
  const qualityToStatus = (quality) => {
    if (quality === 'excellent') return 'correct'
    if (quality === 'mistake' || quality === 'blunder') return 'wrong'
    if (quality === 'inaccuracy' || quality === 'good') return 'review'
    return 'unchecked'
  }

  // Build coach-assigned position statuses from moveAnnotations (permanent correction)
  const coachPositions = hasCorrection && correction.moveAnnotations?.length > 0
    ? correction.moveAnnotations.map((ann) => qualityToStatus(ann.quality))
    : []

  let total, correct, wrong, review, pct
  if (hasCorrection) {
    pct = correction.score || 0
    if (coachPositions.length > 0) {
      // Use exact counts from the coach's position markings
      total   = coachPositions.length
      correct = coachPositions.filter((s) => s === 'correct').length
      wrong   = coachPositions.filter((s) => s === 'wrong').length
      review  = coachPositions.filter((s) => s === 'review').length
    } else {
      // Fallback: estimate from score
      total   = submission?.moveSequence?.length || 1
      correct = Math.round((pct / 100) * total)
      wrong   = total - correct
      review  = 0
    }
  } else if (hasSolveState) {
    total   = statePositions.length || 1
    correct = Object.values(stateAnswers).filter((a) => a.status === 'correct').length
    wrong   = Object.values(stateAnswers).filter((a) => a.status === 'wrong').length
    review  = Object.values(stateAnswers).filter((a) => a.status === 'review').length
    pct     = Math.round((correct / total) * 100)
  } else {
    // Submitted but no correction yet
    total   = submission?.moveSequence?.length || 1
    correct = 0
    wrong   = 0
    review  = 0
    pct     = 0
  }

  const grade = hasCorrection
    ? (correction.grade || (pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F'))
    : (pct >= 90 ? 'A' : pct >= 80 ? 'B' : pct >= 70 ? 'C' : pct >= 60 ? 'D' : 'F')

  const pieData = [
    { name: 'Correct',    value: correct,                              fill: '#22c55e' },
    { name: 'Wrong',      value: wrong,                                fill: '#ef4444' },
    { name: 'Review',     value: review,                               fill: '#f59e0b' },
    { name: 'Unanswered', value: Math.max(0, total - correct - wrong - review), fill: '#2a2d3e' },
  ].filter((d) => d.value > 0)

  if (isLoading || loadingSubmissions) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '60px', color: 'var(--text-muted)', fontSize: 15 }}>
        <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        Loading results…
      </div>
    )
  }

  // No submission found — redirect them to solve
  if (!submission && !stateAnswers) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px', textAlign: 'center' }}>
        <BookOpen size={48} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>Not submitted yet</h3>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          You haven't submitted this homework. Complete it first to see results.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <Button icon={<ArrowLeft size={16} />} variant="secondary" onClick={() => navigate('/student/homework')}>
            Back to Homework
          </Button>
          <Button onClick={() => navigate(`/student/homework/${id}`)}>
            Start Homework
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      {/* Trophy header */}
      <div className={styles.resultHeader}>
        <div className={styles.trophy}>
          {pct >= 80 ? '🏆' : pct >= 60 ? '🥈' : '📚'}
        </div>
        <h1 className={styles.resultTitle}>{hw?.title || 'Homework'} — Results</h1>
        <p className={styles.resultSub}>
          {user?.firstName || user?.username}'s submission
        </p>

        {hasCorrection ? (
          <div
            className={styles.gradeBadge}
            style={{
              background: pct >= 80 ? 'var(--green-dim)' : pct >= 60 ? 'var(--yellow-dim)' : 'var(--red-dim)',
              color: pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--yellow)' : 'var(--red)',
              border: `1px solid ${pct >= 80 ? 'rgba(34,197,94,0.3)' : pct >= 60 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}
          >
            Grade {grade} · {pct}% · Coach Reviewed ✓
          </div>
        ) : submission ? (
          <div className={styles.pendingBadge}>
            <Clock size={15} /> Awaiting coach review
          </div>
        ) : null}
      </div>

      {/* Stats row */}
      {hasSolveState && (
        <div className={styles.statsRow}>
          <Card className={styles.statCard}>
            <CheckCircle size={24} className={styles.statIcon} style={{ color: 'var(--green)' }} />
            <div className={styles.statNum} style={{ color: 'var(--green)' }}>{correct}</div>
            <div className={styles.statLbl}>Correct</div>
          </Card>
          <Card className={styles.statCard}>
            <XCircle size={24} className={styles.statIcon} style={{ color: 'var(--red)' }} />
            <div className={styles.statNum} style={{ color: 'var(--red)' }}>{wrong}</div>
            <div className={styles.statLbl}>Wrong</div>
          </Card>
          <Card className={styles.statCard}>
            <HelpCircle size={24} className={styles.statIcon} style={{ color: 'var(--yellow)' }} />
            <div className={styles.statNum} style={{ color: 'var(--yellow)' }}>{review}</div>
            <div className={styles.statLbl}>For Review</div>
          </Card>
          <Card className={styles.statCard}>
            <Trophy size={24} className={styles.statIcon} style={{ color: 'var(--accent)' }} />
            <div className={styles.statNum} style={{ color: 'var(--accent)' }}>{pct}%</div>
            <div className={styles.statLbl}>Score</div>
          </Card>
        </div>
      )}

      {/* Coach correction score (if reviewed) */}
      {hasCorrection && (
        <div className={styles.statsRow}>
          <Card className={styles.statCard}>
            <Award size={24} className={styles.statIcon} style={{ color: 'var(--green)' }} />
            <div className={styles.statNum} style={{ color: 'var(--green)' }}>{correction.score}</div>
            <div className={styles.statLbl}>Coach Score</div>
          </Card>
          <Card className={styles.statCard}>
            <Star size={24} className={styles.statIcon} style={{ color: 'var(--yellow)' }} />
            <div className={styles.statNum} style={{ color: 'var(--yellow)' }}>{grade}</div>
            <div className={styles.statLbl}>Grade</div>
          </Card>
          <Card className={styles.statCard}>
            <BookOpen size={24} className={styles.statIcon} style={{ color: 'var(--purple)' }} />
            <div className={styles.statNum} style={{ color: 'var(--purple)' }}>{hw?.maxScore || 100}</div>
            <div className={styles.statLbl}>Max Points</div>
          </Card>
          <Card className={styles.statCard}>
            <Trophy size={24} className={styles.statIcon} style={{ color: 'var(--accent)' }} />
            <div className={styles.statNum} style={{ color: 'var(--accent)' }}>{pct}%</div>
            <div className={styles.statLbl}>Percentage</div>
          </Card>
        </div>
      )}

      {/* Chart + Position grid (if we have solve state) */}
      {hasSolveState && (
        <div className={styles.mainRow}>
          <Card className={styles.chartCard}>
            <h3 className={styles.cardTitle}>Accuracy</h3>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={2} dataKey="value">
                  {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className={styles.chartCenter}>
              <div className={styles.bigPct}>{pct}%</div>
              <div className={styles.bigLbl}>Accuracy</div>
            </div>
            <ProgressBar value={correct} max={total} color={pct >= 80 ? 'green' : pct >= 60 ? 'yellow' : 'red'} showPercent label="Correct Rate" />
          </Card>

          <Card className={styles.posGrid}>
            <h3 className={styles.cardTitle}>Position Breakdown</h3>
            <div className={styles.posBoxGrid}>
              {Array.from({ length: total }).map((_, i) => {
                const ans = stateAnswers[i]
                const status = ans?.status || 'unanswered'
                return (
                  <div
                    key={i}
                    className={[styles.posBox,
                      status === 'correct' ? styles.posCorrect :
                      status === 'wrong' ? styles.posWrong :
                      status === 'review' ? styles.posReview : styles.posUnanswered
                    ].join(' ')}
                    title={`Position ${i + 1 + baseOffset}: ${ans?.move || 'Not answered'}`}
                  >
                    <div className={styles.posBoxNum}>{i + 1 + baseOffset}</div>
                    <div className={styles.posBoxIcon}>
                      {status === 'correct' ? '✅' :
                       status === 'wrong' ? '❌' :
                       status === 'review' ? '❓' : '○'}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className={styles.legend}>
              <span>✅ Correct</span>
              <span>❌ Wrong</span>
              <span>❓ Review</span>
            </div>
          </Card>
        </div>
      )}

      {/* Submission metadata */}
      {submission && (
        <Card className={styles.submissionMeta}>
          <h3 className={styles.cardTitle}><MessageSquare size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />Submission Details</h3>
          <div className={styles.metaGrid}>
            <div className={styles.metaItem}>
              <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
              <div>
                <div className={styles.metaLabel}>Submitted</div>
                <div className={styles.metaValue}>
                  {submission.submittedAt ? format(new Date(submission.submittedAt), 'PPP p') : '—'}
                </div>
              </div>
            </div>
            {submission.isLate && (
              <div className={styles.metaItem}>
                <Clock size={14} style={{ color: 'var(--red)' }} />
                <div>
                  <div className={styles.metaLabel}>Status</div>
                  <div className={styles.metaValue} style={{ color: 'var(--red)' }}>Late submission</div>
                </div>
              </div>
            )}
            {submission.moveSequence?.length > 0 && (
              <div className={styles.metaItem}>
                <BookOpen size={14} style={{ color: 'var(--text-muted)' }} />
                <div>
                  <div className={styles.metaLabel}>Moves Answered</div>
                  <div className={styles.metaValue}>{submission.moveSequence.length} positions</div>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Coach feedback / correction */}
      {hasCorrection && (
        <Card className={styles.correctionCard}>
          <h3 className={styles.cardTitle}>
            <MessageSquare size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Coach Correction — Permanent Result
          </h3>

          {/* Score badges row */}
          <div className={styles.correctionMeta}>
            <Badge variant="green">Score: {correction.score}/100</Badge>
            <Badge variant="blue">Grade: {correction.grade}</Badge>
            <Badge variant="purple">{correct} Correct · {wrong} Wrong · {review} Review</Badge>
          </div>

          {/* Coach position grid (permanent correction view) */}
          {coachPositions.length > 0 && (
            <div className={styles.coachPosSection}>
              <div className={styles.coachPosLabel}>Position-by-Position Results:</div>
              <div className={styles.coachPosGrid}>
                {coachPositions.map((status, i) => (
                  <div
                    key={i}
                    className={[
                      styles.coachPosCell,
                      status === 'correct'   ? styles.coachCellCorrect :
                      status === 'wrong'     ? styles.coachCellWrong :
                      status === 'review'    ? styles.coachCellReview :
                                              styles.coachCellUnchecked,
                    ].join(' ')}
                    title={`Position ${i + 1 + baseOffset}: ${status}`}
                  >
                    <div className={styles.coachCellNum}>{i + 1 + baseOffset}</div>
                    <div className={styles.coachCellIcon}>
                      {status === 'correct' ? '✅' :
                       status === 'wrong'   ? '❌' :
                       status === 'review'  ? '❓' : '○'}
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.legend}>
                <span>✅ Correct</span>
                <span>❌ Wrong</span>
                <span>❓ Needs Review</span>
              </div>
            </div>
          )}

          {/* Written feedback */}
          {correction.feedback && (
            <div className={styles.feedbackBox}>
              <div className={styles.feedbackBoxLabel}>Coach Feedback:</div>
              <div className={styles.feedbackText}>{correction.feedback}</div>
            </div>
          )}
        </Card>
      )}

      {/* Homework info strip */}
      {hw && (
        <Card className={styles.hwInfoCard}>
          <div className={styles.hwInfoRow}>
            <div>
              <div className={styles.hwInfoLabel}>Category</div>
              <Badge variant="purple" size="sm">{hw.category}</Badge>
            </div>
            <div>
              <div className={styles.hwInfoLabel}>Difficulty</div>
              <Badge variant={hw.difficulty === 'beginner' ? 'green' : hw.difficulty === 'intermediate' ? 'yellow' : 'red'} size="sm">
                {hw.difficulty}
              </Badge>
            </div>
            {hw.dueDate && (
              <div>
                <div className={styles.hwInfoLabel}>Due Date</div>
                <div className={styles.hwInfoValue}>{format(new Date(hw.dueDate), 'PPP')}</div>
              </div>
            )}
            {hw.maxScore && (
              <div>
                <div className={styles.hwInfoLabel}>Max Score</div>
                <div className={styles.hwInfoValue}>{hw.maxScore} pts</div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Actions */}
      <div className={styles.actions}>
        <Button variant="secondary" icon={<ArrowLeft size={16} />} onClick={() => navigate('/student/homework')}>
          Back to Homework
        </Button>
        {hasSolveState && (
          <Button variant="ghost" icon={<RotateCcw size={16} />} onClick={() => navigate(`/student/homework/${id}`)}>
            Review Again
          </Button>
        )}
      </div>
    </div>
  )
}
