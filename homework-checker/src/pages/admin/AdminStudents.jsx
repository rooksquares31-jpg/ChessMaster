import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  UserPlus, Search, Filter, MoreVertical, Eye, Edit2,
  UserX, UserCheck, Mail, Calendar, Trophy, BookOpen,
  Users, TrendingUp, CheckCircle, XCircle, X, ChevronDown, Trash2, AlertTriangle,
  BarChart2, Clock, HelpCircle, Minus, BadgeCheck, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format, isPast } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import ProgressBar from '../../components/ui/ProgressBar'
import styles from './AdminStudents.module.css'

/* ─── Add / Edit Student Form ─────────────────────────────────────────── */
export function StudentForm({ initial = {}, onSubmit, loading, error }) {
  const isEdit = !!initial._id
  const [form, setForm] = useState({
    firstName: initial.firstName || '',
    lastName:  initial.lastName  || '',
    username:  initial.username  || '',
    email:     initial.email     || '',
    password:  '',
    grade:     initial.grade     || '',
    phone:     initial.phone     || '',
    notes:     initial.notes     || '',
  })
  const [fieldErrors, setFieldErrors] = useState({})

  const set = (field) => (e) => {
    setForm((f) => ({ ...f, [field]: e.target.value }))
    setFieldErrors((fe) => ({ ...fe, [field]: '' }))
  }

  const validate = () => {
    const errs = {}
    if (!form.firstName.trim()) errs.firstName = 'First name is required'
    if (!form.username.trim())  errs.username  = 'Username is required'
    if (form.username.length < 3) errs.username = 'Username must be at least 3 characters'
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) errs.username = 'Letters, numbers and _ only'
    if (!form.email.trim())     errs.email     = 'Email is required'
    if (!/^\S+@\S+\.\S+$/.test(form.email)) errs.email = 'Valid email required'
    if (!isEdit) {
      if (!form.password) errs.password = 'Password is required'
      else if (form.password.length < 8) errs.password = 'Minimum 8 characters'
      else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password))
        errs.password = 'Need uppercase, lowercase and a number'
    }
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!validate()) return
    const payload = { ...form }
    if (isEdit && !payload.password) delete payload.password
    onSubmit(payload)
  }

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <div className={styles.formError}><XCircle size={15} />{error}</div>}

      <div className={styles.formGrid}>
        <Input label="First Name" placeholder="Alice" value={form.firstName}
          onChange={set('firstName')} error={fieldErrors.firstName} required />
        <Input label="Last Name" placeholder="Smith" value={form.lastName}
          onChange={set('lastName')}  error={fieldErrors.lastName} />
      </div>

      <div className={styles.formGrid}>
        <Input label="Username" placeholder="alice_chess" value={form.username}
          onChange={set('username')} error={fieldErrors.username}
          hint="Letters, numbers, underscores only" required />
        <Input label="Email" type="email" placeholder="alice@school.com"
          value={form.email} onChange={set('email')} error={fieldErrors.email}
          icon={<Mail size={15} />} required />
      </div>

      <div className={styles.formGrid}>
        <Input
          label={isEdit ? 'New Password (leave blank to keep)' : 'Password'}
          type="password" placeholder={isEdit ? '••••••••' : 'Min 8 chars'}
          value={form.password} onChange={set('password')}
          error={fieldErrors.password}
          required={!isEdit}
          hint={!isEdit ? 'Uppercase + lowercase + number required' : undefined}
        />
        <Input label="Grade / Class" placeholder="e.g. Grade 6, Club A"
          value={form.grade} onChange={set('grade')} />
      </div>

      <Input label="Phone / Parent Contact" placeholder="+1 555 000 0000"
        value={form.phone} onChange={set('phone')} />

      <div className={styles.notesWrap}>
        <label className={styles.notesLabel}>Notes (optional)</label>
        <textarea
          className={styles.notesArea}
          placeholder="Any additional information about this student…"
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
        />
      </div>

      <div className={styles.formActions}>
        <Button type="submit" loading={loading} fullWidth size="lg"
          icon={isEdit ? <Edit2 size={16} /> : <UserPlus size={16} />}>
          {isEdit ? 'Update Student' : 'Add Student'}
        </Button>
      </div>
    </form>
  )
}

/* ─── Homework Marks Section (inside drawer) ─────────────────────────── */
function qualityToStatus(quality) {
  if (quality === 'excellent') return 'correct'
  if (quality === 'mistake' || quality === 'blunder') return 'wrong'
  if (quality === 'inaccuracy' || quality === 'good') return 'review'
  return 'unchecked'
}

