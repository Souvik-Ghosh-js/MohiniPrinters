import React, { useRef, useState, useCallback, useEffect } from 'react'
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

// ─── CURVED TEXT SVG ─────────────────────────────────────────
const CurvedText: React.FC<{ text: string; width: number; height: number; style: React.CSSProperties; curve: string; curveAmount: number }> = ({
  text, width, height, style, curve, curveAmount
}) => {
  const amount = curveAmount || 50
  const w = width
  const h = height
  const id = `curve-${Math.abs(text.length * 7 + amount)}`

  // Arc path: amount positive = arch up, negative = arch down
  const buildPath = () => {
    if (curve === 'arc') {
      const bend = (amount / 100) * h * 2
      const midY = amount >= 0 ? -bend : h - bend
      return `M 0,${h / 2} Q ${w / 2},${midY} ${w},${h / 2}`
    }
    if (curve === 'wave') {
      const a = (amount / 100) * h
      return `M 0,${h/2} C ${w*0.25},${h/2 - a} ${w*0.75},${h/2 + a} ${w},${h/2}`
    }
    return `M 0,${h/2} L ${w},${h/2}`
  }

  const fontSize  = (style.fontSize as string || '24px').replace('px', '')
  const fontFamily = style.fontFamily as string || 'Arial'
  const fill = (style.color as string) || '#000'
  const fontWeight = style.fontWeight as string || '400'
  const letterSpacing = style.letterSpacing as string || '0'

  return (
    <svg width={w} height={h} style={{ overflow: 'visible', position: 'absolute', top: 0, left: 0 }}>
      <defs>
        <path id={id} d={buildPath()} />
      </defs>
      <text
        fontSize={fontSize}
        fontFamily={fontFamily}
        fill={fill}
        fontWeight={fontWeight}
        letterSpacing={letterSpacing}
        textAnchor="middle"
      >
        <textPath href={`#${id}`} startOffset="50%">
          {text}
        </textPath>
      </text>
    </svg>
  )
}

// ─── INLINE TEXT EDITOR ──────────────────────────────────────
const InlineTextEditor: React.FC<{
  el: CanvasElement
  scale: number
  onDone: (text: string) => void
}> = ({ el, scale, onDone }) => {
  const ref = useRef<HTMLTextAreaElement>(null)
  const p = el.properties

  useEffect(() => {
    if (ref.current) {
      ref.current.focus()
      ref.current.select()
    }
  }, [])

  const style: React.CSSProperties = {
    position: 'absolute',
    left: el.x * scale,
    top: el.y * scale,
    width: el.width * scale,
    height: el.height * scale,
    transform: `rotate(${el.rotation || 0}deg)`,
    transformOrigin: 'center center',
    zIndex: 9999,
    resize: 'none',
    border: '2px solid #1dc48d',
    borderRadius: 2,
    padding: '4px 6px',
    background: 'rgba(255,255,255,0.95)',
    // Minimum 16px font so iOS doesn't auto-zoom on focus
    fontSize: `${Math.max((p.fontSize || 24) * scale, 16)}px`,
    fontFamily: p.fontFamily || 'Arial',
    color: p.fill || '#000',
    fontWeight: p.fontWeight || '400',
    fontStyle: p.fontStyle || 'normal',
    textAlign: p.textAlign || 'center',
    lineHeight: p.lineHeight ? `${p.lineHeight}` : '1.4',
    letterSpacing: p.letterSpacing ? `${p.letterSpacing * scale}px` : '0',
    outline: 'none',
    cursor: 'text',
    overflow: 'hidden',
    boxSizing: 'border-box',
    WebkitUserSelect: 'text',
    touchAction: 'manipulation',
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    if (e.key === 'Escape') onDone(ref.current?.value || p.text || '')
  }

  return (
    <textarea
      ref={ref}
      defaultValue={p.text || ''}
      style={style}
      onBlur={e => onDone(e.target.value)}
      onKeyDown={handleKey}
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      inputMode="text"
      autoCapitalize="sentences"
      autoCorrect="on"
      spellCheck={true}
    />
  )
}

