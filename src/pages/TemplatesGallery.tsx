import React from 'react'
import { useNavigate } from 'react-router-dom'
import { DESIGN_TEMPLATES } from '../types/canvas'
import { ArrowLeft } from 'lucide-react'

const TemplatesGallery: React.FC = () => {
  const navigate = useNavigate()
  const entries = Object.entries(DESIGN_TEMPLATES)
  const categories = Array.from(new Set(entries.map(([, t]) => t.category)))

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 2rem', height: 60, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}><ArrowLeft size={18} /></button>
        <h1 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Templates Gallery</h1>
      </header>
      <main style={{ maxWidth: 1100, margin: '2.5rem auto', padding: '0 2rem' }}>
        {categories.map(cat => (
          <div key={cat} style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: '1rem' }}>{cat}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
              {entries.filter(([, t]) => t.category === cat).map(([key, tpl]) => (
                <div key={key} style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)', cursor: 'pointer', boxShadow: 'var(--shadow)' }}
                  onClick={() => navigate('/dashboard')}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = ''}
                >
                  <div style={{ height: 120, background: `linear-gradient(135deg, hsl(${key.length * 20}, 60%, 70%), hsl(${key.length * 40}, 80%, 80%))`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 700 }}>{tpl.width}×{tpl.height}</span>
                  </div>
                  <div style={{ padding: '0.875rem 1rem' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>{tpl.name}</h3>
                    <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: 2 }}>{tpl.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
    </div>
  )
}

export default TemplatesGallery
