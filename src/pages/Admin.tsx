import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import toast from 'react-hot-toast'
import { useSelector } from 'react-redux'
import { ArrowLeft, Users, FolderOpen, Layout, Image } from 'lucide-react'
import { RootState } from '../store'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const Admin: React.FC = () => {
  const [stats, setStats] = useState<any>(null)
  const navigate = useNavigate()
  const { token } = useSelector((s: RootState) => s.auth)

  useEffect(() => {
    axios.get(`${API}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setStats(r.data.data))
      .catch(() => toast.error('Failed to load stats'))
  }, [])

  const cards = [
    { icon: <Users size={24} />, label: 'Total Users', value: stats?.totalUsers ?? '—', color: '#2563eb' },
    { icon: <FolderOpen size={24} />, label: 'Total Projects', value: stats?.totalProjects ?? '—', color: '#1dc48d' },
    { icon: <Layout size={24} />, label: 'Templates', value: stats?.totalTemplates ?? '—', color: '#7c3aed' },
    { icon: <Image size={24} />, label: 'Assets', value: stats?.totalAssets ?? '—', color: '#f59e0b' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 2rem', height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}><ArrowLeft size={18} /></button>
        <h1 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Admin Panel</h1>
      </header>
      <main style={{ maxWidth: 900, margin: '2.5rem auto', padding: '0 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' }}>
          {cards.map((c, i) => (
            <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ color: c.color }}>{c.icon}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)' }}>{c.value}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{c.label}</div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

export default Admin
