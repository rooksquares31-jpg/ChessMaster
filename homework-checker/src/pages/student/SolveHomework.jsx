import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, BookmarkPlus, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import ChessBoard from '../../components/chess/ChessBoard'
import Button from '../../components/ui/Button'
import ProgressBar from '../../components/ui/ProgressBar'
import Badge from '../../components/ui/Badge'
import styles from './StudentHomework.module.css'

const STATUS = { UNANSWERED: 'unanswered', CORRECT: 'correct', WRONG: 'wrong', REVIEW: 'review' }

export default function SolveHomework() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({}) // { idx: { move, status } }
  const [moveInput, setMoveInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const { data: hw, isLoading } = useQuery({
    queryKey: ['homework', id],
    queryFn: () => api.get(`/homework/${id}`).then((r) => r.data.data),
  })

  // Parse positions from instructions field or positions array
  const parsePositions = () => {
    if (!hw) return []
    if (hw.positions && hw.positions.length > 0) {
      return hw.positions
    }
    if (hw.fenPosition) {
      // Single position stored in main fields
      return [{
        fen: hw.fenPosition,
        correctMove: '',
        explanation: hw.instructions || '',
        points: hw.maxScore || 10,
      }]
    }
    return []
  }

  const positions = parsePositions()
  const total = positions.length || 1
  const completed = Object.keys(answers).length
  const correctCount = Object.values(answers).filter((a) => a.status === STATUS.CORRECT).length

  const checkMove = () => {
    if (!moveInput.trim()) return
    const pos = positions[current]
    const correct = pos?.correctMove
    const isCorrect = correct
      ? moveInput.trim().toLowerCase() === correct.toLowerCase()
      : true // no correct move defined, accept anything

    const status = isCorrect ? STATUS.CORRECT : STATUS.WRONG
    setAnswers((a) => ({ ...a, [current]: { move: moveInput.trim(), status } }))
    if (isCorrect) toast.success('✓ Correct!', { duration: 1500 })
    else toast.error(`✗ Incorrect. Try again or mark for review.`, { duration: 2000 })
    setMoveInput('')
  }

  const handleReset = () => {
    setMoveInput('')
    setResetKey((k) => k + 1)
  }

  const markReview = () => {
    setAnswers((a) => ({ ...a, [current]: { move: moveInput || '?', status: STATUS.REVIEW } }))
    setMoveInput('')
    if (current < total - 1) setCurrent((c) => c + 1)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const moveSeq = Object.values(answers).map((a) => a.move)
      const solution = Object.entries(answers)
        .map(([i, a]) => `Position ${parseInt(i) + 1}: ${a.move} (${a.status})`)
        .join('\n')
      await api.post('/submissions', {
        homeworkId: id,
        submittedSolution: solution,
        moveSequence: moveSeq,
      })
      toast.success('Homework submitted!')
      navigate(`/student/homework/${id}/result`, { state: { answers, positions, hw } })
    } catch (err) {
      const msg = err.response?.data?.message || 'Submission failed'
      if (msg.includes('already submitted')) {
        navigate(`/student/homework/${id}/result`, { state: { answers, positions, hw } })
      } else {
        toast.error(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const posStatus = (i) => answers[i]?.status || STATUS.UNANSWERED
  const btnClass = (i) => {
    const s = posStatus(i)
    if (i === current) return `${styles.posBtn} ${styles.posBtnActive}`
    if (s === STATUS.CORRECT) return `${styles.posBtn} ${styles.posBtnCorrect}`
    if (s === STATUS.WRONG) return `${styles.posBtn} ${styles.posBtnWrong}`
    if (s === STATUS.REVIEW) return `${styles.posBtn} ${styles.posBtnReview}`
    return styles.posBtn
  }

  if (isLoading) return <div className={styles.loading}>Loading homework…</div>
  if (!hw) return <div className={styles.loading}>Homework not found.</div>

  const currentFen = positions[current]?.fen || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
  const currentAnswer = answers[current]

  return (
    <div className={styles.solvePage}>
      {/* Header */}
      <div className={styles.solveHeader}>
        <div className={styles.solveHeaderTop}>
          <div>
            <div className={styles.solveTitle}>{hw.title}</div>
            <div className={styles.solveProgress}>Progress: {completed} / {total} completed</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Badge variant="purple">{hw.category}</Badge>
            <Badge variant={hw.difficulty === 'beginner' ? 'green' : hw.difficulty === 'intermediate' ? 'yellow' : 'red'}>
              {hw.difficulty}
            </Badge>
          </div>
        </div>
        <ProgressBar value={completed} max={total} color="blue" showPercent />
      </div>

      {/* Main layout */}
      <div className={styles.solveLayout}>
        {/* Board */}
        <div className={styles.boardSection}>
          <div className={styles.questionCard}>
            <div className={styles.questionTitle}>Position {current + 1} of {total}</div>
            <div className={styles.questionText}>
              {hw.category === 'mate-in-one' ? 'Find the checkmate in one move.' :
               hw.category === 'mate-in-two' ? 'Find the checkmate in two moves.' :
               'Find the best move for this position.'}
            </div>
            {positions[current]?.explanation && (
              <div className={styles.instructionText}>{positions[current].explanation}</div>
            )}
          </div>

          <ChessBoard
            key={`${current}-${currentFen}-${!!currentAnswer}-${resetKey}`}
            fen={currentFen}
            size={420}
            interactive={!currentAnswer}
            onMove={({ san }) => {
              if (!currentAnswer) setMoveInput(san)
            }}
          />
        </div>

        {/* Side panel */}
        <div className={styles.sidePanel}>
          {/* Position navigator */}
          <div className={styles.posNav}>
            <div className={styles.posNavTitle}>Position Navigator</div>
            <div className={styles.posGrid}>
              {Array.from({ length: total }).map((_, i) => (
                <button key={i} className={btnClass(i)} onClick={() => setCurrent(i)}>
                  {posStatus(i) === STATUS.CORRECT ? '✓' :
                   posStatus(i) === STATUS.WRONG ? '✗' :
                   posStatus(i) === STATUS.REVIEW ? '?' : i + 1}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 12, fontSize: 11, color: 'var(--text-muted)', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--green)' }}>✓ Correct</span>
              <span style={{ color: 'var(--red)' }}>✗ Wrong</span>
              <span style={{ color: 'var(--yellow)' }}>? Review</span>
            </div>
          </div>

          {/* Answer input */}
          <div className={styles.moveInput}>
            <div className={styles.moveInputTitle}>Your Answer</div>
            {currentAnswer ? (
              <div className={[styles.resultFeedback, currentAnswer.status === STATUS.CORRECT ? styles.correct : currentAnswer.status === STATUS.WRONG ? styles.wrong : ''].join(' ')}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  {currentAnswer.status === STATUS.CORRECT && <CheckCircle size={16} />}
                  {currentAnswer.status === STATUS.WRONG && <XCircle size={16} />}
                  {currentAnswer.status === STATUS.REVIEW && <BookmarkPlus size={16} />}
                  <span>
                    {currentAnswer.status === STATUS.CORRECT ? `Correct! You played ${currentAnswer.move}` :
                     currentAnswer.status === STATUS.WRONG ? `Wrong. You played ${currentAnswer.move}` :
                     `Marked for review.`}
                  </span>
                  {currentAnswer.status === STATUS.WRONG && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setAnswers((a) => {
                          const next = { ...a }
                          delete next[current]
                          return next
                        })
                        setMoveInput('')
                      }}
                      style={{ padding: '4px 8px', fontSize: '12px', height: 'auto', minHeight: 'unset' }}
                    >
                      Try Again
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.moveField}>
                <input
                  className={styles.moveInputBox}
                  placeholder="e.g. Qh5#"
                  value={moveInput}
                  onChange={(e) => setMoveInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && checkMove()}
                />
                <Button size="sm" onClick={checkMove} disabled={!moveInput.trim()}>Check</Button>
                {moveInput.trim() && (
                  <Button size="sm" variant="ghost" onClick={handleReset}>Reset</Button>
                )}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className={styles.navBtns}>
            <Button variant="secondary" icon={<ChevronLeft size={16} />} onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0}>
              Prev
            </Button>
            {!currentAnswer && (
              <Button variant="ghost" icon={<BookmarkPlus size={14} />} onClick={markReview} size="sm">
                Review Later
              </Button>
            )}
            <Button iconRight={<ChevronRight size={16} />} onClick={() => setCurrent((c) => Math.min(total - 1, c + 1))} disabled={current === total - 1}>
              Next
            </Button>
          </div>

          {/* Submit */}
          {completed > 0 && (
            <div className={styles.submitAllCard}>
              <div className={styles.submitAllTitle}>{completed} / {total} Answered</div>
              <div className={styles.submitAllSub}>
                {correctCount} correct · {Object.values(answers).filter((a) => a.status === STATUS.WRONG).length} wrong
              </div>
              <Button loading={submitting} icon={<Send size={16} />} onClick={handleSubmit} fullWidth>
                Submit Homework
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
