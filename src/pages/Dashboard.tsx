import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Plus, Trash2, LogOut, Settings, Layout, Clock, ChevronRight } from 'lucide-react'
import { RootState } from '../store'
import { logout } from '../store/slices/authSlice'
import { DESIGN_TEMPLATES } from '../types/canvas'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface AdminTemplate {
  name: string
  url: string
  displayName: string
  category: string
  type: string
  createdAt: string
}

const Dashboard: React.FC = () => {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewModal, setShowNewModal] = useState(false)
  const [newTitle, setNewTitle] = useState('Untitled Design')
  const [selectedSize, setSelectedSize] = useState('a4_portrait')
  const [modalStep, setModalStep] = useState<'templates' | 'sizes'>('templates')
  const [selectedTemplate, setSelectedTemplate] = useState<AdminTemplate | null>(null)
  const [adminTemplates, setAdminTemplates] = useState<AdminTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user, token } = useSelector((s: RootState) => s.auth)
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    fetchProjects()
    fetchAdminTemplates()
  }, [])

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API}/api/projects`, { headers })
      setProjects(res.data.data)
    } catch { toast.error('Failed to load projects') }
    finally { setLoading(false) }
  }

  const fetchAdminTemplates = async () => {
    setTemplatesLoading(true)
    try {
      const res = await axios.get(`${API}/api/assets/templates`)
      setAdminTemplates(res.data.files || [])
    } catch { /* silently ignore */ }
    finally { setTemplatesLoading(false) }
  }

  const handleCreate = async (templateFile?: AdminTemplate) => {
    const tpl = DESIGN_TEMPLATES[selectedSize]
    try {
      const res = await axios.post(`${API}/api/projects`, {
        title: newTitle || 'Untitled Design',
        width: tpl.width,
        height: tpl.height,
      }, { headers })
      toast.success('Project created!')
      const projectId = res.data.data.id
      if (templateFile) {
        // Navigate with template URL so editor can apply it on load
        navigate(`/editor/${projectId}`, { state: { templateUrl: templateFile.url, templateName: templateFile.displayName } })
      } else {
        navigate(`/editor/${projectId}`)
      }
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

  const openModal = () => {
    setModalStep('templates')
    setSelectedTemplate(null)
    setNewTitle('Untitled Design')
    setSelectedSize('a4_portrait')
    setShowNewModal(true)
  }

  const templateEntries = Object.entries(DESIGN_TEMPLATES)
  const categories = Array.from(new Set(templateEntries.map(([, t]) => t.category)))

  // Group admin templates by category
  const templateCategories = Array.from(new Set(adminTemplates.map(t => t.category || 'Other').filter(Boolean)))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 2rem', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 0 var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/assets/mohini.png" alt="Mohini Design Hub" style={{ height: 44, objectFit: 'contain' }} />
          <span className="header-logo-text" style={{ fontWeight: 800, fontSize: '1.1rem' }}>Mohini Design Hub</span>
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
          <button className="btn btn-primary" style={{ padding: '10px 20px', fontSize: '0.9375rem' }} onClick={openModal}>
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
            <button className="btn btn-primary" onClick={openModal}><Plus size={18}/> Create First Design</button>
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

        {/* ── Admin Templates Section ── */}
        {!templatesLoading && adminTemplates.length > 0 && (
          <div style={{ marginTop: '3rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>Templates</h2>
                <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Start from a professionally designed template</p>
              </div>
            </div>

            {templateCategories.map(cat => {
              const catTemplates = adminTemplates.filter(t => (t.category || 'Other') === cat)
              return (
                <div key={cat} style={{ marginBottom: '2rem' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>{cat}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem' }}>
                    {catTemplates.map(tpl => (
                      <div key={tpl.name}
                        onClick={() => {
                          setSelectedTemplate(tpl)
                          setNewTitle(tpl.displayName || 'Untitled Design')
                          setModalStep('sizes')
                          setShowNewModal(true)
                        }}
                        style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border)', transition: 'all 0.2s', boxShadow: 'var(--shadow)' }}
                        onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)', e.currentTarget.style.boxShadow = 'var(--shadow-lg)')}
                        onMouseLeave={e => (e.currentTarget.style.transform = '', e.currentTarget.style.boxShadow = 'var(--shadow)')}
                      >
                        <div style={{ width: '100%', height: 130, background: 'linear-gradient(135deg, #f0fdf7, #e8f4ff)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {(tpl.type.startsWith('image/') || tpl.url.match(/\.(jpg|jpeg|png|webp)$/i)) ? (
                            <img src={tpl.url} alt={tpl.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                              <Layout size={32} color="#cbd5e1" />
                              <span style={{ fontSize: '0.65rem', color: '#94a3b8', background: '#f1f5f9', padding: '2px 8px', borderRadius: 4 }}>JSON Template</span>
                            </div>
                          )}
                        </div>
                        <div style={{ padding: '0.75rem 1rem' }}>
                          <h3 style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.displayName}</h3>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{tpl.category}</span>
                            <ChevronRight size={14} color="var(--brand)" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* New Design Modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="new-design-modal" style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>

            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
              <h2 style={{ fontWeight: 800, fontSize: '1.2rem', margin: 0 }}>
                {modalStep === 'templates' ? 'Choose a Template' : 'Set Canvas Size'}
              </h2>
              {modalStep === 'templates' && (
                <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: 4 }}>
                  Pick a template to start, or start from scratch
                </p>
              )}
            </div>

            <div style={{ overflowY: 'auto', flex: 1, padding: '1.25rem 1.5rem' }}>

              {/* ── Step 1: Admin Templates ── */}
              {modalStep === 'templates' && (
                <>
                  {/* Design Title */}
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="label">Design Title</label>
                    <input className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Untitled Design" />
                  </div>

                  {/* Admin Templates */}
                  {templatesLoading ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Loading templates…</div>
                  ) : adminTemplates.length > 0 ? (
                    <>
                      {templateCategories.map(cat => {
                        const catTpls = adminTemplates.filter(t => (t.category || 'Other') === cat)
                        return (
                          <div key={cat} style={{ marginBottom: '1.25rem' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--muted)', marginBottom: '0.6rem' }}>{cat}</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.625rem' }}>
                              {catTpls.map(tpl => (
                                <div key={tpl.name}
                                  onClick={() => { setSelectedTemplate(tpl); setNewTitle(tpl.displayName || newTitle); setModalStep('sizes') }}
                                  style={{ borderRadius: 10, border: `2px solid ${selectedTemplate?.name === tpl.name ? 'var(--brand)' : 'var(--border)'}`, overflow: 'hidden', cursor: 'pointer', background: selectedTemplate?.name === tpl.name ? 'var(--brand-light)' : '#fff', transition: 'all 0.15s' }}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--brand)' }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = selectedTemplate?.name === tpl.name ? 'var(--brand)' : 'var(--border)' }}
                                >
                                  <div style={{ height: 90, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                    {(tpl.type.startsWith('image/') || tpl.url.match(/\.(jpg|jpeg|png|webp)$/i)) ? (
                                      <img src={tpl.url} alt={tpl.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                      <Layout size={22} style={{ opacity: 0.3 }} />
                                    )}
                                  </div>
                                  <div style={{ padding: '5px 7px' }}>
                                    <p style={{ fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: selectedTemplate?.name === tpl.name ? 'var(--brand)' : 'var(--text)' }}>{tpl.displayName}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--muted)', fontSize: '0.875rem', background: '#f8fafc', borderRadius: 10, marginBottom: '1rem' }}>
                      No templates uploaded yet — start from scratch below
                    </div>
                  )}

                  {/* Start from scratch shortcut */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                    <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => { setSelectedTemplate(null); setModalStep('sizes') }}>
                      Start from Scratch (A4 default)
                    </button>
                  </div>
                </>
              )}

              {/* ── Step 2: Size Picker ── */}
              {modalStep === 'sizes' && (
                <>
                  {selectedTemplate && (
                    <div style={{ background: 'var(--brand-light)', border: '1px solid var(--brand)', borderRadius: 8, padding: '8px 12px', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--brand)', fontWeight: 600 }}>
                      Template: {selectedTemplate.displayName} — canvas size below applies to the new project
                    </div>
                  )}

                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="label">Design Title</label>
                    <input className="input" value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Untitled Design" />
                  </div>

                  <div>
                    <label className="label">Canvas Size <span style={{ color: 'var(--muted)', fontWeight: 400 }}>(default: A4)</span></label>
                    {categories.map(cat => (
                      <div key={cat} style={{ marginBottom: '1rem' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase' }}>{cat}</div>
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
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="modal-actions" style={{ display: 'flex', gap: '0.75rem', justifyContent: 'space-between', padding: '1rem 1.5rem', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
              <button className="btn btn-secondary"
                onClick={() => {
                  if (modalStep === 'sizes' && adminTemplates.length > 0) { setModalStep('templates') }
                  else { setShowNewModal(false); setSelectedTemplate(null) }
                }}>
                {modalStep === 'sizes' && adminTemplates.length > 0 ? '← Back' : 'Cancel'}
              </button>
              <button className="btn btn-primary" onClick={() => handleCreate(selectedTemplate || undefined)}>
                <Plus size={16} /> Create Design
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default Dashboard
