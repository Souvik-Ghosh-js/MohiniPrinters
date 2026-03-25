import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import axios from 'axios'
import toast from 'react-hot-toast'
import {
  ArrowLeft, Save, Undo, Redo, ZoomIn, ZoomOut, Download,
  Type, Image as ImageIcon, Layers, Layout, Sliders,
  AlignCenter, Upload, FileJson, RefreshCw, Filter, Maximize2
} from 'lucide-react'
import { RootState } from '../store'
import {
  loadProject, addElement, updateElement, commitUpdate, deleteElement,
  selectElement, updateBackground, setCanvasSize, setZoom,
  undo, redo, bringForward, sendBackward, toggleLock, toggleVisibility, duplicateElement
} from '../store/slices/canvasSlice'
import { CanvasElement, Background, A4_WIDTH, A4_HEIGHT } from '../types/canvas'
import CanvasEnhanced from '../components/Editor/Canvas-Enhanced'
import PropertiesPanelEnhanced from '../components/Editor/PropertiesPanel-Enhanced'
import BackgroundEditor from '../components/Editor/BackgroundEditor'
import TemplateSelector from '../components/Editor/TemplateSelector'
import LayersPanel from '../components/Editor/LayersPanel'
import { useAssets } from '../hooks/useAssets'
import { AssetFile, fixProtocol } from '../utils/assetApi'
import TemplateThumbnail from '../components/Editor/TemplateThumbnail'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

type LeftTab = 'templates' | 'assets' | 'add' | 'layers' | 'size'
type RightTab = 'properties' | 'background'
type AssetSubTab = 'logos' | 'backgrounds' | 'elements' | 'schools'

let saveTimer: ReturnType<typeof setTimeout>

// ─── THUMBNAIL GENERATOR (Canvas 2D, no DOM manipulation) ─────
const THUMB_POLYS: Record<string, [number,number][]> = {
  triangle:     [[50,0],[0,100],[100,100]],
  diamond:      [[50,0],[100,50],[50,100],[0,50]],
  star:         [[50,0],[61,35],[98,35],[68,57],[79,91],[50,70],[21,91],[32,57],[2,35],[39,35]],
  pentagon:     [[50,0],[100,38],[82,100],[18,100],[0,38]],
  hexagon:      [[25,0],[75,0],[100,50],[75,100],[25,100],[0,50]],
  arrow_right:  [[0,20],[60,20],[60,0],[100,50],[60,100],[60,80],[0,80]],
  arrow_up:     [[50,0],[100,60],[80,60],[80,100],[20,100],[20,60],[0,60]],
  cross:        [[10,40],[40,40],[40,10],[60,10],[60,40],[90,40],[90,60],[60,60],[60,90],[40,90],[40,60],[10,60]],
  parallelogram:[[25,0],[100,0],[75,100],[0,100]],
  trapezoid:    [[20,0],[80,0],[100,100],[0,100]],
}

const generateThumbnailBlob = async (
  elements: CanvasElement[], background: Background, cw: number, ch: number
): Promise<Blob | null> => {
  const THUMB_W = 600
  const scale = THUMB_W / cw
  const THUMB_H = Math.round(ch * scale)
  const cvs = document.createElement('canvas')
  cvs.width = THUMB_W; cvs.height = THUMB_H
  const ctx = cvs.getContext('2d')
  if (!ctx) return null

  // Draw background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, THUMB_W, THUMB_H)
  if (background.type === 'solid' && background.solid) {
    ctx.save()
    ctx.globalAlpha = (background.solid.opacity ?? 100) / 100
    ctx.fillStyle = background.solid.color || '#fff'
    ctx.fillRect(0, 0, THUMB_W, THUMB_H)
    ctx.restore()
  } else if (background.type === 'gradient' && background.gradient) {
    const g = background.gradient
    const angle = ((g.angle ?? 135) * Math.PI) / 180
    const x1 = THUMB_W/2 - Math.cos(angle)*THUMB_W/2, y1 = THUMB_H/2 - Math.sin(angle)*THUMB_H/2
    const x2 = THUMB_W/2 + Math.cos(angle)*THUMB_W/2, y2 = THUMB_H/2 + Math.sin(angle)*THUMB_H/2
    const grad = ctx.createLinearGradient(x1,y1,x2,y2)
    const colors = g.colors || ['#ccc','#888']
    colors.forEach((c,i) => grad.addColorStop(i/(colors.length-1||1), c))
    ctx.save(); ctx.globalAlpha = (g.opacity??100)/100; ctx.fillStyle = grad; ctx.fillRect(0,0,THUMB_W,THUMB_H); ctx.restore()
  } else if (background.type === 'image' && background.image?.src) {
    await new Promise<void>(res => {
      const img = new Image()
      img.onload = () => { ctx.drawImage(img,0,0,THUMB_W,THUMB_H); res() }
      img.onerror = () => res()
      img.src = background.image!.src
    })
  }

  // Draw elements
  const sorted = [...elements].filter(e => e.visible !== false).sort((a,b)=>(a.zIndex||0)-(b.zIndex||0))
  for (const el of sorted) {
    ctx.save()
    ctx.globalAlpha = (el.opacity??100)/100
    const x=el.x*scale, y=el.y*scale, w=el.width*scale, h=el.height*scale
    if (el.rotation) {
      ctx.translate(x+w/2, y+h/2)
      ctx.rotate((el.rotation*Math.PI)/180)
      ctx.translate(-(x+w/2), -(y+h/2))
    }
    const p = el.properties

    if (el.type === 'image' && p.src) {
      await new Promise<void>(res => {
        const img = new Image()
        img.onload = () => {
          ctx.save()
          if (p.borderRadius) {
            ctx.beginPath(); ctx.roundRect(x,y,w,h,p.borderRadius*scale); ctx.clip()
          }
          ctx.drawImage(img,x,y,w,h); ctx.restore(); res()
        }
        img.onerror = () => res()
        img.src = p.src || ''
      })
    } else if (el.type === 'text') {
      const fs = (p.fontSize||24)*scale
      ctx.font = `${p.fontStyle||'normal'} ${p.fontWeight||'400'} ${fs}px ${p.fontFamily||'Arial'}`
      ctx.fillStyle = p.fill || '#000000'
      ctx.textBaseline = 'middle'
      ctx.textAlign = (p.textAlign as CanvasTextAlign)||'left'
      const tx = p.textAlign==='center' ? x+w/2 : p.textAlign==='right' ? x+w : x
      const lines = (p.text||'').split('\n')
      const lh = fs*(p.lineHeight||1.4)
      lines.forEach((line,i) => ctx.fillText(line, tx, y+h/2+(i-(lines.length-1)/2)*lh, w))
    } else if (el.type === 'shape') {
      const st = p.shapeType||(p.borderRadius===999?'circle':'rect')
      ctx.fillStyle = p.fill||'#2980b9'
      ctx.beginPath()
      if (st==='circle') {
        ctx.ellipse(x+w/2, y+h/2, w/2, h/2, 0, 0, Math.PI*2)
      } else if (st==='rect') {
        const r = Math.min((p.borderRadius||0)*scale, w/2, h/2)
        ctx.roundRect(x,y,w,h,r)
      } else if (st==='heart') {
        ctx.moveTo(x+w/2,y+h*0.85)
        ctx.bezierCurveTo(x+w*0.1,y+h*0.6,x,y+h*0.35,x+w/2,y+h*0.25)
        ctx.bezierCurveTo(x+w,y+h*0.35,x+w*0.9,y+h*0.6,x+w/2,y+h*0.85)
      } else {
        const poly = THUMB_POLYS[st]
        if (poly) {
          poly.forEach(([px,py],i) => {
            const vx=x+w*px/100, vy=y+h*py/100
            i===0 ? ctx.moveTo(vx,vy) : ctx.lineTo(vx,vy)
          })
          ctx.closePath()
        } else {
          ctx.rect(x,y,w,h)
        }
      }
      ctx.fill()
      if (p.stroke?.width && p.stroke?.color) {
        ctx.strokeStyle=p.stroke.color; ctx.lineWidth=p.stroke.width*scale; ctx.stroke()
      }
    }
    ctx.restore()
  }

  return new Promise(res => {
    try { cvs.toBlob(b => res(b), 'image/jpeg', 0.88) }
    catch { res(null) }
  })
}

