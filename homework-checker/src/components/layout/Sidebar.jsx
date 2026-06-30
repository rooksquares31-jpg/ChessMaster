import { useState, useEffect } from 'react'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, Users, CheckSquare,
  BarChart2, LogOut, ChevronRight, Crown, GraduationCap,
  Video, Menu, X,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import styles from './Sidebar.module.css'

const adminNav = [
  { to: '/admin',             icon: <LayoutDashboard size={18} />, label: 'Dashboard'   },
  { to: '/admin/homework',    icon: <BookOpen size={18} />,        label: 'Homework'    },
  { to: '/admin/classrooms',  icon: <Video size={18} />,           label: 'Classrooms'  },
  { to: '/admin/students',    icon: <Users size={18} />,           label: 'Students'    },
  { to: '/admin/corrections', icon: <CheckSquare size={18} />,     label: 'Corrections' },
  { to: '/admin/analytics',   icon: <BarChart2 size={18} />,       label: 'Analytics'   },
]

const studentNav = [
  { to: '/student',            icon: <LayoutDashboard size={18} />, label: 'Dashboard'   },
  { to: '/student/homework',   icon: <BookOpen size={18} />,        label: 'My Homework' },
  { to: '/student/classrooms', icon: <Video size={18} />,           label: 'Classrooms'  },
  { to: '/student/results',    icon: <BarChart2 size={18} />,       label: 'My Results'  },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin  = user?.role === 'admin'
  const nav      = isAdmin ? adminNav : studentNav

  // Mobile drawer open/close
  const [mobileOpen, setMobileOpen] = useState(false)

  // Close drawer on route change
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Close drawer on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const handleLogout = async () => { await logout(); navigate('/login') }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>♟</div>
        <div className={styles.logoText}>
          <div className={styles.logoName}>ChessCoach</div>
          <div className={styles.logoSub}>Homework Platform</div>
        </div>
      </div>

      {/* Role badge */}
      <div className={styles.roleBadge}>
        {isAdmin ? <Crown size={12} /> : <GraduationCap size={12} />}
        <span className={styles.roleBadgeText}>
          {isAdmin ? 'Coach Dashboard' : 'Student Portal'}
        </span>
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin' || item.to === '/student'}
            className={({ isActive }) =>
              [styles.navItem, isActive ? styles.active : ''].join(' ')
            }
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
            <ChevronRight size={13} className={styles.chevron} />
          </NavLink>
        ))}
      </nav>

      {/* User profile */}
      <div className={styles.user}>
        <div className={styles.avatar}>
          {(user?.firstName?.[0] || user?.username?.[0] || '?').toUpperCase()}
        </div>
        <div className={styles.userInfo}>
          <div className={styles.userName}>{user?.firstName || user?.username}</div>
          <div className={styles.userEmail}>{user?.email}</div>
        </div>
        <button className={styles.logoutBtn} onClick={handleLogout} title="Logout">
          <LogOut size={16} />
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ── Mobile hamburger button (fixed top-left) ── */}
      <button
        className={styles.hamburger}
        onClick={() => setMobileOpen((o) => !o)}
        aria-label="Open menu"
      >
        <Menu size={22} />
      </button>

      {/* ── Mobile overlay backdrop ── */}
      {mobileOpen && (
        <div
          className={styles.backdrop}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Desktop sidebar (always visible ≥ 768px) ── */}
      <aside className={styles.sidebar}>
        <SidebarContent />
      </aside>

      {/* ── Mobile drawer (slides in from left) ── */}
      <aside className={[styles.drawer, mobileOpen ? styles.drawerOpen : ''].join(' ')}>
        <button
          className={styles.drawerClose}
          onClick={() => setMobileOpen(false)}
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
        <SidebarContent />
      </aside>
    </>
  )
}
