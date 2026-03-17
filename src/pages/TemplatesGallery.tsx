import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Upload, Search, Layout, Code, Image as ImageIcon,
  Eye, Download, RefreshCw, Filter, X
} from 'lucide-react'
import { useAssets } from '../hooks/useAssets'
import { AssetFile, validateJsonTemplate, extractTemplatePreview } from '../utils/assetApi'
import toast from 'react-hot-toast'

const CATS = ['All','Certificate','Diploma','Award','Invitation','Brochure','Flyer','Poster','Business Card','Letterhead','Other']

const TemplatesGallery: React.FC = () => {
  const navigate = useNavigate()
  const { files, loading, error, load } = useAssets('templates')
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('All')
  const [showUpload, setShowUpload] = useState(false)

  const filtered = files.filter(f => {
    const matchCat = cat === 'All' || f.category === cat
    const matchSearch = !search || f.displayName?.toLowerCase().includes(search.toLowerCase()) || f.category?.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid var(--border)', padding: '0 2rem', height: 60, display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 100 }}>
        <button className="btn btn-ghost btn-icon" onClick={() => navigate('/dashboard')}><ArrowLeft size={18}/></button>
        <h1 style={{ fontWeight: 800, fontSize: '1.1rem' }}>Template Gallery</h1>
        <div style={{ flex: 1 }}/>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowUpload(v => !v)}>
          <Upload size={14}/> Upload Template
        </button>
        <button onClick={load} className="btn btn-ghost btn-sm"><RefreshCw size={14}/></button>
      </header>

      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem' }}>

        {/* Upload panel (collapsible) */}
        {showUpload && (
          <UploadPanel onClose={() => setShowUpload(false)} onUploaded={() => { setShowUpload(false); load() }} />
        )}

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: 340 }}>
            <Search size={15} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}/>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search templates…"
              className="input"
              style={{ paddingLeft: 32, width: '100%' }}
            />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}><X size={14}/></button>}
          </div>

          {/* Category filter */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Filter size={15} style={{ color: 'var(--muted)', alignSelf: 'center' }}/>
            {CATS.map(c => (
              <button key={c} onClick={() => setCat(c)}
                style={{ padding: '5px 12px', borderRadius: 20, border: '1px solid var(--border)', background: cat===c?'var(--brand)':'#fff', color: cat===c?'#fff':'var(--text)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: cat===c?700:400, transition: 'all .15s' }}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        {error && <div style={{ color: '#ef4444', background: '#fef2f2', padding: '10px 14px', borderRadius: 8, marginBottom: 16 }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
            Loading templates…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '5rem', color: 'var(--muted)' }}>
            <Layout size={56} style={{ margin: '0 auto 1rem', opacity: .25 }}/>
            <p style={{ fontWeight: 600, fontSize: '1.1rem' }}>
              {files.length === 0 ? 'No templates uploaded yet' : 'No templates match your filter'}
            </p>
            <p style={{ fontSize: '0.875rem', marginTop: 6 }}>
              {files.length === 0
                ? 'Upload your first template using the button above, or ask your admin to upload templates'
                : 'Try clearing the search or changing the category filter'
              }
            </p>
            {files.length === 0 && (
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowUpload(true)}>
                <Upload size={14}/> Upload Template
              </button>
            )}
          </div>
        ) : (
          <>
            <p style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '1rem' }}>{filtered.length} template{filtered.length !== 1 ? 's' : ''} found</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.25rem' }}>
              {filtered.map(f => <TemplateCard key={f.name} template={f} onUse={() => navigate('/dashboard')} />)}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

/* ─── TEMPLATE CARD ─────────────────────────────────────── */
const TemplateCard: React.FC<{ template: AssetFile; onUse: () => void }> = ({ template: t, onUse }) => {
  const [hovered, setHovered] = useState(false)
  const fmt = (b: number) => b ? `${(b/1024).toFixed(0)} KB` : '—'

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: hovered ? '0 8px 28px rgba(0,0,0,0.12)' : 'var(--shadow)', border: '1px solid var(--border)', transition: 'all .2s', transform: hovered ? 'translateY(-3px)' : '' }}>

      {/* Preview thumbnail */}
      <div style={{ height: 155, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
        {t.previewUrl ? (
          <img src={t.previewUrl} alt={t.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}/>
        ) : t.type === 'application/json' ? (
          <div style={{ textAlign: 'center', color: '#1dc48d' }}>
            <Code size={36}/>
            <p style={{ fontSize: '0.75rem', marginTop: 6, fontWeight: 600 }}>JSON Template</p>
            {t.jsonData?.objects?.length > 0 && (
              <p style={{ fontSize: '0.65rem', color: '#555', marginTop: 2 }}>{t.jsonData.objects.length} elements</p>
            )}
          </div>
        ) : (
          <ImageIcon size={36} style={{ opacity: .25 }}/>
        )}

        {/* Category badge */}
        {t.category && (
          <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(37,99,235,.88)', color: '#fff', fontSize: '0.65rem', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
            {t.category}
          </span>
        )}

        {/* JSON badge */}
        {(t.type === 'application/json' || t.name.endsWith('.json')) && (
          <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(22,163,74,.88)', color: '#fff', fontSize: '0.6rem', padding: '2px 7px', borderRadius: 10, fontWeight: 700 }}>
            JSON
          </span>
        )}

        {/* Hover overlay with Use button */}
        {hovered && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '8px 20px', fontSize: '0.85rem' }}
              onClick={onUse}
            >
              Use Template
            </button>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 14px' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }} title={t.displayName}>
          {t.displayName || t.name}
        </h3>
        {t.description && t.description !== 'No description' && (
          <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {t.description}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)' }}>{fmt(t.size)}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <a href={t.url} target="_blank" rel="noreferrer" style={{ padding: '4px 7px', background: '#eff6ff', color: '#2563eb', borderRadius: 5, textDecoration: 'none', display: 'flex', alignItems: 'center' }} title="Preview"><Eye size={13}/></a>
            <a href={t.url} download={t.name} style={{ padding: '4px 7px', background: '#f0fdf4', color: '#16a34a', borderRadius: 5, textDecoration: 'none', display: 'flex', alignItems: 'center' }} title="Download JSON"><Download size={13}/></a>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── UPLOAD PANEL ──────────────────────────────────────── */
const UploadPanel: React.FC<{ onClose: () => void; onUploaded: () => void }> = ({ onClose, onUploaded }) => {
  const { upload, uploading } = useAssets('templates')
  const [files, setFiles] = useState<File[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [cats, setCats] = useState<Record<string, string>>({})
  const [descs, setDescs] = useState<Record<string, string>>({})
  const [previews, setPreviews] = useState<Record<string, string>>({})
  const [jsonInfos, setJsonInfos] = useState<Record<string, any>>({})
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fs = Array.from(e.target.files || [])
    const valid: File[] = []
    for (const f of fs) {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} exceeds 10MB`); continue }
      const okTypes = ['application/json', 'image/jpeg', 'image/png', 'image/webp']
      if (!okTypes.includes(f.type)) { toast.error(`${f.name}: unsupported type`); continue }
      if (f.type === 'application/json') {
        try {
          const text = await f.text()
          const json = JSON.parse(text)
          if (!validateJsonTemplate(json)) { toast.error(`${f.name}: invalid template structure`); continue }
          setJsonInfos(p => ({ ...p, [f.name]: json }))
          const prev = extractTemplatePreview(json)
          if (prev) setPreviews(p => ({ ...p, [f.name]: prev }))
        } catch { toast.error(`${f.name}: invalid JSON`); continue }
      } else {
        setPreviews(p => ({ ...p, [f.name]: URL.createObjectURL(f) }))
      }
      valid.push(f)
      const dn = f.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
      setNames(p => ({ ...p, [f.name]: dn }))
      setCats(p => ({ ...p, [f.name]: 'Other' }))
      setDescs(p => ({ ...p, [f.name]: '' }))
    }
    setFiles(p => [...p, ...valid])
  }

  const remove = (n: string) => {
    setFiles(p => p.filter(f => f.name !== n))
    setPreviews(p => { const x = { ...p }; delete x[n]; return x })
    setNames(p => { const x = { ...p }; delete x[n]; return x })
    setCats(p => { const x = { ...p }; delete x[n]; return x })
    setDescs(p => { const x = { ...p }; delete x[n]; return x })
    setJsonInfos(p => { const x = { ...p }; delete x[n]; return x })
  }

  const doUpload = async () => {
    if (!files.length) return
    const missing = files.filter(f => !names[f.name]?.trim() || !cats[f.name])
    if (missing.length) { toast.error('Please fill name and category for all files'); return }
    let ok = 0
    for (const f of files) {
      try { await upload(f, { name: names[f.name], category: cats[f.name], description: descs[f.name] }); ok++ }
      catch (e: any) { toast.error(e.message) }
    }
    if (ok > 0) { toast.success(`Uploaded ${ok} template(s)!`); onUploaded() }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '1.5rem', boxShadow: 'var(--shadow)', marginBottom: '2rem', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>Upload New Template</h3>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4 }}><X size={18}/></button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleSelect({ target: { files: e.dataTransfer.files } } as any) }}
        onClick={() => fileRef.current?.click()}
        style={{ border: `2px dashed ${files.length ? '#1dc48d' : 'var(--border)'}`, borderRadius: 10, padding: '2rem', textAlign: 'center', cursor: 'pointer', background: files.length ? '#f0fdf9' : '#fafafa', marginBottom: '1rem' }}>
        <input ref={fileRef} type="file" accept=".json,.jpg,.jpeg,.png,.webp" multiple onChange={handleSelect} style={{ display: 'none' }}/>
        {files.length > 0 ? (
          <div style={{ color: '#1dc48d' }}>
            <Upload size={30} style={{ margin: '0 auto 8px' }}/>
            <p style={{ fontWeight: 700 }}>✓ {files.length} file(s) selected — click to add more</p>
          </div>
        ) : (
          <div style={{ color: 'var(--muted)' }}>
            <Upload size={36} style={{ margin: '0 auto 10px', opacity: .35 }}/>
            <p style={{ fontWeight: 600 }}>Click or drag & drop templates here</p>
            <p style={{ fontSize: '0.8rem', marginTop: 4 }}>JSON (Fabric.js), PNG, JPG, WebP · Max 10MB each</p>
          </div>
        )}
      </div>

      {/* File list */}
      {files.map(f => (
        <div key={f.name} style={{ display: 'flex', gap: 14, padding: '12px', border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, background: '#fafafa' }}>
          <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 7, border: '1px solid var(--border)', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {previews[f.name]
              ? <img src={previews[f.name]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
              : jsonInfos[f.name]
                ? <div style={{ textAlign: 'center', color: '#1dc48d', fontSize: '0.6rem' }}><Code size={20}/><div>JSON</div></div>
                : <Code size={20} style={{ opacity: .3 }}/>
            }
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <p style={{ fontSize: '0.8rem', fontWeight: 600 }}>{f.name}</p>
              <button onClick={() => remove(f.name)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}><X size={15}/></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
              <input className="input" value={names[f.name] || ''} onChange={e => setNames(p => ({ ...p, [f.name]: e.target.value }))} placeholder="Template name *" style={{ fontSize: '0.8rem' }}/>
              <select className="input" value={cats[f.name] || ''} onChange={e => setCats(p => ({ ...p, [f.name]: e.target.value }))} style={{ fontSize: '0.8rem' }}>
                <option value="">Category *</option>
                {CATS.slice(1).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <input className="input" value={descs[f.name] || ''} onChange={e => setDescs(p => ({ ...p, [f.name]: e.target.value }))} placeholder="Description (optional)" style={{ fontSize: '0.8rem' }}/>
            {jsonInfos[f.name] && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 10px', fontSize: '0.7rem', color: '#166534' }}>
                ✓ Valid JSON · {jsonInfos[f.name].pages?.length || 1} page(s) · {jsonInfos[f.name].pages?.[0]?.json?.objects?.length || jsonInfos[f.name].canvasData?.objects?.length || jsonInfos[f.name].objects?.length || 0} objects
              </div>
            )}
          </div>
        </div>
      ))}

      {files.length > 0 && (
        <button className="btn btn-primary" onClick={doUpload} disabled={uploading} style={{ width: '100%', padding: '12px', fontSize: '0.95rem', marginTop: 4 }}>
          {uploading ? 'Uploading…' : `Upload ${files.length} Template(s)`}
        </button>
      )}
    </div>
  )
}

export default TemplatesGallery
