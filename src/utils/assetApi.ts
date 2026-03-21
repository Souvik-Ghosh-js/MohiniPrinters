const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

// Strip any trailing slash so URL joins are clean
const BASE = API.replace(/\/$/, '')

export type AssetCategory = 'logos' | 'backgrounds' | 'schools' | 'templates' | 'elements'

export interface AssetFile {
  name: string
  url: string
  displayName: string
  category?: string
  description?: string
  size: number
  type: string
  createdAt: string
  jsonData?: any
  previewUrl?: string
}

// Rebuild the file URL using VITE_API_URL as the base so it always
// uses the correct protocol (https in prod), regardless of what the
// backend returns. The backend constructs URLs with req.protocol which
// is 'http' when sitting behind an SSL-terminating proxy.
const rebuildUrl = (bucket: AssetCategory, filename: string): string =>
  `${BASE}/uploads/${bucket}/${encodeURIComponent(filename)}`

export const fetchAssets = async (bucket: AssetCategory, token?: string): Promise<AssetFile[]> => {
  const headers: Record<string,string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/api/assets/${bucket}`, { headers })
  if (!res.ok) throw new Error(`Failed to fetch ${bucket}`)
  const data = await res.json()
  // Override the URL from the server with one built from VITE_API_URL
  const files = (data.files as AssetFile[]).map(f => ({
    ...f,
    url: rebuildUrl(bucket, f.name),
  }))
  return files
}

export const uploadAsset = async (
  bucket: AssetCategory, file: File,
  meta: { name?: string; category?: string; description?: string },
  token?: string
): Promise<AssetFile> => {
  const headers: Record<string,string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const fd = new FormData()
  fd.append('file', file)
  if (meta.name) fd.append('displayName', meta.name)
  if (meta.category) fd.append('category', meta.category)
  if (meta.description) fd.append('description', meta.description)
  const res = await fetch(`${BASE}/api/assets/${bucket}`, { method:'POST', headers, body:fd })
  if (!res.ok) { const err = await res.json().catch(()=>({message:'Upload failed'})); throw new Error(err.message||'Upload failed') }
  const data = await res.json()
  const f = data.file as AssetFile
  return { ...f, url: rebuildUrl(bucket, f.name) }
}

export const deleteAsset = async (bucket: AssetCategory, fileName: string, token?: string): Promise<void> => {
  const headers: Record<string,string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE}/api/assets/${bucket}/${encodeURIComponent(fileName)}`, { method:'DELETE', headers })
  if (!res.ok) throw new Error('Delete failed')
}

// Kept for backwards-compat; no longer needed but harmless
export const fixProtocol = (url: string): string => {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return url.replace(/^http:\/\//i, 'https://')
  }
  return url
}

export const loadJsonTemplate = async (url: string): Promise<any> => {
  try { const res = await fetch(url); if (!res.ok) return null; return await res.json() }
  catch { return null }
}

export const validateJsonTemplate = (j: any): boolean => {
  if (!j) return false
  if (Array.isArray(j.objects) || j.background || j.backgroundImage) return true
  if (j.canvasData && (Array.isArray(j.canvasData.objects) || j.canvasData.background)) return true
  if (j.pages && Array.isArray(j.pages) && j.pages.length > 0 && j.pages[0].json) return true
  return false
}

export const extractTemplatePreview = (j: any): string | null => {
  if (!j) return null
  if (j.projectImageUrl) return j.projectImageUrl
  if (j.pageImageUrl) return j.pageImageUrl
  if (j.backgroundImage) return j.backgroundImage
  if (j.canvasData?.backgroundImage) return j.canvasData.backgroundImage
  if (j.pages?.[0]?.json?.backgroundImage) return j.pages[0].json.backgroundImage
  return null
}

export const extractTemplateMetadata = (fileName: string) => {
  const withoutExt = fileName.replace(/\.[^/.]+$/, '')
  const parts = withoutExt.split('_')
  return {
    category: parts[0] || 'Other',
    name: parts[1] ? parts[1].replace(/-/g,' ') : withoutExt.replace(/[_-]/g,' '),
    description: parts[2] ? parts[2].replace(/-/g,' ') : '',
  }
}
