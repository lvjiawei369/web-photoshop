import { createCanvas, getCtx } from '../core/document'

export type AdjustmentType =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'hsl'
  | 'levels'
  | 'blur'
  | 'pixelate'
  | 'noise'

export interface AdjustmentParam {
  key: string
  label: string
  min: number
  max: number
  initial: number
  step?: number
}

export interface AdjustmentDef {
  label: string
  params: AdjustmentParam[]
}

export const ADJUSTMENTS: Record<AdjustmentType, AdjustmentDef> = {
  brightness: { label: '亮度', params: [{ key: 'v', label: '亮度', min: -100, max: 100, initial: 0 }] },
  contrast: { label: '对比度', params: [{ key: 'v', label: '对比度', min: -100, max: 100, initial: 0 }] },
  saturation: { label: '饱和度', params: [{ key: 'v', label: '饱和度', min: -100, max: 100, initial: 0 }] },
  hsl: {
    label: '色相/饱和度',
    params: [
      { key: 'h', label: '色相', min: -180, max: 180, initial: 0 },
      { key: 's', label: '饱和度', min: -100, max: 100, initial: 0 },
      { key: 'l', label: '明度', min: -100, max: 100, initial: 0 },
    ],
  },
  levels: {
    label: '色阶',
    params: [
      { key: 'black', label: '黑场', min: 0, max: 254, initial: 0 },
      { key: 'white', label: '白场', min: 1, max: 255, initial: 255 },
      { key: 'gamma', label: '灰度系数', min: 10, max: 300, initial: 100 }, // /100
    ],
  },
  blur: { label: '高斯模糊', params: [{ key: 'v', label: '半径', min: 0, max: 50, initial: 0 }] },
  pixelate: { label: '像素化', params: [{ key: 'v', label: '块大小', min: 1, max: 64, initial: 8 }] },
  noise: { label: '添加噪点', params: [{ key: 'v', label: '数量', min: 0, max: 100, initial: 20 }] },
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const f = (t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255]
}

/** Apply an adjustment to `source` pixels, writing the result onto `canvas`. */
export function applyAdjustment(
  canvas: HTMLCanvasElement,
  source: ImageData,
  type: AdjustmentType,
  values: Record<string, number>
) {
  const ctx = getCtx(canvas)
  const w = canvas.width
  const h = canvas.height

  if (type === 'blur') {
    const src = createCanvas(w, h)
    getCtx(src).putImageData(source, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.filter = values.v > 0 ? `blur(${values.v}px)` : 'none'
    ctx.drawImage(src, 0, 0)
    ctx.filter = 'none'
    return
  }
  if (type === 'pixelate') {
    const block = Math.max(1, Math.round(values.v))
    const src = createCanvas(w, h)
    getCtx(src).putImageData(source, 0, 0)
    const small = createCanvas(Math.max(1, Math.ceil(w / block)), Math.max(1, Math.ceil(h / block)))
    const sctx = getCtx(small)
    sctx.imageSmoothingEnabled = true
    sctx.drawImage(src, 0, 0, small.width, small.height)
    ctx.clearRect(0, 0, w, h)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(small, 0, 0, small.width, small.height, 0, 0, small.width * block, small.height * block)
    ctx.imageSmoothingEnabled = true
    return
  }

  const out = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height)
  const d = out.data
  if (type === 'brightness') {
    const v = values.v
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(d[i] + v)
      d[i + 1] = clamp(d[i + 1] + v)
      d[i + 2] = clamp(d[i + 2] + v)
    }
  } else if (type === 'contrast') {
    const f = (259 * (values.v + 255)) / (255 * (259 - values.v))
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(f * (d[i] - 128) + 128)
      d[i + 1] = clamp(f * (d[i + 1] - 128) + 128)
      d[i + 2] = clamp(f * (d[i + 2] - 128) + 128)
    }
  } else if (type === 'saturation') {
    const s = 1 + values.v / 100
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = clamp(gray + s * (d[i] - gray))
      d[i + 1] = clamp(gray + s * (d[i + 1] - gray))
      d[i + 2] = clamp(gray + s * (d[i + 2] - gray))
    }
  } else if (type === 'hsl') {
    const dh = values.h / 360
    const ds = values.s / 100
    const dl = values.l / 100
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      let [hh, ss, ll] = rgbToHsl(d[i], d[i + 1], d[i + 2])
      hh = (hh + dh + 1) % 1
      ss = Math.max(0, Math.min(1, ss + ds))
      ll = Math.max(0, Math.min(1, ll + dl))
      const [r, g, b] = hslToRgb(hh, ss, ll)
      d[i] = clamp(r)
      d[i + 1] = clamp(g)
      d[i + 2] = clamp(b)
    }
  } else if (type === 'levels') {
    const black = values.black
    const white = Math.max(black + 1, values.white)
    const gamma = values.gamma / 100
    const lut = new Uint8ClampedArray(256)
    for (let v = 0; v < 256; v++) {
      const norm = Math.max(0, Math.min(1, (v - black) / (white - black)))
      lut[v] = Math.pow(norm, 1 / gamma) * 255
    }
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]]
      d[i + 1] = lut[d[i + 1]]
      d[i + 2] = lut[d[i + 2]]
    }
  } else if (type === 'noise') {
    const amount = values.v * 1.28
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      const n = (Math.random() - 0.5) * amount
      d[i] = clamp(d[i] + n)
      d[i + 1] = clamp(d[i + 1] + n)
      d[i + 2] = clamp(d[i + 2] + n)
    }
  }
  ctx.putImageData(out, 0, 0)
}

