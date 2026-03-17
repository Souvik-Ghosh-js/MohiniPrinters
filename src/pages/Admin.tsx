import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, LogOut, Upload, Trash2, Eye, Download,
  Image as ImageIcon, FileText, Code, X, RefreshCw,
  Users, FolderOpen, Layout, Settings
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import { useAssets } from '../hooks/useAssets'
import { AssetCategory, AssetFile, validateJsonTemplate, extractTemplatePreview } from '../utils/assetApi'
import axios from 'axios'
import toast from 'react-hot-toast'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
type Tab = 'overview' | 'logos' | 'backgrounds' | 'schools' | 'templates' | 'elements'

/* ─── OVERVIEW ─────────────────────────────────────────── */
const Overview: React.FC<{ token: string | null }> = ({ token }) => {
  const [stats, setStats] = useState<any>(null)
  useEffect(() => {
    axios.get(`${API}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setStats(r.data.data)).catch(() => {})
  }, [token])
  const cards = [
    { label: 'Total Users', value: stats?.totalUsers ?? '—', color: '#2563eb', icon: <Users size={22} /> },
    { label: 'Total Projects', value: stats?.totalProjects ?? '—', color: '#1dc48d', icon: <FolderOpen size={22} /> },
    { label: 'Templates', value: stats?.totalTemplates ?? '—', color: '#7c3aed', icon: <Layout size={22} /> },
    { label: 'Assets', value: stats?.totalAssets ?? '—', color: '#f59e0b', icon: <ImageIcon size={22} /> },
  ]
  return (
    <div>
      <h2 style={{ fontWeight: 800, fontSize: '1.25rem', marginBottom: '1.5rem', color: 'var(--text)' }}>Dashboard Overview</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: '1.25rem' }}>
        {cards.map((c, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ color: c.color }}>{c.icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)' }}>{c.value}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{c.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: '2rem', background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: 'var(--shadow)' }}>
        <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', fontSize: '0.95rem' }}>Quick Guide</h3>
        <ul style={{ fontSize: '0.85rem', color: 'var(--muted)', lineHeight: 2, margin: 0, paddingLeft: '1.25rem' }}>
          <li><strong>Logos & Icons</strong> — Upload school logos, crests, and icon assets</li>
          <li><strong>Backgrounds</strong> — Upload background images used behind certificate designs</li>
          <li><strong>School Names</strong> — Upload school name graphics / text images</li>
          <li><strong>Templates</strong> — Upload JSON (Fabric.js) or image templates users can load</li>
          <li><strong>Elements</strong> — Upload borders, seals, stamps, and decorative elements</li>
        </ul>
      </div>
    </div>
  )
}

/* ─── GENERIC IMAGE UPLOAD PANEL ──────────────────────── */
interface ImagePanelProps {
  bucket: AssetCategory
  title: string
  description: string
  accept?: string
  maxMB?: number
}

const ImagePanel: React.FC<ImagePanelProps> = ({ bucket, title, description, accept = '.jpg,.jpeg,.png,.webp,.svg', maxMB = 5 }) => {
  const { files, loading, uploading, error, load, upload, remove } = useAssets(bucket)
  const [selected, setSelected] = useState<File[]>([])
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [names, setNames] = useState<Record<string, string>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const fmt = (b: number) => { if (!b) return '—'; const k = 1024, i = Math.floor(Math.log(b)/Math.log(k)); return `${(b/Math.pow(k,i)).toFixed(1)} ${['B','KB','MB','GB'][i]}` }

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files || [])
    const valid: File[] = []
    for (const f of fs) {
      if (f.size > maxMB * 1024 * 1024) { toast.error(`${f.name} exceeds ${maxMB}MB`); continue }
      valid.push(f)
      setPreviews(p => ({ ...p, [f.name]: URL.createObjectURL(f) }))
      setNames(p => ({ ...p, [f.name]: f.name.replace(/\.[^/.]+$/,'').replace(/[_-]/g,' ') }))
    }
    setSelected(p => [...p, ...valid])
  }

  const drop = (e: React.DragEvent) => { e.preventDefault(); handleSelect({ target: { files: e.dataTransfer.files } } as any) }
  const removeFile = (n: string) => { setSelected(p => p.filter(f => f.name !== n)); setPreviews(p => { const x={...p}; delete x[n]; return x }); setNames(p => { const x={...p}; delete x[n]; return x }) }

  const doUpload = async () => {
    let ok = 0
    for (const f of selected) {
      try { await upload(f, { name: names[f.name] || f.name }); ok++ } catch(e:any){ toast.error(e.message) }
    }
    if (ok > 0) { toast.success(`Uploaded ${ok} file(s)`); setSelected([]); setPreviews({}); setNames({}); if (fileRef.current) fileRef.current.value = '' }
  }

  const del = async (name: string) => {
    if (!confirm('Delete this file?')) return
    try { await remove(name); toast.success('Deleted') } catch { toast.error('Delete failed') }
  }

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text)' }}>{title}</h2>
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem', marginTop: 4 }}>{description}</p>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: 'var(--shadow)', marginBottom: '1.5rem' }}>
        <div onDragOver={e=>e.preventDefault()} onDrop={drop} onClick={()=>fileRef.current?.click()}
          style={{ border: `2px dashed ${selected.length?'#1dc48d':'var(--border)'}`, borderRadius: 10, padding: '2.5rem', textAlign: 'center', cursor: 'pointer', background: selected.length?'#f0fdf9':'#fafafa', transition: 'all .2s' }}>
          <input ref={fileRef} type="file" accept={accept} multiple onChange={handleSelect} style={{ display:'none' }} />
          {selected.length > 0 ? (
            <div style={{ color: '#1dc48d' }}>
              <Upload size={32} style={{ margin: '0 auto 8px' }} />
              <p style={{ fontWeight: 700 }}>✓ {selected.length} file(s) selected — click to add more</p>
            </div>
          ) : (
            <div style={{ color: 'var(--muted)' }}>
              <Upload size={40} style={{ margin: '0 auto 12px', opacity: .4 }} />
              <p style={{ fontWeight: 600 }}>Click or drag & drop files here</p>
              <p style={{ fontSize: '0.8rem', marginTop: 4 }}>Accepts: {accept} · Max {maxMB}MB each</p>
            </div>
          )}
        </div>

        {selected.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            {selected.map(f => (
              <div key={f.name} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 12px', border:'1px solid var(--border)', borderRadius:8, marginBottom:8 }}>
                {previews[f.name] && <img src={previews[f.name]} alt="" style={{ width:48, height:48, objectFit:'cover', borderRadius:6, flexShrink:0 }} />}
                <div style={{ flex:1 }}>
                  <input value={names[f.name]||''} onChange={e=>setNames(p=>({...p,[f.name]:e.target.value}))} placeholder="Display name" className="input" style={{ fontSize:'0.8rem', width:'100%' }} />
                  <p style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:2 }}>{f.name} · {fmt(f.size)}</p>
                </div>
                <button onClick={()=>removeFile(f.name)} style={{ background:'none', border:'none', cursor:'pointer', color:'#ef4444', padding:4 }}><X size={16} /></button>
              </div>
            ))}
            <button className="btn btn-primary" onClick={doUpload} disabled={uploading} style={{ width:'100%', marginTop:4 }}>
              {uploading ? 'Uploading…' : `Upload ${selected.length} File(s)`}
            </button>
          </div>
        )}
      </div>

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.75rem' }}>
        <h3 style={{ fontWeight:700, fontSize:'0.95rem' }}>Uploaded Files ({files.length})</h3>
        <button onClick={load} className="btn btn-ghost btn-sm"><RefreshCw size={14} /></button>
      </div>

      {error && <div style={{ color:'#ef4444', background:'#fef2f2', padding:'10px', borderRadius:8, marginBottom:12, fontSize:'0.875rem' }}>{error}</div>}

      {loading ? <div style={{ textAlign:'center', padding:'2rem', color:'var(--muted)' }}>Loading…</div>
      : files.length === 0 ? (
        <div style={{ textAlign:'center', padding:'3rem', border:'2px dashed var(--border)', borderRadius:10, color:'var(--muted)' }}>
          <ImageIcon size={40} style={{ margin:'0 auto 12px', opacity:.3 }} />
          <p>No files uploaded yet</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(155px,1fr))', gap:'1rem' }}>
          {files.map(f => (
            <div key={f.name} style={{ background:'#fff', borderRadius:10, overflow:'hidden', boxShadow:'var(--shadow)', border:'1px solid var(--border)' }}>
              <div style={{ height:105, background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                {f.url.match(/\.(jpg|jpeg|png|webp|gif|svg)/i)
                  ? <img src={f.url} alt={f.displayName} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <FileText size={30} style={{ opacity:.3 }} />}
              </div>
              <div style={{ padding:'8px 10px' }}>
                <p style={{ fontSize:'0.75rem', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }} title={f.displayName}>{f.displayName||f.name}</p>
                <p style={{ fontSize:'0.65rem', color:'var(--muted)', marginTop:2 }}>{fmt(f.size)}</p>
                <div style={{ display:'flex', gap:4, marginTop:8 }}>
                  <a href={f.url} target="_blank" rel="noreferrer" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:5, background:'#eff6ff', color:'#2563eb', borderRadius:4, textDecoration:'none' }}><Eye size={13} /></a>
                  <a href={f.url} download={f.name} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:5, background:'#f0fdf4', color:'#16a34a', borderRadius:4, textDecoration:'none' }}><Download size={13} /></a>
                  <button onClick={()=>del(f.name)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:5, background:'#fef2f2', color:'#dc2626', border:'none', borderRadius:4, cursor:'pointer' }}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── TEMPLATE PANEL ───────────────────────────────────── */
const CATS = ['Certificate','Diploma','Award','Invitation','Brochure','Flyer','Poster','Business Card','Letterhead','Other']

const TemplatePanel: React.FC = () => {
  const { files, loading, uploading, error, load, upload, remove } = useAssets('templates')
  const [view, setView] = useState<'upload'|'manage'>('upload')
  const [selected, setSelected] = useState<File[]>([])
  const [names, setNames] = useState<Record<string,string>>({})
  const [cats, setCats] = useState<Record<string,string>>({})
  const [descs, setDescs] = useState<Record<string,string>>({})
  const [previews, setPreviews] = useState<Record<string,string>>({})
  const [jsonInfos, setJsonInfos] = useState<Record<string,any>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const fmt = (b:number) => { if(!b) return '—'; const k=1024,i=Math.floor(Math.log(b)/Math.log(k)); return `${(b/Math.pow(k,i)).toFixed(1)} ${['B','KB','MB','GB'][i]}` }

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files||[])
    const valid: File[] = []
    for (const f of fs) {
      if (f.size > 10*1024*1024) { toast.error(`${f.name} exceeds 10MB`); continue }
      const okTypes = ['application/json','image/jpeg','image/png','image/webp']
      if (!okTypes.includes(f.type)) { toast.error(`${f.name} unsupported type`); continue }
      if (f.type === 'application/json') {
        try {
          const text = await f.text()
          const json = JSON.parse(text)
          if (!validateJsonTemplate(json)) { toast.error(`${f.name} invalid template structure`); continue }
          setJsonInfos(p=>({...p,[f.name]:json}))
          const prev = extractTemplatePreview(json)
          if (prev) setPreviews(p=>({...p,[f.name]:prev}))
        } catch { toast.error(`${f.name} invalid JSON`); continue }
      } else {
        setPreviews(p=>({...p,[f.name]:URL.createObjectURL(f)}))
      }
      valid.push(f)
      const dn = f.name.replace(/\.[^/.]+$/,'').replace(/[_-]/g,' ').replace(/\b\w/g,l=>l.toUpperCase())
      setNames(p=>({...p,[f.name]:dn}))
      setCats(p=>({...p,[f.name]:'Other'}))
      setDescs(p=>({...p,[f.name]:''}))
    }
    setSelected(p=>[...p,...valid])
  }

  const drop = (e:React.DragEvent) => { e.preventDefault(); handleSelect({target:{files:e.dataTransfer.files}} as any) }

  const removeFile = (n:string) => {
    setSelected(p=>p.filter(f=>f.name!==n))
    setPreviews(p=>{const x={...p};delete x[n];return x})
    setNames(p=>{const x={...p};delete x[n];return x})
    setCats(p=>{const x={...p};delete x[n];return x})
    setDescs(p=>{const x={...p};delete x[n];return x})
    setJsonInfos(p=>{const x={...p};delete x[n];return x})
  }

  const doUpload = async () => {
    const missing = selected.filter(f=>!names[f.name]?.trim()||!cats[f.name])
    if (missing.length) { toast.error('Fill name & category for all files'); return }
    let ok=0
    for (const f of selected) {
      try { await upload(f,{name:names[f.name],category:cats[f.name],description:descs[f.name]}); ok++ }
      catch(e:any){ toast.error(e.message) }
    }
    if (ok>0) {
      toast.success(`Uploaded ${ok} template(s)!`)
      setSelected([]); setPreviews({}); setNames({}); setCats({}); setDescs({}); setJsonInfos({})
      if (fileRef.current) fileRef.current.value=''
      setView('manage')
    }
  }

  const del = async (name:string) => {
    if(!confirm('Delete this template?')) return
    try { await remove(name); toast.success('Deleted') } catch { toast.error('Delete failed') }
  }

  return (
    <div>
      <div style={{ marginBottom:'1.5rem' }}>
        <h2 style={{ fontWeight:800, fontSize:'1.25rem', color:'var(--text)' }}>Template Management</h2>
        <p style={{ color:'var(--muted)', fontSize:'0.875rem', marginTop:4 }}>Upload JSON (Fabric.js) or image templates — stored on the server for users to apply</p>
      </div>

      <div style={{ display:'flex', gap:0, borderBottom:'2px solid var(--border)', marginBottom:'1.5rem' }}>
        {(['upload','manage'] as const).map(t=>(
          <button key={t} onClick={()=>{setView(t);if(t==='manage')load()}}
            style={{ padding:'10px 24px', background:'none', border:'none', borderBottom:view===t?'2px solid var(--brand)':'2px solid transparent', marginBottom:-2, fontWeight:600, fontSize:'0.875rem', color:view===t?'var(--brand)':'var(--muted)', cursor:'pointer' }}>
            {t==='upload'?`Upload New${selected.length?` (${selected.length})`:''}`:`Manage (${files.length})`}
          </button>
        ))}
      </div>

      {view==='upload' ? (
        <div>
          <div style={{ background:'#fff', borderRadius:12, padding:'1.5rem', boxShadow:'var(--shadow)', marginBottom:'1.5rem' }}>
            <div onDragOver={e=>e.preventDefault()} onDrop={drop} onClick={()=>fileRef.current?.click()}
              style={{ border:`2px dashed ${selected.length?'#1dc48d':'var(--border)'}`, borderRadius:10, padding:'3rem', textAlign:'center', cursor:'pointer', background:selected.length?'#f0fdf9':'#fafafa' }}>
              <input ref={fileRef} type="file" accept=".json,.jpg,.jpeg,.png,.webp" multiple onChange={handleSelect} style={{ display:'none' }} />
              {selected.length>0 ? (
                <div style={{ color:'#1dc48d' }}>
                  <Upload size={36} style={{ margin:'0 auto 8px' }} />
                  <p style={{ fontWeight:700, fontSize:'1.05rem' }}>✓ {selected.length} file(s) selected</p>
                  <p style={{ fontSize:'0.8rem', color:'#555', marginTop:4 }}>Click to add more files</p>
                </div>
              ) : (
                <div style={{ color:'var(--muted)' }}>
                  <Upload size={44} style={{ margin:'0 auto 12px', opacity:.35 }} />
                  <p style={{ fontWeight:600, fontSize:'1.05rem' }}>Click to select or drag & drop</p>
                  <p style={{ fontSize:'0.8rem', marginTop:6 }}>Supports: <strong>JSON</strong> (Fabric.js), PNG, JPG, WebP · Max 10MB</p>
                </div>
              )}
            </div>

            {selected.length>0 && (
              <div style={{ marginTop:'1.25rem' }}>
                <h4 style={{ fontWeight:700, fontSize:'0.9rem', marginBottom:'0.75rem' }}>Configure Templates ({selected.length})</h4>
                {selected.map(f=>(
                  <div key={f.name} style={{ border:'1px solid var(--border)', borderRadius:10, padding:'1rem', background:'#fafafa', marginBottom:12 }}>
                    <div style={{ display:'flex', gap:14 }}>
                      <div style={{ width:80, height:80, flexShrink:0, borderRadius:8, border:'1px solid var(--border)', background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                        {previews[f.name]
                          ? <img src={previews[f.name]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : jsonInfos[f.name]
                            ? <div style={{ textAlign:'center', color:'#1dc48d', fontSize:'0.65rem' }}><Code size={22} /><div>Valid JSON</div></div>
                            : <FileText size={22} style={{ opacity:.3 }} />
                        }
                      </div>
                      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:8 }}>
                        <div style={{ display:'flex', justifyContent:'space-between' }}>
                          <div>
                            <p style={{ fontWeight:600, fontSize:'0.8rem' }}>{f.name}</p>
                            <p style={{ fontSize:'0.7rem', color:'var(--muted)' }}>{f.type} · {fmt(f.size)}</p>
                          </div>
                          <button onClick={()=>removeFile(f.name)} style={{ background:'none', border:'none', cursor:'pointer', color:'#dc2626', padding:2 }}><X size={16} /></button>
                        </div>
                        <input className="input" value={names[f.name]||''} onChange={e=>setNames(p=>({...p,[f.name]:e.target.value}))} placeholder="Template name *" style={{ fontSize:'0.8rem' }} />
                        <select className="input" value={cats[f.name]||''} onChange={e=>setCats(p=>({...p,[f.name]:e.target.value}))} style={{ fontSize:'0.8rem' }}>
                          <option value="">Select category *</option>
                          {CATS.map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                        <input className="input" value={descs[f.name]||''} onChange={e=>setDescs(p=>({...p,[f.name]:e.target.value}))} placeholder="Description (optional)" style={{ fontSize:'0.8rem' }} />
                        {jsonInfos[f.name] && (
                          <div style={{ background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:6, padding:'6px 10px', fontSize:'0.7rem', color:'#166534' }}>
                            ✓ Valid JSON · Objects: {jsonInfos[f.name].pages?.[0]?.json?.objects?.length||jsonInfos[f.name].canvasData?.objects?.length||jsonInfos[f.name].objects?.length||0} · Pages: {jsonInfos[f.name].pages?.length||1}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <button className="btn btn-primary" onClick={doUpload} disabled={uploading} style={{ width:'100%', padding:'12px', fontSize:'0.95rem' }}>
                  {uploading ? 'Uploading…' : `Upload ${selected.length} Template(s)`}
                </button>
              </div>
            )}
          </div>

          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10, padding:'1rem 1.25rem' }}>
            <h4 style={{ fontWeight:700, color:'#1e40af', marginBottom:8, fontSize:'0.875rem' }}>Template Guidelines</h4>
            <ul style={{ fontSize:'0.8rem', color:'#1e40af', lineHeight:1.8, margin:0, paddingLeft:'1.25rem' }}>
              <li>JSON templates should follow <strong>Fabric.js canvas format</strong></li>
              <li>Include an <code>objects</code> array and canvas <code>width</code>/<code>height</code></li>
              <li>Multi-page templates use a <code>pages[]</code> array with <code>json</code> per page</li>
              <li>Include <code>projectImageUrl</code> or <code>backgroundImage</code> for thumbnail previews</li>
              <li>Default canvas is A4 (794×1123px) — design templates at this size for best results</li>
            </ul>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1rem' }}>
            <span style={{ fontWeight:600, fontSize:'0.9rem' }}>All Templates ({files.length})</span>
            <button onClick={load} className="btn btn-ghost btn-sm"><RefreshCw size={14} /> Refresh</button>
          </div>
          {error && <div style={{ color:'#ef4444', background:'#fef2f2', padding:'10px', borderRadius:8, marginBottom:12 }}>{error}</div>}
          {loading ? <div style={{ textAlign:'center', padding:'3rem', color:'var(--muted)' }}>Loading templates…</div>
          : files.length===0 ? (
            <div style={{ textAlign:'center', padding:'4rem', border:'2px dashed var(--border)', borderRadius:12, color:'var(--muted)' }}>
              <Layout size={48} style={{ margin:'0 auto 16px', opacity:.25 }} />
              <p style={{ fontWeight:600 }}>No templates yet</p>
              <button className="btn btn-primary btn-sm" style={{ marginTop:12 }} onClick={()=>setView('upload')}>Upload First Template</button>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(205px,1fr))', gap:'1.25rem' }}>
              {files.map(f=>(
                <div key={f.name} style={{ background:'#fff', borderRadius:12, overflow:'hidden', boxShadow:'var(--shadow)', border:'1px solid var(--border)' }}>
                  <div style={{ height:130, background:'#f3f4f6', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', position:'relative' }}>
                    {f.previewUrl
                      ? <img src={f.previewUrl} alt={f.displayName} style={{ width:'100%', height:'100%', objectFit:'cover' }} onError={e=>{(e.target as HTMLImageElement).style.display='none'}} />
                      : f.type==='application/json'
                        ? <div style={{ textAlign:'center', color:'#1dc48d' }}><Code size={32}/><p style={{ fontSize:'0.7rem', marginTop:4 }}>JSON Template</p></div>
                        : <ImageIcon size={32} style={{ opacity:.25 }} />
                    }
                    {f.category && <span style={{ position:'absolute', top:6, left:6, background:'rgba(37,99,235,.85)', color:'#fff', fontSize:'0.65rem', padding:'2px 7px', borderRadius:10, fontWeight:600 }}>{f.category}</span>}
                  </div>
                  <div style={{ padding:'10px 12px' }}>
                    <p style={{ fontWeight:700, fontSize:'0.8rem', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }} title={f.displayName}>{f.displayName||f.name}</p>
                    {f.description&&f.description!=='No description'&&<p style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:2 }}>{f.description}</p>}
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
                      <span style={{ fontSize:'0.65rem', color:'var(--muted)' }}>{f.size?(f.size/1024).toFixed(0)+'KB':'—'}</span>
                      <div style={{ display:'flex', gap:4 }}>
                        <a href={f.url} target="_blank" rel="noreferrer" style={{ padding:'4px 7px', background:'#eff6ff', color:'#2563eb', borderRadius:4, textDecoration:'none', display:'flex', alignItems:'center' }}><Eye size={13}/></a>
                        <a href={f.url} download={f.name} style={{ padding:'4px 7px', background:'#f0fdf4', color:'#16a34a', borderRadius:4, textDecoration:'none', display:'flex', alignItems:'center' }}><Download size={13}/></a>
                        <button onClick={()=>del(f.name)} style={{ padding:'4px 7px', background:'#fef2f2', color:'#dc2626', border:'none', borderRadius:4, cursor:'pointer', display:'flex', alignItems:'center' }}><Trash2 size={13}/></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── MAIN ADMIN ───────────────────────────────────────── */
const Admin: React.FC = () => {
  const [tab, setTab] = useState<Tab>('overview')
  const navigate = useNavigate()
  const { token } = useSelector((s: RootState) => s.auth)

  const nav: {id:Tab;label:string;icon:React.ReactNode}[] = [
    {id:'overview',  label:'Overview',      icon:<Settings size={17}/>},
    {id:'logos',     label:'Logos & Icons', icon:<ImageIcon size={17}/>},
    {id:'backgrounds',label:'Backgrounds',  icon:<ImageIcon size={17}/>},
    {id:'schools',   label:'School Names',  icon:<Users size={17}/>},
    {id:'templates', label:'Templates',     icon:<Layout size={17}/>},
    {id:'elements',  label:'Elements',      icon:<FolderOpen size={17}/>},
  ]

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>
      <aside style={{ width:215, background:'#fff', borderRight:'1px solid var(--border)', flexShrink:0, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'1.25rem 1rem', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <h2 style={{ fontWeight:800, fontSize:'1rem', color:'var(--text)' }}>Admin Panel</h2>
            <p style={{ fontSize:'0.7rem', color:'var(--muted)', marginTop:2 }}>Asset Management</p>
          </div>
          <button onClick={()=>navigate('/dashboard')} style={{ padding:6, background:'#fef2f2', border:'none', borderRadius:6, cursor:'pointer', color:'#dc2626' }} title="Back"><LogOut size={16}/></button>
        </div>
        <nav style={{ padding:'0.5rem', flex:1 }}>
          {nav.map(item=>(
            <button key={item.id} onClick={()=>setTab(item.id)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:8, border:'none', cursor:'pointer', background:tab===item.id?'var(--brand-light)':'transparent', color:tab===item.id?'var(--brand)':'var(--text)', fontWeight:tab===item.id?700:500, fontSize:'0.875rem', textAlign:'left', marginBottom:2, transition:'all .15s' }}
              onMouseEnter={e=>{if(tab!==item.id)(e.currentTarget as HTMLElement).style.background='var(--bg)'}}
              onMouseLeave={e=>{if(tab!==item.id)(e.currentTarget as HTMLElement).style.background='transparent'}}
            >
              {item.icon}{item.label}
            </button>
          ))}
        </nav>
        <div style={{ padding:'1rem', borderTop:'1px solid var(--border)' }}>
          <button onClick={()=>navigate('/dashboard')} className="btn btn-ghost btn-sm" style={{ width:'100%' }}>
            <ArrowLeft size={14}/> Back to App
          </button>
        </div>
      </aside>

      <main style={{ flex:1, padding:'2rem', overflowY:'auto' }}>
        {tab==='overview'     && <Overview token={token}/>}
        {tab==='logos'        && <ImagePanel bucket="logos"       title="Logos & Icons"      description="Upload school logos, crests, and icon assets used in templates"                   accept=".jpg,.jpeg,.png,.webp,.svg" maxMB={5}  />}
        {tab==='backgrounds'  && <ImagePanel bucket="backgrounds" title="Background Images"   description="Upload background images for templates — high resolution recommended"           accept=".jpg,.jpeg,.png,.webp"      maxMB={10} />}
        {tab==='schools'      && <ImagePanel bucket="schools"     title="School Name Graphics" description="Upload school-specific logos and name graphics for certificate designs"         accept=".jpg,.jpeg,.png,.webp,.svg" maxMB={5}  />}
        {tab==='templates'    && <TemplatePanel/>}
        {tab==='elements'     && <ImagePanel bucket="elements"    title="Design Elements"     description="Upload borders, seals, stamps, and decorative assets for use in the editor"    accept=".jpg,.jpeg,.png,.webp,.svg,.gif" maxMB={5} />}
      </main>
    </div>
  )
}

export default Admin
