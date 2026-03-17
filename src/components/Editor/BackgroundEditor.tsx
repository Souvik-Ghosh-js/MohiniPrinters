import React, { useState } from 'react'
import { Background } from '../../types/canvas'

interface Props {
  background: Background
  onUpdate: (bg: Background) => void
}

const BackgroundEditor: React.FC<Props> = ({ background, onUpdate }) => {
  const [mode, setMode] = useState<'solid' | 'gradient' | 'image'>(background?.type || 'solid')

  const s: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8125rem' }

  const switchMode = (m: 'solid' | 'gradient' | 'image') => {
    setMode(m)
    if (m === 'solid') onUpdate({ type: 'solid', solid: { color: background?.solid?.color || '#ffffff', opacity: 100 } })
    if (m === 'gradient') onUpdate({ type: 'gradient', gradient: { angle: 135, colors: ['#1dc48d', '#2563eb'], opacity: 100 } })
    if (m === 'image') onUpdate({ type: 'image', image: { src: '', opacity: 100, blur: 0, scale: 1 } })
  }

  return (
    <div className="panel-section">
      <div className="panel-title">Background</div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['solid', 'gradient', 'image'] as const).map(m => (
          <button key={m} onClick={() => switchMode(m)} className={`btn btn-sm${mode === m ? ' btn-primary' : ' btn-secondary'}`} style={{ flex: 1, textTransform: 'capitalize' }}>
            {m}
          </button>
        ))}
      </div>

      {mode === 'solid' && (
        <div>
          <label className="label">Color</label>
          <input type="color" value={background?.solid?.color || '#ffffff'}
            onChange={e => onUpdate({ type: 'solid', solid: { color: e.target.value, opacity: background?.solid?.opacity ?? 100 } })}
            style={{ width: '100%', height: 38, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2, marginBottom: 8 }} />
          <label className="label">Opacity: {background?.solid?.opacity ?? 100}%</label>
          <input type="range" className="range-input" min={0} max={100} value={background?.solid?.opacity ?? 100}
            onChange={e => onUpdate({ type: 'solid', solid: { color: background?.solid?.color || '#ffffff', opacity: +e.target.value } })} />
        </div>
      )}

      {mode === 'gradient' && (
        <div>
          <label className="label">Angle: {background?.gradient?.angle ?? 135}°</label>
          <input type="range" className="range-input" min={0} max={360} value={background?.gradient?.angle ?? 135}
            onChange={e => onUpdate({ type: 'gradient', gradient: { ...background.gradient!, angle: +e.target.value } })}
            style={{ marginBottom: 10 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <label className="label">Color 1</label>
              <input type="color" value={background?.gradient?.colors?.[0] || '#1dc48d'}
                onChange={e => { const c = [...(background?.gradient?.colors || ['#1dc48d','#2563eb'])]; c[0]=e.target.value; onUpdate({ type: 'gradient', gradient: { ...background.gradient!, colors: c } }) }}
                style={{ width: '100%', height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
            </div>
            <div>
              <label className="label">Color 2</label>
              <input type="color" value={background?.gradient?.colors?.[1] || '#2563eb'}
                onChange={e => { const c = [...(background?.gradient?.colors || ['#1dc48d','#2563eb'])]; c[1]=e.target.value; onUpdate({ type: 'gradient', gradient: { ...background.gradient!, colors: c } }) }}
                style={{ width: '100%', height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
            </div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label className="label">Opacity: {background?.gradient?.opacity ?? 100}%</label>
            <input type="range" className="range-input" min={0} max={100} value={background?.gradient?.opacity ?? 100}
              onChange={e => onUpdate({ type: 'gradient', gradient: { ...background.gradient!, opacity: +e.target.value } })} />
          </div>
        </div>
      )}

      {mode === 'image' && (
        <div>
          <label className="label">Image URL</label>
          <input style={{ ...s, marginBottom: 8 }} type="text" placeholder="https://..." value={background?.image?.src || ''}
            onChange={e => onUpdate({ type: 'image', image: { ...background.image!, src: e.target.value } })} />
          <label className="label">Opacity: {background?.image?.opacity ?? 100}%</label>
          <input type="range" className="range-input" min={0} max={100} value={background?.image?.opacity ?? 100}
            onChange={e => onUpdate({ type: 'image', image: { ...background.image!, opacity: +e.target.value } })}
            style={{ marginBottom: 8 }} />
          <label className="label">Blur: {background?.image?.blur ?? 0}px</label>
          <input type="range" className="range-input" min={0} max={20} value={background?.image?.blur ?? 0}
            onChange={e => onUpdate({ type: 'image', image: { ...background.image!, blur: +e.target.value } })} />
        </div>
      )}
    </div>
  )
}

export default BackgroundEditor
