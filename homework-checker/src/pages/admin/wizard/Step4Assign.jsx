import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, UserPlus, UserMinus, Users, CheckCircle } from 'lucide-react'
import api from '../../../lib/api'
import styles from './Steps.module.css'

export default function Step4Assign({ assigned, setAssigned }) {
  const [search, setSearch] = useState('')

  const { data: studentsData } = useQuery({
    queryKey: ['students-assign'],
    queryFn: () => api.get('/students?limit=100').then((r) => r.data.data),
  })
  const students = studentsData || []

  const filtered = students.filter((s) =>
    !search ||
    s.username?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase()) ||
    s.firstName?.toLowerCase().includes(search.toLowerCase())
  )

  const isAssigned = (id) => assigned.some((s) => s._id === id)

  const toggle = (student) => {
    if (isAssigned(student._id)) {
      setAssigned((a) => a.filter((s) => s._id !== student._id))
    } else {
      setAssigned((a) => [...a, student])
    }
  }

  const assignAll = () => setAssigned(filtered)
  const clearAll = () => setAssigned([])

  return (
    <div className={styles.step}>
      <h2 className={styles.stepTitle}>Assign Students</h2>
      <p className={styles.stepDesc}>Choose which students will receive this homework assignment.</p>

      <div className={styles.assignHeader}>
        <div className={styles.assignSearch}>
          <Search size={15} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search students…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.assignActions}>
          <button type="button" className={styles.actionBtn} onClick={assignAll}>
            <Users size={14} /> Select All ({filtered.length})
          </button>
          <button type="button" className={styles.actionBtn} onClick={clearAll}>
            Clear
          </button>
        </div>
      </div>

      <div className={styles.assignGrid}>
        {/* Available students */}
        <div className={styles.assignCol}>
          <div className={styles.assignColTitle}>Available Students ({filtered.length})</div>
          <div className={styles.studentList}>
            {filtered.length === 0 && <div className={styles.empty}>No students found</div>}
            {filtered.map((s) => (
              <button
                key={s._id}
                type="button"
                className={[styles.studentRow, isAssigned(s._id) ? styles.studentAssigned : ''].join(' ')}
                onClick={() => toggle(s)}
              >
                <div className={styles.studentAvatar}>
                  {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                </div>
                <div className={styles.studentInfo}>
                  <div className={styles.studentName}>
                    {s.firstName ? `${s.firstName} ${s.lastName || ''}` : s.username}
                  </div>
                  <div className={styles.studentEmail}>{s.email}</div>
                </div>
                {isAssigned(s._id)
                  ? <CheckCircle size={16} className={styles.assignedIcon} />
                  : <UserPlus size={16} className={styles.addIcon} />
                }
              </button>
            ))}
          </div>
        </div>

        {/* Assigned panel */}
        <div className={styles.assignCol}>
          <div className={styles.assignColTitle}>Assigned ({assigned.length})</div>
          <div className={styles.studentList}>
            {assigned.length === 0 && (
              <div className={styles.emptyAssign}>
                <Users size={32} />
                <p>No students assigned yet</p>
              </div>
            )}
            {assigned.map((s) => (
              <div key={s._id} className={styles.assignedRow}>
                <div className={styles.studentAvatar} style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                  {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                </div>
                <div className={styles.studentInfo}>
                  <div className={styles.studentName}>
                    {s.firstName ? `${s.firstName} ${s.lastName || ''}` : s.username}
                  </div>
                </div>
                <button type="button" className={styles.removeBtn} onClick={() => toggle(s)}>
                  <UserMinus size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.assignNote}>
        ℹ️ You can also skip this step and assign students later from the homework detail page.
      </div>
    </div>
  )
}
