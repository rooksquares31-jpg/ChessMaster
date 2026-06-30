import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, Video, Users, Copy, Trash2, Play, Square,
  Clock, CheckCircle, ExternalLink, Search, X,
  UserPlus, UserMinus, Share2, ChevronRight,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import styles from './AdminClassrooms.module.css'

/* ══════════════════════════════════════════════════════════════
   Student Picker — Google Meet style "Add people" component
══════════════════════════════════════════════════════════════ */
function StudentPicker({ selected, onChange }) {
  const [search, setSearch] = useState('')

  const { data } = useQuery({
    queryKey: ['students-picker'],
    queryFn: () => api.get('/students?limit=200&status=active').then((r) => r.data.data),
  })
  const all = data || []

  const filtered = all.filter((s) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      s.username?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.firstName?.toLowerCase().includes(q) ||
      s.lastName?.toLowerCase().includes(q)
    )
  })

  const isSelected = (id) => selected.some((s) => s._id === id)

  const toggle = (student) => {
    if (isSelected(student._id)) {
      onChange(selected.filter((s) => s._id !== student._id))
    } else {
      onChange([...selected, student])
    }
  }

  const removeSelected = (id) => onChange(selected.filter((s) => s._id !== id))

  const selectAll = () => onChange(filtered)
  const clearAll  = () => onChange([])

  return (
    <div className={styles.picker}>
      {/* Search bar */}
      <div className={styles.pickerSearch}>
        <Search size={14} className={styles.pickerSearchIcon} />
        <input
          className={styles.pickerInput}
          placeholder="Search students by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button className={styles.pickerClear} onClick={() => setSearch('')}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Bulk actions */}
      {filtered.length > 0 && (
        <div className={styles.pickerBulk}>
          <button className={styles.bulkBtn} onClick={selectAll}>
            <Users size={12} /> Add all ({filtered.length})
          </button>
          {selected.length > 0 && (
            <button className={styles.bulkBtn} onClick={clearAll}>
              <X size={12} /> Clear
            </button>
          )}
        </div>
      )}

      <div className={styles.pickerLayout}>
        {/* Available list */}
        <div className={styles.pickerCol}>
          <div className={styles.pickerColTitle}>
            Available Students
            <span className={styles.pickerCount}>{filtered.length}</span>
          </div>
          <div className={styles.pickerList}>
            {filtered.length === 0 && (
              <div className={styles.pickerEmpty}>
                {all.length === 0 ? 'No active students found' : 'No matches'}
              </div>
            )}
            {filtered.map((s) => {
              const sel = isSelected(s._id)
              return (
                <button
                  key={s._id}
                  type="button"
                  className={[styles.pickerRow, sel ? styles.pickerRowSel : ''].join(' ')}
                  onClick={() => toggle(s)}
                >
                  <div
                    className={styles.pickerAvatar}
                    style={{
                      background: sel
                        ? 'linear-gradient(135deg,#22c55e,#16a34a)'
                        : 'linear-gradient(135deg,#4f8ef7,#a855f7)',
                    }}
                  >
                    {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                  </div>
                  <div className={styles.pickerInfo}>
                    <div className={styles.pickerName}>
                      {s.firstName ? `${s.firstName} ${s.lastName || ''}` : s.username}
                    </div>
                    <div className={styles.pickerEmail}>{s.email}</div>
                  </div>
                  <div className={styles.pickerToggle}>
                    {sel ? (
                      <span className={styles.toggleAdded}><CheckCircle size={15} /></span>
                    ) : (
                      <span className={styles.toggleAdd}><UserPlus size={15} /></span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected panel */}
        <div className={styles.pickerCol}>
          <div className={styles.pickerColTitle}>
            Invited
            <span className={styles.pickerCount} style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
              {selected.length}
            </span>
          </div>
          <div className={styles.pickerList}>
            {selected.length === 0 && (
              <div className={styles.pickerEmpty}>
                Click students on the left to invite them
              </div>
            )}
            {selected.map((s) => (
              <div key={s._id} className={styles.selectedRow}>
                <div
                  className={styles.pickerAvatar}
                  style={{ background: 'linear-gradient(135deg,#22c55e,#16a34a)' }}
                >
                  {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                </div>
                <div className={styles.pickerInfo}>
                  <div className={styles.pickerName}>
                    {s.firstName ? `${s.firstName} ${s.lastName || ''}` : s.username}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={() => removeSelected(s._id)}
                >
                  <UserMinus size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.pickerNote}>
        ℹ️ Students can also join without an invite using the classroom code.
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Create Classroom Modal — 2-step wizard
══════════════════════════════════════════════════════════════ */
function CreateModal({ open, onClose }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [step, setStep]         = useState(1) // 1 = details, 2 = add students
  const [title, setTitle]       = useState('')
  const [desc, setDesc]         = useState('')
  const [students, setStudents] = useState([])
  const [err, setErr]           = useState('')

  // Reset when modal closes
  useEffect(() => {
    if (!open) { setStep(1); setTitle(''); setDesc(''); setStudents([]); setErr('') }
  }, [open])

  const mut = useMutation({
    mutationFn: (payload) => api.post('/classrooms', payload),
    onSuccess: (res) => {
      toast.success('Classroom created!')
      qc.invalidateQueries(['classrooms'])
      onClose()
      navigate(`/admin/classroom/${res.data.data._id}`)
    },
    onError: (e) => { setErr(e.response?.data?.message || 'Failed to create'); setStep(1) },
  })

  const handleSubmit = () => {
    if (!title.trim()) { setErr('Title is required'); setStep(1); return }
    mut.mutate({
      title:      title.trim(),
      description: desc.trim(),
      studentIds:  students.map((s) => s._id),
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === 1 ? '🏫 New Classroom' : '👥 Add Students'}
      size="lg"
    >
      {/* Step indicator */}
      <div className={styles.wizardSteps}>
        <div className={[styles.wStep, step >= 1 ? styles.wStepActive : ''].join(' ')}>
          <span className={styles.wStepNum}>1</span>
          <span>Details</span>
        </div>
        <div className={styles.wLine} />
        <div className={[styles.wStep, step >= 2 ? styles.wStepActive : ''].join(' ')}>
          <span className={styles.wStepNum}>2</span>
          <span>Add Students</span>
        </div>
      </div>

      {err && <div className={styles.formErr}>{err}</div>}

      {/* Step 1: Details */}
      {step === 1 && (
        <div className={styles.stepBody}>
          <Input
            label="Classroom Title"
            placeholder="e.g. Tactics Tuesday — Week 3"
            value={title}
            onChange={(e) => { setTitle(e.target.value); setErr('') }}
            required
            autoFocus
          />
          <div className={styles.notesWrap}>
            <label className={styles.notesLbl}>Description (optional)</label>
            <textarea
              className={styles.notesArea}
              rows={3}
              placeholder="What will you cover in this session? e.g. Back-rank mates, Pin tactics…"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            />
          </div>
          <div className={styles.stepNav}>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              iconRight={<ChevronRight size={16} />}
              onClick={() => { if (!title.trim()) { setErr('Title is required'); return }; setErr(''); setStep(2) }}
            >
              Next: Add Students
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Student picker */}
      {step === 2 && (
        <div className={styles.stepBody}>
          <StudentPicker selected={students} onChange={setStudents} />
          <div className={styles.stepNav}>
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button
              loading={mut.isPending}
              icon={<Video size={15} />}
              onClick={handleSubmit}
            >
              Create Classroom
              {students.length > 0 && ` & Invite ${students.length}`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

/* ══════════════════════════════════════════════════════════════
   Classroom Card
══════════════════════════════════════════════════════════════ */
const statusVariant = { waiting: 'yellow', live: 'green', ended: 'default' }

function ClassroomCard({ c, onDelete, deleting }) {
  const navigate = useNavigate()
  const isLive   = c.status === 'live'

  const copyCode = () => {
    navigator.clipboard.writeText(c.code)
    toast.success(`Code "${c.code}" copied to clipboard!`)
  }

  const shareLink = () => {
    const url = `${window.location.origin}/student/classrooms?code=${c.code}`
    navigator.clipboard.writeText(url)
    toast.success('Shareable link copied!')
  }

  return (
    <Card className={[styles.classCard, isLive ? styles.classCardLive : ''].join(' ')}>
      {isLive && <div className={styles.liveIndicator}><span className={styles.livePulse} />LIVE</div>}

      <div className={styles.classTop}>
        <div className={styles.classLeft}>
          {/* Title & status */}
          <div className={styles.classTitleRow}>
            <h3 className={styles.classTitle}>{c.title}</h3>
            <Badge variant={statusVariant[c.status]}>
              {c.status === 'live' ? <Play size={11} /> : c.status === 'waiting' ? <Clock size={11} /> : <CheckCircle size={11} />}
              {' '}{c.status.charAt(0).toUpperCase() + c.status.slice(1)}
            </Badge>
          </div>
          {c.description && <p className={styles.classDesc}>{c.description}</p>}

          {/* Code chip */}
          <div className={styles.classMeta}>
            <div className={styles.codeChip}>
              <span className={styles.codeLabel}>Join Code</span>
              <span className={styles.codeValue}>{c.code}</span>
              <button className={styles.copyBtn} onClick={copyCode} title="Copy code">
                <Copy size={13} />
              </button>
            </div>
            <div className={styles.metaItem}><Users size={12} />{c.invitedStudents?.length || 0} invited</div>
            <div className={styles.metaItem}><Clock size={12} />{format(new Date(c.createdAt), 'MMM d, yyyy')}</div>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.classActions}>
          <Button
            size="sm"
            variant={isLive ? 'primary' : 'secondary'}
            icon={<ExternalLink size={14} />}
            onClick={() => navigate(`/admin/classroom/${c._id}`)}
          >
            {isLive ? 'Join Live' : 'Open Room'}
          </Button>
          <button className={styles.shareBtn} onClick={shareLink} title="Copy shareable link">
            <Share2 size={14} />
          </button>
          {c.status !== 'live' && (
            <button
              className={styles.deleteBtn}
              onClick={() => onDelete(c._id)}
              disabled={deleting}
              title="Delete classroom"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}

/* ══════════════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════════════ */
export default function AdminClassrooms() {
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['classrooms'],
    queryFn: () => api.get('/classrooms').then((r) => r.data.data),
  })
  const classrooms = data || []

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/classrooms/${id}`),
    onSuccess: () => { toast.success('Classroom deleted'); qc.invalidateQueries(['classrooms']) },
    onError:   () => toast.error('Could not delete classroom'),
  })

  const live  = classrooms.filter((c) => c.status === 'live')
  const wait  = classrooms.filter((c) => c.status === 'waiting')
  const ended = classrooms.filter((c) => c.status === 'ended')

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Classrooms</h1>
          <p className={styles.subtitle}>Live interactive chess sessions with your students</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          New Classroom
        </Button>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--green-dim)', color: 'var(--green)' }}><Play size={18} /></div>
          <div><div className={styles.statNum}>{live.length}</div><div className={styles.statLbl}>Live Now</div></div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--yellow-dim)', color: 'var(--yellow)' }}><Clock size={18} /></div>
          <div><div className={styles.statNum}>{wait.length}</div><div className={styles.statLbl}>Waiting</div></div>
        </Card>
        <Card className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}><Video size={18} /></div>
          <div><div className={styles.statNum}>{classrooms.length}</div><div className={styles.statLbl}>Total Sessions</div></div>
        </Card>
      </div>

      {isLoading && (
        <div className={styles.loading}>
          <div className={styles.spinner} />Loading classrooms…
        </div>
      )}

      {!isLoading && classrooms.length === 0 && (
        <Card className={styles.empty}>
          <Video size={52} className={styles.emptyIcon} />
          <h3>No classrooms yet</h3>
          <p>Create a classroom, invite your students, and share the 6-character join code.</p>
          <Button icon={<Plus size={15} />} onClick={() => setShowCreate(true)} size="sm">
            Create First Classroom
          </Button>
        </Card>
      )}

      {/* Live sessions first */}
      {[...live, ...wait, ...ended].map((c) => (
        <ClassroomCard
          key={c._id}
          c={c}
          onDelete={(id) => deleteMut.mutate(id)}
          deleting={deleteMut.isPending}
        />
      ))}

      <CreateModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
