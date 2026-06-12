import { createCanvas, getCtx } from './document'

/** Free-transform state for one layer. Box is in document coordinates; rotation around box center. */
export interface TransformState {
  layerId: string
  /** Layer pixels cropped to their original bounding box */
  src: HTMLCanvasElement
  x: number
  y: number
  w: number
  h: number
  rotation: number // radians
  before: ImageData
}

/** Bounding box of non-transparent pixels; null if layer is empty. */
export function contentBounds(canvas: HTMLCanvasElement): { x: number; y: number; w: number; h: number } | null {
  const w = canvas.width
  const h = canvas.height
  const d = getCtx(canvas).getImageData(0, 0, w, h).data
  let minX = w,
    minY = h,
    maxX = -1,
    maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
}

export function makeTransform(layerId: string, canvas: HTMLCanvasElement, before: ImageData): TransformState | null {
  const bounds = contentBounds(canvas) ?? { x: 0, y: 0, w: canvas.width, h: canvas.height }
  if (bounds.w < 1 || bounds.h < 1) return null
  const src = createCanvas(bounds.w, bounds.h)
  getCtx(src).drawImage(canvas, -bounds.x, -bounds.y)
  return { layerId, src, ...bounds, rotation: 0, before }
}

/** Draw the transformed source onto ctx (used by compositor preview and final apply). */
export function drawTransformed(ctx: CanvasRenderingContext2D, t: TransformState) {
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(t.rotation)
  ctx.drawImage(t.src, -t.w / 2, -t.h / 2, t.w, t.h)
  ctx.restore()
}

export type TransformHandle =
  | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
  | 'move'
  | 'rotate'

/** Handle positions in document coordinates (rotated box corners/edges). */
export function handlePoints(t: TransformState): Record<string, { x: number; y: number }> {
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  const pt = (lx: number, ly: number) => ({
    x: cx + lx * cos - ly * sin,
    y: cy + lx * sin + ly * cos,
  })
  const hw = t.w / 2
  const hh = t.h / 2
  return {
    nw: pt(-hw, -hh),
    n: pt(0, -hh),
    ne: pt(hw, -hh),
    e: pt(hw, 0),
    se: pt(hw, hh),
    s: pt(0, hh),
    sw: pt(-hw, hh),
    w: pt(-hw, 0),
  }
}

/** Convert a document point into the box's local (unrotated, center-origin) frame. */
export function toLocal(t: TransformState, x: number, y: number): { x: number; y: number } {
  const cx = t.x + t.w / 2
  const cy = t.y + t.h / 2
  const cos = Math.cos(-t.rotation)
  const sin = Math.sin(-t.rotation)
  const dx = x - cx
  const dy = y - cy
  return { x: dx * cos - dy * sin, y: dx * sin + dy * cos }
}

/** Hit-test a pointer position against the transform box. `r` = handle radius in doc px. */
export function hitTest(t: TransformState, x: number, y: number, r: number): TransformHandle | null {
  const handles = handlePoints(t)
  for (const [name, p] of Object.entries(handles)) {
    if (Math.abs(x - p.x) <= r && Math.abs(y - p.y) <= r) return name as TransformHandle
  }
  const local = toLocal(t, x, y)
  if (Math.abs(local.x) <= t.w / 2 && Math.abs(local.y) <= t.h / 2) return 'move'
  if (Math.abs(local.x) <= t.w / 2 + r * 4 && Math.abs(local.y) <= t.h / 2 + r * 4) return 'rotate'
  return null
}

/** Apply a drag on a scale handle. Opposite corner/edge stays fixed. */
export function scaleByHandle(
  t: TransformState,
  handle: TransformHandle,
  x: number,
  y: number,
  keepRatio: boolean
): TransformState {
  const local = toLocal(t, x, y)
  let { w, h } = t
  let newW = w
  let newH = h
  // local coords of the dragged point determine new size relative to the fixed opposite side
  if (handle.includes('e')) newW = local.x + w / 2
  if (handle.includes('w')) newW = w / 2 - local.x
  if (handle.includes('s')) newH = local.y + h / 2
  if (handle.includes('n')) newH = h / 2 - local.y
  newW = Math.max(4, newW)
  newH = Math.max(4, newH)
  if (keepRatio && handle.length === 2) {
    const s = Math.max(newW / w, newH / h)
    newW = w * s
    newH = h * s
  }
  // keep the opposite anchor fixed: shift center by half the size delta along the rotated axes
  const cos = Math.cos(t.rotation)
  const sin = Math.sin(t.rotation)
  let dx = 0
  let dy = 0
  if (handle.includes('e')) dx = (newW - w) / 2
  if (handle.includes('w')) dx = -(newW - w) / 2
  if (handle.includes('s')) dy = (newH - h) / 2
  if (handle.includes('n')) dy = -(newH - h) / 2
  const cx = t.x + w / 2 + dx * cos - dy * sin
  const cy = t.y + h / 2 + dx * sin + dy * cos
  return { ...t, w: newW, h: newH, x: cx - newW / 2, y: cy - newH / 2 }
}
