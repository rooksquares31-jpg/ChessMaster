import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Users, BookOpen, CheckSquare, TrendingUp, Plus, Clock, Award, Target } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import Card from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import styles from './AdminDashboard.module.css'

const StatCard = ({ icon, label, value, color, sub }) => (
  <Card className={styles.statCard}>
    <div className={[styles.statIcon, styles[color]].join(' ')}>{icon}</div>
    <div className={styles.statValue}>{value ?? '—'}</div>
    <div className={styles.statLabel}>{label}</div>
    {sub && <div className={styles.statSub}>{sub}</div>}
  </Card>
)

const CHART_COLORS = ['#4f8ef7', '#22c55e', '#f59e0b', '#ef4444', '#a855f7']

export default function AdminDashboard() {
  const navigate = useNavigate()
  const { data: dash, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then((r) => r.data.data),
  })

  const ov = dash?.overview || {}
  const leaderboard = dash?.leaderboard || []
  const trend = dash?.monthlyTrend || []

  const pieData = [
    { name: 'Completed', value: ov.totalSubmissions || 0 },
    { name: 'Pending', value: ov.pendingCorrections || 0 },
    { name: 'Overdue', value: ov.overdueHomework || 0 },
  ]

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Coach Dashboard</h1>
          <p className={styles.subtitle}>Overview of your chess classes and student performance</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => navigate('/admin/homework/create')}>
          Create Homework
        </Button>
        <Button icon={<Plus size={16} />} onClick={() => navigate('/admin/add/student')}>
          Add Student
        </Button>
      </div>

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        <StatCard icon={<Users size={20} />} label="Total Students" value={ov.totalStudents} color="blue"
          sub={`${ov.activeStudents} active`} />
        <StatCard icon={<BookOpen size={20} />} label="Homework Assigned" value={ov.totalHomework} color="purple" />
        <StatCard icon={<CheckSquare size={20} />} label="Submissions" value={ov.totalSubmissions} color="green"
          sub={`${ov.pendingCorrections} pending review`} />
        <StatCard icon={<TrendingUp size={20} />} label="Avg Class Score" value={ov.averageClassScore ? `${ov.averageClassScore}%` : '—'} color="yellow" />
        <StatCard icon={<Clock size={20} />} label="Overdue" value={ov.overdueHomework} color="red" />
        <StatCard icon={<Target size={20} />} label="Pending Corrections" value={ov.pendingCorrections} color="orange"
          sub="Need your review" />
      </div>

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        {/* Pie */}
        <Card className={styles.chartCard}>
          <h3 className={styles.cardTitle}>Homework Overview</h3>
          {ov.totalSubmissions > 0 ? (
            <div className={styles.pieWrap}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className={styles.pieLegend}>
                {pieData.map((d, i) => (
                  <div key={i} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: CHART_COLORS[i] }} />
                    <span>{d.name}</span>
                    <strong>{d.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.empty}>No data yet</div>
          )}
        </Card>

        {/* Bar */}
        <Card className={styles.chartCard}>
          <h3 className={styles.cardTitle}>Monthly Submissions</h3>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trend}>
                <XAxis dataKey="month" stroke="#555870" tick={{ fontSize: 12, fill: '#8b90a7' }} />
                <YAxis stroke="#555870" tick={{ fontSize: 12, fill: '#8b90a7' }} />
                <Tooltip contentStyle={{ background: '#1a1d27', border: '1px solid #2a2d3e', borderRadius: 8, fontSize: 13 }} />
                <Bar dataKey="count" fill="#4f8ef7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className={styles.empty}>No submissions yet</div>
          )}
        </Card>
      </div>

      {/* Leaderboard */}
      <Card>
        <div className={styles.leaderHeader}>
          <h3 className={styles.cardTitle}><Award size={18} /> Student Leaderboard</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/students')}>View All</Button>
        </div>
        {leaderboard.length === 0 ? (
          <div className={styles.empty}>No student data yet</div>
        ) : (
          <div className={styles.leaderList}>
            {leaderboard.map((entry, i) => (
              <div key={i} className={styles.leaderRow}>
                <div className={[styles.rank, i < 3 ? styles[`rank${i}`] : ''].join(' ')}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                </div>
                <div className={styles.leaderAvatar}>
                  {(entry.student?.firstName?.[0] || entry.student?.username?.[0] || '?').toUpperCase()}
                </div>
                <div className={styles.leaderInfo}>
                  <div className={styles.leaderName}>
                    {entry.student?.firstName
                      ? `${entry.student.firstName} ${entry.student.lastName || ''}`
                      : entry.student?.username}
                  </div>
                  <div className={styles.leaderSub}>{entry.completedHomework} assignments completed</div>
                </div>
                <div className={styles.leaderScore}>
                  <div className={styles.scoreValue}>{entry.averageScore}%</div>
                  <Badge variant={entry.completionRate >= 80 ? 'green' : entry.completionRate >= 50 ? 'yellow' : 'red'} size="sm">
                    {entry.completionRate}% rate
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
