import React from 'react'
import { DESIGN_TEMPLATES } from '../../types/canvas'

interface Props {
  onSelectTemplate: (width: number, height: number, name: string) => void
  currentW: number
  currentH: number
}

const TemplateSelector: React.FC<Props> = ({ onSelectTemplate, currentW, currentH }) => {
  const entries = Object.entries(DESIGN_TEMPLATES)
  const categories = Array.from(new Set(entries.map(([, t]) => t.category)))

  return (
    <div style={{ padding: '0 0 1rem' }}>
      {categories.map(cat => (
        <div key={cat}>
          <div style={{ padding: '10px 16px 6px', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>{cat}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '0 8px' }}>
            {entries.filter(([, t]) => t.category === cat).map(([key, tpl]) => {
              const active = currentW === tpl.width && currentH === tpl.height
              return (
                <button key={key} onClick={() => onSelectTemplate(tpl.width, tpl.height, tpl.name)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', border: `1.5px solid ${active ? 'var(--brand)' : 'transparent'}`, borderRadius: 7, background: active ? 'var(--brand-light)' : 'transparent', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', width: '100%' }}
                  onMouseEnter={e => !active && (e.currentTarget.style.background = 'var(--bg)')}
                  onMouseLeave={e => !active && (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ fontWeight: 600, fontSize: '0.8125rem', color: active ? 'var(--brand)' : 'var(--text)' }}>{tpl.name}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>{tpl.width}×{tpl.height}</span>
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div style={{ padding: '10px 16px 6px', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)' }}>Custom</div>
      <CustomSizeInput onSelectTemplate={onSelectTemplate} />
    </div>
  )
}

const CustomSizeInput: React.FC<{ onSelectTemplate: (w: number, h: number, name: string) => void }> = ({ onSelectTemplate }) => {
  const [w, setW] = React.useState(1200)
  const [h, setH] = React.useState(800)
  const s: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8125rem' }
  return (
    <div style={{ padding: '0 8px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        <div><label className="label">Width</label><input style={s} type="number" value={w} onChange={e => setW(+e.target.value)} /></div>
        <div><label className="label">Height</label><input style={s} type="number" value={h} onChange={e => setH(+e.target.value)} /></div>
      </div>
      <button className="btn btn-secondary btn-sm" style={{ width: '100%' }} onClick={() => onSelectTemplate(w, h, 'Custom')}>Apply Custom Size</button>
    </div>
  )
}

export default TemplateSelector
