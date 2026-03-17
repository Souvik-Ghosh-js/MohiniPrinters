import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, Trash2, LogOut, Settings, Layout, Clock } from 'lucide-react'
import { RootState } from '../store'
import { logout } from '../store/slices/authSlice'
import { DESIGN_TEMPLATES } from '../types/canvas'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTitle, setNewTitle] = useState('Untitled Design')
  const [selectedSize, setSelectedSize] = useState('presentation')
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user, token } = useSelector((s: RootState) => s.auth)
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => { fetchProjects() }, [])

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API}/api/projects`, { headers })
      setProjects(res.data.data)
    } catch { toast.error('Failed to load projects') }
    finally { setLoading(false) }
  }

  const handleCreate = async () => {
    const tpl = DESIGN_TEMPLATES[selectedSize]
    try {
      const res = await axios.post(`${API}/api/projects`, { title: newTitle || 'Untitled Design', width: tpl.width, height: tpl.height }, { headers })
      toast.success('Project created!')
      navigate(`/editor/${res.data.data.id}`)
    } catch { toast.error('Failed to create project') }
  }

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Delete this project?')) return
    try {
      await axios.delete(`${API}/api/projects/${id}`, { headers })
      setProjects(p => p.filter(x => x.id !== id))
      toast.success('Deleted')
    } catch { toast.error('Failed to delete') }
  }

  const templateEntries = Object.entries(DESIGN_TEMPLATES)
  const categories = Array.from(new Set(templateEntries.map(([, t]) => t.category)))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 2rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 0 var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: 'var(--brand)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: '1rem' }}>✦</span>
          </div>
          <span className="header-logo-text" style={{ fontWeight: 800, fontSize: '1.1rem' }}>MohiniPrinters</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span className="header-greeting" style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Hello, {user?.name || 'Designer'}</span>
          {user?.is_admin && (
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/admin')}>
              <Settings size={14} /> Admin
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={() => { dispatch(logout()); navigate('/login') }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </header>

      <main style={{ maxWidth: 1400, margin: '0 auto', padding: '2.5rem 2rem' }}>
        {/* Hero */}
        <div className="dashboard-hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.5rem' }}>Your Designs</h1>
            <p style={{ color: 'var(--muted)' }}>{projects.length} project{projects.length !== 1 ? 's' : ''} — create stunning graphics for any platform</p>
          </div>
          <button className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '0.9375rem' }} onClick={() => setShowNewModal(true)}>
            <Plus size={18} /> New Design
          </button>
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--muted)' }}>Loading your designs...</div>
        ) : projects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem', background: '#fff', borderRadius: 16, border: '2px dashed var(--border)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎨</div>
            <h2 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>No designs yet</h2>
            <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>Click "New Design" to get started</p>
            <button className="btn btn-primary" onClick={() => setShowNewModal(true)}><Plus size={18}/> Create First Design</button>
          </div>
        ) : (
          <div className="projects-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
            {projects.map(p => (
              <div key={p.id} onClick={() => navigate(`/editor/${p.id}`)}
                style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s', boxShadow: 'var(--shadow)' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)', e.currentTarget.style.boxShadow = 'var(--shadow-lg)')}
                onMouseLeave={e => (e.currentTarget.style.transform = '', e.currentTarget.style.boxShadow = 'var(--shadow)')}
              >
                <div style={{ width: '100%', height: 150, background: 'linear-gradient(135deg, #f0fdf7, #e8f4ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {p.thumbnail_url
                    ? <img src={p.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Layout size={40} color="#cbd5e1" />
                  }
                </div>
                <div style={{ padding: '0.875rem 1rem' }}>
                  <h3 style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</h3>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--muted)', fontSize: '0.75rem' }}>
                      <Clock size={11} /> {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                    <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={e => handleDelete(p.id, e)}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Design Modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="new-design-modal" style={{ background: '#fff', borderRadius: 16, padding: '2rem', width: 560, maxHeight: '80vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontWeight: 800, marginBottom: '1.5rem', fontSize: '1.25rem' }}>Create New Design</h2>

            <div style={{ marginBottom: '1.25rem' }}>
              <label className="label">Design Title</label>
              <input className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Untitled Design" />
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="label">Choose Size</label>
              {categories.map(cat => (
                <div key={cat} style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--muted)', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase' }}>{cat}</div>
                  <div className="size-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {templateEntries.filter(([, t]) => t.category === cat).map(([key, tpl]) => (
                      <button key={key} onClick={() => setSelectedSize(key)}
                        style={{ padding: '10px 8px', border: `2px solid ${selectedSize === key ? 'var(--brand)' : 'var(--border)'}`, borderRadius: 8, background: selectedSize === key ? 'var(--brand-light)' : '#fff', cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.8125rem', color: selectedSize === key ? 'var(--brand)' : 'var(--text)' }}>{tpl.name}</div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--muted)', marginTop: 2 }}>{tpl.width}×{tpl.height}</div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowNewModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCreate}><Plus size={16} /> Create Design</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard