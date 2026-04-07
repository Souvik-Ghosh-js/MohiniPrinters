import api from './api'

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

// Rebuild the file URL based on API base for consistency
const rebuildUrl = (bucket: AssetCategory, filename: string): string =>
  `/uploads/${bucket}/${encodeURIComponent(filename)}`

export const fetchAssets = async (bucket: AssetCategory): Promise<AssetFile[]> => {
  const res = await api.get(`/api/assets/${bucket}`)
  const data = res.data
  // Override the URL from the server with one built for consistency
  const files = (data.files as AssetFile[]).map(f => ({
    ...f,
    url: `${api.defaults.baseURL}${rebuildUrl(bucket, f.name)}`,
  }))
  return files
}

export const uploadAsset = async (
  bucket: AssetCategory, file: File,
  meta: { name?: string; category?: string; description?: string }
): Promise<AssetFile> => {
  const fd = new FormData()
  fd.append('file', file)
  if (meta.name) fd.append('displayName', meta.name)
  if (meta.category) fd.append('category', meta.category)
  if (meta.description) fd.append('description', meta.description)
  
  const res = await api.post(`/api/assets/${bucket}`, fd)
  const data = res.data
  const f = data.file as AssetFile
  return { ...f, url: `${api.defaults.baseURL}${rebuildUrl(bucket, f.name)}` }
}

export const deleteAsset = async (bucket: AssetCategory, fileName: string): Promise<void> => {
  await api.delete(`/api/assets/${bucket}/${encodeURIComponent(fileName)}`)
}

// Kept for backwards-compat; no longer needed but harmless
export const fixProtocol = (url: string): string => {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return url.replace(/^http:\/\//i, 'https://')
  }
  return url
}

export const loadJsonTemplate = async (url: string): Promise<any> => {
  try { 
    // For external URLs we still use fetch or a clean axios call
    const res = await fetch(url); 
    if (!res.ok) return null; 
    return await res.json() 
  }
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
  // Native format: background image
  if (j._format === 'mohini-design-hub' || Array.isArray(j.elements)) {
    if (j.background?.type === 'image' && j.background?.image?.src) return j.background.image.src
    return null
  }
  // Fabric.js format
  const bi = j.backgroundImage || j.canvasData?.backgroundImage || j.pages?.[0]?.json?.backgroundImage
  if (bi) return typeof bi === 'string' ? bi : (bi.src || null)
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
