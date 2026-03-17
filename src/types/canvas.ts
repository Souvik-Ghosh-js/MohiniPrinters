export interface Shadow {
  offsetX: number
  offsetY: number
  blur: number
  color: string
  opacity: number
}

export interface Stroke {
  width: number
  color: string
}

export interface Gradient {
  type: 'linear' | 'radial'
  angle: number
  colors: string[]
}

export interface ElementProperties {
  // Text
  text?: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
  fontStyle?: string
  textDecoration?: string
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  lineHeight?: number
  letterSpacing?: number
  fill?: string
  textCurve?: 'none' | 'arc' | 'wave'
  curveAmount?: number
  shadow?: Shadow
  stroke?: Stroke
  gradient?: Gradient

  // Image
  src?: string
  brightness?: number
  contrast?: number
  saturation?: number
  hueRotate?: number
  blur?: number
  grayscale?: number
  sepia?: number
  objectFit?: 'cover' | 'contain' | 'fill'
  borderRadius?: number
  borderWidth?: number
  borderColor?: string

  // Shape
  fillOpacity?: number
  blendMode?: string
}

export interface CanvasElement {
  id: string
  type: 'text' | 'image' | 'shape' | 'icon'
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  zIndex: number
  locked: boolean
  visible: boolean
  properties: ElementProperties
}

export interface Background {
  type: 'solid' | 'gradient' | 'image'
  solid?: { color: string; opacity: number }
  gradient?: { angle: number; colors: string[]; opacity: number }
  image?: { src: string; opacity: number; blur: number; scale: number }
}

export interface CanvasState {
  elements: CanvasElement[]
  selectedElementId: string | null
  background: Background
  width: number
  height: number
  zoom: number
  history: { elements: CanvasElement[]; background: Background }[]
  historyIndex: number
}

export const DESIGN_TEMPLATES: Record<string, { name: string; width: number; height: number; category: string }> = {
  instagram_post: { name: 'Instagram Post', width: 1080, height: 1080, category: 'Social Media' },
  instagram_story: { name: 'Instagram Story', width: 1080, height: 1920, category: 'Social Media' },
  instagram_reel: { name: 'Instagram Reel', width: 1080, height: 1920, category: 'Social Media' },
  facebook_post: { name: 'Facebook Post', width: 1200, height: 630, category: 'Social Media' },
  twitter_post: { name: 'Twitter Post', width: 1024, height: 512, category: 'Social Media' },
  linkedin_post: { name: 'LinkedIn Post', width: 1200, height: 627, category: 'Social Media' },
  youtube_thumbnail: { name: 'YouTube Thumbnail', width: 1280, height: 720, category: 'Social Media' },
  tiktok_video: { name: 'TikTok Video', width: 1080, height: 1920, category: 'Social Media' },
  pinterest_pin: { name: 'Pinterest Pin', width: 1000, height: 1500, category: 'Social Media' },
  poster_a2: { name: 'Poster (A2)', width: 2400, height: 3600, category: 'Print' },
  flyer_a5: { name: 'Flyer (A5)', width: 800, height: 1000, category: 'Print' },
  business_card: { name: 'Business Card', width: 420, height: 240, category: 'Print' },
  presentation: { name: 'Presentation', width: 1920, height: 1080, category: 'Presentation' },
  banner_728: { name: 'Banner 728x90', width: 728, height: 90, category: 'Web' },
  banner_970: { name: 'Banner 970x250', width: 970, height: 250, category: 'Web' },
  banner_300: { name: 'Banner 300x600', width: 300, height: 600, category: 'Web' },
}