// ─── MAIN CANVAS ─────────────────────────────────────────────
const CanvasEnhanced: React.FC<Props> = ({
  elements, selectedId, onSelect, onUpdate, onCommit, width, height, zoom, background
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const lastTap = useRef<{ id: string; time: number } | null>(null)
  const scale = zoom / 100

  const getBackgroundStyle = (): React.CSSProperties => {
    if (!background) return { background: '#ffffff' }
    if (background.type === 'solid') return { background: background.solid?.color || '#ffffff' }
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
      }
    }
    return { background: '#ffffff' }
  }

  const getFilter = (el: CanvasElement) => {
    const p = el.properties
    const parts: string[] = []
    if (p.brightness !== undefined && p.brightness !== 100) parts.push(`brightness(${p.brightness}%)`)
    if (p.contrast  !== undefined && p.contrast  !== 100) parts.push(`contrast(${p.contrast}%)`)
    if (p.saturation!== undefined && p.saturation!== 100) parts.push(`saturate(${p.saturation}%)`)
    if (p.hueRotate !== undefined && p.hueRotate !== 0)   parts.push(`hue-rotate(${p.hueRotate}deg)`)
    if (p.blur      !== undefined && p.blur      !== 0)   parts.push(`blur(${p.blur}px)`)
    if (p.grayscale !== undefined && p.grayscale !== 0)   parts.push(`grayscale(${p.grayscale}%)`)
    if (p.sepia     !== undefined && p.sepia     !== 0)   parts.push(`sepia(${p.sepia}%)`)
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
      whiteSpace: 'pre-wrap',
      overflow: 'hidden',
      boxSizing: 'border-box',
    }
    if (p.shadow) {
      style.textShadow = `${p.shadow.offsetX||2}px ${p.shadow.offsetY||2}px ${p.shadow.blur||4}px ${p.shadow.color||'#00000066'}`
    }
    if (p.stroke) {
      style.WebkitTextStroke = `${p.stroke.width}px ${p.stroke.color}`
    }
    if (p.gradient) {
      const colors = p.gradient.colors?.join(', ') || '#000, #fff'
      style.background = `linear-gradient(${p.gradient.angle || 90}deg, ${colors})`
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

  // ─── DRAG / RESIZE / ROTATE ──────────────────────────────
  const onMouseDown = useCallback((
    e: React.MouseEvent, el: CanvasElement,
    type: 'drag' | 'resize' | 'rotate', handle?: string
  ) => {
    if (el.locked) return
    e.stopPropagation()
    e.preventDefault()
    onSelect(el.id)

    const startX = e.clientX
    const startY = e.clientY

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
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
        const cy = rect.top  + (el.y + el.height / 2) * scale
        const angle = Math.atan2(ev.clientY - cy, ev.clientX - cx) * (180 / Math.PI) + 90
        onUpdate(el.id, { rotation: Math.round(angle) })
      }
    }
    const onUp = () => {
      onCommit()
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [scale, onUpdate, onCommit, onSelect])

  // ─── DOUBLE CLICK: enter text edit mode ──────────────────
  const onDoubleClick = useCallback((e: React.MouseEvent, el: CanvasElement) => {
    if (el.type !== 'text' || el.locked) return
    e.stopPropagation()
    e.preventDefault()
    setEditingId(el.id)
  }, [])

  // ─── DOUBLE TAP (mobile): enter text edit mode ───────────
  const onTouchTap = useCallback((e: React.TouchEvent, el: CanvasElement) => {
    if (el.type !== 'text' || el.locked) return
    const now = Date.now()
    const prev = lastTap.current
    if (prev && prev.id === el.id && now - prev.time < 300) {
      e.stopPropagation()
      e.preventDefault()
      setEditingId(el.id)
      lastTap.current = null
    } else {
      lastTap.current = { id: el.id, time: now }
    }
  }, [])

  const finishEdit = useCallback((id: string, text: string) => {
    onUpdate(id, { properties: { ...elements.find(e => e.id === id)!.properties, text } })
    onCommit()
    setEditingId(null)
  }, [elements, onUpdate, onCommit])

  // ─── RESIZE HANDLES ──────────────────────────────────────
  const handles = ['nw','n','ne','w','e','sw','s','se']
  const handlePos: Record<string, React.CSSProperties> = {
    nw: { top: -5, left: -5, cursor: 'nw-resize' },
    n:  { top: -5, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' },
    ne: { top: -5, right: -5, cursor: 'ne-resize' },
    w:  { top: '50%', left: -5, transform: 'translateY(-50%)', cursor: 'w-resize' },
    e:  { top: '50%', right: -5, transform: 'translateY(-50%)', cursor: 'e-resize' },
    sw: { bottom: -5, left: -5, cursor: 'sw-resize' },
    s:  { bottom: -5, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' },
    se: { bottom: -5, right: -5, cursor: 'se-resize' },
  }

  // ─── RENDER ELEMENT ──────────────────────────────────────
  const renderElement = (el: CanvasElement) => {
    const isSelected = selectedId === el.id
    const isEditing  = editingId === el.id
    const p = el.properties
    const hasCurve = el.type === 'text' && p.textCurve && p.textCurve !== 'none'

    return (
      <div
        key={el.id}
        style={getElementWrapStyle(el)}
        onMouseDown={e => { if (!isEditing) onMouseDown(e, el, 'drag') }}
        onDoubleClick={e => onDoubleClick(e, el)}
        onTouchEnd={e => onTouchTap(e, el)}
      >
        {/* TEXT */}
        {el.type === 'text' && !isEditing && (
          hasCurve ? (
            <CurvedText
              text={p.text || ''}
              width={el.width}
              height={el.height}
              style={getTextStyle(el)}
              curve={p.textCurve!}
              curveAmount={p.curveAmount ?? 50}
            />
          ) : (
            <div style={getTextStyle(el)}>{p.text || 'Double-click to edit'}</div>
          )
        )}

        {/* IMAGE */}
        {el.type === 'image' && (
          <img
            src={p.src} alt=""
            crossOrigin="anonymous"
            style={{ width: '100%', height: '100%', objectFit: p.objectFit || 'cover', borderRadius: p.borderRadius || 0, filter: getFilter(el), display: 'block', pointerEvents: 'none' }}
            draggable={false}
          />
        )}

        {/* SHAPE */}
        {el.type === 'shape' && (
          <div style={{
            width: '100%', height: '100%',
            background: p.fill || '#1dc48d',
            borderRadius: p.borderRadius || 0,
            border: p.stroke ? `${p.stroke.width}px solid ${p.stroke.color}` : undefined
          }} />
        )}

        {/* SELECTION HANDLES */}
        {isSelected && !el.locked && !isEditing && (
          <>
            {handles.map(h => (
              <div
                key={h}
                onMouseDown={e => onMouseDown(e, el, 'resize', h)}
                style={{ position: 'absolute', ...handlePos[h], width: 10, height: 10, background: '#fff', border: '2px solid #1dc48d', borderRadius: 2, zIndex: 10 }}
              />
            ))}
            {/* Rotate handle */}
            <div
              onMouseDown={e => onMouseDown(e, el, 'rotate')}
              style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', width: 16, height: 16, background: '#1dc48d', borderRadius: '50%', cursor: 'grab', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span style={{ color: '#fff', fontSize: 10 }}>↻</span>
            </div>
            <div style={{ position: 'absolute', top: -20, left: '50%', width: 2, height: 20, background: '#1dc48d', transform: 'translateX(-50%)', zIndex: 9 }} />
            {/* Double-click hint for text */}
            {el.type === 'text' && (
              <div style={{ position: 'absolute', bottom: -20, left: '50%', transform: 'translateX(-50%)', fontSize: '0.6rem', color: '#1dc48d', whiteSpace: 'nowrap', background: 'white', padding: '1px 6px', borderRadius: 4, border: '1px solid #1dc48d' }}>
                dbl-click to edit
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  // Outer wrapper must be exactly scaled size so it doesn't overflow parent
  const scaledW = Math.round(width  * scale)
  const scaledH = Math.round(height * scale)

  return (
    <div style={{ position: 'relative', width: scaledW, height: scaledH, overflow: 'hidden', flexShrink: 0 }}>
      {/* Inline text editor rendered at scaled coords over the canvas */}
      {editingId && (() => {
        const el = elements.find(e => e.id === editingId)
        return el ? (
          <InlineTextEditor
            el={el}
            scale={scale}
            onDone={text => finishEdit(editingId, text)}
          />
        ) : null
      })()}

      {/* canvas-export-target: always full 1:1 size, used by PNG export */}
      <div
        ref={containerRef}
        className="canvas-export-target"
        style={{
          width, height, position: 'absolute', top: 0, left: 0,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          cursor: 'default', overflow: 'hidden',
          ...getBackgroundStyle()
        }}
        onClick={e => { if (e.target === e.currentTarget && !editingId) onSelect(null) }}
      >
        {sorted.map(renderElement)}
      </div>
    </div>
  )
}

export default CanvasEnhanced