import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import styles from './LoginPage.module.css'

export default function LoginPage() {
  const { login, loading } = useAuthStore()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    try {
      const user = await login(form.email, form.password)
      navigate(user.role === 'admin' ? '/admin' : '/student')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={styles.page}>
      {/* Background chess pattern */}
      <div className={styles.bg} aria-hidden="true">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className={styles.cell} style={{ opacity: Math.random() * 0.06 + 0.02 }} />
        ))}
      </div>

      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>♟</div>
          <div>
            <h1 className={styles.logoName}>ChessCoach</h1>
            <p className={styles.logoSub}>Homework Platform</p>
          </div>
        </div>

        <div className={styles.divider} />

        <h2 className={styles.title}>Welcome back</h2>
        <p className={styles.subtitle}>Sign in to your account to continue</p>

        {error && (
          <div className={styles.errorBanner}>
            <span>⚠️</span> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            icon={<Mail size={16} />}
            required
            autoComplete="email"
          />
          <div className={styles.passWrap}>
            <Input
              label="Password"
              type={showPass ? 'text' : 'password'}
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              icon={<Lock size={16} />}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className={styles.eyeBtn}
              onClick={() => setShowPass((s) => !s)}
              aria-label={showPass ? 'Hide password' : 'Show password'}
            >
              {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          <Button type="submit" loading={loading} fullWidth size="lg">
            Sign In
          </Button>
        </form>

        <div className={styles.demo}>
          <p className={styles.demoTitle}>Demo Credentials</p>
          <div className={styles.demoGrid}>
            <button className={styles.demoBtn} onClick={() => setForm({ email: 'admin@chess.com', password: 'Admin123!' })}>
              <span className={styles.demoRole}>👑 Admin</span>
              <span>admin@chess.com</span>
            </button>
            <button className={styles.demoBtn} onClick={() => setForm({ email: 'bob@chess.com', password: 'Student1!' })}>
              <span className={styles.demoRole}>🎓 Student</span>
              <span>bob@chess.com</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
