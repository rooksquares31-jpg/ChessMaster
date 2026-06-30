import { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  KeyRound, Video, Play, Clock, CheckCircle,
  ExternalLink, ArrowRight, Users,
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import styles from './StudentClassrooms.module.css'

/* ══════════════════════════════════════════════════════════════
   Digit-by-digit code input (6 boxes, like OTP inputs)
══════════════════════════════════════════════════════════════ */
function CodeInput({ onSubmit, defaultCode = '' }) {
  const [digits, setDigits] = useState(() => {
    const arr = Array(6).fill('')
    if (defaultCode) defaultCode.toUpperCase().split('').forEach((c, i) => { if (i < 6) arr[i] = c })
    return arr
  })
  const [joining, setJoining] = useState(false)
  const [err, setErr]         = useState('')
  const refs = useRef([])

  // Auto-submit if defaultCode was passed (from share link)
  useEffect(() => {
    if (defaultCode.length === 6) handleSubmit(defaultCode.toUpperCase())
  }, [])

  const handleKey = (i, e) => {
    setErr('')
    if (e.key === 'Backspace') {
      const next = [...digits]; next[i] = ''; setDigits(next)
      if (i > 0) refs.current[i - 1]?.focus()
      return
    }
    const ch = e.key.toUpperCase()
    if (!/^[A-Z0-9]$/.test(ch)) return
    const next = [...digits]; next[i] = ch; setDigits(next)
    if (i < 5) refs.current[i + 1]?.focus()
    else if (next.every((d) => d !== '')) handleSubmit(next.join(''))
  }

  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
    if (text.length === 6) {
      setDigits(text.split(''))
      handleSubmit(text)
    }
  }

  const handleSubmit = async (code) => {
    const c = (code || digits.join('')).toUpperCase()
    if (c.length !== 6) { setErr('Enter all 6 characters'); return }
    setJoining(true); setErr('')
    try {
      const { data } = await api.post('/classrooms/join', { code: c })
      toast.success(`Joining "${data.data.title}"…`)
      onSubmit(data.data.classroomId)
    } catch (err) {
      setErr(err.response?.data?.message || 'Invalid code — please check and try again')
      setDigits(Array(6).fill(''))
      refs.current[0]?.focus()
    } finally {
      setJoining(false)
    }
  }

  const full = digits.every((d) => d !== '')

  return (
    <div className={styles.codeWidget}>
      <div className={styles.codeBoxes} onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (refs.current[i] = el)}
            className={[styles.codeBox, err ? styles.codeBoxErr : d ? styles.codeBoxFilled : ''].join(' ')}
            value={d}
            maxLength={1}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onKeyDown={(e) => handleKey(i, e)}
            onFocus={(e) => e.target.select()}
            onChange={() => {}} // controlled via onKeyDown
            readOnly={joining}
          />
        ))}
      </div>
      {err && <p className={styles.codeErr}>{err}</p>}
      <Button
        loading={joining}
        disabled={!full}
        fullWidth
        size="lg"
        icon={<ArrowRight size={16} />}
        onClick={() => handleSubmit(digits.join(''))}
      >
        Join Classroom
      </Button>
    </div>
  )
}

/* ══════════════════════════════════════════════════════════════
   Classroom card
══════════════════════════════════════════════════════════════ */
function ClassCard({ c, onJoin }) {
  const isLive = c.status === 'live'
  const isWait = c.status === 'waiting'

  return (
    <Card className={[styles.classCard, isLive ? styles.liveCard : ''].join(' ')}>
      {isLive && <div className={styles.livePill}><span className={styles.liveDotSmall} />Live</div>}
      <div className={styles.cardTop}>
        <h4 className={styles.cardTitle}>{c.title}</h4>
        <Badge
          variant={isLive ? 'green' : isWait ? 'yellow' : 'default'}
          size="sm" dot
        >
          {c.status}
        </Badge>
      </div>
      {c.description && <p className={styles.cardDesc}>{c.description}</p>}
      <div className={styles.cardMeta}>
        <Users size={12} />
        <span>Coach: {c.host?.firstName ? `${c.host.firstName} ${c.host.lastName || ''}` : c.host?.username}</span>
      </div>
      {onJoin && (
        <Button
          variant={isLive ? 'primary' : 'secondary'}
          size="sm"
          fullWidth
          icon={isLive ? <Play size={13} /> : <ExternalLink size={13} />}
          onClick={onJoin}
        >
          {isLive ? 'Join Live Session' : 'Enter Room'}
        </Button>
      )}
    </Card>
  )
}

/* ══════════════════════════════════════════════════════════════
   Main Page
══════════════════════════════════════════════════════════════ */
export default function StudentClassrooms() {
  const navigate      = useNavigate()
  const [params]      = useSearchParams()
  const defaultCode   = params.get('code') || ''

  const { data, isLoading } = useQuery({
    queryKey: ['my-classrooms'],
    queryFn: () => api.get('/classrooms').then((r) => r.data.data),
  })
  const classrooms = data || []
  const live    = classrooms.filter((c) => c.status === 'live')
  const waiting = classrooms.filter((c) => c.status === 'waiting')
  const ended   = classrooms.filter((c) => c.status === 'ended')

  const handleJoined = (classroomId) => navigate(`/student/classroom/${classroomId}`)

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Classrooms</h1>
        <p className={styles.subtitle}>Join a live chess session with your coach</p>
      </div>

      {/* ── Join by code ── */}
      <Card className={styles.joinCard}>
        <div className={styles.joinLeft}>
          <div className={styles.joinIconWrap}><KeyRound size={26} /></div>
          <div>
            <h3 className={styles.joinTitle}>Enter Classroom Code</h3>
            <p className={styles.joinDesc}>
              Your coach shares a 6-character code. Type it below or paste it to join instantly — no invite needed.
            </p>
          </div>
        </div>
        <div className={styles.joinRight}>
          <CodeInput onSubmit={handleJoined} defaultCode={defaultCode} />
        </div>
      </Card>

      {/* ── Live now ── */}
      {live.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.liveDot} />
            Live Now — Join Immediately
          </div>
          <div className={styles.classGrid}>
            {live.map((c) => (
              <ClassCard key={c._id} c={c} onJoin={() => navigate(`/student/classroom/${c._id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Waiting / upcoming ── */}
      {waiting.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <Clock size={13} /> Upcoming Sessions
          </div>
          <div className={styles.classGrid}>
            {waiting.map((c) => (
              <ClassCard key={c._id} c={c} onJoin={() => navigate(`/student/classroom/${c._id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* ── Past ── */}
      {ended.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionTitle}>
            <CheckCircle size={13} /> Past Sessions
          </div>
          <div className={styles.classGrid}>
            {ended.map((c) => (
              <ClassCard key={c._id} c={c} onJoin={null} />
            ))}
          </div>
        </section>
      )}

      {/* Empty */}
      {!isLoading && classrooms.length === 0 && (
        <Card className={styles.empty}>
          <Video size={44} className={styles.emptyIcon} />
          <h3>No sessions yet</h3>
          <p>
            Your coach hasn't scheduled any sessions yet.
            Use the code above to jump into one directly.
          </p>
        </Card>
      )}
    </div>
  )
}