function StudentHomeworkMarks({ studentId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['student-hw-marks', studentId],
    queryFn: () => api.get(`/students/${studentId}/homework`).then((r) => r.data.data),
    enabled: !!studentId,
  })

  if (isLoading) return (
    <div className={styles.hwMarksLoading}>
      <div className={styles.spinner} /> Loading homework…
    </div>
  )

  const list = data || []

  if (list.length === 0) return (
    <div className={styles.hwMarksEmpty}>
      <BookOpen size={32} style={{ opacity: 0.25 }} />
      <p>No homework assigned yet</p>
    </div>
  )

  return (
    <div className={styles.hwMarksList}>
      {list.map(({ homework: hw, submission: sub, correction: corr }) => {
        const isCorrected = !!corr
        const isSubmitted = !!sub && !corr
        const overdue = !sub && isPast(new Date(hw.dueDate))
        const positions = corr?.moveAnnotations?.length > 0
          ? corr.moveAnnotations.map((ann) => qualityToStatus(ann.quality))
          : []
        const correct = positions.filter((s) => s === 'correct').length
        const wrong   = positions.filter((s) => s === 'wrong').length
        const review  = positions.filter((s) => s === 'review').length

        return (
          <div key={hw._id} className={styles.hwMarkRow}>
            {/* Left colour strip */}
            <div className={styles.hwMarkStrip} style={{
              background: isCorrected ? 'var(--green)' : isSubmitted ? 'var(--accent)' : overdue ? 'var(--red)' : 'var(--yellow)',
            }} />

            <div className={styles.hwMarkBody}>
              {/* Title + badges */}
              <div className={styles.hwMarkTop}>
                <span className={styles.hwMarkTitle}>{hw.title}</span>
                <div className={styles.hwMarkBadges}>
                  <Badge variant="purple" size="sm">{hw.category}</Badge>
                  <Badge
                    variant={hw.difficulty === 'beginner' ? 'green' : hw.difficulty === 'intermediate' ? 'yellow' : 'red'}
                    size="sm"
                  >
                    {hw.difficulty}
                  </Badge>
                  <Badge
                    variant={isCorrected ? 'green' : isSubmitted ? 'blue' : overdue ? 'red' : 'yellow'}
                    size="sm" dot
                  >
                    {isCorrected ? 'Corrected ✓' : isSubmitted ? 'Submitted' : overdue ? 'Overdue' : 'Pending'}
                  </Badge>
                </div>
              </div>

              {/* Due date */}
              <div className={styles.hwMarkDue}>
                <Calendar size={11} />
                <span>Due {format(new Date(hw.dueDate), 'PPP')}</span>
                {sub?.submittedAt && (
                  <span style={{ color: 'var(--text-muted)' }}>· Submitted {format(new Date(sub.submittedAt), 'MMM d, yyyy')}</span>
                )}
              </div>

              {/* Score + grade (if corrected) */}
              {isCorrected && (
                <>
                  <div className={styles.hwMarkScore}>
                    <div className={styles.hwScoreBox} style={{
                      background: corr.score >= 80 ? 'var(--green-dim)' : corr.score >= 60 ? 'var(--yellow-dim)' : 'var(--red-dim)',
                      color: corr.score >= 80 ? 'var(--green)' : corr.score >= 60 ? 'var(--yellow)' : 'var(--red)',
                      border: `1px solid ${corr.score >= 80 ? 'rgba(34,197,94,0.3)' : corr.score >= 60 ? 'rgba(245,158,11,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}>
                      <Trophy size={13} />
                      <strong>{corr.score}%</strong>
                      <span>Grade {corr.grade}</span>
                    </div>
                    {positions.length > 0 && (
                      <div className={styles.hwPosCount}>
                        <span style={{ color: 'var(--green)' }}><CheckCircle size={11} /> {correct}</span>
                        <span style={{ color: 'var(--red)' }}><XCircle size={11} /> {wrong}</span>
                        {review > 0 && <span style={{ color: 'var(--yellow)' }}><HelpCircle size={11} /> {review}</span>}
                      </div>
                    )}
                  </div>

                  {/* Position mini-grid */}
                  {positions.length > 0 && (
                    <div className={styles.hwMiniGrid}>
                      {positions.map((status, i) => (
                        <div
                          key={i}
                          className={[
                            styles.hwMiniCell,
                            status === 'correct'  ? styles.hwMiniCorrect  :
                            status === 'wrong'    ? styles.hwMiniWrong    :
                            status === 'review'   ? styles.hwMiniReview   :
                                                    styles.hwMiniUnchecked,
                          ].join(' ')}
                          title={`Position ${i + 1}: ${status}`}
                        >
                          <span className={styles.hwMiniNum}>{i + 1}</span>
                          <span className={styles.hwMiniIcon}>
                            {status === 'correct' ? '✅' : status === 'wrong' ? '❌' : status === 'review' ? '❓' : <Minus size={8} />}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Feedback */}
                  {corr.feedback && (
                    <div className={styles.hwFeedback}>
                      <BadgeCheck size={11} style={{ flexShrink: 0 }} />
                      <span>{corr.feedback}</span>
                    </div>
                  )}

                  {corr.correctedAt && (
                    <div className={styles.hwCorrectedAt}>
                      Graded {format(new Date(corr.correctedAt), 'PPp')}
                    </div>
                  )}
                </>
              )}

              {/* Awaiting review note */}
              {isSubmitted && (
                <div className={styles.hwAwaitingNote}>
                  <Clock size={11} /> Submitted — awaiting correction
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ─── Student Detail Drawer ──────────────────────────────────────────── */
function StudentDetailModal({ student, onClose, onEdit, onToggleStatus, onDelete }) {
  const [tab, setTab] = useState('overview') // 'overview' | 'homework'

  const { data } = useQuery({
    queryKey: ['student-detail', student._id],
    queryFn: () => api.get(`/students/${student._id}`).then((r) => r.data.data),
    enabled: !!student._id,
  })

  const s = data?.student || student
  const progress = data?.progress

  const completionRate = progress?.totalHomework > 0
    ? Math.round((progress.completedHomework / progress.totalHomework) * 100) : 0

  return (
    <div className={styles.drawer}>
      {/* Header */}
      <div className={styles.drawerHeader}>
        <div className={styles.drawerAvatar}
          style={{ background: s.status === 'active'
            ? 'linear-gradient(135deg,#4f8ef7,#a855f7)'
            : 'linear-gradient(135deg,#555,#333)' }}>
          {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
        </div>
        <div className={styles.drawerInfo}>
          <h3 className={styles.drawerName}>
            {s.firstName ? `${s.firstName} ${s.lastName || ''}` : s.username}
          </h3>
          <p className={styles.drawerUsername}>@{s.username}</p>
          <Badge variant={s.status === 'active' ? 'green' : 'red'} dot>{s.status}</Badge>
        </div>
        <button className={styles.drawerClose} onClick={onClose}><X size={18} /></button>
      </div>

      {/* Tab strip */}
      <div className={styles.tabStrip}>
        <button
          className={[styles.tabBtn, tab === 'overview' ? styles.tabBtnActive : ''].join(' ')}
          onClick={() => setTab('overview')}
        >
          <BarChart2 size={13} /> Overview
        </button>
        <button
          className={[styles.tabBtn, tab === 'homework' ? styles.tabBtnActive : ''].join(' ')}
          onClick={() => setTab('homework')}
        >
          <BookOpen size={13} /> Homework &amp; Marks
        </button>
      </div>

      {tab === 'overview' ? (
        <>
          {/* Info grid */}
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <Mail size={14} className={styles.infoIcon} />
              <div>
                <div className={styles.infoLabel}>Email</div>
                <div className={styles.infoValue}>{s.email}</div>
              </div>
            </div>
            <div className={styles.infoItem}>
              <Calendar size={14} className={styles.infoIcon} />
              <div>
                <div className={styles.infoLabel}>Joined</div>
                <div className={styles.infoValue}>{s.createdAt ? format(new Date(s.createdAt), 'PPP') : '—'}</div>
              </div>
            </div>
            {s.grade && (
              <div className={styles.infoItem}>
                <BookOpen size={14} className={styles.infoIcon} />
                <div>
                  <div className={styles.infoLabel}>Grade / Class</div>
                  <div className={styles.infoValue}>{s.grade}</div>
                </div>
              </div>
            )}
            {s.lastLogin && (
              <div className={styles.infoItem}>
                <CheckCircle size={14} className={styles.infoIcon} />
                <div>
                  <div className={styles.infoLabel}>Last Login</div>
                  <div className={styles.infoValue}>{format(new Date(s.lastLogin), 'PPP p')}</div>
                </div>
              </div>
            )}
          </div>

          {/* Progress */}
          {progress ? (
            <div className={styles.progressSection}>
              <h4 className={styles.sectionTitle}>Progress Overview</h4>
              <div className={styles.progressStats}>
                <div className={styles.pStat}>
                  <div className={styles.pStatNum} style={{ color: 'var(--accent)' }}>
                    {progress.totalHomework}
                  </div>
                  <div className={styles.pStatLbl}>Assigned</div>
                </div>
                <div className={styles.pStat}>
                  <div className={styles.pStatNum} style={{ color: 'var(--green)' }}>
                    {progress.completedHomework}
                  </div>
                  <div className={styles.pStatLbl}>Completed</div>
                </div>
                <div className={styles.pStat}>
                  <div className={styles.pStatNum} style={{ color: 'var(--yellow)' }}>
                    {progress.overdueHomework || 0}
                  </div>
                  <div className={styles.pStatLbl}>Overdue</div>
                </div>
                <div className={styles.pStat}>
                  <div className={styles.pStatNum} style={{ color: 'var(--purple)' }}>
                    {progress.averageScore || 0}%
                  </div>
                  <div className={styles.pStatLbl}>Avg Score</div>
                </div>
              </div>
              <div className={styles.progressBars}>
                <ProgressBar
                  value={completionRate} max={100}
                  color={completionRate >= 80 ? 'green' : completionRate >= 50 ? 'yellow' : 'red'}
                  label="Completion Rate" showPercent
                />
                <ProgressBar
                  value={progress.averageScore || 0} max={100}
                  color="blue" label="Average Score" showPercent
                />
              </div>
            </div>
          ) : (
            <div className={styles.noProgress}>No activity recorded yet</div>
          )}
        </>
      ) : (
        /* ── Homework & Marks tab ── */
        <StudentHomeworkMarks studentId={s._id} />
      )}

      {/* Actions */}
      <div className={styles.drawerActions}>
        <Button variant="secondary" icon={<Edit2 size={15} />} onClick={() => onEdit(s)} fullWidth>
          Edit Profile
        </Button>
        <Button
          variant={s.status === 'active' ? 'danger' : 'success'}
          icon={s.status === 'active' ? <UserX size={15} /> : <UserCheck size={15} />}
          onClick={() => onToggleStatus(s)}
          fullWidth
        >
          {s.status === 'active' ? 'Deactivate Account' : 'Reactivate Account'}
        </Button>
        <Button
          variant="danger"
          icon={<Trash2 size={15} />}
          onClick={() => onDelete(s)}
          fullWidth
        >
          Delete Permanently
        </Button>
      </div>
    </div>
  )
}

/* ─── Main Page ──────────────────────────────────────────────────────── */
export default function AdminStudents() {
  const qc = useQueryClient()

  const [search, setSearch]               = useState('')
  const [statusFilter, setStatus]         = useState('all')
  const [showAdd, setShowAdd]             = useState(false)
  const [editStudent, setEdit]            = useState(null)
  const [viewStudent, setView]            = useState(null)
  const [menuOpen, setMenuOpen]           = useState(null)
  const [formError, setFormError]         = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null) // student to delete

  /* ── Queries ── */
  const params = new URLSearchParams({ limit: 100 })
  if (statusFilter !== 'all') params.set('status', statusFilter)
  if (search) params.set('search', search)

  const { data, isLoading } = useQuery({
    queryKey: ['students', search, statusFilter],
    queryFn: () => api.get(`/students?${params}`).then((r) => r.data.data),
  })
  const students = data || []

  /* ── Stats ── */
  const total  = students.length
  const active = students.filter((s) => s.status === 'active').length
  const inactive = total - active

  /* ── Mutations ── */
  const createMut = useMutation({
    mutationFn: (payload) => api.post('/students', payload),
    onSuccess: () => {
      toast.success('Student account created!')
      qc.invalidateQueries(['students'])
      setShowAdd(false)
      setFormError('')
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Failed to create student'
      setFormError(msg)
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, payload }) => api.put(`/students/${id}`, payload),
    onSuccess: () => {
      toast.success('Student updated!')
      qc.invalidateQueries(['students'])
      qc.invalidateQueries(['student-detail', editStudent?._id])
      setEdit(null)
      setFormError('')
      if (viewStudent) setView((v) => ({ ...v, ...editStudent }))
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Failed to update'
      setFormError(msg)
    },
  })

  const toggleStatusMut = useMutation({
    mutationFn: ({ id, status }) =>
      status === 'active'
        ? api.put(`/students/${id}`, { status: 'inactive' })
        : api.put(`/students/${id}`, { status: 'active' }),
    onSuccess: (_, vars) => {
      const action = vars.status === 'active' ? 'Deactivated' : 'Reactivated'
      toast.success(`${action} successfully`)
      qc.invalidateQueries(['students'])
      qc.invalidateQueries(['student-detail', vars.id])
      setView(null)
    },
    onError: () => toast.error('Action failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/students/${id}`),
    onSuccess: () => {
      toast.success('Student and all their data permanently deleted')
      qc.invalidateQueries(['students'])
      qc.invalidateQueries(['admin-homework'])
      qc.invalidateQueries(['my-homework'])
      qc.invalidateQueries(['all-students-correction'])
      setConfirmDelete(null)
      setView(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  })

  const handleCreate = (payload) => createMut.mutate(payload)
  const handleUpdate = (payload) => updateMut.mutate({ id: editStudent._id, payload })
  const handleToggle = (s) => toggleStatusMut.mutate({ id: s._id, status: s.status })
  const handleDelete = (s) => { setConfirmDelete(s); setView(null) }

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Students</h1>
          <p className={styles.subtitle}>Manage your chess students</p>
        </div>
        <Button icon={<UserPlus size={16} />} onClick={() => { setFormError(''); setShowAdd(true) }}>
          Add Student
        </Button>
      </div>

      {/* ── Stats strip ── */}
      <div className={styles.statsRow}>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <Users size={18} />
          </div>
          <div className={styles.statBody}>
            <div className={styles.statNum}>{total}</div>
            <div className={styles.statLbl}>Total Students</div>
          </div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
            <UserCheck size={18} />
          </div>
          <div className={styles.statBody}>
            <div className={styles.statNum}>{active}</div>
            <div className={styles.statLbl}>Active</div>
          </div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
            <UserX size={18} />
          </div>
          <div className={styles.statBody}>
            <div className={styles.statNum}>{inactive}</div>
            <div className={styles.statLbl}>Inactive</div>
          </div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--purple-dim)', color: 'var(--purple)' }}>
            <TrendingUp size={18} />
          </div>
          <div className={styles.statBody}>
            <div className={styles.statNum}>
              {total > 0 ? Math.round((active / total) * 100) : 0}%
            </div>
            <div className={styles.statLbl}>Active Rate</div>
          </div>
        </Card>
      </div>

      {/* ── Search + Filter ── */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search by name, username or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>
              <X size={14} />
            </button>
          )}
        </div>

        <div className={styles.filterGroup}>
          {['all', 'active', 'inactive'].map((s) => (
            <button
              key={s}
              className={[styles.filterBtn, statusFilter === s ? styles.filterBtnActive : ''].join(' ')}
              onClick={() => setStatus(s)}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      {isLoading ? (
        <div className={styles.loading}>
          <div className={styles.spinner} />
          Loading students…
        </div>
      ) : students.length === 0 ? (
        <Card className={styles.empty}>
          <Users size={48} className={styles.emptyIcon} />
          <h3>
            {search || statusFilter !== 'all'
              ? 'No students match your search'
              : 'No students yet'}
          </h3>
          <p>
            {search || statusFilter !== 'all'
              ? 'Try adjusting your search or filter.'
              : 'Add your first student to get started.'}
          </p>
          {!search && statusFilter === 'all' && (
            <Button icon={<UserPlus size={16} />} onClick={() => setShowAdd(true)} size="sm">
              Add First Student
            </Button>
          )}
        </Card>
      ) : (
        <div className={styles.tableWrap}>
          <div className={styles.tableHead}>
            <span>Student</span>
            <span>Email</span>
            <span>Grade</span>
            <span>Joined</span>
            <span>Status</span>
            <span>Actions</span>
          </div>

          {students.map((s) => (
            <div key={s._id} className={styles.tableRow}>
              {/* Avatar + name */}
              <div className={styles.studentCell} onClick={() => setView(s)}>
                <div
                  className={styles.avatar}
                  style={{
                    background: s.status === 'active'
                      ? 'linear-gradient(135deg,#4f8ef7,#a855f7)'
                      : 'linear-gradient(135deg,#555,#333)',
                  }}
                >
                  {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                </div>
                <div>
                  <div className={styles.studentName}>
                    {s.firstName ? `${s.firstName} ${s.lastName || ''}` : s.username}
                  </div>
                  <div className={styles.studentUsername}>@{s.username}</div>
                </div>
              </div>

              {/* Email */}
              <div className={styles.cell}>
                <span className={styles.emailCell}>{s.email}</span>
              </div>

              {/* Grade */}
              <div className={styles.cell}>
                {s.grade
                  ? <Badge variant="blue" size="sm">{s.grade}</Badge>
                  : <span className={styles.na}>—</span>
                }
              </div>

              {/* Joined */}
              <div className={styles.cell}>
                <span className={styles.dateCell}>
                  {s.createdAt ? format(new Date(s.createdAt), 'MMM d, yyyy') : '—'}
                </span>
              </div>

              {/* Status */}
              <div className={styles.cell}>
                <Badge variant={s.status === 'active' ? 'green' : 'red'} size="sm" dot>
                  {s.status}
                </Badge>
              </div>

              {/* Action menu */}
              <div className={styles.cell}>
                <div className={styles.actionMenu}>
                  <button
                    className={styles.menuBtn}
                    onClick={() => setMenuOpen(menuOpen === s._id ? null : s._id)}
                  >
                    <MoreVertical size={16} />
                  </button>
                  {menuOpen === s._id && (
                    <div className={styles.dropdown}>
                      <button
                        className={styles.dropItem}
                        onClick={() => { setView(s); setMenuOpen(null) }}
                      >
                        <Eye size={14} /> View Profile
                      </button>
                      <button
                        className={styles.dropItem}
                        onClick={() => { setEdit(s); setFormError(''); setMenuOpen(null) }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <div className={styles.dropDivider} />
                      <button
                        className={[styles.dropItem, s.status === 'active' ? styles.dropDanger : styles.dropSuccess].join(' ')}
                        onClick={() => { handleToggle(s); setMenuOpen(null) }}
                      >
                        {s.status === 'active'
                          ? <><UserX size={14} /> Deactivate</>
                          : <><UserCheck size={14} /> Reactivate</>
                        }
                      </button>
                      <div className={styles.dropDivider} />
                      <button
                        className={[styles.dropItem, styles.dropDanger].join(' ')}
                        onClick={() => { handleDelete(s); setMenuOpen(null) }}
                      >
                        <Trash2 size={14} /> Delete Permanently
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Student Modal ── */}
      <Modal open={showAdd} onClose={() => { setShowAdd(false); setFormError('') }} title="Add New Student" size="md">
        <StudentForm
          onSubmit={handleCreate}
          loading={createMut.isPending}
          error={formError}
        />
      </Modal>

      {/* ── Edit Student Modal ── */}
      <Modal open={!!editStudent} onClose={() => { setEdit(null); setFormError('') }} title="Edit Student" size="md">
        {editStudent && (
          <StudentForm
            initial={editStudent}
            onSubmit={handleUpdate}
            loading={updateMut.isPending}
            error={formError}
          />
        )}
      </Modal>

      {/* ── View Detail Modal ── */}
      <Modal open={!!viewStudent} onClose={() => setView(null)} size="md">
        {viewStudent && (
          <StudentDetailModal
            student={viewStudent}
            onClose={() => setView(null)}
            onEdit={(s) => { setView(null); setEdit(s); setFormError('') }}
            onToggleStatus={handleToggle}
            onDelete={handleDelete}
          />
        )}
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete Student?" size="sm">
        {confirmDelete && (
          <div className={styles.confirmBody}>
            <div className={styles.confirmIcon}><AlertTriangle size={32} /></div>
            <p className={styles.confirmTitle}>
              Permanently delete <strong>{confirmDelete.firstName || confirmDelete.username}</strong>?
            </p>
            <p className={styles.confirmSub}>
              This will delete their account, all submissions, corrections, and remove them from all homework.
              <strong> This cannot be undone.</strong>
            </p>
            <div className={styles.confirmActions}>
              <Button variant="secondary" icon={<X size={15} />} onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 size={15} />}
                loading={deleteMut.isPending}
                onClick={() => deleteMut.mutate(confirmDelete._id)}
              >
                Yes, Delete Everything
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Backdrop for menu close */}
      {menuOpen && (
        <div className={styles.menuBackdrop} onClick={() => setMenuOpen(null)} />
      )}
    </div>
  )
}
