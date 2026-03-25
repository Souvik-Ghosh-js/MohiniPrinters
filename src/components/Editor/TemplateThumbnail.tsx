import React, { useMemo } from 'react'
import { CanvasElement, Background } from '../../types/canvas'

interface Props {
  jsonData: any
  width?: number   // thumbnail container width  (px)
  height?: number  // thumbnail container height (px)
}

// ─── SHAPE CLIPS (same as Canvas-Enhanced) ──────────────────
const SHAPE_CLIPS: Record<string, string> = {
  triangle:     'polygon(50% 0%, 0% 100%, 100% 100%)',
  diamond:      'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)',
  star:         'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)',
  pentagon:     'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
  hexagon:      'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)',
  arrow_right:  'polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)',
  cross:        'polygon(10% 40%, 40% 40%, 40% 10%, 60% 10%, 60% 40%, 90% 40%, 90% 60%, 60% 60%, 60% 90%, 40% 90%, 40% 60%, 10% 60%)',
  parallelogram:'polygon(25% 0%, 100% 0%, 75% 100%, 0% 100%)',
  trapezoid:    'polygon(20% 0%, 80% 0%, 100% 100%, 0% 100%)',
}

// ─── PARSE JSON → { elements, background, cw, ch } ──────────
function parseTemplateJson(jd: any): { elements: CanvasElement[]; background: Background; cw: number; ch: number } {
  const fallback = { elements: [], background: { type: 'solid' as const, solid: { color: '#ffffff', opacity: 100 } }, cw: 794, ch: 1123 }
  if (!jd) return fallback

  // ── Our native format ──
  if (Array.isArray(jd.elements)) {
    return {
      elements: jd.elements,
      background: jd.background || fallback.background,
      cw: jd.width || fallback.cw,
      ch: jd.height || fallback.ch,
    }
  }

  // ── Fabric.js format ──
  const pageJson: any = jd.pages?.[0]?.json || jd.canvasData || (jd.objects !== undefined ? jd : null)
  if (!pageJson) return fallback

  const cw = pageJson.width  || fallback.cw
  const ch = pageJson.height || fallback.ch

  // Background
  let background: Background = { type: 'solid', solid: { color: '#ffffff', opacity: 100 } }
  if (pageJson.background && typeof pageJson.background === 'string' && pageJson.background !== 'rgba(0,0,0,0)') {
    background = { type: 'solid', solid: { color: pageJson.background, opacity: 100 } }
  }
  if (pageJson.backgroundImage) {
    const bi = pageJson.backgroundImage
    const src = typeof bi === 'string' ? bi : bi.src
    if (src) background = { type: 'image', image: { src, opacity: 100, blur: 0, scale: 1 } }
  }

  // Elements
  const objects: any[] = pageJson.objects || []
  const elements: CanvasElement[] = objects.map((obj, i) => {
    const x = obj.left || 0
    const y = obj.top  || 0
    const w = (obj.width  || 100) * (obj.scaleX || 1)
    const h = (obj.height || 100) * (obj.scaleY || 1)
    const id = `thumb_${i}`

    if (obj.type === 'Image') {
      return { id, type: 'image' as const, x, y, width: w, height: h, rotation: obj.angle || 0, opacity: (obj.opacity ?? 1) * 100, zIndex: i + 1, locked: false, visible: true, properties: { src: obj.src || '', objectFit: 'contain', brightness: 100, contrast: 100, saturation: 100, hueRotate: 0, blur: 0, grayscale: 0, sepia: 0, borderRadius: 0 } }
    }
    if (obj.type === 'Textbox' || obj.type === 'Text' || obj.type === 'IText') {
      return { id, type: 'text' as const, x, y, width: Math.max(w, 50), height: Math.max(h, 20), rotation: obj.angle || 0, opacity: (obj.opacity ?? 1) * 100, zIndex: i + 1, locked: false, visible: true, properties: { text: obj.text || '', fontSize: obj.fontSize || 18, fontFamily: obj.fontFamily || 'Arial', fontWeight: String(obj.fontWeight || '400'), fontStyle: obj.fontStyle || 'normal', textDecoration: 'none', textAlign: obj.textAlign || 'left', fill: typeof obj.fill === 'string' ? obj.fill : '#000', lineHeight: obj.lineHeight || 1.16, letterSpacing: 0, textTransform: 'none' } }
    }
    if (obj.type === 'Rect' || obj.type === 'Circle' || obj.type === 'Polygon') {
      return { id, type: 'shape' as const, x, y, width: w, height: h, rotation: obj.angle || 0, opacity: (obj.opacity ?? 1) * 100, zIndex: i + 1, locked: false, visible: true, properties: { fill: typeof obj.fill === 'string' ? obj.fill : '#ccc', borderRadius: obj.type === 'Circle' ? 999 : (obj.rx || 0), shapeType: obj.type === 'Circle' ? 'circle' : 'rect' } }
    }
    return null
  }).filter(Boolean) as CanvasElement[]

  return { elements, background, cw, ch }
}

