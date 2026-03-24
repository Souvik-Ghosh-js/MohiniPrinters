import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react'
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

// ─── SHAPE CLIP PATHS ─────────────────────────────────────────
const SHAPE_CLIPS: Record<string, string> = {
  triangle:     'polygon(50% 0%, 0% 100%, 100% 100%)',
  diamond:      'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  star:         'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  pentagon:     'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
  hexagon:      'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  arrow_right:  'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)',
  arrow_up:     'polygon(50% 0%, 100% 60%, 80% 60%, 80% 100%, 20% 100%, 20% 60%, 0% 60%)',
  cross:        'polygon(10% 40%, 40% 40%, 40% 10%, 60% 10%, 60% 40%, 90% 40%, 90% 60%, 60% 60%, 60% 90%, 40% 90%, 40% 60%, 10% 60%)',
  parallelogram:'polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)',
  trapezoid:    'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
  heart: `path('M 50 30 A 20 20 0 0 1 90 30 Q 90 60 50 90 Q 10 60 10 30 A 20 20 0 0 1 50 30 Z')`,
}

// ─── CURVED TEXT SVG ─────────────────────────────────────────
const CurvedText: React.FC<{ text: string; width: number; height: number; style: React.CSSProperties; curve: string; curveAmount: number }> = ({
  text, width, height, style, curve, curveAmount
}) => {
  const amount = curveAmount || 50
  const w = width
  const h = height
  const id = `curve-${Math.abs(text.length * 7 + amount)}`

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
    // Delay focus slightly so the DOM is ready and iOS keyboard triggers
    const t = setTimeout(() => {
      if (ref.current) {
        ref.current.focus()
        ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length)
      }
    }, 80)
    return () => clearTimeout(t)
  }, [])

  // InlineTextEditor is rendered INSIDE the element wrapper which is already
  // at (el.x, el.y) in canvas coords and has rotation applied.
  // So: position 0,0, fill 100%, NO rotation, NO scale multiplication.
  const style: React.CSSProperties = {
    position: 'absolute',
    left: 0,
    top: 0,
    width: '100%',
    height: '100%',
    // No transform — parent wrapper handles rotation + scale
    zIndex: 9999,
    resize: 'none',
    border: '2px solid var(--brand)',
    borderRadius: 2,
    padding: '4px 6px',
    background: 'rgba(255,255,255,0.93)',
    // font-size in canvas coords (parent is already scaled); min 16 so iOS doesn't zoom
    fontSize: `${Math.max(p.fontSize || 24, 16)}px`,
    fontFamily: p.fontFamily || 'Arial',
    color: p.fill || '#000',
    fontWeight: p.fontWeight || '400',
    fontStyle: p.fontStyle || 'normal',
    textAlign: p.textAlign || 'center',
    lineHeight: p.lineHeight ? `${p.lineHeight}` : '1.4',
    letterSpacing: p.letterSpacing ? `${p.letterSpacing}px` : '0',
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
      onTouchStart={e => { e.stopPropagation() }}
      onTouchEnd={e => { e.stopPropagation() }}
      inputMode="text"
      autoCapitalize="sentences"
      autoCorrect="on"
      spellCheck={true}
    />
  )
}

// ─── ALIGNMENT GUIDE HELPERS ─────────────────────────────────
const SNAP_THRESHOLD = 6
const computeAlignLines = (
  els: CanvasElement[], movingId: string,
  newX: number, newY: number, w: number, h: number
) => {
  const x: number[] = [], y: number[] = []
  const left = newX, right = newX + w, cx = newX + w / 2
  const top  = newY, bottom = newY + h, cy = newY + h / 2
  els.forEach(o => {
    if (o.id === movingId) return
    const oL = o.x, oR = o.x + o.width,  oCx = o.x + o.width  / 2
    const oT = o.y, oB = o.y + o.height, oCy = o.y + o.height / 2
    ;[oL, oR, oCx].forEach(p => {
      if (Math.abs(left-p)<SNAP_THRESHOLD||Math.abs(right-p)<SNAP_THRESHOLD||Math.abs(cx-p)<SNAP_THRESHOLD) x.push(p)
    })
    ;[oT, oB, oCy].forEach(p => {
      if (Math.abs(top-p)<SNAP_THRESHOLD||Math.abs(bottom-p)<SNAP_THRESHOLD||Math.abs(cy-p)<SNAP_THRESHOLD) y.push(p)
    })
  })
  return { x: [...new Set(x)], y: [...new Set(y)] }
}

