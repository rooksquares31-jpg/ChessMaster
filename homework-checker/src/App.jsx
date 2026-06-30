import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

// Layout
import AppLayout from './components/layout/AppLayout'

// Auth
import LoginPage from './pages/auth/LoginPage'

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminHomeworkList from './pages/admin/AdminHomeworkList'
import AdminHomeworkDetail from './pages/admin/AdminHomeworkDetail'
import CreateHomework from './pages/admin/CreateHomework'
import AdminStudents from './pages/admin/AdminStudents'
import AdminAddStudents from './pages/admin/AdminAddStudents'
import CorrectionInterface from './pages/admin/CorrectionInterface'
import AdminClassrooms from './pages/admin/AdminClassrooms'

// Student pages
import StudentDashboard from './pages/student/StudentDashboard'
import StudentHomeworkList from './pages/student/StudentHomeworkList'
import StudentResults from './pages/student/StudentResults'
import SolveHomework from './pages/student/SolveHomework'
import HomeworkResult from './pages/student/HomeworkResult'
import StudentClassrooms from './pages/student/StudentClassrooms'

// Classroom (shared)
import LiveClassroom from './pages/classroom/LiveClassroom'

// Guards
function RequireAuth({ children, role }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/login" replace />
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />
  }
  return children
}

export default function App() {
  const { user } = useAuthStore()

  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={
        user ? <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace /> : <LoginPage />
      } />

      {/* Admin routes */}
      <Route path="/admin" element={
        <RequireAuth role="admin"><AppLayout /></RequireAuth>
      }>
        <Route index element={<AdminDashboard />} />
        <Route path="homework" element={<AdminHomeworkList />} />
        <Route path="homework/create" element={<CreateHomework />} />
        <Route path="homework/:id" element={<AdminHomeworkDetail />} />
        <Route path="add/student" element={<AdminAddStudents />} />
        <Route path="students" element={<AdminStudents />} />
        <Route path="corrections" element={<CorrectionInterface />} />
        <Route path="analytics" element={<AdminDashboard />} />
        <Route path="classrooms" element={<AdminClassrooms />} />
        <Route path="classroom/:id" element={<LiveClassroom />} />
      </Route>

      {/* Student routes */}
      <Route path="/student" element={
        <RequireAuth role="student"><AppLayout /></RequireAuth>
      }>
        <Route index element={<StudentDashboard />} />
        <Route path="homework" element={<StudentHomeworkList />} />
        <Route path="homework/:id" element={<SolveHomework />} />
        <Route path="homework/:id/result" element={<HomeworkResult />} />
        <Route path="results" element={<StudentResults />} />
        <Route path="progress" element={<StudentResults />} />
        <Route path="classrooms" element={<StudentClassrooms />} />
        <Route path="classroom/:id" element={<LiveClassroom />} />
      </Route>

      {/* Default redirect */}
      <Route path="/" element={
        user
          ? <Navigate to={user.role === 'admin' ? '/admin' : '/student'} replace />
          : <Navigate to="/login" replace />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
