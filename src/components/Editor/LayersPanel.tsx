import React from 'react'
import { Eye, EyeOff, Lock, Unlock, Type, Image, Square } from 'lucide-react'
import { CanvasElement } from '../../types/canvas'

interface Props {
  elements: CanvasElement[]
  selectedId: string | null
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  onToggleLock: (id: string) => void
}

const typeIcon = (type: string) => {
  if (type === 'text') return <Type size={12} />
  if (type === 'image') return <Image size={12} />
  return <Square size={12} />
}

const LayersPanel: React.FC<Props> = ({ elements, selectedId, onSelect, onToggleVisibility, onToggleLock }) => {
  const sorted = [...elements].sort((a, b) => b.zIndex - a.zIndex)

  return (
    <div style={{ padding: '0 0 1rem' }}>
      {sorted.length === 0 && (
        <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.8125rem' }}>
          No layers yet.<br />Add text, images or shapes.
        </div>
      )}
      {sorted.map(el => (
        <div key={el.id} onClick={() => onSelect(el.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', background: selectedId === el.id ? 'var(--brand-light)' : 'transparent', borderLeft: `3px solid ${selectedId === el.id ? 'var(--brand)' : 'transparent'}`, transition: 'all 0.1s' }}
          onMouseEnter={e => selectedId !== el.id && (e.currentTarget.style.background = 'var(--bg)')}
          onMouseLeave={e => selectedId !== el.id && (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ color: selectedId === el.id ? 'var(--brand)' : 'var(--muted)', flexShrink: 0 }}>{typeIcon(el.type)}</span>
          <span style={{ flex: 1, fontSize: '0.8125rem', fontWeight: selectedId === el.id ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: el.visible === false ? 'var(--muted)' : 'var(--text)' }}>
            {el.type === 'text' ? (el.properties.text?.slice(0, 20) || 'Text') : el.type === 'image' ? 'Image' : 'Shape'}
          </span>
          <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24, padding: 0, flexShrink: 0 }} onClick={e => { e.stopPropagation(); onToggleVisibility(el.id) }}>
            {el.visible === false ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
          <button className="btn btn-ghost btn-icon" style={{ width: 24, height: 24, padding: 0, flexShrink: 0 }} onClick={e => { e.stopPropagation(); onToggleLock(el.id) }}>
            {el.locked ? <Lock size={11} /> : <Unlock size={11} />}
          </button>
        </div>
      ))}
    </div>
  )
}

export default LayersPanel
