import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Save, Undo, Redo, ZoomIn, ZoomOut, Download,
  Type, Image as ImageIcon, Square, Layers, Layout, Sliders, AlignCenter
} from 'lucide-react'
import { RootState } from '../store'
import {
  loadProject, addElement, updateElement, commitUpdate, deleteElement,
  selectElement, updateBackground, setCanvasSize, setZoom,
  undo, redo, bringForward, sendBackward, toggleLock, toggleVisibility, duplicateElement
} from '../store/slices/canvasSlice'
import { CanvasElement, Background } from '../types/canvas'
import CanvasEnhanced from '../components/Editor/Canvas-Enhanced'
import PropertiesPanelEnhanced from '../components/Editor/PropertiesPanel-Enhanced'
import BackgroundEditor from '../components/Editor/BackgroundEditor'
import TemplateSelector from '../components/Editor/TemplateSelector'
import LayersPanel from '../components/Editor/LayersPanel'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

type LeftTab = 'templates' | 'elements' | 'layers'
type RightTab = 'properties' | 'background'

let saveTimer: ReturnType<typeof setTimeout>

const Editor: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { token } = useSelector((s: RootState) => s.auth)
  const { elements, selectedElementId, background, width, height, zoom, historyIndex, history } = useSelector((s: RootState) => s.canvas)
  const headers = { Authorization: `Bearer ${token}` }

  const [title, setTitle] = useState('Untitled Design')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [leftTab, setLeftTab] = useState<LeftTab>('elements')
  const [rightTab, setRightTab] = useState<RightTab>('properties')
  const [imageUrl, setImageUrl] = useState('')
  const [showImageInput, setShowImageInput] = useState(false)
  const canvasWrapRef = useRef<HTMLDivElement>(null)

  const selectedElement = elements.find(e => e.id === selectedElementId) || null

  useEffect(() => {
    fetchProject()
  }, [projectId])

  // Auto-save every 30s
  useEffect(() => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (!loading) saveProject(false)
    }, 30000)
    return () => clearTimeout(saveTimer)
  }, [elements, background, title])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); dispatch(undo()) }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); dispatch(redo()) }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); saveProject(true) }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd') { e.preventDefault(); if (selectedElementId) dispatch(duplicateElement(selectedElementId)) }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedElementId) { dispatch(deleteElement(selectedElementId)); return } }
      if (e.key === 'Escape') dispatch(selectElement(null))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedElementId])

  const fetchProject = async () => {
    try {
      const res = await axios.get(`${API}/api/projects/${projectId}`, { headers })
      const p = res.data.data
      setTitle(p.title)
      let canvasData = { elements: [], background: { type: 'solid', solid: { color: '#ffffff', opacity: 100 } } as Background }
      if (p.canvas_data) {
        try { canvasData = JSON.parse(p.canvas_data) } catch {}
      }
      dispatch(loadProject({ elements: canvasData.elements || [], background: canvasData.background, width: p.width || 1920, height: p.height || 1080 }))
    } catch {
      toast.error('Failed to load project')
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  const saveProject = async (showToast = true) => {
    setSaving(true)
    try {
      await axios.put(`${API}/api/projects/${projectId}`, {
        title,
        canvas_data: JSON.stringify({ elements, background }),
      }, { headers })
      if (showToast) toast.success('Saved!')
    } catch {
      if (showToast) toast.error('Save failed')
    } finally {
      setSaving(false)
    }
  }

  const makeId = () => Date.now().toString() + Math.random().toString(36).slice(2, 6)
  const nextZ = () => Math.max(0, ...elements.map(e => e.zIndex)) + 1

  const addText = () => {
    const el: CanvasElement = {
      id: makeId(), type: 'text', x: width / 2 - 150, y: height / 2 - 30,
      width: 300, height: 60, rotation: 0, opacity: 100, zIndex: nextZ(), locked: false, visible: true,
      properties: { text: 'Double click to edit', fontSize: 32, fontFamily: 'Arial', fontWeight: '700', fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', textTransform: 'none', fill: '#1a1d2e', lineHeight: 1.2, letterSpacing: 0, textCurve: 'none' }
    }
    dispatch(addElement(el))
    setRightTab('properties')
  }

  const addShape = (type: 'rect' | 'circle') => {
    const el: CanvasElement = {
      id: makeId(), type: 'shape', x: width / 2 - 75, y: height / 2 - 75,
      width: 150, height: 150, rotation: 0, opacity: 100, zIndex: nextZ(), locked: false, visible: true,
      properties: { fill: '#1dc48d', borderRadius: type === 'circle' ? 999 : 0, blendMode: 'normal' }
    }
    dispatch(addElement(el))
    setRightTab('properties')
  }

  const addImage = () => {
    if (!imageUrl.trim()) return
    const el: CanvasElement = {
      id: makeId(), type: 'image', x: width / 2 - 200, y: height / 2 - 150,
      width: 400, height: 300, rotation: 0, opacity: 100, zIndex: nextZ(), locked: false, visible: true,
      properties: { src: imageUrl, objectFit: 'cover', brightness: 100, contrast: 100, saturation: 100, hueRotate: 0, blur: 0, grayscale: 0, sepia: 0, borderRadius: 0 }
    }
    dispatch(addElement(el))
    setImageUrl('')
    setShowImageInput(false)
    setRightTab('properties')
  }

  const handleUpdate = useCallback((id: string, updates: Partial<CanvasElement>) => {
    dispatch(updateElement({ id, updates }))
  }, [dispatch])

  const handleCommit = useCallback(() => { dispatch(commitUpdate()) }, [dispatch])

  const handleDownload = () => {
    toast('Export: Use browser print or screenshot for now. PDF export coming with html2canvas integration.', { icon: 'ℹ️' })
  }

  if (loading) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎨</div>
        Loading your design...
      </div>
    </div>
  )

  const canvasDisplayW = width * (zoom / 100)
  const canvasDisplayH = height * (zoom / 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

      {/* ─── TOP TOOLBAR ─── */}
      <header style={{ height: 56, background: '#fff', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', flexShrink: 0, zIndex: 100 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')} title="Back to Dashboard">
          <ArrowLeft size={18} />
        </button>

        <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 4px' }} />

        {/* Title */}
        <input value={title} onChange={e => setTitle(e.target.value)} onBlur={() => saveProject(false)}
          style={{ border: 'none', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--text)', background: 'transparent', outline: 'none', minWidth: 120, maxWidth: 260 }} />

        <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 4px' }} />

        {/* Undo/Redo */}
        <button className="toolbar-btn" onClick={() => dispatch(undo())} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)"><Undo size={16} /></button>
        <button className="toolbar-btn" onClick={() => dispatch(redo())} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)"><Redo size={16} /></button>

        <div style={{ width: 1, height: 28, background: 'var(--border)', margin: '0 4px' }} />

        {/* Zoom */}
        <button className="toolbar-btn" onClick={() => dispatch(setZoom(Math.max(10, zoom - 10)))} title="Zoom Out"><ZoomOut size={16} /></button>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--muted)', minWidth: 44, textAlign: 'center' }}>{zoom}%</span>
        <button className="toolbar-btn" onClick={() => dispatch(setZoom(Math.min(200, zoom + 10)))} title="Zoom In"><ZoomIn size={16} /></button>

        {/* Zoom presets */}
        <select value={zoom} onChange={e => dispatch(setZoom(+e.target.value))} style={{ fontSize: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 6px', background: '#fff', cursor: 'pointer' }}>
          {[25, 33, 50, 67, 75, 100, 125, 150, 200].map(z => <option key={z} value={z}>{z}%</option>)}
        </select>

        <div style={{ flex: 1 }} />

        {/* Canvas size display */}
        <span style={{ fontSize: '0.75rem', color: 'var(--muted)', background: 'var(--bg)', padding: '4px 8px', borderRadius: 6 }}>{width}×{height}</span>

        <button className="btn btn-ghost btn-sm" onClick={handleDownload} title="Export"><Download size={14} /> Export</button>
        <button className="btn btn-primary btn-sm" onClick={() => saveProject(true)} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ─── LEFT SIDEBAR ─── */}
        <aside style={{ width: 240, background: '#fff', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          {/* Tab Nav */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {([['elements', <AlignCenter size={14}/>, 'Add'], ['templates', <Layout size={14}/>, 'Size'], ['layers', <Layers size={14}/>, 'Layers']] as const).map(([tab, icon, label]) => (
              <button key={tab} className={`sidebar-nav-item${leftTab === tab ? ' active' : ''}`} style={{ flex: 1, padding: '10px 4px', borderRadius: 0, borderBottom: leftTab === tab ? '2px solid var(--brand)' : '2px solid transparent', fontSize: '0.625rem' }} onClick={() => setLeftTab(tab as LeftTab)}>
                {icon}{label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {leftTab === 'elements' && (
              <div style={{ padding: '12px 8px' }}>
                <div className="panel-title" style={{ padding: '0 8px', marginBottom: 8 }}>Add Elements</div>

                {/* Text */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>Text</div>
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 4 }} onClick={addText}><Type size={14} /> Add Text</button>
                </div>

                {/* Shapes */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>Shapes</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => addShape('rect')}>
                      <div style={{ width: 12, height: 12, background: 'currentColor', borderRadius: 2 }} /> Rect
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => addShape('circle')}>
                      <div style={{ width: 12, height: 12, background: 'currentColor', borderRadius: '50%' }} /> Circle
                    </button>
                  </div>
                </div>

                {/* Image */}
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>Images</div>
                  <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start', marginBottom: showImageInput ? 6 : 0 }} onClick={() => setShowImageInput(v => !v)}>
                    <ImageIcon size={14} /> Add Image URL
                  </button>
                  {showImageInput && (
                    <div style={{ padding: '0 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input className="input" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." onKeyDown={e => e.key === 'Enter' && addImage()} style={{ fontSize: '0.8125rem' }} />
                      <button className="btn btn-primary btn-sm" onClick={addImage} disabled={!imageUrl.trim()}>Add to Canvas</button>
                    </div>
                  )}
                </div>

                {/* Quick stock image tiles */}
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', padding: '0 8px', marginBottom: 6 }}>Quick Add (Unsplash)</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                    {[
                      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&q=60',
                      'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&q=60',
                      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=300&q=60',
                      'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=300&q=60',
                      'https://images.unsplash.com/photo-1518791841217-8f162f1912da?w=300&q=60',
                      'https://images.unsplash.com/photo-1478827536114-da961b7f86d2?w=300&q=60',
                    ].map((src, i) => (
                      <img key={i} src={src} alt="" style={{ width: '100%', height: 56, objectFit: 'cover', borderRadius: 6, cursor: 'pointer', border: '1.5px solid transparent', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--brand)'}
                        onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
                        onClick={() => {
                          const el: CanvasElement = { id: makeId(), type: 'image', x: width/2-200, y: height/2-150, width: 400, height: 300, rotation: 0, opacity: 100, zIndex: nextZ(), locked: false, visible: true, properties: { src, objectFit: 'cover', brightness: 100, contrast: 100, saturation: 100, hueRotate: 0, blur: 0, grayscale: 0, sepia: 0, borderRadius: 0 } }
                          dispatch(addElement(el))
                          setRightTab('properties')
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {leftTab === 'templates' && (
              <TemplateSelector
                currentW={width} currentH={height}
                onSelectTemplate={(w, h, name) => {
                  dispatch(setCanvasSize({ width: w, height: h }))
                  toast.success(`Canvas: ${name} (${w}×${h})`)
                }}
              />
            )}

            {leftTab === 'layers' && (
              <LayersPanel
                elements={elements} selectedId={selectedElementId}
                onSelect={id => { dispatch(selectElement(id)); setRightTab('properties') }}
                onToggleVisibility={id => dispatch(toggleVisibility(id))}
                onToggleLock={id => dispatch(toggleLock(id))}
              />
            )}
          </div>
        </aside>

        {/* ─── CANVAS AREA ─── */}
        <main style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 32px', background: '#e8eaf0' }} ref={canvasWrapRef}>
          <div style={{ position: 'relative' }}>
            {/* Canvas shadow */}
            <div style={{ boxShadow: '0 4px 40px rgba(0,0,0,0.25)', borderRadius: 2 }}>
              <CanvasEnhanced
                elements={elements}
                selectedId={selectedElementId}
                onSelect={id => { dispatch(selectElement(id)); if (id) setRightTab('properties') }}
                onUpdate={handleUpdate}
                onCommit={handleCommit}
                width={width}
                height={height}
                zoom={zoom}
                background={background}
              />
            </div>
            {/* Canvas size label */}
            <div style={{ position: 'absolute', bottom: -28, left: '50%', transform: 'translateX(-50%)', fontSize: '0.75rem', color: '#8899aa', whiteSpace: 'nowrap' }}>
              {width} × {height} px
            </div>
          </div>
        </main>

        {/* ─── RIGHT PANEL ─── */}
        <aside style={{ width: 256, background: '#fff', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, overflow: 'hidden' }}>
          {/* Tab Nav */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
            {([['properties', <Sliders size={14}/>, 'Properties'], ['background', <Layout size={14}/>, 'Background']] as const).map(([tab, icon, label]) => (
              <button key={tab} className={`sidebar-nav-item${rightTab === tab ? ' active' : ''}`} style={{ flex: 1, padding: '10px 4px', borderRadius: 0, borderBottom: rightTab === tab ? '2px solid var(--brand)' : '2px solid transparent', fontSize: '0.625rem' }} onClick={() => setRightTab(tab as RightTab)}>
                {icon}{label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {rightTab === 'background' && (
              <BackgroundEditor background={background} onUpdate={bg => dispatch(updateBackground(bg))} />
            )}

            {rightTab === 'properties' && (
              selectedElement ? (
                <PropertiesPanelEnhanced
                  element={selectedElement}
                  onUpdate={updates => {
                    dispatch(updateElement({ id: selectedElement.id, updates }))
                    // Debounce commit for slider-type updates
                    clearTimeout((window as any).__commitTimer)
                    ;(window as any).__commitTimer = setTimeout(() => dispatch(commitUpdate()), 600)
                  }}
                  onDelete={() => dispatch(deleteElement(selectedElement.id))}
                  onDuplicate={() => dispatch(duplicateElement(selectedElement.id))}
                  onLock={() => dispatch(toggleLock(selectedElement.id))}
                  onToggleVisibility={() => dispatch(toggleVisibility(selectedElement.id))}
                  onBringForward={() => dispatch(bringForward(selectedElement.id))}
                  onSendBackward={() => dispatch(sendBackward(selectedElement.id))}
                />
              ) : (
                <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--muted)' }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>👆</div>
                  <p style={{ fontSize: '0.875rem', lineHeight: 1.5 }}>Select an element on the canvas to edit its properties</p>
                  <p style={{ fontSize: '0.75rem', marginTop: '1rem', color: '#aaa' }}>Or switch to Background tab to edit the canvas background</p>
                </div>
              )
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

export default Editor
