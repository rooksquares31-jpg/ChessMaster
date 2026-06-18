import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import { StudentForm } from './AdminStudents'
import pageStyles from './AdminStudents.module.css'

export default function AdminAddStudents() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [errorMsg, setErrorMsg] = useState('')

  const createMutation = useMutation({
    mutationFn: (payload) => api.post('/students', payload),
    onSuccess: () => {
      toast.success('Student account created successfully!')
      queryClient.invalidateQueries({ queryKey: ['students'] })
      navigate('/admin/students')
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Failed to create student account'
      setErrorMsg(msg)
    },
  })

  const handleSubmit = (payload) => {
    setErrorMsg('')
    createMutation.mutate(payload)
  }

  return (
    <div className={pageStyles.page}>
      {/* Header */}
      <div className={pageStyles.header}>
        <div>
          <h1 className={pageStyles.title}>Add New Student</h1>
          <p className={pageStyles.subtitle}>Create a student account and grant them access to homework assignments</p>
        </div>
        <Button
          variant="secondary"
          icon={<ChevronLeft size={16} />}
          onClick={() => navigate('/admin/students')}
        >
          Back to Students
        </Button>
      </div>

      {/* Form Card wrapper */}
      <div style={{ maxWidth: '800px', width: '100%', margin: '0 auto' }}>
        <Card glass>
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex'
            }}>
              <UserPlus size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>Student Registration</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Enter profile details and password credentials</p>
            </div>
          </div>

          <StudentForm
            onSubmit={handleSubmit}
            loading={createMutation.isPending}
            error={errorMsg}
          />
        </Card>
      </div>
    </div>
  )
}
