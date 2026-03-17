import { useState, useEffect, useCallback } from 'react'
import { useSelector } from 'react-redux'
import { RootState } from '../store'
import {
  fetchAssets, uploadAsset, deleteAsset,
  AssetCategory, AssetFile,
  loadJsonTemplate, extractTemplatePreview, extractTemplateMetadata
} from '../utils/assetApi'

export const useAssets = (bucket: AssetCategory) => {
  const [files, setFiles] = useState<AssetFile[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const { token } = useSelector((s: RootState) => s.auth)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      let assets = await fetchAssets(bucket, token ?? undefined)
      if (bucket === 'templates') {
        assets = await Promise.all(assets.map(async a => {
          if (a.type === 'application/json' || a.name.endsWith('.json')) {
            const jsonData = await loadJsonTemplate(a.url)
            if (jsonData) {
              const meta = extractTemplateMetadata(a.name)
              return { ...a, jsonData, previewUrl: extractTemplatePreview(jsonData) || undefined, displayName: a.displayName || meta.name, category: a.category || meta.category }
            }
          }
          return a
        }))
      }
      setFiles(assets)
    } catch(e:any) { setError(e.message||'Failed to load') }
    finally { setLoading(false) }
  }, [bucket, token])

  useEffect(() => { load() }, [load])

  const upload = useCallback(async (file: File, meta: { name?:string; category?:string; description?:string } = {}) => {
    setUploading(true); setError('')
    try {
      const asset = await uploadAsset(bucket, file, meta, token ?? undefined)
      setFiles(p => [...p, asset])
      return asset
    } catch(e:any) { setError(e.message||'Upload failed'); throw e }
    finally { setUploading(false) }
  }, [bucket, token])

  const remove = useCallback(async (fileName: string) => {
    try { await deleteAsset(bucket, fileName, token ?? undefined); setFiles(p => p.filter(f => f.name !== fileName)) }
    catch(e:any) { setError(e.message||'Delete failed'); throw e }
  }, [bucket, token])

  return { files, loading, uploading, error, load, upload, remove }
}