export type InstantFilterType = 'grayscale' | 'invert' | 'sepia' | 'sharpen' | 'emboss'

export const INSTANT_FILTER_LABELS: Record<InstantFilterType, string> = {
  grayscale: '灰度',
  invert: '反相',
  sepia: '棕褐色',
  sharpen: '锐化',
  emboss: '浮雕',
}

function convolve(src: ImageData, kernel: number[], offset = 0): ImageData {
  const w = src.width
  const h = src.height
  const s = src.data
  const out = new ImageData(w, h)
  const d = out.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let r = 0,
        g = 0,
        b = 0
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = Math.max(0, Math.min(w - 1, x + kx))
          const py = Math.max(0, Math.min(h - 1, y + ky))
          const si = (py * w + px) * 4
          const k = kernel[(ky + 1) * 3 + (kx + 1)]
          r += s[si] * k
          g += s[si + 1] * k
          b += s[si + 2] * k
        }
      }
      d[i] = clamp(r + offset)
      d[i + 1] = clamp(g + offset)
      d[i + 2] = clamp(b + offset)
      d[i + 3] = s[i + 3]
    }
  }
  return out
}

/** Compute the filtered result of `source`, writing onto `canvas`. */
export function applyInstantFilter(canvas: HTMLCanvasElement, source: ImageData, type: InstantFilterType) {
  const ctx = getCtx(canvas)
  if (type === 'sharpen') {
    ctx.putImageData(convolve(source, [0, -1, 0, -1, 5, -1, 0, -1, 0]), 0, 0)
    return
  }
  if (type === 'emboss') {
    ctx.putImageData(convolve(source, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 0), 0, 0)
    return
  }
  const out = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height)
  const d = out.data
  if (type === 'grayscale') {
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = d[i + 1] = d[i + 2] = gray
    }
  } else if (type === 'invert') {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i]
      d[i + 1] = 255 - d[i + 1]
      d[i + 2] = 255 - d[i + 2]
    }
  } else if (type === 'sepia') {
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i],
        g = d[i + 1],
        b = d[i + 2]
      d[i] = clamp(0.393 * r + 0.769 * g + 0.189 * b)
      d[i + 1] = clamp(0.349 * r + 0.686 * g + 0.168 * b)
      d[i + 2] = clamp(0.272 * r + 0.534 * g + 0.131 * b)
    }
  }
  ctx.putImageData(out, 0, 0)
}