// ─── FABRIC JSON → OUR ELEMENT FORMAT ────────────────────────
const fabricObjectToElement = (obj: any, idx: number): CanvasElement | null => {
  const makeId = () => `fabric_${Date.now()}_${idx}_${Math.random().toString(36).slice(2,6)}`
  const z = idx + 1

  const x = obj.left || 0
  const y = obj.top  || 0
  const w = (obj.width  || 100) * (obj.scaleX || 1)
  const h = (obj.height || 100) * (obj.scaleY || 1)

  if (obj.type === 'Image') {
    return {
      id: makeId(), type: 'image',
      x, y, width: w, height: h,
      rotation: obj.angle || 0, opacity: (obj.opacity ?? 1) * 100,
      zIndex: z, locked: false, visible: obj.visible !== false,
      properties: {
        src: obj.src || '',
        objectFit: 'contain',
        brightness: 100, contrast: 100, saturation: 100,
        hueRotate: 0, blur: 0, grayscale: 0, sepia: 0, borderRadius: 0
      }
    }
  }

  if (obj.type === 'Textbox' || obj.type === 'Text' || obj.type === 'IText') {
    return {
      id: makeId(), type: 'text',
      x, y, width: Math.max(w, 100), height: Math.max(h, 30),
      rotation: obj.angle || 0, opacity: (obj.opacity ?? 1) * 100,
      zIndex: z, locked: false, visible: obj.visible !== false,
      properties: {
        text: obj.text || '',
        fontSize: obj.fontSize || 18,
        fontFamily: obj.fontFamily || 'Arial',
        fontWeight: String(obj.fontWeight || '400'),
        fontStyle: obj.fontStyle || 'normal',
        textDecoration: obj.underline ? 'underline' : 'none',
        textAlign: (obj.textAlign as any) || 'center',
        fill: typeof obj.fill === 'string' ? obj.fill : '#000000',
        lineHeight: obj.lineHeight || 1.16,
        letterSpacing: obj.charSpacing ? obj.charSpacing / 1000 : 0,
        textTransform: 'none',
        textCurve: 'none',
      }
    }
  }

  if (obj.type === 'Rect' || obj.type === 'Circle' || obj.type === 'Polygon') {
    return {
      id: makeId(), type: 'shape',
      x, y, width: w, height: h,
      rotation: obj.angle || 0, opacity: (obj.opacity ?? 1) * 100,
      zIndex: z, locked: false, visible: obj.visible !== false,
      properties: {
        fill: typeof obj.fill === 'string' ? obj.fill : '#cccccc',
        borderRadius: obj.type === 'Circle' ? 999 : (obj.rx || 0),
        blendMode: obj.globalCompositeOperation || 'normal',
      }
    }
  }

  return null
}

const applyFabricTemplate = (
  jsonData: any,
  dispatch: any,
  toast: any,
) => {
  try {
    if (jsonData._format === 'mohini-design-hub' || Array.isArray(jsonData.elements)) {
      dispatch(loadProject({
        elements: jsonData.elements || [],
        background: jsonData.background || { type: 'solid', solid: { color: '#ffffff', opacity: 100 } },
        width: jsonData.width || A4_WIDTH,
        height: jsonData.height || A4_HEIGHT,
      }))
      toast.success(`Template applied — ${(jsonData.elements || []).length} elements loaded`)
      return true
    }

    let pageJson: any = null
    if (jsonData.pages && Array.isArray(jsonData.pages) && jsonData.pages.length > 0) {
      pageJson = jsonData.pages[0].json
    } else if (jsonData.canvasData) {
      pageJson = jsonData.canvasData
    } else if (jsonData.objects !== undefined || jsonData.backgroundImage !== undefined) {
      pageJson = jsonData
    }

    if (!pageJson) { toast.error('Unrecognised template structure'); return false }

    const tplW = pageJson.width  || A4_WIDTH
    const tplH = pageJson.height || A4_HEIGHT
    dispatch(setCanvasSize({ width: tplW, height: tplH }))

    if (pageJson.background && typeof pageJson.background === 'string' && pageJson.background !== 'rgba(0,0,0,0)') {
      dispatch(updateBackground({ type: 'solid', solid: { color: pageJson.background, opacity: 100 } }))
    }

    if (pageJson.backgroundImage) {
      const bi = pageJson.backgroundImage
      const src = typeof bi === 'string' ? bi : bi.src
      if (src) {
        dispatch(updateBackground({ type: 'image', image: { src, opacity: 100, blur: 0, scale: 1 } }))
      }
    }

    const objects: any[] = pageJson.objects || []
    const elements: CanvasElement[] = objects
      .map((obj, i) => fabricObjectToElement(obj, i))
      .filter(Boolean) as CanvasElement[]

    dispatch(loadProject({
      elements,
      background: { type: 'solid', solid: { color: pageJson.background || '#ffffff', opacity: 100 } },
      width: tplW,
      height: tplH,
    }))

    if (pageJson.backgroundImage) {
      const bi = pageJson.backgroundImage
      const src = typeof bi === 'string' ? bi : bi.src
      if (src) {
        setTimeout(() => {
          dispatch(updateBackground({ type: 'image', image: { src, opacity: 100, blur: 0, scale: 1 } }))
        }, 0)
      }
    }

    toast.success(`Template applied — ${elements.length} elements loaded`)
    return true
  } catch (e: any) {
    console.error('applyFabricTemplate error:', e)
    toast.error('Failed to apply template: ' + e.message)
    return false
  }
}