// ─── MAIN CANVAS ─────────────────────────────────────────────
const CanvasEnhanced: React.FC<Props> = ({
  elements, selectedId, onSelect, onUpdate, onCommit, width, height, zoom, background
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const elementsRef  = useRef(elements)
  const [editingId, setEditingId]     = useState<string | null>(null)
  const [alignLines, setAlignLines]   = useState<{ x: number[]; y: number[] }>({ x: [], y: [] })
  const scale = zoom / 100

  useEffect(() => { elementsRef.current = elements }, [elements])

  // Background is rendered as a separate overlay div so opacity doesn't bleed into elements
  const getBgLayerStyle = (): React.CSSProperties => {
    if (!background) return { background: '#ffffff' }
    const opacity = (() => {
      if (background.type === 'solid')    return (background.solid?.opacity    ?? 100) / 100
      if (background.type === 'gradient') return (background.gradient?.opacity ?? 100) / 100
      if (background.type === 'image')    return (background.image?.opacity    ?? 100) / 100
      return 1
    })()
    const base: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 0, opacity }
    if (background.type === 'solid') {
      return { ...base, background: background.solid?.color || '#ffffff' }
    }
    if (background.type === 'gradient') {
      const angle  = background.gradient?.angle ?? 45
      const colors = background.gradient?.colors?.join(', ') || '#000, #fff'
      return { ...base, background: `linear-gradient(${angle}deg, ${colors})` }
    }
    if (background.type === 'image' && background.image?.src) {
      const blur = background.image?.blur ?? 0
      return { ...base, backgroundImage: `url(${background.image.src})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: blur ? `blur(${blur}px)` : undefined }
    }
    return { ...base, background: '#ffffff' }
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
    // Text effects (presets override manual shadow)
    if (p.textEffect === 'carved') {
      style.textShadow = '1px 1px 2px rgba(255,255,255,0.7), -1px -1px 1px rgba(0,0,0,0.45)'
    } else if (p.textEffect === 'neon') {
      const c = p.fill || '#0ff'
      style.textShadow = `0 0 4px ${c}, 0 0 10px ${c}, 0 0 22px ${c}, 0 0 40px ${c}`
    } else if (p.textEffect === '3d') {
      style.textShadow = '1px 1px 0 #999, 2px 2px 0 #888, 3px 3px 0 #777, 4px 4px 0 #666'
    } else if (p.textEffect === 'gold') {
      style.background = 'linear-gradient(180deg, #f5d060, #c9860a, #f5d060)'
      style.WebkitBackgroundClip = 'text'
      style.WebkitTextFillColor = 'transparent'
      style.textShadow = '1px 2px 4px rgba(0,0,0,0.3)'
    } else if (p.shadow) {
      const oX   = p.shadow.offsetX ?? 0
      const oY   = p.shadow.offsetY ?? 0
      const blur = p.shadow.blur    ?? 0
      const color = p.shadow.color  || 'rgba(0,0,0,0.4)'
      // Only apply shadow if at least one value is non-zero
      if (oX !== 0 || oY !== 0 || blur !== 0) {
        style.textShadow = `${oX}px ${oY}px ${blur}px ${color}`
      }
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

  const getElementWrapStyle = (el: CanvasElement): React.CSSProperties => {
    const flipX = el.properties.flipX ? -1 : 1
    const flipY = el.properties.flipY ? -1 : 1
    const flipStr = (flipX !== 1 || flipY !== 1) ? ` scale(${flipX},${flipY})` : ''
    return ({
    position: 'absolute',
    left: el.x,
    top: el.y,
    width: el.width,
    height: el.height,
    transform: `rotate(${el.rotation || 0}deg)${flipStr}`,
    transformOrigin: 'center center',
    opacity: (el.opacity ?? 100) / 100,
    zIndex: el.zIndex || 1,
    cursor: el.locked ? 'not-allowed' : 'move',
    visibility: el.visible === false ? 'hidden' : 'visible',
    mixBlendMode: (el.properties.blendMode as any) || 'normal',
    userSelect: 'none',
    outline: selectedId === el.id ? '2px solid var(--brand)' : 'none',
    boxShadow: selectedId === el.id ? '0 0 0 1px rgba(41,128,185,0.3)' : undefined,
    touchAction: 'none', // prevent scroll during drag on mobile
  })}

  // ─── MOUSE DRAG / RESIZE / ROTATE ────────────────────────
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
    const startElX = el.x, startElY = el.y
    const startW = el.width, startH = el.height

    const onMove = (ev: MouseEvent) => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      if (type === 'drag') {
        const nx = startElX + dx, ny = startElY + dy
        onUpdate(el.id, { x: nx, y: ny })
        setAlignLines(computeAlignLines(elementsRef.current, el.id, nx, ny, el.width, el.height))
      } else if (type === 'resize') {
        if (handle === 'se') onUpdate(el.id, { width: Math.max(20, startW + dx), height: Math.max(20, startH + dy) })
        else if (handle === 'sw') onUpdate(el.id, { x: startElX + dx, width: Math.max(20, startW - dx), height: Math.max(20, startH + dy) })
        else if (handle === 'ne') onUpdate(el.id, { y: startElY + dy, width: Math.max(20, startW + dx), height: Math.max(20, startH - dy) })
        else if (handle === 'nw') onUpdate(el.id, { x: startElX + dx, y: startElY + dy, width: Math.max(20, startW - dx), height: Math.max(20, startH - dy) })
        else if (handle === 'n') onUpdate(el.id, { y: startElY + dy, height: Math.max(20, startH - dy) })
        else if (handle === 's') onUpdate(el.id, { height: Math.max(20, startH + dy) })
        else if (handle === 'e') onUpdate(el.id, { width: Math.max(20, startW + dx) })
        else if (handle === 'w') onUpdate(el.id, { x: startElX + dx, width: Math.max(20, startW - dx) })
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
      setAlignLines({ x: [], y: [] })
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [scale, onUpdate, onCommit, onSelect])

  // ─── TOUCH DRAG (mobile) ──────────────────────────────────
  const handleTouchStart = useCallback((e: React.TouchEvent, el: CanvasElement) => {
    if (el.locked || editingId === el.id) return
    e.stopPropagation()

    // Capture selection state BEFORE this tap changes it
    const wasAlreadySelected = selectedId === el.id
    onSelect(el.id)

    const touch = e.touches[0]
    const startX = touch.clientX
    const startY = touch.clientY
    const startElX = el.x
    const startElY = el.y
    let moved = false

    const onTouchMove = (ev: TouchEvent) => {
      const t = ev.touches[0]
      const dx = (t.clientX - startX) / scale
      const dy = (t.clientY - startY) / scale
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        moved = true
        ev.preventDefault()
        const nx = startElX + dx, ny = startElY + dy
        onUpdate(el.id, { x: nx, y: ny })
        setAlignLines(computeAlignLines(elementsRef.current, el.id, nx, ny, el.width, el.height))
      }
    }

    const onTouchEnd = (ev: TouchEvent) => {
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
      setAlignLines({ x: [], y: [] })

      if (moved) {
        onCommit()
      } else if (el.type === 'text' && wasAlreadySelected) {
        // Second tap on an already-selected text element → open keyboard
        ev.preventDefault()
        setEditingId(el.id)
      }
      // First tap on an unselected element just selects it (no editor)
    }

    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
  }, [scale, onUpdate, onCommit, onSelect, editingId, selectedId])

  // ─── TOUCH RESIZE (mobile handles) ───────────────────────
  const handleResizeTouchStart = useCallback((e: React.TouchEvent, el: CanvasElement, handle: string) => {
    if (el.locked) return
    e.stopPropagation()
    e.preventDefault()

    const touch = e.touches[0]
    const startX = touch.clientX
    const startY = touch.clientY
    const startElX = el.x, startElY = el.y
    const startW = el.width, startH = el.height

    const onMove = (ev: TouchEvent) => {
      ev.preventDefault()
      const t = ev.touches[0]
      const dx = (t.clientX - startX) / scale
      const dy = (t.clientY - startY) / scale
      if (handle === 'se') onUpdate(el.id, { width: Math.max(20, startW + dx), height: Math.max(20, startH + dy) })
      else if (handle === 'sw') onUpdate(el.id, { x: startElX + dx, width: Math.max(20, startW - dx), height: Math.max(20, startH + dy) })
      else if (handle === 'ne') onUpdate(el.id, { y: startElY + dy, width: Math.max(20, startW + dx), height: Math.max(20, startH - dy) })
      else if (handle === 'nw') onUpdate(el.id, { x: startElX + dx, y: startElY + dy, width: Math.max(20, startW - dx), height: Math.max(20, startH - dy) })
      else if (handle === 'n') onUpdate(el.id, { y: startElY + dy, height: Math.max(20, startH - dy) })
      else if (handle === 's') onUpdate(el.id, { height: Math.max(20, startH + dy) })
      else if (handle === 'e') onUpdate(el.id, { width: Math.max(20, startW + dx) })
      else if (handle === 'w') onUpdate(el.id, { x: startElX + dx, width: Math.max(20, startW - dx) })
    }
    const onEnd = () => {
      onCommit()
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
    }
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onEnd)
  }, [scale, onUpdate, onCommit])

  // ─── DOUBLE CLICK: enter text edit mode ──────────────────
  const onDoubleClick = useCallback((e: React.MouseEvent, el: CanvasElement) => {
    if (el.type !== 'text' || el.locked) return
    e.stopPropagation()
    e.preventDefault()
    setEditingId(el.id)
  }, [])

  const finishEdit = useCallback((id: string, text: string) => {
    onUpdate(id, { properties: { ...elements.find(e => e.id === id)!.properties, text } })
    onCommit()
    setEditingId(null)
  }, [elements, onUpdate, onCommit])

  // ─── RESIZE HANDLES ──────────────────────────────────────
  const handles = ['nw','n','ne','w','e','sw','s','se']
  const handlePos: Record<string, React.CSSProperties> = {
    nw: { top: -10, left: -10, cursor: 'nw-resize' },
    n:  { top: -10, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' },
    ne: { top: -10, right: -10, cursor: 'ne-resize' },
    w:  { top: '50%', left: -10, transform: 'translateY(-50%)', cursor: 'w-resize' },
    e:  { top: '50%', right: -10, transform: 'translateY(-50%)', cursor: 'e-resize' },
    sw: { bottom: -10, left: -10, cursor: 'sw-resize' },
    s:  { bottom: -10, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' },
    se: { bottom: -10, right: -10, cursor: 'se-resize' },
  }

  // ─── RENDER SHAPE ─────────────────────────────────────────
  const renderShape = (el: CanvasElement) => {
    const p = el.properties
    // Determine effective shape type
    const st = p.shapeType || (p.borderRadius === 999 ? 'circle' : 'rect')
    const clip = SHAPE_CLIPS[st]
    const bg = p.fill || '#2980b9'
    const strokeStyle = p.stroke ? `${p.stroke.width}px solid ${p.stroke.color}` : undefined

    if (st === 'heart') {
      // SVG heart since clip-path path() has limited support
      return (
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          <path d="M50,85 C50,85 10,60 10,35 A20,20,0,0,1,50,25 A20,20,0,0,1,90,35 C90,60 50,85 50,85 Z"
            fill={bg} stroke={p.stroke?.color} strokeWidth={p.stroke?.width} />
        </svg>
      )
    }

    return (
      <div style={{
        width: '100%',
        height: '100%',
        background: bg,
        borderRadius: st === 'circle' ? '50%' : (st === 'rect' ? (p.borderRadius || 0) : 0),
        clipPath: clip,
        border: (!clip && st !== 'circle') ? strokeStyle : undefined,
        boxSizing: 'border-box',
      }} />
    )
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
        onTouchStart={e => { if (!isEditing) handleTouchStart(e, el) }}
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
        {el.type === 'shape' && renderShape(el)}

        {/* SELECTION HANDLES */}
        {isSelected && !el.locked && !isEditing && (
          <>
            {handles.map(h => (
              <div
                key={h}
                onMouseDown={e => onMouseDown(e, el, 'resize', h)}
                onTouchStart={e => handleResizeTouchStart(e, el, h)}
                style={{ position: 'absolute', ...handlePos[h], width: 20, height: 20, background: '#fff', border: '2px solid var(--brand)', borderRadius: 3, zIndex: 10, touchAction: 'none', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
              />
            ))}
            {/* Rotate handle */}
            <div
              onMouseDown={e => onMouseDown(e, el, 'rotate')}
              style={{ position: 'absolute', top: -36, left: '50%', transform: 'translateX(-50%)', width: 28, height: 28, background: 'var(--brand)', borderRadius: '50%', cursor: 'grab', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', boxShadow: '0 2px 6px rgba(0,0,0,0.25)' }}
            >
              <span style={{ color: '#fff', fontSize: 15 }}>↻</span>
            </div>
            <div style={{ position: 'absolute', top: -28, left: '50%', width: 2, height: 28, background: 'var(--brand)', transform: 'translateX(-50%)', zIndex: 9 }} />
          </>
        )}

        {/* Inline text editor overlay */}
        {isEditing && (
          <InlineTextEditor
            el={el}
            scale={scale}
            onDone={text => finishEdit(el.id, text)}
          />
        )}
      </div>
    )
  }

  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  const scaledW = Math.round(width  * scale)
  const scaledH = Math.round(height * scale)

  return (
    <div style={{ position: 'relative', width: scaledW, height: scaledH, overflow: 'hidden', flexShrink: 0 }}>
      {/* canvas-export-target: always full 1:1 size, used by PNG export */}
      <div
        ref={containerRef}
        className="canvas-export-target"
        style={{
          width, height, position: 'absolute', top: 0, left: 0,
          transform: `scale(${scale})`, transformOrigin: 'top left',
          cursor: 'default', overflow: 'hidden', background: '#fff',
        }}
        onClick={e => { if (e.target === e.currentTarget && !editingId) onSelect(null) }}
        onTouchEnd={e => { if (e.target === e.currentTarget && !editingId) onSelect(null) }}
      >
        {/* Background layer — isolated so opacity doesn't bleed into elements */}
        <div style={{ ...getBgLayerStyle(), position: 'absolute', inset: 0 }}
          onClick={e => { if (!editingId) { e.stopPropagation(); onSelect(null) } }}
          onTouchEnd={e => { if (!editingId) { e.stopPropagation(); onSelect(null) } }}
        />

        {sorted.map(renderElement)}

        {/* Alignment guide lines */}
        {alignLines.x.map((x, i) => (
          <div key={`ax${i}`} style={{ position: 'absolute', left: x - 1, top: 0, width: 2, height: '100%', background: '#ff2d55', opacity: 0.9, zIndex: 99999, pointerEvents: 'none', boxShadow: '0 0 3px rgba(255,45,85,0.6)' }} />
        ))}
        {alignLines.y.map((y, i) => (
          <div key={`ay${i}`} style={{ position: 'absolute', left: 0, top: y - 1, width: '100%', height: 2, background: '#ff2d55', opacity: 0.9, zIndex: 99999, pointerEvents: 'none', boxShadow: '0 0 3px rgba(255,45,85,0.6)' }} />
        ))}
      </div>
    </div>
  )
}

export default CanvasEnhanced
