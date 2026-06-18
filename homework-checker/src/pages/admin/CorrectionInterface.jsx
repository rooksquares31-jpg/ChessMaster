import { useState, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Users, BookOpen, CheckCircle, XCircle, HelpCircle,
  ChevronRight, Save, Trophy, RotateCcw,
  Clock, Minus, BadgeCheck, Search,
} from 'lucide-react'
import { format, isPast } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import styles from './CorrectionInterface.module.css'

// ---------- Per‑student status helper ----------
// Global Homework.status is NOT reliable for the admin UI – it flips when any student is corrected.
// Derive the effective status from the student's own submission and correction.
function getEffectiveStatus(sub, corr, hw) {
  if (corr) return 'corrected'
  if (sub)  return 'submitted'
  if (isPast(new Date(hw.dueDate))) return 'overdue'
  return 'assigned'
}

// Status options per position
const POS_STATUS = {
  UNCHECKED: 'unchecked',   // no mark yet
  CORRECT:   'correct',
  WRONG:     'wrong',
  REVIEW:    'review',      // question mark / needs review
}

const STATUS_CYCLE = [POS_STATUS.UNCHECKED, POS_STATUS.CORRECT, POS_STATUS.WRONG, POS_STATUS.REVIEW]

function statusIcon(s, size = 16) {
  if (s === POS_STATUS.CORRECT) return <CheckCircle size={size} />
  if (s === POS_STATUS.WRONG)   return <XCircle size={size} />
  if (s === POS_STATUS.REVIEW)  return <HelpCircle size={size} />
  return <Minus size={size} />
}

function statusColor(s) {
  if (s === POS_STATUS.CORRECT) return 'var(--green)'
  if (s === POS_STATUS.WRONG)   return 'var(--red)'
  if (s === POS_STATUS.REVIEW)  return 'var(--yellow)'
  return 'var(--text-muted)'
}

function statusBg(s) {
  if (s === POS_STATUS.CORRECT) return 'var(--green-dim)'
  if (s === POS_STATUS.WRONG)   return 'var(--red-dim)'
  if (s === POS_STATUS.REVIEW)  return 'var(--yellow-dim)'
  return 'var(--bg-input)'
}

// Parse number of positions from homework data
function parsePositionCount(hw) {
  if (!hw) return 1
  if (hw.positions && hw.positions.length > 0) return hw.positions.length
  if (hw.maxScore) return Math.max(1, Math.round(hw.maxScore / 10))
  return 1
}

