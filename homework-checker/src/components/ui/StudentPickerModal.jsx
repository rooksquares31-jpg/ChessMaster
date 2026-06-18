/**
 * StudentPickerModal
 * A reusable modal that lets you pick/toggle students from the full list.
 * Used both in AdminHomeworkDetail (to add more students to an existing homework)
 * and potentially re-exported for CreateHomework use.
 *
 * Props:
 *  open           {boolean}        — whether modal is visible
 *  onClose        {() => void}     — called when user closes without saving
 *  onSave         {(ids: string[]) => void}  — called with the NEW student IDs to add
 *  alreadyIds     {string[]}       — IDs already assigned (to grey them out)
 *  saving         {boolean}        — show loading state on Save button
 */
import { useState } from 'react'
import { Search, CheckCircle, UserPlus, Users, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../../lib/api'
import Button from './Button'
import styles from './StudentPickerModal.module.css'

export default function StudentPickerModal({ open, onClose, onSave, alreadyIds = [], saving = false }) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState([]) // newly selected student objects

  const { data } = useQuery({
    queryKey: ['all-students-picker'],
    queryFn: () => api.get('/students?limit=200&status=active').then((r) => r.data.data),
    enabled: open,
  })
  const allStudents = data || []

  const filtered = allStudents.filter((s) => {
    const q = search.toLowerCase()
    return (
      !q ||
      s.username?.toLowerCase().includes(q) ||
      s.firstName?.toLowerCase().includes(q) ||
      s.lastName?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q)
    )
  })

  const alreadySet  = new Set(alreadyIds.map(String))
  const selectedSet = new Set(selected.map((s) => s._id))

  const toggle = (student) => {
    if (alreadySet.has(student._id)) return // already assigned — can't re-toggle
    setSelected((prev) =>
      prev.some((s) => s._id === student._id)
        ? prev.filter((s) => s._id !== student._id)
        : [...prev, student]
    )
  }

  const handleSave = () => {
    onSave(selected.map((s) => s._id))
    setSelected([])
    setSearch('')
  }

  const handleClose = () => {
    setSelected([])
    setSearch('')
    onClose()
  }

  if (!open) return null

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>
            <Users size={16} />
            Add Students to Homework
          </div>
          <button className={styles.closeBtn} onClick={handleClose}>
            <X size={16} />
          </button>
        </div>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className={styles.selectedChips}>
            {selected.map((s) => (
              <div key={s._id} className={styles.chip}>
                <div className={styles.chipAvatar}>
                  {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                </div>
                <span className={styles.chipName}>
                  {s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : s.username}
                </span>
                <button className={styles.chipRemove} onClick={() => toggle(s)}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className={styles.searchWrap}>
          <Search size={13} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search by name, username or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {search && (
            <button className={styles.clearSearch} onClick={() => setSearch('')}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Student list */}
        <div className={styles.list}>
          {filtered.length === 0 && (
            <div className={styles.empty}>
              {allStudents.length === 0 ? 'No active students found' : 'No students match your search'}
            </div>
          )}

          {/* Select all (unassigned) */}
          {filtered.length > 0 && (
            <button
              className={styles.selectAllBtn}
              onClick={() => {
                const unassigned = filtered.filter((s) => !alreadySet.has(s._id))
                setSelected(unassigned)
              }}
            >
              <Users size={13} />
              Select all unassigned ({filtered.filter((s) => !alreadySet.has(s._id)).length})
            </button>
          )}

          {filtered.map((s) => {
            const isAlready  = alreadySet.has(s._id)
            const isSelected = selectedSet.has(s._id)
            return (
              <button
                key={s._id}
                className={[
                  styles.row,
                  isAlready  ? styles.rowAlready  : '',
                  isSelected ? styles.rowSelected : '',
                ].join(' ')}
                onClick={() => toggle(s)}
                disabled={isAlready}
              >
                <div className={[styles.rowAvatar, isAlready ? styles.avatarAlready : ''].join(' ')}>
                  {(s.firstName?.[0] || s.username?.[0] || '?').toUpperCase()}
                </div>
                <div className={styles.rowInfo}>
                  <div className={styles.rowName}>
                    {s.firstName ? `${s.firstName} ${s.lastName || ''}`.trim() : s.username}
                  </div>
                  <div className={styles.rowEmail}>{s.email}</div>
                </div>
                {isAlready ? (
                  <span className={styles.alreadyTag}>Already assigned</span>
                ) : isSelected ? (
                  <CheckCircle size={16} className={styles.checkIcon} />
                ) : (
                  <UserPlus size={16} className={styles.addIcon} />
                )}
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button
            icon={<UserPlus size={15} />}
            loading={saving}
            onClick={handleSave}
            disabled={selected.length === 0}
          >
            {selected.length === 0
              ? 'Select students first'
              : `Add ${selected.length} Student${selected.length > 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
