import React from 'react'
import { Trash2, Copy, Lock, Unlock, Eye, EyeOff, ChevronUp, ChevronDown } from 'lucide-react'
import { CanvasElement } from '../../types/canvas'

interface Props {
  element: CanvasElement
  onUpdate: (updates: Partial<CanvasElement>) => void
  onDelete: () => void
  onDuplicate: () => void
  onLock: () => void
  onToggleVisibility: () => void
  onBringForward: () => void
  onSendBackward: () => void
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="panel-section">
    <div className="panel-title">{title}</div>
    {children}
  </div>
)

const Row2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>{children}</div>
)

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="label">{label}</label>
    {children}
  </div>
)

const SliderField: React.FC<{ label: string; value: number; min: number; max: number; onChange: (v: number) => void; unit?: string }> = ({ label, value, min, max, onChange, unit = '' }) => (
  <div style={{ marginBottom: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
      <label className="label" style={{ marginBottom: 0 }}>{label}</label>
      <span style={{ fontSize: '0.75rem', color: 'var(--brand)', fontWeight: 600 }}>{Math.round(value)}{unit}</span>
    </div>
    <input type="range" className="range-input" min={min} max={max} value={value} onChange={e => onChange(+e.target.value)} />
  </div>
)

const PropertiesPanelEnhanced: React.FC<Props> = ({ element, onUpdate, onDelete, onDuplicate, onLock, onToggleVisibility, onBringForward, onSendBackward }) => {
  const p = element.properties

  const up = (key: string, val: any) => onUpdate({ properties: { ...p, [key]: val } })
  const upNested = (parent: string, key: string, val: any) => onUpdate({ properties: { ...p, [parent]: { ...(p as any)[parent], [key]: val } } })

  const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 8px', border: '1px solid var(--border)', borderRadius: 6, fontSize: '0.8125rem', background: '#fff', color: 'var(--text)' }

  return (
    <div style={{ overflowY: 'auto', height: '100%' }}>
      {/* Actions */}
      <div className="panel-section" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost btn-icon btn-sm" title="Duplicate" onClick={onDuplicate}><Copy size={14} /></button>
        <button className="btn btn-ghost btn-icon btn-sm" title={element.locked ? 'Unlock' : 'Lock'} onClick={onLock}>{element.locked ? <Lock size={14} /> : <Unlock size={14} />}</button>
        <button className="btn btn-ghost btn-icon btn-sm" title={element.visible === false ? 'Show' : 'Hide'} onClick={onToggleVisibility}>{element.visible === false ? <EyeOff size={14} /> : <Eye size={14} />}</button>
        <button className="btn btn-ghost btn-icon btn-sm" title="Bring Forward" onClick={onBringForward}><ChevronUp size={14} /></button>
        <button className="btn btn-ghost btn-icon btn-sm" title="Send Backward" onClick={onSendBackward}><ChevronDown size={14} /></button>
        <button className="btn btn-danger btn-icon btn-sm" title="Delete" onClick={onDelete} style={{ marginLeft: 'auto' }}><Trash2 size={14} /></button>
      </div>

      {/* Position & Size */}
      <Section title="Position & Size">
        <Row2>
          <Field label="X"><input style={inputStyle} type="number" value={Math.round(element.x)} onChange={e => onUpdate({ x: +e.target.value })} /></Field>
          <Field label="Y"><input style={inputStyle} type="number" value={Math.round(element.y)} onChange={e => onUpdate({ y: +e.target.value })} /></Field>
          <Field label="Width"><input style={inputStyle} type="number" value={Math.round(element.width)} onChange={e => onUpdate({ width: Math.max(1, +e.target.value) })} /></Field>
          <Field label="Height"><input style={inputStyle} type="number" value={Math.round(element.height)} onChange={e => onUpdate({ height: Math.max(1, +e.target.value) })} /></Field>
        </Row2>
        <div style={{ marginTop: 8 }}>
          <SliderField label="Rotation" value={element.rotation} min={0} max={360} onChange={v => onUpdate({ rotation: v })} unit="°" />
          <SliderField label="Opacity" value={element.opacity} min={0} max={100} onChange={v => onUpdate({ opacity: v })} unit="%" />
        </div>
      </Section>

      {/* ═══ TEXT PROPERTIES ═══ */}
      {element.type === 'text' && <>
        <Section title="Text Content">
          <textarea value={p.text || ''} onChange={e => up('text', e.target.value)} style={{ ...inputStyle, minHeight: 64, resize: 'vertical', fontFamily: p.fontFamily || 'Arial' }} />
        </Section>

        <Section title="Typography">
          <Field label="Font Family">
            <select style={inputStyle} value={p.fontFamily || 'Arial'} onChange={e => up('fontFamily', e.target.value)}>
              {['Arial', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Trebuchet MS', 'Impact', 'Comic Sans MS', 'Palatino', 'Garamond', 'Bookman', 'Tahoma', 'Helvetica', 'Futura'].map(f => <option key={f}>{f}</option>)}
            </select>
          </Field>
          <div style={{ marginTop: 8 }} />
          <Row2>
            <Field label="Size">
              <input style={inputStyle} type="number" value={p.fontSize || 24} onChange={e => up('fontSize', +e.target.value)} />
            </Field>
            <Field label="Weight">
              <select style={inputStyle} value={p.fontWeight || '400'} onChange={e => up('fontWeight', e.target.value)}>
                <option value="300">Light</option>
                <option value="400">Normal</option>
                <option value="500">Medium</option>
                <option value="600">Semi Bold</option>
                <option value="700">Bold</option>
                <option value="800">Extra Bold</option>
                <option value="900">Black</option>
              </select>
            </Field>
            <Field label="Style">
              <select style={inputStyle} value={p.fontStyle || 'normal'} onChange={e => up('fontStyle', e.target.value)}>
                <option value="normal">Normal</option>
                <option value="italic">Italic</option>
              </select>
            </Field>
            <Field label="Transform">
              <select style={inputStyle} value={p.textTransform || 'none'} onChange={e => up('textTransform', e.target.value)}>
                <option value="none">None</option>
                <option value="uppercase">Uppercase</option>
                <option value="lowercase">Lowercase</option>
                <option value="capitalize">Capitalize</option>
              </select>
            </Field>
          </Row2>
          <div style={{ marginTop: 8 }}>
            <SliderField label="Line Height" value={+(p.lineHeight || 1.4)} min={0.5} max={4} onChange={v => up('lineHeight', v)} />
            <SliderField label="Letter Spacing" value={p.letterSpacing || 0} min={-10} max={50} onChange={v => up('letterSpacing', v)} unit="px" />
          </div>
        </Section>

        <Section title="Text Alignment">
          <div style={{ display: 'flex', gap: 6 }}>
            {(['left', 'center', 'right', 'justify'] as const).map(a => (
              <button key={a} className={`toolbar-btn${p.textAlign === a ? ' active' : ''}`} onClick={() => up('textAlign', a)} title={a}>
                {a === 'left' ? '⫸' : a === 'center' ? '≡' : a === 'right' ? '⫷' : '☰'}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Color & Fill">
          <Field label="Text Color">
            <input type="color" value={p.fill || '#000000'} onChange={e => up('fill', e.target.value)} style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
          </Field>
        </Section>

        <Section title="Text Curve">
          <Field label="Effect">
            <select style={inputStyle} value={p.textCurve || 'none'} onChange={e => up('textCurve', e.target.value)}>
              <option value="none">None</option>
              <option value="arc">Arc</option>
              <option value="wave">Wave</option>
            </select>
          </Field>
          {p.textCurve && p.textCurve !== 'none' && (
            <div style={{ marginTop: 8 }}>
              <SliderField label="Curve Amount" value={p.curveAmount || 50} min={1} max={200} onChange={v => up('curveAmount', v)} />
            </div>
          )}
        </Section>

        <Section title="Shadow">
          <Row2>
            <Field label="Blur">
              <input style={inputStyle} type="number" value={p.shadow?.blur || 0} onChange={e => upNested('shadow', 'blur', +e.target.value)} />
            </Field>
            <Field label="Color">
              <input type="color" value={p.shadow?.color || '#000000'} onChange={e => upNested('shadow', 'color', e.target.value)} style={{ width: '100%', height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
            </Field>
            <Field label="Offset X">
              <input style={inputStyle} type="number" value={p.shadow?.offsetX || 0} onChange={e => upNested('shadow', 'offsetX', +e.target.value)} />
            </Field>
            <Field label="Offset Y">
              <input style={inputStyle} type="number" value={p.shadow?.offsetY || 0} onChange={e => upNested('shadow', 'offsetY', +e.target.value)} />
            </Field>
          </Row2>
        </Section>

        <Section title="Stroke / Outline">
          <Row2>
            <Field label="Width">
              <input style={inputStyle} type="number" value={p.stroke?.width || 0} onChange={e => upNested('stroke', 'width', +e.target.value)} />
            </Field>
            <Field label="Color">
              <input type="color" value={p.stroke?.color || '#000000'} onChange={e => upNested('stroke', 'color', e.target.value)} style={{ width: '100%', height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
            </Field>
          </Row2>
        </Section>

        <Section title="Gradient Text">
          <Field label="Type">
            <select style={inputStyle} value={p.gradient?.type || 'none'} onChange={e => {
              if (e.target.value === 'none') up('gradient', undefined)
              else up('gradient', { type: e.target.value, angle: 90, colors: ['#1dc48d', '#2563eb'] })
            }}>
              <option value="none">None</option>
              <option value="linear">Linear</option>
            </select>
          </Field>
          {p.gradient && <>
            <div style={{ marginTop: 8 }}>
              <SliderField label="Angle" value={p.gradient.angle || 90} min={0} max={360} onChange={v => upNested('gradient', 'angle', v)} unit="°" />
            </div>
            <Row2>
              <Field label="Color 1">
                <input type="color" value={p.gradient.colors?.[0] || '#1dc48d'} onChange={e => { const c = [...(p.gradient?.colors || [])]; c[0] = e.target.value; up('gradient', { ...p.gradient, colors: c }) }} style={{ width: '100%', height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              </Field>
              <Field label="Color 2">
                <input type="color" value={p.gradient.colors?.[1] || '#2563eb'} onChange={e => { const c = [...(p.gradient?.colors || [])]; c[1] = e.target.value; up('gradient', { ...p.gradient, colors: c }) }} style={{ width: '100%', height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              </Field>
            </Row2>
          </>}
        </Section>
      </>}

      {/* ═══ IMAGE PROPERTIES ═══ */}
      {element.type === 'image' && <>
        <Section title="Image Source">
          <Field label="URL">
            <input style={inputStyle} value={p.src || ''} onChange={e => up('src', e.target.value)} placeholder="https://..." />
          </Field>
          <div style={{ marginTop: 8 }}>
            <Field label="Object Fit">
              <select style={inputStyle} value={p.objectFit || 'cover'} onChange={e => up('objectFit', e.target.value)}>
                <option value="cover">Cover</option>
                <option value="contain">Contain</option>
                <option value="fill">Fill</option>
              </select>
            </Field>
          </div>
        </Section>
        <Section title="Filters">
          <SliderField label="Brightness" value={p.brightness ?? 100} min={0} max={200} onChange={v => up('brightness', v)} unit="%" />
          <SliderField label="Contrast" value={p.contrast ?? 100} min={0} max={200} onChange={v => up('contrast', v)} unit="%" />
          <SliderField label="Saturation" value={p.saturation ?? 100} min={0} max={200} onChange={v => up('saturation', v)} unit="%" />
          <SliderField label="Hue Rotate" value={p.hueRotate ?? 0} min={0} max={360} onChange={v => up('hueRotate', v)} unit="°" />
          <SliderField label="Blur" value={p.blur ?? 0} min={0} max={20} onChange={v => up('blur', v)} unit="px" />
          <SliderField label="Grayscale" value={p.grayscale ?? 0} min={0} max={100} onChange={v => up('grayscale', v)} unit="%" />
          <SliderField label="Sepia" value={p.sepia ?? 0} min={0} max={100} onChange={v => up('sepia', v)} unit="%" />
        </Section>
        <Section title="Border">
          <Row2>
            <Field label="Radius">
              <input style={inputStyle} type="number" value={p.borderRadius || 0} onChange={e => up('borderRadius', +e.target.value)} />
            </Field>
            <Field label="Width">
              <input style={inputStyle} type="number" value={p.borderWidth || 0} onChange={e => up('borderWidth', +e.target.value)} />
            </Field>
          </Row2>
          {(p.borderWidth || 0) > 0 && (
            <div style={{ marginTop: 8 }}>
              <Field label="Border Color">
                <input type="color" value={p.borderColor || '#000000'} onChange={e => up('borderColor', e.target.value)} style={{ width: '100%', height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
              </Field>
            </div>
          )}
        </Section>
      </>}

      {/* ═══ SHAPE PROPERTIES ═══ */}
      {element.type === 'shape' && <>
        <Section title="Fill">
          <Field label="Color">
            <input type="color" value={p.fill || '#1dc48d'} onChange={e => up('fill', e.target.value)} style={{ width: '100%', height: 36, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
          </Field>
          <div style={{ marginTop: 8 }}>
            <SliderField label="Border Radius" value={p.borderRadius || 0} min={0} max={500} onChange={v => up('borderRadius', v)} unit="px" />
          </div>
        </Section>
        <Section title="Stroke">
          <Row2>
            <Field label="Width">
              <input style={inputStyle} type="number" value={p.stroke?.width || 0} onChange={e => upNested('stroke', 'width', +e.target.value)} />
            </Field>
            <Field label="Color">
              <input type="color" value={p.stroke?.color || '#000000'} onChange={e => upNested('stroke', 'color', e.target.value)} style={{ width: '100%', height: 34, border: '1px solid var(--border)', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
            </Field>
          </Row2>
        </Section>
      </>}

      {/* Blend Mode (all types) */}
      <Section title="Blend Mode">
        <Field label="Mode">
          <select style={inputStyle} value={p.blendMode || 'normal'} onChange={e => up('blendMode', e.target.value)}>
            {['normal','multiply','screen','overlay','darken','lighten','color-dodge','color-burn','hard-light','soft-light','difference','exclusion','hue','saturation','color','luminosity'].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
          </select>
        </Field>
      </Section>
    </div>
  )
}

export default PropertiesPanelEnhanced
