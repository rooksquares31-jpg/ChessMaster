import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle, ChevronRight, ChevronLeft, Zap, Sliders, Search, Users, UserPlus, UserMinus, X } from 'lucide-react'
import { Chess } from 'chess.js'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Step1Details from './wizard/Step1Details'
import Step2Positions from './wizard/Step2Positions'
import Step3PositionEntry from './wizard/Step3PositionEntry'
import Step4Assign from './wizard/Step4Assign'
import Step5Publish from './wizard/Step5Publish'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import Input from '../../components/ui/Input'
import styles from './CreateHomework.module.css'

const STEPS = [
  { id: 1, label: 'Details' },
  { id: 2, label: 'Positions' },
  { id: 3, label: 'Position Entry' },
  { id: 4, label: 'Assign' },
  { id: 5, label: 'Publish' },
]

const emptyPosition = () => ({
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  correctMove: '',
  explanation: '',
  points: 10,
})

const displayError = (err, fallback) => {
  const serverMsg = err.response?.data?.message
  const validationErrors = err.response?.data?.errors
  if (validationErrors && validationErrors.length > 0) {
    validationErrors.forEach((e) => toast.error(e.message || e.msg || 'Validation error'))
  } else {
    toast.error(serverMsg || fallback)
  }
}

export default function CreateHomework() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('simple') // 'simple' or 'advanced'
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Simple mode states
  const [simpleTitle, setSimpleTitle] = useState('')
  const [simplePositions, setSimplePositions] = useState('10')
  const [simpleAssigned, setSimpleAssigned] = useState([])  // students assigned in simple mode
  const [simpleSearch, setSimpleSearch] = useState('')

  // Load all students for simple-mode picker
  const { data: studentsData } = useQuery({
    queryKey: ['students-assign'],
    queryFn: () => api.get('/students?limit=100&status=active').then((r) => r.data.data),
  })
  const allStudents = studentsData || []
  const filteredStudents = allStudents.filter((s) =>
    !simpleSearch ||
    s.username?.toLowerCase().includes(simpleSearch.toLowerCase()) ||
    s.firstName?.toLowerCase().includes(simpleSearch.toLowerCase()) ||
    s.email?.toLowerCase().includes(simpleSearch.toLowerCase())
  )
  const isSimpleAssigned = (id) => simpleAssigned.some((s) => s._id === id)
  const toggleSimple = (student) => {
    if (isSimpleAssigned(student._id)) {
      setSimpleAssigned((a) => a.filter((s) => s._id !== student._id))
    } else {
      setSimpleAssigned((a) => [...a, student])
    }
  }

  // Advanced mode states
  const [details, setDetails] = useState({
    title: '', topic: '', category: 'tactics', difficulty: 'intermediate', dueDate: '',
  })
  const [positionCount, setPositionCount] = useState(10)
  const [positions, setPositions] = useState(() => Array.from({ length: 10 }, emptyPosition))
  const [assignedStudents, setAssignedStudents] = useState([])

  const updatePositionCount = (n) => {
    setPositionCount(n)
    setPositions((prev) => {
      if (n > prev.length) return [...prev, ...Array.from({ length: n - prev.length }, emptyPosition)]
      return prev.slice(0, n)
    })
  }

  const updatePosition = (idx, field, value) => {
    setPositions((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)))
  }

  const canNext = () => {
    if (step === 1) return details.title && details.category && details.difficulty && details.dueDate
    if (step === 2) return positionCount >= 1
    if (step === 3) {
      return positions.every((p) => {
        if (!p.fen || !p.correctMove) return false
        try {
          const g = new Chess()
          const val = g.validateFen ? g.validateFen(p.fen) : (Chess.validateFen ? Chess.validateFen(p.fen) : null)
          if (val && !val.valid) return false
          const result = g.load(p.fen)
          return result !== false
        } catch {
          return false
        }
      })
    }
    return true
  }

  const handleSimplePublish = async (e) => {
    e.preventDefault()
    if (!simpleTitle.trim()) {
      toast.error('Title is required')
      return
    }
    const count = parseInt(simplePositions, 10)
    if (isNaN(count) || count < 1) {
      toast.error('Number of positions must be at least 1')
      return
    }

    setSaving(true)
    try {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 7)
      dueDate.setHours(23, 59, 59, 999)

      const simplePositionsArray = Array.from({ length: count }, emptyPosition)

      const hwPayload = {
        title: simpleTitle,
        description: 'Simple homework assignment',
        category: 'tactics',
        difficulty: 'intermediate',
        dueDate: dueDate.toISOString(),
        instructions: simplePositionsArray.map((p, i) =>
          `Position ${i + 1}: ${p.explanation || ''} [Correct: ${p.correctMove}]`
        ).join('\n'),
        fenPosition: simplePositionsArray[0]?.fen || undefined,
        positions: simplePositionsArray,
        maxScore: count * 10,
      }

      const { data } = await api.post('/homework', hwPayload)
      const hwId = data.data._id

      // Assign selected students so they see this homework when they log in
      if (simpleAssigned.length > 0) {
        await api.post('/homework/assign', {
          homeworkId: hwId,
          studentIds: simpleAssigned.map((s) => s._id),
        })
        toast.success(`Homework published & assigned to ${simpleAssigned.length} student${simpleAssigned.length > 1 ? 's' : ''}!`)
      } else {
        toast.success('Homework published! Assign students from the homework list.')
      }
      navigate('/admin/homework')
    } catch (err) {
      displayError(err, 'Failed to publish')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    setSaving(true)
    try {
      // Create homework
      const hwPayload = {
        title: details.title,
        description: details.topic,
        category: details.category,
        difficulty: details.difficulty,
        dueDate: new Date(details.dueDate).toISOString(),
        instructions: positions.map((p, i) =>
          `Position ${i + 1}: ${p.explanation || ''} [Correct: ${p.correctMove}]`
        ).join('\n'),
        fenPosition: positions[0]?.fen || undefined,
        positions: positions,
        maxScore: positions.reduce((a, p) => a + (p.points || 10), 0),
      }
      const { data } = await api.post('/homework', hwPayload)
      const hwId = data.data._id

      // Assign students
      if (assignedStudents.length > 0) {
        await api.post('/homework/assign', { homeworkId: hwId, studentIds: assignedStudents.map((s) => s._id) })
      }

      toast.success('Homework published successfully!')
      navigate('/admin/homework')
    } catch (err) {
      displayError(err, 'Failed to publish')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Create Homework</h1>
          <p className={styles.subtitle}>Build a chess homework assignment step by step</p>
        </div>
        <div className={styles.toggleContainer}>
          <div className={styles.modeToggle}>
            <button
              type="button"
              className={[styles.modeBtn, mode === 'simple' ? styles.modeBtnActive : ''].join(' ')}
              onClick={() => setMode('simple')}
            >
              <Zap size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Simple Mode
            </button>
            <button
              type="button"
              className={[styles.modeBtn, mode === 'advanced' ? styles.modeBtnActive : ''].join(' ')}
              onClick={() => setMode('advanced')}
            >
              <Sliders size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
              Advanced Mode
            </button>
          </div>
          <Button variant="ghost" onClick={() => navigate('/admin/homework')}>Cancel</Button>
        </div>
      </div>

      {mode === 'simple' ? (
        <Card glass className={styles.content}>
          <form onSubmit={handleSimplePublish} className={styles.simpleForm}>
            <div className={styles.simpleHeader}>
              <div className={styles.simpleIconWrap}>
                <Zap size={20} />
              </div>
              <div>
                <h2 className={styles.simpleTitle}>Quick Homework Creation</h2>
                <p className={styles.simpleSubtitle}>Create a homework assignment quickly with standard empty positions.</p>
              </div>
            </div>

            <Input
              label="Homework Title"
              placeholder="e.g. Knight Forks Practice"
              value={simpleTitle}
              onChange={(e) => setSimpleTitle(e.target.value)}
              required
            />

            <Input
              label="Number of Positions"
              type="number"
              min="1"
              max="50"
              placeholder="10"
              value={simplePositions}
              onChange={(e) => setSimplePositions(e.target.value)}
              required
              hint="Enter the number of chess positions for this assignment (1-50)"
            />

            {/* ── Assign Students ── */}
            <div className={styles.simpleAssignSection}>
              <div className={styles.simpleAssignLabel}>
                <Users size={15} />
                Assign to Students
                <span className={styles.simpleAssignCount}>
                  {simpleAssigned.length > 0
                    ? `${simpleAssigned.length} selected`
                    : 'Optional'}
                </span>
              </div>

              {/* Assigned chips */}
              {simpleAssigned.length > 0 && (
                <div className={styles.assignedChips}>
                  {simpleAssigned.map((s) => (
                    <div key={s._id} className={styles.assignedChip}>
                      <div className={styles.chipAvatar}>
                        {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                      </div>
                      <span className={styles.chipName}>
                        {s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : s.username}
                      </span>
                      <button
                        type="button"
                        className={styles.chipRemove}
                        onClick={() => toggleSimple(s)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search + list */}
              <div className={styles.simpleStudentPicker}>
                <div className={styles.simpleSearchWrap}>
                  <Search size={13} className={styles.simpleSearchIcon} />
                  <input
                    type="text"
                    className={styles.simpleSearchInput}
                    placeholder="Search students by name or email…"
                    value={simpleSearch}
                    onChange={(e) => setSimpleSearch(e.target.value)}
                  />
                </div>
                <div className={styles.simpleStudentList}>
                  {filteredStudents.length === 0 ? (
                    <div className={styles.simpleNoStudents}>
                      {allStudents.length === 0 ? 'No active students found' : 'No students match your search'}
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        className={styles.selectAllBtn}
                        onClick={() => setSimpleAssigned(filteredStudents)}
                      >
                        <Users size={13} /> Select all ({filteredStudents.length})
                      </button>
                      {filteredStudents.map((s) => {
                        const assigned = isSimpleAssigned(s._id)
                        return (
                          <button
                            key={s._id}
                            type="button"
                            className={[styles.simpleStudentRow, assigned ? styles.simpleStudentSelected : ''].join(' ')}
                            onClick={() => toggleSimple(s)}
                          >
                            <div className={styles.simpleStudentAvatar}>
                              {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                            </div>
                            <div className={styles.simpleStudentInfo}>
                              <div className={styles.simpleStudentName}>
                                {s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : s.username}
                              </div>
                              <div className={styles.simpleStudentEmail}>{s.email}</div>
                            </div>
                            {assigned
                              ? <CheckCircle size={16} className={styles.assignedCheck} />
                              : <UserPlus size={16} className={styles.addIcon} />}
                          </button>
                        )
                      })}
                    </>
                  )}
                </div>
              </div>
            </div>

            <div style={{ marginTop: '4px' }}>
              <Button
                type="submit"
                loading={saving}
                fullWidth
                size="lg"
                icon={<CheckCircle size={16} />}
              >
                {simpleAssigned.length > 0
                  ? `Publish & Assign to ${simpleAssigned.length} Student${simpleAssigned.length > 1 ? 's' : ''}`
                  : 'Publish Homework'}
              </Button>
            </div>
          </form>
        </Card>
      ) : (
        <>
          {/* Step indicator */}
          <div className={styles.stepper}>
            {STEPS.map((s, i) => (
              <div key={s.id} className={styles.stepItem}>
                <div className={[styles.stepCircle, step === s.id ? styles.active : step > s.id ? styles.done : ''].join(' ')}>
                  {step > s.id ? <CheckCircle size={16} /> : s.id}
                </div>
                <span className={[styles.stepLabel, step === s.id ? styles.activeLabel : ''].join(' ')}>{s.label}</span>
                {i < STEPS.length - 1 && <div className={[styles.stepLine, step > s.id ? styles.lineDone : ''].join(' ')} />}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div className={styles.content}>
            {step === 1 && <Step1Details details={details} setDetails={setDetails} />}
            {step === 2 && <Step2Positions count={positionCount} setCount={updatePositionCount} />}
            {step === 3 && (
              <Step3PositionEntry positions={positions} updatePosition={updatePosition} />
            )}
            {step === 4 && (
              <Step4Assign assigned={assignedStudents} setAssigned={setAssignedStudents} />
            )}
            {step === 5 && (
              <Step5Publish
                details={details} positions={positions}
                assignedStudents={assignedStudents}
                onPublish={handlePublish} saving={saving}
              />
            )}
          </div>

          {/* Nav buttons */}
          {step < 5 && (
            <div className={styles.nav}>
              {step > 1 && (
                <Button variant="secondary" icon={<ChevronLeft size={16} />} onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              <Button
                iconRight={<ChevronRight size={16} />}
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
              >
                {step === 4 ? 'Review & Publish' : 'Continue'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
