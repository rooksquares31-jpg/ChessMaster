import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus, BookOpen, Calendar, Users, Trash2, AlertTriangle, X, ChevronRight,
} from 'lucide-react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import styles from './AdminHomework.module.css'

export default function AdminHomeworkList() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(null) // homework to delete

  const { data, isLoading } = useQuery({
    queryKey: ['admin-homework'],
    queryFn: () => api.get('/homework?limit=50').then((r) => r.data.data),
  })
  const homework = data || []

  const deleteMut = useMutation({
    mutationFn: (id) => api.delete(`/homework/${id}`),
    onSuccess: (_, id) => {
      toast.success('Homework and all related submissions deleted permanently')
      qc.invalidateQueries(['admin-homework'])
      qc.invalidateQueries(['my-homework'])
      qc.invalidateQueries(['my-submissions-all'])
      qc.invalidateQueries(['sub-for-grading'])
      qc.invalidateQueries(['student-dashboard'])
      setConfirmDelete(null)
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to delete homework')
    },
  })

  const catColor = { tactics: 'yellow', 'mate-in-one': 'red', 'mate-in-two': 'red', opening: 'blue', middlegame: 'purple', endgame: 'green', strategy: 'blue', calculation: 'purple' }
  const diffColor = { beginner: 'green', intermediate: 'yellow', advanced: 'red' }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Homework</h1>
          <p className={styles.subtitle}>{homework.length} assignment{homework.length !== 1 ? 's' : ''} created</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => navigate('/admin/homework/create')}>
          Create Homework
        </Button>
      </div>

      {isLoading ? (
        <div className={styles.loading}>Loading…</div>
      ) : homework.length === 0 ? (
        <Card className={styles.empty}>
          <BookOpen size={48} />
          <h3>No homework yet</h3>
          <p>Create your first homework assignment for students.</p>
          <Button icon={<Plus size={16} />} onClick={() => navigate('/admin/homework/create')}>
            Create Homework
          </Button>
        </Card>
      ) : (
        <div className={styles.table}>
          <div className={styles.tableHead}>
            <span>Title</span>
            <span>Category</span>
            <span>Difficulty</span>
            <span>Students</span>
            <span>Due Date</span>
            <span>Status</span>
            <span></span>
          </div>
          {homework.map((hw) => (
            <div key={hw._id} className={styles.tableRow} onClick={() => navigate(`/admin/homework/${hw._id}`)}>
              <div className={styles.hwName}>
                <div className={styles.hwTitle}>{hw.title}</div>
                {hw.description && <div className={styles.hwDesc}>{hw.description.slice(0, 60)}…</div>}
              </div>
              <Badge variant={catColor[hw.category] || 'blue'} size="sm">{hw.category}</Badge>
              <Badge variant={diffColor[hw.difficulty] || 'yellow'} size="sm">{hw.difficulty}</Badge>
              <div className={styles.hwStudents}>
                <Users size={13} />
                {hw.assignedStudents?.length || 0}
              </div>
              <div className={styles.hwDate}>
                <Calendar size={13} />
                {format(new Date(hw.dueDate), 'MMM d, yyyy')}
              </div>
              <Badge
                variant={hw.status === 'corrected' ? 'green' : hw.status === 'submitted' ? 'blue' : 'yellow'}
                size="sm" dot
              >
                {hw.status}
              </Badge>
              <div className={styles.rowRight}>
                <button
                  className={styles.deleteBtn}
                  title="Delete homework permanently"
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(hw) }}
                >
                  <Trash2 size={15} />
                </button>
                <ChevronRight size={15} className={styles.rowChevron} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Delete Confirm Modal ── */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Homework?"
        size="sm"
      >
        {confirmDelete && (
          <div className={styles.confirmBody}>
            <div className={styles.confirmIcon}>
              <AlertTriangle size={32} />
            </div>
            <p className={styles.confirmTitle}>
              Permanently delete <strong>"{confirmDelete.title}"</strong>?
            </p>
            <p className={styles.confirmSub}>
              This will also delete all student submissions and coach corrections for this homework.
              <strong> This cannot be undone.</strong>
            </p>
            <div className={styles.confirmActions}>
              <Button variant="secondary" onClick={() => setConfirmDelete(null)} icon={<X size={15} />}>
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
    </div>
  )
}
