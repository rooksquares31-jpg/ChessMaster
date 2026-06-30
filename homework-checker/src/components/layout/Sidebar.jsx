import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, BookOpen, Users, CheckSquare,
  BarChart2, LogOut, ChevronRight, Crown, GraduationCap, Video,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import styles from './Sidebar.module.css'

const adminNav = [
  { to: '/admin',             icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/admin/homework',    icon: <BookOpen size={18} />,        label: 'Homework' },
  { to: '/admin/classrooms',  icon: <Video size={18} />,           label: 'Classrooms' },
  { to: '/admin/students',    icon: <Users size={18} />,           label: 'Students' },
  { to: '/admin/corrections', icon: <CheckSquare size={18} />,     label: 'Corrections' },
  { to: '/admin/analytics',   icon: <BarChart2 size={18} />,       label: 'Analytics' },
]

const studentNav = [
  { to: '/student',             icon: <LayoutDashboard size={18} />, label: 'Dashboard' },
  { to: '/student/homework',    icon: <BookOpen size={18} />,        label: 'My Homework' },
  { to: '/student/classrooms',  icon: <Video size={18} />,           label: 'Classrooms' },
  { to: '/student/results',     icon: <BarChart2 size={18} />,       label: 'My Results' },
]

export default function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const isAdmin = user?.role === 'admin'
  const nav = isAdmin ? adminNav : studentNav

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <aside className={styles.sidebar}>
      {/* Logo */}
      <div className={styles.logo}>
        <div className={styles.logoIcon}>♟</div>
        <div>
          <div className={styles.logoName}>ChessCoach</div>
          <div className={styles.logoSub}>Homework Platform</div>
        </div>
      </div>

      {/* Role badge */}
      <div className={styles.roleBadge}>
        {isAdmin ? <Crown size={13} /> : <GraduationCap size={13} />}
        {isAdmin ? 'Coach Dashboard' : 'Student Portal'}
      </div>

      {/* Nav */}
      <nav className={styles.nav}>
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin' || item.to === '/student'}
            className={({ isActive }) => [styles.navItem, isActive ? styles.active : ''].join(' ')}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            <span className={styles.navLabel}>{item.label}</span>
            <ChevronRight size={14} className={styles.chevron} />
          </NavLink>
        ))}
      </nav>

      {/* User */}
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
    </aside>
  )
}