// ─── BACKGROUND STYLE ───────────────────────────────────────
function getBgStyle(bg: Background, opacity = 1): React.CSSProperties {
  if (bg.type === 'solid') {
    return { background: bg.solid?.color || '#fff', opacity: (bg.solid?.opacity ?? 100) / 100 * opacity, position: 'absolute', inset: 0 }
  }
  if (bg.type === 'gradient' && bg.gradient) {
    const cols = bg.gradient.colors?.join(', ') || '#ccc, #fff'
    return { background: `linear-gradient(${bg.gradient.angle ?? 135}deg, ${cols})`, opacity: (bg.gradient.opacity ?? 100) / 100 * opacity, position: 'absolute', inset: 0 }
  }
  if (bg.type === 'image' && bg.image?.src) {
    return { backgroundImage: `url(${bg.image.src})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: (bg.image.opacity ?? 100) / 100 * opacity, position: 'absolute', inset: 0 }
  }
  return { background: '#fff', position: 'absolute', inset: 0 }
}

// ─── ELEMENT RENDERER (no interaction) ──────────────────────
const ThumbnailElement: React.FC<{ el: CanvasElement }> = ({ el }) => {
  const p = el.properties
  if (el.visible === false) return null

  const wrapStyle: React.CSSProperties = {
    position: 'absolute',
    left: el.x, top: el.y,
    width: el.width, height: el.height,
    transform: `rotate(${el.rotation || 0}deg)`,
    transformOrigin: 'center center',
    opacity: (el.opacity ?? 100) / 100,
    zIndex: el.zIndex || 1,
    overflow: 'hidden',
    pointerEvents: 'none',
  }

  if (el.type === 'image') {
    return (
      <div style={wrapStyle}>
        <img src={p.src} alt="" crossOrigin="anonymous"
          style={{ width: '100%', height: '100%', objectFit: (p.objectFit as any) || 'cover', display: 'block' }}
          draggable={false}
        />
      </div>
    )
  }

  if (el.type === 'text') {
    return (
      <div style={{ ...wrapStyle, overflow: 'hidden' }}>
        <div style={{
          fontSize: `${p.fontSize || 24}px`,
          fontFamily: p.fontFamily || 'Arial',
          color: p.fill || '#000',
          fontWeight: p.fontWeight || '400',
          fontStyle: p.fontStyle || 'normal',
          textAlign: (p.textAlign as any) || 'center',
          lineHeight: p.lineHeight ? `${p.lineHeight}` : '1.4',
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '2px 4px',
          wordBreak: 'break-word', whiteSpace: 'pre-wrap', overflow: 'hidden', boxSizing: 'border-box',
        }}>{p.text || ''}</div>
      </div>
    )
  }

  if (el.type === 'shape') {
    const st = p.shapeType || (p.borderRadius === 999 ? 'circle' : 'rect')
    const clip = SHAPE_CLIPS[st]
    const bg = p.fill || '#2980b9'
    const strokeWidth = p.stroke?.width || 0
    const strokeColor = p.stroke?.color || '#000000'

    if (st === 'heart') {
      return (
        <div style={wrapStyle}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <path d="M50,85 C50,85 10,60 10,35 A20,20,0,0,1,50,25 A20,20,0,0,1,90,35 C90,60 50,85 50,85 Z"
              fill={bg} stroke={strokeWidth > 0 ? strokeColor : undefined} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
          </svg>
        </div>
      )
    }

    if (clip) {
      const matches = clip.match(/polygon\((.*)\)/)
      if (matches) {
        const points = matches[1].replace(/%/g, '')
        return (
          <div style={wrapStyle}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <polygon points={points} fill={bg === 'transparent' ? 'none' : bg} stroke={strokeWidth > 0 ? strokeColor : undefined} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        )
      }
    }

    return (
      <div style={wrapStyle}>
        <div style={{
          width: '100%',
          height: '100%',
          background: bg === 'transparent' ? 'transparent' : bg,
          borderRadius: st === 'circle' ? '50%' : (p.borderRadius || 0),
          border: strokeWidth > 0 ? `${strokeWidth}px solid ${strokeColor}` : 'none',
          boxSizing: 'border-box',
        }} />
      </div>
    )
  }

  return null
}

// ─── MAIN COMPONENT ─────────────────────────────────────────
const TemplateThumbnail: React.FC<Props> = ({ jsonData, width = 160, height = 100 }) => {
  const { elements, background, cw, ch } = useMemo(() => parseTemplateJson(jsonData), [jsonData])

  // If the JSON has a _preview snapshot, show that directly (pixel-perfect)
  if (jsonData?._preview) {
    return (
      <div style={{ width, height, overflow: 'hidden', position: 'relative', flexShrink: 0, background: '#f8fafc' }}>
        <img src={jsonData._preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
      </div>
    )
  }

  // Scale to contain: show the entire design (no cropping)
  const scale = Math.min(width / cw, height / ch)
  // Center the scaled canvas so we show the middle, not the top-left corner
  const offsetX = (width  - cw * scale) / 2
  const offsetY = (height - ch * scale) / 2

  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  return (
    <div style={{ width, height, overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
      {/* Canvas rendered at full native size, CSS-scaled and centered */}
      <div style={{ width: cw, height: ch, position: 'absolute', top: 0, left: 0, transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`, transformOrigin: 'top left' }}>
        {/* Background */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <div style={getBgStyle(background)} />
        </div>
        {/* Elements */}
        {sorted.map(el => <ThumbnailElement key={el.id} el={el} />)}
      </div>
    </div>
  )
}

export default TemplateThumbnail