// ─── SERVER TEMPLATE PANEL ────────────────────────────────────
const ServerTemplatePanel: React.FC<{
  onApply: (f: AssetFile) => void
  onSizeChange: (w: number, h: number, name: string) => void
  currentW: number
  currentH: number
}> = ({ onApply, onSizeChange, currentW, currentH }) => {
  const { files, loading, load } = useAssets('templates')
  const [filter, setFilter] = useState('All')
  const cats = ['All', ...Array.from(new Set(files.map(f => f.category || 'Other').filter(Boolean)))]
  const visible = filter === 'All' ? files : files.filter(f => f.category === filter)

  return (
    <div style={{ padding: '0 0 1rem' }}>
      <div style={{ margin: '4px 0 8px', padding: '10px 16px 0' }}>
        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)', marginBottom: 6 }}>
          Server Templates
          <button onClick={load} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><RefreshCw size={11}/></button>
        </div>

        {cats.length > 1 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
            {cats.map(c => (
              <button key={c} onClick={() => setFilter(c)}
                style={{ padding: '2px 8px', borderRadius: 10, border: '1px solid var(--border)', background: filter===c?'var(--brand)':'transparent', color: filter===c?'#fff':'var(--muted)', fontSize: '0.6rem', cursor: 'pointer', fontWeight: 600 }}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem', padding: '1rem' }}>Loading…</p>}

      {!loading && visible.length === 0 && (
        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem', padding: '1rem' }}>
          No templates yet — upload via Admin panel
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '0 8px' }}>
        {visible.map(f => (
          <div key={f.name} onClick={() => onApply(f)}
            style={{ borderRadius: 8, border: '1.5px solid var(--border)', overflow: 'hidden', cursor: 'pointer', background: '#fff', transition: 'all .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='var(--brand)'; e.currentTarget.style.transform='translateY(-1px)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='' }}>
            {f.jsonData
              ? <TemplateThumbnail jsonData={f.jsonData} width={120} height={80} />
              : f.previewUrl
                ? <div style={{ height:80, overflow:'hidden' }}><img src={f.previewUrl} alt={f.displayName} style={{ width:'100%', height:'100%', objectFit:'cover' }} /></div>
                : <div style={{ height:80, background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center' }}><Layout size={20} style={{ opacity:.3 }} /></div>
            }
            <div style={{ padding: '4px 6px' }}>
              <p style={{ fontSize:'0.62rem', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{f.displayName||f.name}</p>
              {f.category && <p style={{ fontSize:'0.58rem', color:'var(--muted)' }}>{f.category}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── ASSETS PANEL ─────────────────────────────────────────────
const AssetsPanel: React.FC<{
  onAddImage: (url: string) => void
  onSetBg: (url: string) => void
}> = ({ onAddImage, onSetBg }) => {
  const [sub, setSub] = useState<AssetSubTab>('logos')
  const { files, loading } = useAssets(sub)

  return (
    <div>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
        {(['logos','backgrounds','elements','schools'] as AssetSubTab[]).map(t => (
          <button key={t} onClick={() => setSub(t)}
            style={{ flex:1, padding:'7px 2px', border:'none', borderBottom: sub===t?'2px solid var(--brand)':'2px solid transparent', background:'none', fontSize:'0.58rem', fontWeight:600, color: sub===t?'var(--brand)':'var(--muted)', cursor:'pointer', textTransform:'capitalize' }}>
            {t === 'backgrounds' ? 'BG' : t}
          </button>
        ))}
      </div>

      {loading && <p style={{ textAlign:'center', color:'var(--muted)', fontSize:'0.75rem', padding:'1rem' }}>Loading…</p>}

      <div style={{ padding: '8px' }}>
        {sub === 'backgrounds' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {files.map(f => (
              <div key={f.name} onClick={() => onSetBg(f.url)} title="Set as background"
                style={{ borderRadius: 8, overflow:'hidden', border:'2px solid var(--border)', cursor:'pointer', height: 110, transition:'border-color .15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--brand)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <img src={f.url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
            {files.map(f => (
              <div key={f.name} onClick={() => onAddImage(f.url)} title={f.displayName}
                style={{ borderRadius:8, border:'2px solid var(--border)', overflow:'hidden', cursor:'pointer', height:90, background:'#fafafa', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:6, gap:4, transition:'border-color .15s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--brand)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <img src={f.url} alt="" style={{ maxWidth:'100%', maxHeight:66, objectFit:'contain', filter: sub === 'logos' ? 'drop-shadow(0 1px 3px rgba(0,0,0,0.35))' : undefined }} />
                <span style={{ fontSize:'0.55rem', color:'var(--muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', width:'100%', textAlign:'center' as any }}>{f.displayName}</span>
              </div>
            ))}
          </div>
        )}
        {!loading && files.length === 0 && (
          <p style={{ textAlign:'center', color:'var(--muted)', fontSize:'0.75rem', padding:'1rem' }}>No {sub} uploaded</p>
        )}
      </div>
    </div>
  )
}

// ─── MEMOIZED PANEL CONTENT (MOVED OUTSIDE EDITOR) ───────────
const PanelContent = React.memo(({ 
  panel, 
  selectedElement, 
  onAddImage, 
  onSetBg, 
  onApplyTemplate, 
  onSizeChange, 
  onAddText, 
  onAddShape, 
  onImageUpload,
  currentW,
  currentH,
  background,
  onUpdateBackground,
  elements,
  selectedElementId,
  onSelectElement,
  onToggleVisibility,
  onToggleLock,
  onBringForward,
  onSendBackward,
  onUpdateElement,
  onDeleteElement,
  onDuplicateElement,
  onClosePanel
}: {
  panel: LeftTab | RightTab;
  selectedElement: CanvasElement | null;
  onAddImage: (url: string) => void;
  onSetBg: (url: string) => void;
  onApplyTemplate: (f: AssetFile) => void;
  onSizeChange: (w: number, h: number, name: string) => void;
  onAddText: () => void;
  onAddShape: (shapeType: string) => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>, onDone?: () => void) => void;
  currentW: number;
  currentH: number;
  background: Background;
  onUpdateBackground: (bg: Background) => void;
  elements: CanvasElement[];
  selectedElementId: string | null;
  onSelectElement: (id: string | null) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onBringForward: (id: string) => void;
  onSendBackward: (id: string) => void;
  onUpdateElement: (updates: any) => void;
  onDeleteElement: (id: string) => void;
  onDuplicateElement: (id: string) => void;
  onClosePanel: () => void;
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocalTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.json')) { toast.error('Please select a .json template file'); return }
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      applyFabricTemplate(json, (action: any) => {}, toast)
    } catch { toast.error('Invalid JSON file') }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  if (panel === 'templates') return (
    <div>
      <ServerTemplatePanel
        onApply={onApplyTemplate}
        onSizeChange={onSizeChange}
        currentW={currentW} 
        currentH={currentH}
      />
      <div style={{ padding:'10px 8px', borderTop:'1px solid var(--border)' }}>
        <div style={{ fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', marginBottom:6 }}>Upload Your Template</div>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleLocalTemplateUpload} style={{ display:'none' }}/>
        <button className="btn btn-secondary btn-sm" style={{ width:'100%', justifyContent:'center', fontSize:'0.75rem' }} onClick={()=>fileInputRef.current?.click()}>
          <Upload size={13}/> Upload JSON Template
        </button>
      </div>
    </div>
  );
  
  if (panel === 'assets') return <AssetsPanel onAddImage={onAddImage} onSetBg={onSetBg}/>;
  
  if (panel === 'add') return (
    <div style={{ padding:'12px 8px' }}>
      <div className="panel-title" style={{ padding:'0 8px', marginBottom:8 }}>Add Elements</div>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:'0.6875rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', padding:'0 8px', marginBottom:6 }}>Text</div>
        <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'flex-start', marginBottom:4 }} onClick={()=>{ onAddText(); onClosePanel(); }}>
          <Type size={14}/> Add Text
        </button>
      </div>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:'0.6875rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', padding:'0 8px', marginBottom:6 }}>Shapes</div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, padding:'0 4px' }}>
          {[
            { type:'rect',        label:'Rect',     preview:<div style={{width:14,height:14,background:'currentColor',borderRadius:2}}/> },
            { type:'circle',      label:'Circle',   preview:<div style={{width:14,height:14,background:'currentColor',borderRadius:'50%'}}/> },
            { type:'triangle',    label:'Triangle', preview:<div style={{width:0,height:0,borderLeft:'7px solid transparent',borderRight:'7px solid transparent',borderBottom:'14px solid currentColor'}}/> },
            { type:'diamond',     label:'Diamond',  preview:<div style={{width:12,height:12,background:'currentColor',transform:'rotate(45deg)'}}/> },
            { type:'star',        label:'Star',     preview:<span style={{fontSize:14,lineHeight:'1'}}>★</span> },
            { type:'pentagon',    label:'Pentagon', preview:<span style={{fontSize:13,lineHeight:'1'}}>⬠</span> },
            { type:'hexagon',     label:'Hexagon',  preview:<span style={{fontSize:13,lineHeight:'1'}}>⬡</span> },
            { type:'arrow_right', label:'Arrow',    preview:<span style={{fontSize:13,lineHeight:'1'}}>➤</span> },
            { type:'cross',       label:'Cross',    preview:<span style={{fontSize:15,lineHeight:'1',fontWeight:700}}>✚</span> },
            { type:'parallelogram',label:'Parallelogram',preview:<span style={{fontSize:12,lineHeight:'1'}}>▱</span> },
            { type:'trapezoid',   label:'Trapezoid',preview:<span style={{fontSize:12,lineHeight:'1'}}>⏢</span> },
            { type:'heart',       label:'Heart',    preview:<span style={{fontSize:14,lineHeight:'1'}}>♥</span> },
          ].map(({type, label, preview}) => (
            <button key={type} className="btn btn-secondary btn-sm"
              style={{ flexDirection:'column', gap:3, padding:'6px 4px', fontSize:'0.58rem', height:48, justifyContent:'center', alignItems:'center' }}
              onClick={()=>{ onAddShape(type); onClosePanel(); }}>
              {preview}{label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ marginBottom:12 }}>
        <div style={{ fontSize:'0.6875rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', padding:'0 8px', marginBottom:6 }}>Image</div>
        <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'flex-start' }}
          onClick={()=>{ const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*'; inp.onchange=(ev)=>{ onImageUpload(ev as any, ()=>onClosePanel()) }; inp.click() }}>
          <Upload size={14}/> Upload Image from Device
        </button>
      </div>
    </div>
  );
  
  if (panel === 'size') return (
    <div style={{ padding:'12px 8px' }}>
      <div className="panel-title" style={{ padding:'0 8px', marginBottom:8 }}>Page Size</div>
      <TemplateSelector currentW={currentW} currentH={currentH} onSelectTemplate={(w,h,name)=>{
        onSizeChange(w, h, name);
        onClosePanel();
      }}/>
    </div>
  );
  
  if (panel === 'layers') return (
    <LayersPanel 
      elements={elements} 
      selectedId={selectedElementId}
      onSelect={onSelectElement}
      onToggleVisibility={onToggleVisibility}
      onToggleLock={onToggleLock}
      onBringForward={onBringForward}
      onSendBackward={onSendBackward}
    />
  );
  
  if (panel === 'properties') return selectedElement ? (
    <PropertiesPanelEnhanced
      element={selectedElement}
      onUpdate={onUpdateElement}
      onDelete={()=>{ onDeleteElement(selectedElement.id); onClosePanel(); }}
      onDuplicate={()=>onDuplicateElement(selectedElement.id)}
      onLock={()=>onToggleLock(selectedElement.id)}
      onToggleVisibility={()=>onToggleVisibility(selectedElement.id)}
      onBringForward={()=>onBringForward(selectedElement.id)}
      onSendBackward={()=>onSendBackward(selectedElement.id)}
    />
  ) : (
    <div style={{ padding:'2rem 1rem', textAlign:'center', color:'var(--muted)' }}>
      <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>👆</div>
      <p style={{ fontSize:'0.875rem', lineHeight:1.5 }}>Tap an element on the canvas to edit its properties</p>
    </div>
  );
  
  if (panel === 'background') return <BackgroundEditor background={background} onUpdate={onUpdateBackground}/>;
  
  return null;
});

// ─── MAIN EDITOR ──────────────────────────────────────────────
const Editor: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const dispatch = useDispatch()
  const { token } = useSelector((s: RootState) => s.auth)
  const { elements, selectedElementId, background, width, height, zoom, historyIndex, history } = useSelector((s: RootState) => s.canvas)
  const headers = { Authorization: `Bearer ${token}` }

  const [title, setTitle] = useState('Untitled Design')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [leftTab, setLeftTab] = useState<LeftTab>('templates')
  const [rightTab, setRightTab] = useState<RightTab>('properties')
  const [imageUrl, setImageUrl] = useState('')
  const [showImageInput, setShowImageInput] = useState(false)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const imageUploadRef  = useRef<HTMLInputElement>(null)

  const selectedElement = elements.find(e => e.id === selectedElementId) || null

  useEffect(() => { fetchProject() }, [projectId])

  // Preserve mobile bottom-sheet scroll position
  useLayoutEffect(() => {
    const el = mobileSheetScrollRef.current
    if (!el || mobilePanel !== 'properties') return
    const curId = selectedElementId ?? null
    if (prevMobileElId.current !== curId) {
      prevMobileElId.current = curId
      mobileSheetScroll.current = 0
      el.scrollTop = 0
    } else {
      el.scrollTop = mobileSheetScroll.current
    }
  })

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if ((e.metaKey||e.ctrlKey) && e.key==='z' && !e.shiftKey) { e.preventDefault(); dispatch(undo()) }
      if ((e.metaKey||e.ctrlKey) && (e.key==='y'||(e.key==='z'&&e.shiftKey))) { e.preventDefault(); dispatch(redo()) }
      if ((e.metaKey||e.ctrlKey) && e.key==='s') { e.preventDefault(); saveProject(true) }
      if ((e.metaKey||e.ctrlKey) && e.key==='d') { e.preventDefault(); if (selectedElementId) dispatch(duplicateElement(selectedElementId)) }
      if (e.key==='Delete'||e.key==='Backspace') { if (selectedElementId) dispatch(deleteElement(selectedElementId)) }
      if (e.key==='Escape') dispatch(selectElement(null))
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
      if (p.canvas_data) { try { canvasData = JSON.parse(p.canvas_data) } catch {} }
      dispatch(loadProject({
        elements: canvasData.elements || [],
        background: canvasData.background,
        width: p.width || A4_WIDTH,
        height: p.height || A4_HEIGHT,
      }))

      const isMob = window.innerWidth <= 768
      const availW = window.innerWidth  - (isMob ? 24  : 248 + 256 + 80)
      const availH = window.innerHeight - (isMob ? 120 : 56  + 80)
      const fitZoom = Math.floor(Math.min(
        (availW / (p.width  || A4_WIDTH))  * 100,
        (availH / (p.height || A4_HEIGHT)) * 100,
        isMob ? 60 : 90
      ) / 5) * 5
      dispatch(setZoom(Math.max(isMob ? 20 : 25, fitZoom)))

      const routeState = location.state as { templateUrl?: string; templateName?: string } | null
      if (routeState?.templateUrl) {
        const safeUrl = fixProtocol(routeState.templateUrl)
        try {
          const tplRes = await fetch(safeUrl)
          if (tplRes.ok) {
            const contentType = tplRes.headers.get('content-type') || ''
            if (contentType.includes('application/json') || safeUrl.endsWith('.json')) {
              const json = await tplRes.json()
              applyFabricTemplate(json, dispatch, toast)
            } else {
              dispatch(updateBackground({ type: 'image', image: { src: safeUrl, opacity: 100, blur: 0, scale: 1 } }))
              toast.success(`Template "${routeState.templateName || ''}" applied`)
            }
          }
        } catch { /* ignore template load failure — project still opens */ }
      }

    } catch {
      toast.error('Failed to load project')
      navigate('/dashboard')
    } finally { setLoading(false) }
  }

  const saveProject = async (showToast = true) => {
    setSaving(true)
    try {
      await axios.put(`${API}/api/projects/${projectId}`, {
        title,
        canvas_data: JSON.stringify({ elements, background }),
        width, height,
      }, { headers })
      if (showToast) toast.success('Saved!')

      generateThumbnailBlob(elements, background, width, height).then(async blob => {
        if (!blob) return
        const fd = new FormData()
        fd.append('thumbnail', blob, 'thumb.jpg')
        await axios.post(`${API}/api/projects/${projectId}/thumbnail`, fd, { headers }).catch(() => {})
      }).catch(() => {})
    } catch { if (showToast) toast.error('Save failed') }
    finally { setSaving(false) }
  }

  const makeId = () => Date.now().toString() + Math.random().toString(36).slice(2,6)
  const nextZ  = () => Math.max(0, ...elements.map(e => e.zIndex)) + 1

  const addText = () => {
    const el: CanvasElement = {
      id: makeId(), type: 'text', x: width/2-150, y: height/2-30,
      width: 300, height: 60, rotation: 0, opacity: 100, zIndex: nextZ(), locked: false, visible: true,
      properties: { text: 'Double-click to edit', fontSize: 32, fontFamily: 'Arial', fontWeight: '700', fontStyle: 'normal', textDecoration: 'none', textAlign: 'center', textTransform: 'none', fill: '#1a1d2e', lineHeight: 1.2, letterSpacing: 0, textCurve: 'none' }
    }
    dispatch(addElement(el)); setRightTab('properties')
  }

  const addShape = (shapeType: string) => {
    const el: CanvasElement = {
      id: makeId(), type: 'shape', x: width/2-75, y: height/2-75,
      width: 150, height: 150, rotation: 0, opacity: 100, zIndex: nextZ(), locked: false, visible: true,
      properties: { fill: '#2980b9', borderRadius: shapeType==='circle'?999:0, shapeType, blendMode: 'normal' }
    }
    dispatch(addElement(el)); setRightTab('properties')
  }

  const handleImageFileUpload = (e: React.ChangeEvent<HTMLInputElement>, onDone?: () => void) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const src = ev.target?.result as string
      if (src) { addImageEl(src); onDone?.() }
    }
    reader.readAsDataURL(file)
    if (e.target) e.target.value = ''
  }

  const addImageEl = (src: string) => {
    const el: CanvasElement = {
      id: makeId(), type: 'image', x: width/2-150, y: height/2-100,
      width: 300, height: 200, rotation: 0, opacity: 100, zIndex: nextZ(), locked: false, visible: true,
      properties: { src, objectFit: 'contain', brightness: 100, contrast: 100, saturation: 100, hueRotate: 0, blur: 0, grayscale: 0, sepia: 0, borderRadius: 0 }
    }
    dispatch(addElement(el)); setRightTab('properties')
  }

  const handleSetBackground = (src: string) => {
    dispatch(updateBackground({ type: 'image', image: { src, opacity: 100, blur: 0, scale: 1 } }))
    setRightTab('background')
    toast.success('Background set!')
  }

  const handleApplyTemplate = async (f: AssetFile) => {
    if (f.jsonData) {
      applyFabricTemplate(f.jsonData, dispatch, toast)
    } else if (f.type === 'application/json' || f.name.endsWith('.json')) {
      try {
        const res = await fetch(f.url)
        const json = await res.json()
        f.jsonData = json
        applyFabricTemplate(json, dispatch, toast)
      } catch { toast.error('Failed to load template JSON') }
    } else if (f.previewUrl || f.url) {
      handleSetBackground(f.previewUrl || f.url)
    }
  }

  const handleLocalTemplateUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.json')) { toast.error('Please select a .json template file'); return }
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      applyFabricTemplate(json, dispatch, toast)
    } catch { toast.error('Invalid JSON file') }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const exportAsJson = async () => {
    let _preview: string | undefined
    try {
      const thumbBlob = await generateThumbnailBlob(elements, background, width, height)
      if (thumbBlob) {
        _preview = await new Promise<string>(res => {
          const reader = new FileReader()
          reader.onloadend = () => res(reader.result as string)
          reader.readAsDataURL(thumbBlob)
        })
      }
    } catch {}

    const exportData: any = {
      _format: 'mohini-design-hub',
      _version: '2.0',
      project: title,
      exportDate: new Date().toISOString(),
      width,
      height,
      background,
      elements,
    }
    if (_preview) exportData._preview = _preview

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.replace(/[^a-z0-9]/gi, '_')}_template.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Exported as JSON template!')
  }

  const exportAsPng = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas')
      const el = document.querySelector('.canvas-export-target') as HTMLElement
      if (!el) { toast.error('Canvas not found'); return }

      const prevTransform = el.style.transform
      const prevWidth = el.style.width
      const prevHeight = el.style.height
      el.style.transform = 'scale(1)'
      el.style.width = `${width}px`
      el.style.height = `${height}px`

      const cv = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        width,
        height,
        windowWidth: width,
        windowHeight: height,
        x: 0,
        y: 0,
      })

      el.style.transform = prevTransform
      el.style.width = prevWidth
      el.style.height = prevHeight

      const a = document.createElement('a')
      a.download = `${title || 'design'}.png`
      a.href = cv.toDataURL('image/png')
      a.click()
      toast.success('Exported as PNG!')
    } catch (err) {
      console.error(err)
      toast.error('PNG export failed')
    }
  }

  // ─── MOBILE PANEL STATE ───────────────────────────────────
  const [mobilePanel, setMobilePanel] = useState<LeftTab | RightTab | null>(null)
  const mobileSheetScrollRef = useRef<HTMLDivElement>(null)
  const mobileSheetScroll    = useRef(0)
  const prevMobileElId       = useRef<string | null>(null)
  const mq = typeof window !== 'undefined' ? window.matchMedia('(max-width: 768px)') : null
  const [isMobileView, setIsMobileView] = useState(mq ? mq.matches : false)

  useEffect(() => {
    if (!mq) return
    const handler = (e: MediaQueryListEvent) => setIsMobileView(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  // ─── DRAGGABLE BOTTOM SHEET ───────────────────────────────
  const [sheetHeightVh, setSheetHeightVh] = useState(65)
  const sheetDragRef = useRef<{ startY: number; startH: number } | null>(null)

  const onSheetHandleTouchStart = (e: React.TouchEvent) => {
    sheetDragRef.current = { startY: e.touches[0].clientY, startH: sheetHeightVh }
  }
  const onSheetHandleTouchMove = (e: React.TouchEvent) => {
    if (!sheetDragRef.current) return
    e.preventDefault()
    const dy = sheetDragRef.current.startY - e.touches[0].clientY
    const viewH = window.innerHeight
    const newH = Math.min(92, Math.max(20, sheetDragRef.current.startH + (dy / viewH) * 100))
    setSheetHeightVh(newH)
  }
  const onSheetHandleTouchEnd = () => {
    sheetDragRef.current = null
    if (sheetHeightVh < 22) { setMobilePanel(null); setSheetHeightVh(65) }
    else if (sheetHeightVh < 45) setSheetHeightVh(35)
    else if (sheetHeightVh < 70) setSheetHeightVh(65)
    else setSheetHeightVh(90)
  }

  const openMobilePanel = (panel: LeftTab | RightTab) => {
    setMobilePanel(prev => prev === panel ? null : panel)
  }

  const closeMobilePanel = useCallback(() => {
    setMobilePanel(null);
    setSheetHeightVh(65);
  }, []);

  // ─── STABLE CALLBACKS FOR PANEL CONTENT ───────────────────
  const handleAddTextAndClose = useCallback(() => {
    addText();
    closeMobilePanel();
  }, [addText, closeMobilePanel]);

  const handleAddShapeAndClose = useCallback((shapeType: string) => {
    addShape(shapeType);
    closeMobilePanel();
  }, [addShape, closeMobilePanel]);

  const handleImageUploadWithClose = useCallback((e: React.ChangeEvent<HTMLInputElement>, onDone?: () => void) => {
    handleImageFileUpload(e, () => {
      onDone?.();
      closeMobilePanel();
    });
  }, [handleImageFileUpload, closeMobilePanel]);

  const handleSizeChangeAndClose = useCallback((w: number, h: number, name: string) => {
    dispatch(setCanvasSize({width:w, height:h}));
    const availW = window.innerWidth - 24;
    const availH = window.innerHeight - 200;
    const fitZ = Math.floor(Math.min((availW/w)*100,(availH/h)*100,60)/5)*5;
    dispatch(setZoom(Math.max(20, fitZ)));
    toast.success(`Canvas: ${name}`);
    closeMobilePanel();
  }, [dispatch, closeMobilePanel]);

  const handleUpdateElement = useCallback((updates: any) => {
    if (!selectedElementId) return;
    dispatch(updateElement({id: selectedElementId, updates}));
    clearTimeout((window as any).__ct);
    (window as any).__ct = setTimeout(() => dispatch(commitUpdate()), 600);
  }, [selectedElementId, dispatch]);

  const handleDeleteElement = useCallback((id: string) => {
    dispatch(deleteElement(id));
    closeMobilePanel();
  }, [dispatch, closeMobilePanel]);

  const handleDuplicateElement = useCallback((id: string) => {
    dispatch(duplicateElement(id));
  }, [dispatch]);

  const handleToggleVisibility = useCallback((id: string) => {
    dispatch(toggleVisibility(id));
  }, [dispatch]);

  const handleToggleLock = useCallback((id: string) => {
    dispatch(toggleLock(id));
  }, [dispatch]);

  const handleBringForward = useCallback((id: string) => {
    dispatch(bringForward(id));
  }, [dispatch]);

  const handleSendBackward = useCallback((id: string) => {
    dispatch(sendBackward(id));
  }, [dispatch]);

  const handleSelectElement = useCallback((id: string | null) => {
    dispatch(selectElement(id));
  }, [dispatch]);

  const handleUpdateBackground = useCallback((bg: Background) => {
    dispatch(updateBackground(bg));
  }, [dispatch]);

  if (loading) return (
    <div style={{ height:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
      <div style={{ textAlign:'center', color:'var(--muted)' }}>
        <div style={{ fontSize:'2rem', marginBottom:'1rem' }}>🎨</div>
        Loading your design…
      </div>
    </div>
  )

  // ─── MOBILE LAYOUT ────────────────────────────────────────
  if (isMobileView) return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#e8eaf0', overflow:'hidden', position:'relative' }}>

      {/* Mobile Top Bar */}
      <header style={{ height:48, background:'#fff', display:'flex', alignItems:'center', gap:6, padding:'0 8px', flexShrink:0, zIndex:200, boxShadow:'0 1px 0 #e5e7eb' }}>
        <button style={{ background:'rgba(0,0,0,0.06)', border:'none', borderRadius:7, padding:7, color:'#374151', cursor:'pointer', display:'flex', alignItems:'center' }} onClick={()=>navigate('/dashboard')}><ArrowLeft size={18}/></button>
        <div style={{ flex:1, display:'flex', justifyContent:'center' }}>
          <img src="/assets/mohini.png" alt="Mohini Design Hub" style={{ height:34, objectFit:'contain' }} />
        </div>
        <button style={{ background:'rgba(0,0,0,0.06)', border:'none', borderRadius:6, width:30, height:30, color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>dispatch(undo())} disabled={historyIndex<=0}><Undo size={15}/></button>
        <button style={{ background:'rgba(0,0,0,0.06)', border:'none', borderRadius:6, width:30, height:30, color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>dispatch(redo())} disabled={historyIndex>=history.length-1}><Redo size={15}/></button>
        <button style={{ background:'var(--gold)', border:'none', borderRadius:7, padding:'6px 12px', color:'#fff', cursor:'pointer', fontSize:'0.8125rem', fontWeight:700, display:'flex', alignItems:'center', gap:5 }} onClick={()=>saveProject(true)} disabled={saving}>
          {saving?'…':<><Save size={13}/> Save</>}
        </button>
      </header>

      {/* Canvas fills remaining space */}
      <main style={{ flex:1, overflow:'auto', display:'flex', alignItems:'center', justifyContent:'center', padding:'16px 12px', background:'var(--bg)' }}>
        <div style={{ position:'relative', flexShrink: 0 }}>
          <div style={{ boxShadow:'0 4px 40px rgba(0,0,0,0.25)', borderRadius:2 }} className="canvas-render-target">
            <CanvasEnhanced
              elements={elements} selectedId={selectedElementId}
              onSelect={id=>{ dispatch(selectElement(id)); if (!id && mobilePanel === 'properties') setMobilePanel(null) }}
              onUpdate={(id,updates)=>dispatch(updateElement({id,updates}))}
              onCommit={()=>dispatch(commitUpdate())}
              width={width} height={height} zoom={zoom} background={background}
            />
          </div>
          <div style={{ textAlign:'center', fontSize:'0.65rem', color:'#8899aa', marginTop:6 }}>{width} × {height} px</div>
        </div>
      </main>

      {/* Bottom Sheet Panel */}
      {mobilePanel && (
        <>
          <div onClick={closeMobilePanel}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.35)', zIndex:299, top:48 }}/>
          <div style={{
            position:'fixed', bottom:64, left:0, right:0, zIndex:300,
            background:'#fff', borderRadius:'20px 20px 0 0',
            boxShadow:'0 -4px 32px rgba(0,0,0,0.18)',
            height:`${sheetHeightVh}vh`, display:'flex', flexDirection:'column',
            animation:'slideUp 0.25s ease', transition:'height 0.1s ease',
          }}>
            <div
              onTouchStart={onSheetHandleTouchStart}
              onTouchMove={onSheetHandleTouchMove}
              onTouchEnd={onSheetHandleTouchEnd}
              style={{ padding:'10px 16px 6px', borderBottom:'1px solid var(--border)', flexShrink:0, cursor:'row-resize', touchAction:'none' }}>
              <div style={{ width:40, height:5, background:'#d1d5db', borderRadius:3, margin:'0 auto' }}/>
            </div>
            <div
              ref={mobileSheetScrollRef}
              style={{ overflowY:'auto', flex:1, paddingBottom:8 }}
              onScroll={() => { mobileSheetScroll.current = mobileSheetScrollRef.current?.scrollTop || 0 }}
            >
              <PanelContent
                panel={mobilePanel}
                selectedElement={selectedElement}
                onAddImage={addImageEl}
                onSetBg={handleSetBackground}
                onApplyTemplate={handleApplyTemplate}
                onSizeChange={handleSizeChangeAndClose}
                onAddText={handleAddTextAndClose}
                onAddShape={handleAddShapeAndClose}
                onImageUpload={handleImageUploadWithClose}
                currentW={width}
                currentH={height}
                background={background}
                onUpdateBackground={handleUpdateBackground}
                elements={elements}
                selectedElementId={selectedElementId}
                onSelectElement={handleSelectElement}
                onToggleVisibility={handleToggleVisibility}
                onToggleLock={handleToggleLock}
                onBringForward={handleBringForward}
                onSendBackward={handleSendBackward}
                onUpdateElement={handleUpdateElement}
                onDeleteElement={handleDeleteElement}
                onDuplicateElement={handleDuplicateElement}
                onClosePanel={closeMobilePanel}
              />
            </div>
          </div>
        </>
      )}

      {/* Bottom Navigation Bar */}
      <nav style={{
        background:'#fff', borderTop:'1px solid var(--border)',
        display:'flex', flexDirection:'column', flexShrink:0, zIndex:400,
        paddingBottom:'env(safe-area-inset-bottom)',
      }}>
        <div style={{ height:58, display:'flex', alignItems:'center' }}>
          {([
            ['templates', <Layout size={18}/>,     'Templates'],
            ['assets',    <ImageIcon size={18}/>,  'Assets'],
            ['add',       <AlignCenter size={18}/>,'Add'],
            ['size',      <Maximize2 size={18}/>,  'Size'],
            ['layers',    <Layers size={18}/>,     'Layers'],
            ['properties',<Sliders size={18}/>,    'Edit'],
            ['background',<Filter size={18}/>,     'BG'],
          ] as [LeftTab|RightTab, React.ReactNode, string][]).map(([tab, icon, label]) => (
            <button key={tab} onClick={()=>openMobilePanel(tab)}
              style={{
                flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:2, border:'none', background:'transparent', cursor:'pointer',
                color: mobilePanel===tab ? 'var(--brand)' : 'var(--muted)',
                padding:'5px 2px', fontSize:'0.5rem', fontWeight:600, textTransform:'uppercase',
                borderTop: mobilePanel===tab ? '2px solid var(--brand)' : '2px solid transparent',
                transition:'all 0.15s', height:'100%',
              }}>
              {icon}
              {label}
            </button>
          ))}
        </div>

        <div style={{ borderTop:'1px solid var(--border)', padding:'4px 0', display:'flex', justifyContent:'center', alignItems:'center' }}>
          <a href="https://gobt.in" target="_blank" rel="noopener noreferrer"
            style={{ display:'flex', alignItems:'center', gap:5, textDecoration:'none' }}>
            <img src="/assets/gobt_logo.png" alt="GOBT" style={{ height:22, objectFit:'cover' }} />
            <span style={{ fontSize:'0.6rem', color:'var(--muted)', fontWeight:500 }}>Powered by GOBT</span>
          </a>
        </div>
      </nav>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  )

  // ─── DESKTOP LAYOUT ───────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)', overflow:'hidden' }}>

      {/* ─── TOP TOOLBAR ─── */}
      <header style={{ height:56, background:'#fff', display:'flex', alignItems:'center', gap:8, padding:'0 12px', flexShrink:0, zIndex:100, position:'relative', boxShadow:'0 1px 0 #e5e7eb' }}>
        <button style={{ background:'rgba(0,0,0,0.06)', border:'none', borderRadius:7, padding:8, color:'#374151', cursor:'pointer', display:'flex', alignItems:'center' }} onClick={()=>navigate('/dashboard')}><ArrowLeft size={18}/></button>
        <div style={{ width:1, height:28, background:'#e5e7eb' }}/>
        <input value={title} onChange={e=>setTitle(e.target.value)}
          style={{ border:'none', fontSize:'0.9375rem', fontWeight:700, color:'#1a1d2e', background:'transparent', outline:'none', minWidth:120, maxWidth:200 }}/>
        <div style={{ width:1, height:28, background:'#e5e7eb' }}/>
        <button style={{ background:'rgba(0,0,0,0.06)', border:'none', borderRadius:6, width:32, height:32, color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>dispatch(undo())} disabled={historyIndex<=0} title="Undo"><Undo size={16}/></button>
        <button style={{ background:'rgba(0,0,0,0.06)', border:'none', borderRadius:6, width:32, height:32, color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>dispatch(redo())} disabled={historyIndex>=history.length-1} title="Redo"><Redo size={16}/></button>
        <div style={{ width:1, height:28, background:'#e5e7eb' }}/>
        <button style={{ background:'rgba(0,0,0,0.06)', border:'none', borderRadius:6, width:30, height:30, color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>dispatch(setZoom(Math.max(10,zoom-10)))}><ZoomOut size={15}/></button>
        <span style={{ fontSize:'0.8rem', fontWeight:700, color:'#374151', minWidth:38, textAlign:'center' }}>{zoom}%</span>
        <button style={{ background:'rgba(0,0,0,0.06)', border:'none', borderRadius:6, width:30, height:30, color:'#374151', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }} onClick={()=>dispatch(setZoom(Math.min(200,zoom+10)))}><ZoomIn size={15}/></button>
        <select value={zoom} onChange={e=>dispatch(setZoom(+e.target.value))} style={{ fontSize:'0.75rem', border:'1px solid #d1d5db', borderRadius:6, padding:'4px 6px', background:'#f9fafb', color:'#374151', cursor:'pointer' }}>
          {[25,33,50,67,75,100,125,150,200].map(z=><option key={z} value={z}>{z}%</option>)}
        </select>

        <div style={{ position:'absolute', left:'50%', transform:'translateX(-50%)', display:'flex', alignItems:'center' }}>
          <img src="/assets/mohini.png" alt="Mohini Design Hub" style={{ height:80, objectFit:'contain' }} />
        </div>

        <div style={{ flex:1 }}/>
        <span style={{ fontSize:'0.7rem', color:'#6b7280', background:'#f3f4f6', padding:'4px 8px', borderRadius:6 }}>{width}×{height}</span>
        <button style={{ background:'rgba(0,0,0,0.06)', border:'1px solid #e5e7eb', borderRadius:7, padding:'6px 12px', color:'#374151', cursor:'pointer', fontSize:'0.8125rem', fontWeight:600, display:'flex', alignItems:'center', gap:5 }} onClick={exportAsJson} title="Export as JSON template">
          <FileJson size={14}/> JSON
        </button>
        <button style={{ background:'rgba(0,0,0,0.06)', border:'1px solid #e5e7eb', borderRadius:7, padding:'6px 12px', color:'#374151', cursor:'pointer', fontSize:'0.8125rem', fontWeight:600, display:'flex', alignItems:'center', gap:5 }} onClick={exportAsPng} title="Export as PNG">
          <Download size={14}/> PNG
        </button>
        <button style={{ background:'var(--gold)', border:'none', borderRadius:7, padding:'6px 14px', color:'#fff', cursor:'pointer', fontSize:'0.8125rem', fontWeight:700, display:'flex', alignItems:'center', gap:5, boxShadow:'0 2px 8px rgba(201,162,39,0.4)' }} onClick={()=>saveProject(true)} disabled={saving}>
          <Save size={14}/> {saving?'Saving…':'Save'}
        </button>
      </header>

      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ─── LEFT SIDEBAR ─── */}
        <aside style={{ width:248, background:'#fff', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
          <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            {([
              ['templates', <Layout size={12}/>,     'Templates'],
              ['assets',    <ImageIcon size={12}/>,  'Assets'],
              ['add',       <AlignCenter size={12}/>,'Add'],
              ['size',      <Maximize2 size={12}/>,  'Size'],
              ['layers',    <Layers size={12}/>,     'Layers'],
            ] as const).map(([tab, icon, label]) => (
              <button key={tab}
                className={`sidebar-nav-item${leftTab===tab?' active':''}`}
                style={{ flex:1, padding:'9px 2px', borderRadius:0, borderBottom:leftTab===tab?'2px solid var(--brand)':'2px solid transparent', fontSize:'0.56rem', gap:2 }}
                onClick={()=>setLeftTab(tab as LeftTab)}>
                {icon}{label}
              </button>
            ))}
          </div>

          <div style={{ flex:1, overflowY:'auto' }}>
            {leftTab==='templates' && (
              <div>
                <ServerTemplatePanel
                  onApply={handleApplyTemplate}
                  onSizeChange={(w,h,name)=>{
                    dispatch(setCanvasSize({width:w,height:h}))
                    const isMob = isMobileView
                    const availW = window.innerWidth - (isMob ? 24 : 248 + 256 + 80)
                    const availH = window.innerHeight - (isMob ? 120 : 56 + 80)
                    const fitZ = Math.floor(Math.min((availW/w)*100,(availH/h)*100,isMob?60:90)/5)*5
                    dispatch(setZoom(Math.max(isMob?20:25, fitZ)))
                    toast.success(`Canvas: ${name}`)
                  }}
                  currentW={width} currentH={height}
                />
                <div style={{ padding:'10px 8px', borderTop:'1px solid var(--border)' }}>
                  <div style={{ fontSize:'0.62rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--muted)', marginBottom:6 }}>Upload Your Template</div>
                  <input ref={fileInputRef} type="file" accept=".json" onChange={handleLocalTemplateUpload} style={{ display:'none' }}/>
                  <button className="btn btn-secondary btn-sm" style={{ width:'100%', justifyContent:'center', fontSize:'0.75rem' }} onClick={()=>fileInputRef.current?.click()}>
                    <Upload size={13}/> Upload JSON Template
                  </button>
                </div>
              </div>
            )}
            {leftTab==='assets' && <AssetsPanel onAddImage={addImageEl} onSetBg={handleSetBackground}/>}
            {leftTab==='add' && (
              <div style={{ padding:'12px 8px' }}>
                <div className="panel-title" style={{ padding:'0 8px', marginBottom:8 }}>Add Elements</div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:'0.6875rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', padding:'0 8px', marginBottom:6 }}>Text</div>
                  <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'flex-start', marginBottom:4 }} onClick={addText}><Type size={14}/> Add Text</button>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:'0.6875rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', padding:'0 8px', marginBottom:6 }}>Shapes</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, padding:'0 4px' }}>
                    {[
                      { type:'rect',        label:'Rect',     preview:<div style={{width:13,height:13,background:'currentColor',borderRadius:2}}/> },
                      { type:'circle',      label:'Circle',   preview:<div style={{width:13,height:13,background:'currentColor',borderRadius:'50%'}}/> },
                      { type:'triangle',    label:'Triangle', preview:<div style={{width:0,height:0,borderLeft:'6px solid transparent',borderRight:'6px solid transparent',borderBottom:'13px solid currentColor'}}/> },
                      { type:'diamond',     label:'Diamond',  preview:<div style={{width:11,height:11,background:'currentColor',transform:'rotate(45deg)'}}/> },
                      { type:'star',        label:'Star',     preview:<span style={{fontSize:13,lineHeight:'1'}}>★</span> },
                      { type:'pentagon',    label:'Pentagon', preview:<span style={{fontSize:12,lineHeight:'1'}}>⬠</span> },
                      { type:'hexagon',     label:'Hexagon',  preview:<span style={{fontSize:12,lineHeight:'1'}}>⬡</span> },
                      { type:'arrow_right', label:'Arrow',    preview:<span style={{fontSize:12,lineHeight:'1'}}>➤</span> },
                      { type:'cross',       label:'Cross',    preview:<span style={{fontSize:14,lineHeight:'1',fontWeight:700}}>✚</span> },
                      { type:'parallelogram',label:'Parallelogram',preview:<span style={{fontSize:11,lineHeight:'1'}}>▱</span> },
                      { type:'trapezoid',   label:'Trapezoid',preview:<span style={{fontSize:11,lineHeight:'1'}}>⏢</span> },
                      { type:'heart',       label:'Heart',    preview:<span style={{fontSize:13,lineHeight:'1'}}>♥</span> },
                    ].map(({type, label, preview}) => (
                      <button key={type} className="btn btn-secondary btn-sm"
                        style={{ flexDirection:'column', gap:2, padding:'5px 3px', fontSize:'0.57rem', height:44, justifyContent:'center', alignItems:'center' }}
                        onClick={()=>addShape(type)}>
                        {preview}{label}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom:12 }}>
                  <div style={{ fontSize:'0.6875rem', fontWeight:700, color:'var(--muted)', textTransform:'uppercase', padding:'0 8px', marginBottom:6 }}>Image</div>
                  <input ref={imageUploadRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => handleImageFileUpload(e)} />
                  <button className="btn btn-secondary" style={{ width:'100%', justifyContent:'flex-start' }} onClick={()=>imageUploadRef.current?.click()}>
                    <Upload size={14}/> Upload Image from Device
                  </button>
                </div>
              </div>
            )}
            {leftTab==='size' && (
              <div style={{ padding:'12px 8px' }}>
                <div className="panel-title" style={{ padding:'0 8px', marginBottom:8 }}>Page Size</div>
                <TemplateSelector currentW={width} currentH={height} onSelectTemplate={(w,h,name)=>{
                  dispatch(setCanvasSize({width:w,height:h}))
                  const availW = window.innerWidth-(248+256+80), availH = window.innerHeight-(56+80)
                  dispatch(setZoom(Math.max(25,Math.floor(Math.min((availW/w)*100,(availH/h)*100,90)/5)*5)))
                  toast.success(`Canvas: ${name}`)
                }}/>
              </div>
            )}
            {leftTab==='layers' && (
              <LayersPanel elements={elements} selectedId={selectedElementId}
                onSelect={id=>{ dispatch(selectElement(id)); setRightTab('properties') }}
                onToggleVisibility={handleToggleVisibility}
                onToggleLock={handleToggleLock}
                onBringForward={handleBringForward}
                onSendBackward={handleSendBackward}
              />
            )}
          </div>
        </aside>

        {/* ─── CANVAS ─── */}
        <main style={{ flex:1, overflow:'auto', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px', background:'var(--bg)', position:'relative' }}>
          <div style={{ position:'relative', flexShrink: 0 }}>
            <div style={{ boxShadow:'0 4px 40px rgba(0,0,0,0.25)', borderRadius:2 }} className="canvas-render-target">
              <CanvasEnhanced
                elements={elements} selectedId={selectedElementId}
                onSelect={id=>{ dispatch(selectElement(id)); if(id) setRightTab('properties') }}
                onUpdate={(id,updates)=>dispatch(updateElement({id,updates}))}
                onCommit={()=>dispatch(commitUpdate())}
                width={width} height={height} zoom={zoom} background={background}
              />
            </div>
            <div style={{ textAlign:'center', marginTop:10, fontSize:'0.72rem', color:'#8899aa', whiteSpace:'nowrap' }}>
              {width} × {height} px
            </div>
          </div>

          <div style={{ position:'fixed', bottom:16, left: 248 + 16, display:'flex', alignItems:'center', zIndex:50 }}>
            <a href="https://gobt.in" target="_blank" rel="noopener noreferrer"
              style={{ display:'flex', alignItems:'center', gap:6, textDecoration:'none', background:'rgba(255,255,255,0.92)', padding:'5px 10px', borderRadius:20, boxShadow:'0 2px 8px rgba(0,0,0,0.12)', border:'1px solid var(--border)' }}>
              <img src="/assets/gobt_logo.png" alt="GOBT" style={{ height:34, objectFit:'contain' }} />
              <span style={{ fontSize:'0.65rem', color:'var(--muted)', fontWeight:600 }}>Powered by GOBT</span>
            </a>
          </div>
        </main>

        {/* ─── RIGHT PANEL ─── */}
        <aside style={{ width:256, background:'#fff', borderLeft:'1px solid var(--border)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
          <div style={{ display:'flex', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
            {([['properties',<Sliders size={14}/>,'Properties'],['background',<Layout size={14}/>,'Background']] as const).map(([tab,icon,label])=>(
              <button key={tab} className={`sidebar-nav-item${rightTab===tab?' active':''}`}
                style={{ flex:1, padding:'10px 4px', borderRadius:0, borderBottom:rightTab===tab?'2px solid var(--brand)':'2px solid transparent', fontSize:'0.625rem' }}
                onClick={()=>setRightTab(tab as RightTab)}>
                {icon}{label}
              </button>
            ))}
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {rightTab==='background' && <BackgroundEditor background={background} onUpdate={handleUpdateBackground}/>}
            {rightTab==='properties' && (
              selectedElement ? (
                <PropertiesPanelEnhanced
                  element={selectedElement}
                  onUpdate={handleUpdateElement}
                  onDelete={()=>dispatch(deleteElement(selectedElement.id))}
                  onDuplicate={()=>dispatch(duplicateElement(selectedElement.id))}
                  onLock={()=>dispatch(toggleLock(selectedElement.id))}
                  onToggleVisibility={()=>dispatch(toggleVisibility(selectedElement.id))}
                  onBringForward={()=>dispatch(bringForward(selectedElement.id))}
                  onSendBackward={()=>dispatch(sendBackward(selectedElement.id))}
                />
              ) : (
                <div style={{ padding:'2rem 1rem', textAlign:'center', color:'var(--muted)' }}>
                  <div style={{ fontSize:'2rem', marginBottom:'0.75rem' }}>👆</div>
                  <p style={{ fontSize:'0.875rem', lineHeight:1.5 }}>Select an element on the canvas to edit its properties</p>
                  <p style={{ fontSize:'0.75rem', marginTop:'0.75rem', color:'#aaa' }}>Double-click any text to edit it directly</p>
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