export default function CorrectionInterface() {
  const qc = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()

  // Pre-selection passed from AdminHomeworkDetail via navigate state
  const preStudent  = location.state?.preStudent  || null
  const preHomework = location.state?.preHomework || null

  // Navigation state
  const [selectedStudent, setSelectedStudent] = useState(null)  // student object
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedHw, setSelectedHw]           = useState(null)  // homework object
  const [selectedSub, setSelectedSub]          = useState(null)  // submission if exists

  // Grading state
  const [positions, setPositions] = useState([])   // array of POS_STATUS values
  const [feedback, setFeedback]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [lastSaved, setLastSaved] = useState(null)  // timestamp of last successful save
  const [savedCorrId, setSavedCorrId] = useState(null)  // correction id after save

  // ── Auto-select from navigation state (from AdminHomeworkDetail) ────────────
  useEffect(() => {
    if (preStudent && !selectedStudent) {
      setSelectedStudent(preStudent)
      setPositions([])
      setFeedback('')
      setLastSaved(null)
      setSavedCorrId(null)
    }
  }, [preStudent]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (preHomework && preStudent && !selectedHw) {
      setSelectedHw(preHomework)
      setSelectedSub(null)
    }
  }, [preHomework, preStudent]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Data fetching ──────────────────────────────────────────────────────────

  // All students
  const { data: studentsData, isLoading: loadingStudents } = useQuery({
    queryKey: ['all-students-correction'],
    queryFn: () => api.get('/students?limit=100').then((r) => r.data.data),
  })
  const allStudents = studentsData || []
  const students = allStudents.filter(s => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (s.firstName && s.firstName.toLowerCase().includes(q)) ||
      (s.lastName && s.lastName.toLowerCase().includes(q)) ||
      (s.username && s.username.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q))
    )
  })

  // Homework assigned to selected student
  const { data: hwData, isLoading: loadingHw } = useQuery({
    queryKey: ['student-hw-correction', selectedStudent?._id],
    queryFn: () => api.get(`/homework?limit=100`).then((r) => r.data.data),
    enabled: !!selectedStudent,
  })
  // filter to those assigned to this student
  const studentHomework = (hwData || []).filter((hw) =>
    hw.assignedStudents?.some((s) =>
      (s._id || s) === selectedStudent?._id || (s._id || s)?.toString() === selectedStudent?._id
    )
  )

  // Submissions for selected student across all homework
  const { data: studentSubs, isLoading: loadingSubs } = useQuery({
    queryKey: ['submissions-for-student', selectedStudent?._id],
    queryFn: () => api.get(`/submissions?studentId=${selectedStudent._id}&limit=100`).then(r => r.data.data),
    enabled: !!selectedStudent,
  })

  // Submission for selected homework by selected student
  const { data: subData, isLoading: loadingSub } = useQuery({
    queryKey: ['sub-for-grading', selectedStudent?._id, selectedHw?._id],
    queryFn: () =>
      api.get(`/submissions?homeworkId=${selectedHw._id}&studentId=${selectedStudent._id}&limit=50`).then((r) => {
        // Find submission by this student
        const all = r.data.data || []
        return all.find((s) => {
          const sid = s.studentId?._id || s.studentId
          return sid?.toString() === selectedStudent._id
        }) || null
      }),
    enabled: !!selectedStudent && !!selectedHw,
  })

  // ── Handlers ──────────────────────────────────────────────────────────────

  const selectStudent = (student) => {
    setSelectedStudent(student)
    setSelectedHw(null)
    setSelectedSub(null)
    setPositions([])
    setFeedback('')
    setLastSaved(null)
    setSavedCorrId(null)
  }

  const selectHomework = useCallback((hw) => {
    setSelectedHw(hw)
    setSelectedSub(null)
    setFeedback('')
    setLastSaved(null)
    setSavedCorrId(null)
    // Build initial positions array
    const count = parsePositionCount(hw)
    setPositions(Array.from({ length: count }, () => POS_STATUS.UNCHECKED))
  }, [])

  // Map a saved quality string back to a POS_STATUS
  const qualityToStatus = (quality) => {
    if (quality === 'excellent') return POS_STATUS.CORRECT
    if (quality === 'mistake' || quality === 'blunder') return POS_STATUS.WRONG
    if (quality === 'inaccuracy' || quality === 'good') return POS_STATUS.REVIEW
    return POS_STATUS.UNCHECKED
  }

  // When submission loads, pre-fill positions from existing correction (permanent state)
  const onSubLoad = useCallback((sub) => {
    setSelectedSub(sub)
    const count = parsePositionCount(selectedHw)

    if (sub?.correction) {
      // ── Restore saved correction positions ──────────────────────────
      const corr = sub.correction
      setFeedback(corr.feedback || '')
      setSavedCorrId(corr._id || corr)
      if (corr.correctedAt) setLastSaved(new Date(corr.correctedAt))

      if (corr.moveAnnotations?.length > 0) {
        // Restore each position status from saved annotations
        const restored = Array.from({ length: count }, (_, i) => {
          const ann = corr.moveAnnotations[i]
          if (!ann) return POS_STATUS.UNCHECKED
          return qualityToStatus(ann.quality)
        })
        setPositions(restored)
        return  // Don't overwrite with move sequence heuristic
      }
    }

    // No correction yet — fall back to move sequence heuristic
    if (sub?.moveSequence?.length > 0) {
      const filled = Array.from({ length: count }, (_, i) => {
        const move = sub.moveSequence[i]
        if (!move || move === '?' || move === '') return POS_STATUS.REVIEW
        return POS_STATUS.UNCHECKED
      })
      setPositions(filled)
    }
  }, [selectedHw])

  // Toggle position status on click
  const cyclePosition = (idx) => {
    setPositions((prev) => {
      const next = [...prev]
      const cur = STATUS_CYCLE.indexOf(next[idx])
      next[idx] = STATUS_CYCLE[(cur + 1) % STATUS_CYCLE.length]
      return next
    })
  }

  // Set all at once
  const setAll = (status) => setPositions((prev) => prev.map(() => status))
  const resetAll = () => setPositions((prev) => prev.map(() => POS_STATUS.UNCHECKED))

  // Score calculation
  const correctCount = positions.filter((p) => p === POS_STATUS.CORRECT).length
  const wrongCount   = positions.filter((p) => p === POS_STATUS.WRONG).length
  const reviewCount  = positions.filter((p) => p === POS_STATUS.REVIEW).length
  const totalPos     = positions.length
  const calcScore    = totalPos > 0 ? Math.round((correctCount / totalPos) * 100) : 0
  const grade        = calcScore >= 90 ? 'A' : calcScore >= 80 ? 'B' : calcScore >= 70 ? 'C' : calcScore >= 60 ? 'D' : 'F'

  const moveAnnotations = positions.map((p, i) => ({
    move: `Position ${i + 1}`,
    quality: p === POS_STATUS.CORRECT ? 'excellent' : p === POS_STATUS.WRONG ? 'mistake' : p === POS_STATUS.REVIEW ? 'inaccuracy' : 'unchecked',
    comment: p === POS_STATUS.CORRECT ? 'Correct' : p === POS_STATUS.WRONG ? 'Wrong' : p === POS_STATUS.REVIEW ? 'Needs review' : 'Not checked',
  }))

  const handleSave = async () => {
    if (!selectedStudent || !selectedHw) {
      toast.error('Select a student and homework first')
      return
    }
    if (positions.every((p) => p === POS_STATUS.UNCHECKED)) {
      toast.error('Mark at least one position before saving')
      return
    }
    setSaving(true)
    try {
      const existingCorrection = selectedSub?.correction
      const corrId = savedCorrId || existingCorrection?._id || existingCorrection

      let savedCorr
      if (corrId) {
        // Update existing correction for this specific student
        const res = await api.put(`/corrections/${corrId}`, {
          score: calcScore,
          feedback: feedback || '',
          moveAnnotations,
        })
        savedCorr = res.data.data
      } else {
        // Use offline endpoint — auto-creates submission if needed
        const res = await api.post('/corrections/offline', {
          studentId: selectedStudent._id,
          homeworkId: selectedHw._id,
          score: calcScore,
          feedback: feedback || '',
          moveAnnotations,
        })
        savedCorr = res.data.data?.correction
      }

      // Persist correction id and timestamp so UI stays in sync
      if (savedCorr?._id) setSavedCorrId(savedCorr._id)
      setLastSaved(new Date())

      const studentName = selectedStudent.firstName || selectedStudent.username
      toast.success(
        `✅ ${studentName}'s result saved! Score: ${calcScore}% (Grade ${grade}) — ${correctCount} correct, ${wrongCount} wrong, ${reviewCount} for review`,
        { duration: 5000 }
      )

      // Refresh everything so student sees updated result immediately
      qc.invalidateQueries(['sub-for-grading', selectedStudent._id, selectedHw._id])
      qc.invalidateQueries(['student-hw-correction', selectedStudent._id])
      qc.invalidateQueries(['all-students-correction'])
      qc.invalidateQueries(['my-homework'])
      qc.invalidateQueries(['my-submissions'])
      qc.invalidateQueries(['my-submissions-all'])
      qc.invalidateQueries(['student-dashboard'])
      qc.invalidateQueries(['student-hw-marks', selectedStudent._id])

    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save correction')
    } finally {
      setSaving(false)
    }
  }

  // Sync submission data into state when it loads
  useEffect(() => {
    if (subData !== undefined) {
      onSubLoad(subData)
    }
  }, [subData]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* Page header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Corrections</h1>
          <p className={styles.subtitle}>Each student has their own correction portal — results are saved permanently</p>
        </div>
      </div>

      <div className={styles.threeCol}>

        {/* ── Column 1: Students ── */}
        <div className={styles.col1}>
          <div className={styles.colHeader}>
            <Users size={14} />
            <span>Students</span>
            <span className={styles.colCount}>{students.length}</span>
          </div>
          <div className={styles.searchWrap}>
            <div className={styles.searchInputWrapper}>
              <Search size={14} className={styles.searchIcon} />
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className={styles.scrollList}>
            {loadingStudents && <div className={styles.loadMsg}>Loading…</div>}
            {students.length === 0 && !loadingStudents && (
              <div className={styles.emptyMsg}>No students registered</div>
            )}
            {students.map((s) => (
              <button
                key={s._id}
                className={[
                  styles.studentRow,
                  selectedStudent?._id === s._id ? styles.studentRowActive : '',
                ].join(' ')}
                onClick={() => selectStudent(s)}
              >
                <div className={styles.studentAvatar}>
                  {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                </div>
                <div className={styles.studentInfo}>
                  <div className={styles.studentName}>
                    {s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : s.username}
                  </div>
                  <div className={styles.studentEmail}>{s.email}</div>
                </div>
                <ChevronRight size={14} className={styles.arrowIcon} />
              </button>
            ))}
          </div>
        </div>

        {/* ── Column 2: Homework list for student ── */}
        <div className={styles.col2}>
          <div className={styles.colHeader}>
            <BookOpen size={14} />
            <span>{selectedStudent ? `${selectedStudent.firstName || selectedStudent.username}'s Homework` : 'Homework'}</span>
            {selectedStudent && <span className={styles.colCount}>{studentHomework.length}</span>}
          </div>
          <div className={styles.scrollList}>
            {!selectedStudent && (
              <div className={styles.emptyMsg} style={{ padding: '40px 20px', textAlign: 'center' }}>
                <Users size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                <div>Select a student to see their assigned homework</div>
              </div>
            )}
            {selectedStudent && loadingHw && <div className={styles.loadMsg}>Loading homework…</div>}
            {selectedStudent && !loadingHw && studentHomework.length === 0 && (
              <div className={styles.emptyMsg}>No homework assigned to this student</div>
            )}
            {studentHomework.map((hw) => {
              const posCount = parsePositionCount(hw)
              const sub = studentSubs?.find(s => {
                const sid = s.studentId?._id || s.studentId
                const hid = s.homeworkId?._id || s.homeworkId
                return sid?.toString() === selectedStudent._id && hid?.toString() === hw._id
              })
              const corr = sub?.correction
              const effectiveStatus = getEffectiveStatus(sub, corr, hw)
              const isCorrected = effectiveStatus === 'corrected'
              const statusVariant =
                effectiveStatus === 'corrected' ? 'green' :
                effectiveStatus === 'submitted' ? 'blue' :
                effectiveStatus === 'overdue' ? 'red' : 'yellow'
              return (
                <button
                  key={hw._id}
                  className={[
                    styles.hwRow,
                    selectedHw?._id === hw._id ? styles.hwRowActive : '',
                  ].join(' ')}
                  onClick={() => selectHomework(hw)}
                >
                  <div className={styles.hwStrip} style={{
                    background: isCorrected ? 'var(--green)' :
                                effectiveStatus === 'submitted' ? 'var(--accent)' : 'var(--yellow)',
                  }} />
                  <div className={styles.hwContent}>
                    <div className={styles.hwTitle}>{hw.title}</div>
                    <div className={styles.hwMeta}>
                      <Badge variant={statusVariant} size="sm">
                        {isCorrected ? '✓ Corrected' : effectiveStatus}
                      </Badge>
                      <span className={styles.hwPositions}>{posCount} positions</span>
                    </div>
                    {isCorrected && (
                      <div className={styles.hwCorrectedNote}>
                        <BadgeCheck size={11} /> Saved permanently · student can view
                      </div>
                    )}
                  </div>
                  <ChevronRight size={14} className={styles.arrowIcon} />
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Column 3: Grading panel ── */}
        <div className={styles.col3}>
          {!selectedHw ? (
            <div className={styles.placeholder}>
              <div className={styles.placeholderIcon}>♟</div>
              <h3>Select a homework to grade</h3>
              <p>Choose a student, then click a homework assignment to start grading positions.</p>
            </div>
          ) : (
            <div className={styles.gradingPanel}>

              {/* ── Permanent save indicator ── */}
              {lastSaved && (
                <div className={styles.savedBanner}>
                  <BadgeCheck size={14} />
                  <span>
                    Correction saved permanently — last updated {format(lastSaved, 'PPp')}
                  </span>
                </div>
              )}

              {/* Submission status notice */}
              {loadingSub && <div className={styles.loadMsg}>Checking submission…</div>}

              {/* Notice: no submission yet */}
              {!loadingSub && !subData && (
                <div className={styles.noSubBanner}>
                  <Clock size={14} />
                  <span>No submission yet — student hasn't submitted. You can still pre-grade positions.</span>
                </div>
              )}

              {/* Homework header */}
              <div className={styles.gradingHeader}>
                <div className={styles.gradingTitle}>{selectedHw.title}</div>
                <div className={styles.gradingMeta}>
                  <Badge variant="purple" size="sm">{selectedHw.category}</Badge>
                  <Badge variant={selectedHw.difficulty === 'beginner' ? 'green' : selectedHw.difficulty === 'intermediate' ? 'yellow' : 'red'} size="sm">
                    {selectedHw.difficulty}
                  </Badge>
                  <span className={styles.posCountLabel}>{positions.length} positions</span>
                </div>
              </div>

              {/* Batch action bar */}
              <div className={styles.batchBar}>
                <span className={styles.batchLabel}>Mark all as:</span>
                <button className={styles.batchBtn} style={{ color: 'var(--green)' }} onClick={() => setAll(POS_STATUS.CORRECT)}>
                  <CheckCircle size={13} /> All Correct
                </button>
                <button className={styles.batchBtn} style={{ color: 'var(--red)' }} onClick={() => setAll(POS_STATUS.WRONG)}>
                  <XCircle size={13} /> All Wrong
                </button>
                <button className={styles.batchBtn} style={{ color: 'var(--yellow)' }} onClick={() => setAll(POS_STATUS.REVIEW)}>
                  <HelpCircle size={13} /> All Review
                </button>
                <button className={styles.batchBtn} onClick={resetAll}>
                  <RotateCcw size={13} /> Reset
                </button>
              </div>

              {/* Position grid */}
              <div className={styles.posSection}>
                <div className={styles.posSectionLabel}>
                  Position-by-position marking — click to cycle: ○ → ✓ → ✗ → ?
                </div>
                <div className={styles.posGrid}>
                  {positions.map((status, i) => (
                    <button
                      key={i}
                      className={styles.posCell}
                      onClick={() => cyclePosition(i)}
                      style={{
                        background: statusBg(status),
                        borderColor: statusColor(status),
                        color: statusColor(status),
                      }}
                      title={`Position ${i + 1}: click to change status`}
                    >
                      <div className={styles.posCellNum}>{i + 1}</div>
                      <div className={styles.posCellIcon}>
                        {statusIcon(status, 18)}
                      </div>
                      <div className={styles.posCellLabel}>
                        {status === POS_STATUS.CORRECT ? 'Correct' :
                         status === POS_STATUS.WRONG   ? 'Wrong' :
                         status === POS_STATUS.REVIEW  ? 'Review' : '—'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Score summary */}
              <div className={styles.scoreSummary}>
                <div className={styles.scoreBox} style={{ color: 'var(--green)', background: 'var(--green-dim)', border: '1px solid rgba(34,197,94,0.3)' }}>
                  <CheckCircle size={16} />
                  <span className={styles.scoreNum}>{correctCount}</span>
                  <span className={styles.scoreLbl}>Correct</span>
                </div>
                <div className={styles.scoreBox} style={{ color: 'var(--red)', background: 'var(--red-dim)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <XCircle size={16} />
                  <span className={styles.scoreNum}>{wrongCount}</span>
                  <span className={styles.scoreLbl}>Wrong</span>
                </div>
                <div className={styles.scoreBox} style={{ color: 'var(--yellow)', background: 'var(--yellow-dim)', border: '1px solid rgba(245,158,11,0.3)' }}>
                  <HelpCircle size={16} />
                  <span className={styles.scoreNum}>{reviewCount}</span>
                  <span className={styles.scoreLbl}>Review</span>
                </div>
                <div className={styles.scoreBox} style={{
                  color: calcScore >= 80 ? 'var(--green)' : calcScore >= 60 ? 'var(--yellow)' : 'var(--red)',
                  background: calcScore >= 80 ? 'var(--green-dim)' : calcScore >= 60 ? 'var(--yellow-dim)' : 'var(--red-dim)',
                  border: `1px solid ${calcScore >= 80 ? 'rgba(34,197,94,0.3)' : calcScore >= 60 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                  <Trophy size={16} />
                  <span className={styles.scoreNum}>{calcScore}%</span>
                  <span className={styles.scoreLbl}>Grade {grade}</span>
                </div>
              </div>

              {/* Student result preview */}
              <div className={styles.previewBanner}>
                <div className={styles.previewLabel}>📋 What the student will see:</div>
                <div className={styles.previewRow}>
                  {positions.map((s, i) => (
                    <div
                      key={i}
                      className={styles.previewDot}
                      style={{ background: statusColor(s), opacity: s === POS_STATUS.UNCHECKED ? 0.25 : 1 }}
                      title={`Position ${i + 1}: ${s}`}
                    >
                      {i + 1}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  Score: <strong style={{ color: 'var(--text-primary)' }}>{calcScore}%</strong> &nbsp;·&nbsp;
                  Correct: <strong style={{ color: 'var(--green)' }}>{correctCount}</strong> &nbsp;·&nbsp;
                  Wrong: <strong style={{ color: 'var(--red)' }}>{wrongCount}</strong> &nbsp;·&nbsp;
                  Review: <strong style={{ color: 'var(--yellow)' }}>{reviewCount}</strong>
                </div>
              </div>

              {/* Feedback */}
              <div className={styles.feedbackSection}>
                <label className={styles.feedbackLabel}>
                  Feedback for student <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  className={styles.feedbackArea}
                  placeholder="Optional — write feedback for the student about their positions, strategy, and areas to improve…"
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Save button */}
              <Button
                loading={saving}
                icon={<Save size={15} />}
                onClick={handleSave}
                fullWidth
                disabled={positions.every((p) => p === POS_STATUS.UNCHECKED)}
              >
                {lastSaved
                  ? `Update ${selectedStudent?.firstName || selectedStudent?.username}'s Correction — ${calcScore}% (Grade ${grade})`
                  : `Save Correction — ${calcScore}% (Grade ${grade}) → ${selectedStudent?.firstName || selectedStudent?.username}`
                }
              </Button>

              {lastSaved && (
                <p className={styles.noSubNote} style={{ color: 'var(--green)' }}>
                  <BadgeCheck size={13} style={{ display: 'inline', marginRight: 4 }} />
                  Saved permanently — {selectedStudent?.firstName || selectedStudent?.username} can view this result in their portal.
                </p>
              )}
              {!subData && !loadingSub && !lastSaved && (
                <p className={styles.noSubNote}>
                  ✓ No digital submission needed — clicking Save will auto-create results for the student.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
