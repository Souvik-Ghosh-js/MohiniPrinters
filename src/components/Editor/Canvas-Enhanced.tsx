import React, { useRef, useState, useCallback } from 'react'
import { CanvasElement, Background } from '../../types/canvas'

interface Props {
  elements: CanvasElement[]
  selectedId: string | null
  onSelect: (id: string | null) => void
  onUpdate: (id: string, updates: Partial<CanvasElement>) => void
  onCommit: () => void
  width: number
  height: number
  zoom: number
  background: Background
}

const CanvasEnhanced: React.FC<Props> = ({ elements, selectedId, onSelect, onUpdate, onCommit, width, height, zoom, background }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [action, setAction] = useState<{ type: 'drag' | 'resize' | 'rotate'; id: string; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number; origRot: number; handle?: string } | null>(null)
  const scale = zoom / 100

  const getBackgroundStyle = (): React.CSSProperties => {
    if (!background) return { background: '#ffffff' }
    if (background.type === 'solid') {
      return { background: background.solid?.color || '#ffffff' }
    }
    if (background.type === 'gradient') {
      const angle = background.gradient?.angle ?? 45
      const colors = background.gradient?.colors?.join(', ') || '#000, #fff'
      return { background: `linear-gradient(${angle}deg, ${colors})` }
    }
    if (background.type === 'image' && background.image?.src) {
      return {
        backgroundImage: `url(${background.image.src})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: background.image.blur ? `blur(${background.image.blur}px)` : undefined,
      }
    }
    return { background: '#ffffff' }
  }

  const getFilter = (el: CanvasElement) => {
    const p = el.properties
    const parts = []
    if (p.brightness !== undefined && p.brightness !== 100) parts.push(`brightness(${p.brightness}%)`)
    if (p.contrast !== undefined && p.contrast !== 100) parts.push(`contrast(${p.contrast}%)`)
    if (p.saturation !== undefined && p.saturation !== 100) parts.push(`saturate(${p.saturation}%)`)
    if (p.hueRotate !== undefined && p.hueRotate !== 0) parts.push(`hue-rotate(${p.hueRotate}deg)`)
    if (p.blur !== undefined && p.blur !== 0) parts.push(`blur(${p.blur}px)`)
    if (p.grayscale !== undefined && p.grayscale !== 0) parts.push(`grayscale(${p.grayscale}%)`)
    if (p.sepia !== undefined && p.sepia !== 0) parts.push(`sepia(${p.sepia}%)`)
    return parts.join(' ') || undefined
  }

  const getTextStyle = (el: CanvasElement): React.CSSProperties => {
    const p = el.properties
    const style: React.CSSProperties = {
      fontSize: `${p.fontSize || 24}px`,
      fontFamily: p.fontFamily || 'Arial',
      color: p.fill || '#000000',
      fontWeight: p.fontWeight || '400',
      fontStyle: p.fontStyle || 'normal',
      textDecoration: p.textDecoration || 'none',
      textAlign: p.textAlign || 'center',
      lineHeight: p.lineHeight ? `${p.lineHeight}` : '1.4',
      letterSpacing: p.letterSpacing ? `${p.letterSpacing}px` : '0',
      textTransform: (p.textTransform as any) || 'none',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: p.textAlign === 'center' ? 'center' : p.textAlign === 'right' ? 'flex-end' : 'flex-start',
      padding: '4px 6px',
      wordBreak: 'break-word',
      overflow: 'hidden',
    }
    if (p.shadow) {
      style.textShadow = `${p.shadow.offsetX || 2}px ${p.shadow.offsetY || 2}px ${p.shadow.blur || 4}px ${p.shadow.color || '#00000066'}`
    }
    if (p.stroke) {
      style.WebkitTextStroke = `${p.stroke.width}px ${p.stroke.color}`
    }
    if (p.gradient) {
      const colors = p.gradient.colors?.join(', ') || '#000, #fff'
      const angle = p.gradient.angle || 90
      style.background = `linear-gradient(${angle}deg, ${colors})`
      style.WebkitBackgroundClip = 'text'
      style.WebkitTextFillColor = 'transparent'
    }
    return style
  }

  const getElementWrapStyle = (el: CanvasElement): React.CSSProperties => ({
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    transform: `rotate(${el.rotation || 0}deg)`,
    transformOrigin: 'center center',
    opacity: (el.opacity ?? 100) / 100,
    zIndex: el.zIndex || 1,
    cursor: el.locked ? 'not-allowed' : 'move',
    visibility: el.visible === false ? 'hidden' : 'visible',
    mixBlendMode: (el.properties.blendMode as any) || 'normal',
    userSelect: 'none',
    outline: selectedId === el.id ? '2px solid #1dc48d' : 'none',
    boxShadow: selectedId === el.id ? '0 0 0 1px #1dc48d44' : undefined,
  })

  const onMouseDown = useCallback((e: React.MouseEvent, el: CanvasElement, type: 'drag' | 'resize' | 'rotate', handle?: string) => {
    if (el.locked) return
    e.stopPropagation()
    e.preventDefault()
    onSelect(el.id)
    setAction({ type, id: el.id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y, origW: el.width, origH: el.height, origRot: el.rotation, handle })

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - e.clientX) / scale
      const dy = (ev.clientY - e.clientY) / scale
      if (type === 'drag') {
        onUpdate(el.id, { x: el.x + dx, y: el.y + dy })
      } else if (type === 'resize') {
        if (handle === 'se') onUpdate(el.id, { width: Math.max(20, el.width + dx), height: Math.max(20, el.height + dy) })
        else if (handle === 'sw') onUpdate(el.id, { x: el.x + dx, width: Math.max(20, el.width - dx), height: Math.max(20, el.height + dy) })
        else if (handle === 'ne') onUpdate(el.id, { y: el.y + dy, width: Math.max(20, el.width + dx), height: Math.max(20, el.height - dy) })
        else if (handle === 'nw') onUpdate(el.id, { x: el.x + dx, y: el.y + dy, width: Math.max(20, el.width - dx), height: Math.max(20, el.height - dy) })
        else if (handle === 'n') onUpdate(el.id, { y: el.y + dy, height: Math.max(20, el.height - dy) })
        else if (handle === 's') onUpdate(el.id, { height: Math.max(20, el.height + dy) })
        else if (handle === 'e') onUpdate(el.id, { width: Math.max(20, el.width + dx) })
        else if (handle === 'w') onUpdate(el.id, { x: el.x + dx, width: Math.max(20, el.width - dx) })
      } else if (type === 'rotate') {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        const cx = rect.left + (el.x + el.width / 2) * scale
        const cy = rect.top + (el.y + el.height / 2) * scale
        const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI) + 90
        onUpdate(el.id, { rotation: Math.round(angle) })
      }
    }
    const onUp = () => {
      onCommit()
      setAction(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [scale, onUpdate, onCommit, onSelect])

  const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']
  const handlePos: Record<string, { top?: string; left?: string; right?: string; bottom?: string; transform: string; cursor: string }> = {
    nw: { top: '-5px', left: '-5px', transform: 'none', cursor: 'nw-resize' },
    n:  { top: '-5px', left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' },
    ne: { top: '-5px', right: '-5px', transform: 'none', cursor: 'ne-resize' },
    w:  { top: '50%', left: '-5px', transform: 'translateY(-50%)', cursor: 'w-resize' },
    e:  { top: '50%', right: '-5px', transform: 'translateY(-50%)', cursor: 'e-resize' },
    sw: { bottom: '-5px', left: '-5px', transform: 'none', cursor: 'sw-resize' },
    s:  { bottom: '-5px', left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' },
    se: { bottom: '-5px', right: '-5px', transform: 'none', cursor: 'se-resize' },
  }

  const renderElement = (el: CanvasElement) => {
    const isSelected = selectedId === el.id
    return (
      <div key={el.id} style={getElementWrapStyle(el)} onMouseDown={e => onMouseDown(e, el, 'drag')}>
        {el.type === 'text' && (
          <div style={getTextStyle(el)}>{el.properties.text || 'Text'}</div>
        )}
        {el.type === 'image' && (
          <img src={el.properties.src} alt="" style={{ width: '100%', height: '100%', objectFit: el.properties.objectFit || 'cover', borderRadius: el.properties.borderRadius || 0, filter: getFilter(el), display: 'block', pointerEvents: 'none' }} draggable={false} />
        )}
        {el.type === 'shape' && (
          <div style={{ width: '100%', height: '100%', background: el.properties.fill || '#1dc48d', borderRadius: el.properties.borderRadius || 0, border: el.properties.stroke ? `${el.properties.stroke.width}px solid ${el.properties.stroke.color}` : undefined }} />
        )}

        {/* Selection handles */}
        {isSelected && !el.locked && (
          <>
            {handles.map(h => (
              <div key={h} onMouseDown={e => onMouseDown(e, el, 'resize', h)} style={{ position: 'absolute', ...handlePos[h], width: 10, height: 10, background: '#fff', border: '2px solid #1dc48d', borderRadius: 2, zIndex: 10 }} />
            ))}
            {/* Rotate handle */}
            <div onMouseDown={e => onMouseDown(e, el, 'rotate')} style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', width: 16, height: 16, background: '#1dc48d', borderRadius: '50%', cursor: 'grab', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#fff', fontSize: 10 }}>↻</span>
            </div>
            {/* Rotate line */}
            <div style={{ position: 'absolute', top: -20, left: '50%', width: 2, height: 20, background: '#1dc48d', transform: 'translateX(-50%)', zIndex: 9 }} />
          </>
        )}
      </div>
    )
  }

  const sortedElements = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  return (
    <div style={{ position: 'relative', overflow: 'hidden', display: 'inline-block' }}>
      <div
        ref={containerRef}
        style={{ width, height, position: 'relative', transform: `scale(${scale})`, transformOrigin: 'top left', cursor: 'default', overflow: 'hidden', ...getBackgroundStyle() }}
        onClick={e => { if (e.target === e.currentTarget) onSelect(null) }}
      >
        {sortedElements.map(renderElement)}
      </div>
    </div>
  )
}

export default CanvasEnhanced
