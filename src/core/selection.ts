import { createCanvas, getCtx } from './document'

/**
 * Pixel-mask based selection. The mask canvas is white where selected.
 * `boundary` is a Path2D in document coordinates used for marching ants.
 */
export interface SelectionState {
  mask: HTMLCanvasElement
  boundary: Path2D
}

/** Trace mask boundary into closed loops so dashed ants flow continuously. */
function boundaryFromAlpha(d: Uint8ClampedArray, w: number, h: number): Path2D {
  const inside = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 127
  // directed edges, clockwise around inside pixels (inside on the left)
  const edges = new Map<number, number[]>() // startVertex -> endVertices
  const vkey = (x: number, y: number) => y * (w + 1) + x
  const addEdge = (x0: number, y0: number, x1: number, y1: number) => {
    const k = vkey(x0, y0)
    const list = edges.get(k)
    if (list) list.push(vkey(x1, y1))
    else edges.set(k, [vkey(x1, y1)])
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue
      if (!inside(x, y - 1)) addEdge(x, y, x + 1, y)
      if (!inside(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1)
      if (!inside(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1)
      if (!inside(x - 1, y)) addEdge(x, y + 1, x, y)
    }
  }
  const path = new Path2D()
  const vx = (k: number) => k % (w + 1)
  const vy = (k: number) => Math.floor(k / (w + 1))
  for (const startKey of Array.from(edges.keys())) {
    let list = edges.get(startKey)
    if (!list || list.length === 0) continue
    let current = startKey
    path.moveTo(vx(current), vy(current))
    while (true) {
      list = edges.get(current)
      if (!list || list.length === 0) break
      const next = list.pop()!
      path.lineTo(vx(next), vy(next))
      current = next
      if (current === startKey) {
        path.closePath()
        break
      }
    }
  }
  return path
}

export function boundaryFromMask(mask: HTMLCanvasElement): Path2D {
  const d = getCtx(mask).getImageData(0, 0, mask.width, mask.height).data
  return boundaryFromAlpha(d, mask.width, mask.height)
}

export function makeShapeSelection(
  kind: 'rect' | 'ellipse',
  x: number,
  y: number,
  w: number,
  h: number,
  docW: number,
  docH: number
): SelectionState {
  const mask = createCanvas(docW, docH)
  const ctx = getCtx(mask)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  if (kind === 'rect') ctx.rect(x, y, w, h)
  else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  const boundary = new Path2D()
  if (kind === 'rect') boundary.rect(x, y, w, h)
  else boundary.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  return { mask, boundary }
}

export function makeLassoSelection(
  points: { x: number; y: number }[],
  docW: number,
  docH: number
): SelectionState | null {
  if (points.length < 3) return null
  const mask = createCanvas(docW, docH)
  const ctx = getCtx(mask)
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (const p of points) ctx.lineTo(p.x, p.y)
  ctx.closePath()
  ctx.fill()
  const boundary = new Path2D()
  boundary.moveTo(points[0].x, points[0].y)
  for (const p of points) boundary.lineTo(p.x, p.y)
  boundary.closePath()
  return { mask, boundary }
}

/** Magic wand: contiguous region of similar color sampled from `source`. */
export function makeWandSelection(
  source: HTMLCanvasElement,
  sx: number,
  sy: number,
  tolerance: number
): SelectionState | null {
  const w = source.width
  const h = source.height
  sx = Math.floor(sx)
  sy = Math.floor(sy)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return null
  const d = getCtx(source).getImageData(0, 0, w, h).data
  const start = (sy * w + sx) * 4
  const t = [d[start], d[start + 1], d[start + 2], d[start + 3]]
  const matches = (i: number) =>
    Math.abs(d[i] - t[0]) <= tolerance &&
    Math.abs(d[i + 1] - t[1]) <= tolerance &&
    Math.abs(d[i + 2] - t[2]) <= tolerance &&
    Math.abs(d[i + 3] - t[3]) <= tolerance
  const selected = new Uint8Array(w * h)
  const stack = [sy * w + sx]
  while (stack.length) {
    const p = stack.pop()!
    if (selected[p]) continue
    if (!matches(p * 4)) continue
    selected[p] = 1
    const x = p % w
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (p >= w) stack.push(p - w)
    if (p < w * (h - 1)) stack.push(p + w)
  }
  const mask = createCanvas(w, h)
  const img = new ImageData(w, h)
  for (let p = 0; p < selected.length; p++) {
    if (selected[p]) {
      const i = p * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = img.data[i + 3] = 255
    }
  }
  getCtx(mask).putImageData(img, 0, 0)
  return { mask, boundary: boundaryFromAlpha(img.data, w, h) }
}

export function invertSelection(sel: SelectionState, docW: number, docH: number): SelectionState {
  const mask = createCanvas(docW, docH)
  const ctx = getCtx(mask)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, docW, docH)
  ctx.globalCompositeOperation = 'destination-out'
  ctx.drawImage(sel.mask, 0, 0)
  return { mask, boundary: boundaryFromMask(mask) }
}

/**
 * Apply a full-canvas filter render but only inside the selection: `render`
 * writes the filtered result of `before` onto the given canvas; the result is
 * then merged into the layer through the mask.
 */
export function applyRenderMasked(
  layer: HTMLCanvasElement,
  before: ImageData,
  sel: SelectionState | null,
  render: (target: HTMLCanvasElement, src: ImageData) => void
) {
  if (!sel) {
    render(layer, before)
    return
  }
  const scratch = createCanvas(layer.width, layer.height)
  render(scratch, before)
  getCtx(layer).putImageData(before, 0, 0)
  drawThroughMask(layer, scratch, sel)
}

/** Draw `content` onto `layer` restricted to the selection mask (or unrestricted if no selection). */
export function drawThroughMask(
  layer: HTMLCanvasElement,
  content: HTMLCanvasElement,
  sel: SelectionState | null,
  opts: { alpha?: number; erase?: boolean } = {}
) {
  const ctx = getCtx(layer)
  let src = content
  if (sel) {
    const tmp = createCanvas(layer.width, layer.height)
    const tctx = getCtx(tmp)
    tctx.drawImage(content, 0, 0)
    tctx.globalCompositeOperation = 'destination-in'
    tctx.drawImage(sel.mask, 0, 0)
    src = tmp
  }
  ctx.save()
  ctx.globalAlpha = opts.alpha ?? 1
  ctx.globalCompositeOperation = opts.erase ? 'destination-out' : 'source-over'
  ctx.drawImage(src, 0, 0)
  ctx.restore()
}
