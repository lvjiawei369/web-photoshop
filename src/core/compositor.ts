import type { Layer, StrokePreview } from '../state/store'
import { createCanvas } from './document'

let checkerPattern: CanvasPattern | null = null

function getCheckerPattern(ctx: CanvasRenderingContext2D): CanvasPattern {
  if (checkerPattern) return checkerPattern
  const tile = createCanvas(16, 16)
  const tctx = tile.getContext('2d')!
  tctx.fillStyle = '#ffffff'
  tctx.fillRect(0, 0, 16, 16)
  tctx.fillStyle = '#cccccc'
  tctx.fillRect(0, 0, 8, 8)
  tctx.fillRect(8, 8, 8, 8)
  checkerPattern = ctx.createPattern(tile, 'repeat')!
  return checkerPattern
}

let temp: HTMLCanvasElement | null = null

function getTemp(w: number, h: number): HTMLCanvasElement {
  if (!temp || temp.width !== w || temp.height !== h) {
    temp = createCanvas(w, h)
  }
  return temp
}

/** Draw one layer merged with an in-progress stroke preview. */
function drawLayerWithStroke(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  stroke: StrokePreview,
  w: number,
  h: number
) {
  const t = getTemp(w, h)
  const tctx = t.getContext('2d')!
  tctx.clearRect(0, 0, w, h)
  tctx.drawImage(layer.canvas, 0, 0)
  tctx.globalAlpha = stroke.opacity
  tctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over'
  tctx.drawImage(stroke.canvas, 0, 0)
  tctx.globalAlpha = 1
  tctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(t, 0, 0)
}

/** Composite all visible layers onto the target canvas, with checkerboard background. */
export function composite(
  target: HTMLCanvasElement,
  layers: Layer[],
  stroke: StrokePreview | null,
  w: number,
  h: number
) {
  const ctx = target.getContext('2d')!
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = getCheckerPattern(ctx)
  ctx.fillRect(0, 0, w, h)
  for (const layer of layers) {
    if (!layer.visible) continue
    ctx.globalAlpha = layer.opacity
    if (stroke && stroke.layerId === layer.id) {
      drawLayerWithStroke(ctx, layer, stroke, w, h)
    } else {
      ctx.drawImage(layer.canvas, 0, 0)
    }
  }
  ctx.globalAlpha = 1
}

/** Flatten visible layers to a new canvas (no checkerboard). */
export function flatten(layers: Layer[], w: number, h: number, background?: string): HTMLCanvasElement {
  const c = createCanvas(w, h)
  const ctx = c.getContext('2d')!
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, w, h)
  }
  for (const layer of layers) {
    if (!layer.visible) continue
    ctx.globalAlpha = layer.opacity
    ctx.drawImage(layer.canvas, 0, 0)
  }
  ctx.globalAlpha = 1
  return c
}
