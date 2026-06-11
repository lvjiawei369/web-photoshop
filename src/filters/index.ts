import { createCanvas, getCtx } from '../core/document'

export type AdjustmentType = 'brightness' | 'contrast' | 'saturation' | 'blur'

export const ADJUSTMENT_LABELS: Record<AdjustmentType, string> = {
  brightness: '亮度',
  contrast: '对比度',
  saturation: '饱和度',
  blur: '高斯模糊',
}

export const ADJUSTMENT_RANGES: Record<AdjustmentType, { min: number; max: number; initial: number }> = {
  brightness: { min: -100, max: 100, initial: 0 },
  contrast: { min: -100, max: 100, initial: 0 },
  saturation: { min: -100, max: 100, initial: 0 },
  blur: { min: 0, max: 50, initial: 0 },
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

/** Apply an adjustment to `source` pixels, writing the result onto `canvas`. */
export function applyAdjustment(
  canvas: HTMLCanvasElement,
  source: ImageData,
  type: AdjustmentType,
  value: number
) {
  const ctx = getCtx(canvas)
  if (type === 'blur') {
    const src = createCanvas(canvas.width, canvas.height)
    getCtx(src).putImageData(source, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.filter = value > 0 ? `blur(${value}px)` : 'none'
    ctx.drawImage(src, 0, 0)
    ctx.filter = 'none'
    return
  }
  const out = new ImageData(new Uint8ClampedArray(source.data), source.width, source.height)
  const d = out.data
  if (type === 'brightness') {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(d[i] + value)
      d[i + 1] = clamp(d[i + 1] + value)
      d[i + 2] = clamp(d[i + 2] + value)
    }
  } else if (type === 'contrast') {
    const f = (259 * (value + 255)) / (255 * (259 - value))
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(f * (d[i] - 128) + 128)
      d[i + 1] = clamp(f * (d[i + 1] - 128) + 128)
      d[i + 2] = clamp(f * (d[i + 2] - 128) + 128)
    }
  } else if (type === 'saturation') {
    const s = 1 + value / 100
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = clamp(gray + s * (d[i] - gray))
      d[i + 1] = clamp(gray + s * (d[i + 1] - gray))
      d[i + 2] = clamp(gray + s * (d[i + 2] - gray))
    }
  }
  ctx.putImageData(out, 0, 0)
}

/** In-place filters applied directly from the menu (no dialog). */
export function applyInstantFilter(canvas: HTMLCanvasElement, type: 'grayscale' | 'invert') {
  const ctx = getCtx(canvas)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  if (type === 'grayscale') {
    for (let i = 0; i < d.length; i += 4) {
      const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      d[i] = d[i + 1] = d[i + 2] = gray
    }
  } else {
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i]
      d[i + 1] = 255 - d[i + 1]
      d[i + 2] = 255 - d[i + 2]
    }
  }
  ctx.putImageData(img, 0, 0)
}
