import { useStore, type Layer } from '../state/store'
import { createCanvas, snapshot } from '../core/document'
import { drawThroughMask } from '../core/selection'
import type { ToolImpl, ToolContext } from './types'

// Strokes are drawn at full alpha onto a temp canvas, previewed by the
// compositor with the brush opacity, and merged into the layer on pointer-up.
// This matches Photoshop semantics: opacity applies per stroke, not per segment.

let strokeCanvas: HTMLCanvasElement | null = null
let last: { x: number; y: number } | null = null
let before: ImageData | null = null

export function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, hardness: number) {
  const r = size / 2
  if (hardness >= 0.99) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  } else {
    const g = ctx.createRadialGradient(x, y, r * hardness, x, y, r)
    const base = ctx.fillStyle as string
    g.addColorStop(0, base)
    g.addColorStop(1, base + '00')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = base
  }
}

/** Walk from `last` to (x,y) calling cb at brush-spacing intervals. Returns new last point. */
export function interpolate(
  from: { x: number; y: number },
  x: number,
  y: number,
  size: number,
  cb: (px: number, py: number) => void
) {
  const dx = x - from.x
  const dy = y - from.y
  const dist = Math.hypot(dx, dy)
  const step = Math.max(1, size / 6)
  const steps = Math.ceil(dist / step)
  for (let i = 1; i <= steps; i++) {
    cb(from.x + (dx * i) / steps, from.y + (dy * i) / steps)
  }
}

/** Merge a finished stroke canvas into the layer (through the selection) and record history. */
export function commitStrokeCanvas(
  layer: Layer,
  stroke: HTMLCanvasElement,
  opacity: number,
  erase: boolean,
  label: string,
  beforeData: ImageData
) {
  const s = useStore.getState()
  drawThroughMask(layer.canvas, stroke, s.selection, { alpha: opacity, erase })
  s.commitLayerChange(layer.id, beforeData, label)
}

function makeBrushTool(erase: boolean): ToolImpl {
  return {
    cursor: 'crosshair',
    down(c: ToolContext) {
      const s = useStore.getState()
      const layer = s.layers.find((l) => l.id === s.activeLayerId)
      if (!s.doc || !layer || !layer.visible) return
      strokeCanvas = createCanvas(s.doc.width, s.doc.height)
      before = snapshot(layer.canvas)
      const ctx = strokeCanvas.getContext('2d')!
      ctx.fillStyle = erase ? '#000000' : s.fgColor
      stamp(ctx, c.x, c.y, s.brushSize, s.brushHardness)
      last = { x: c.x, y: c.y }
      s.set({ stroke: { layerId: layer.id, canvas: strokeCanvas, opacity: s.brushOpacity, erase } })
      s.touch()
    },
    move(c: ToolContext) {
      const s = useStore.getState()
      if (!strokeCanvas || !last) return
      const ctx = strokeCanvas.getContext('2d')!
      ctx.fillStyle = erase ? '#000000' : s.fgColor
      interpolate(last, c.x, c.y, s.brushSize, (px, py) => stamp(ctx, px, py, s.brushSize, s.brushHardness))
      last = { x: c.x, y: c.y }
      s.touch()
    },
    up() {
      const s = useStore.getState()
      const stroke = s.stroke
      const layer = s.layers.find((l) => l.id === stroke?.layerId)
      if (stroke && layer && before) {
        commitStrokeCanvas(layer, stroke.canvas, stroke.opacity, stroke.erase, erase ? '橡皮擦' : '画笔', before)
      }
      strokeCanvas = null
      last = null
      before = null
      s.set({ stroke: null })
      s.touch()
    },
  }
}

export const brushTool = makeBrushTool(false)
export const eraserTool = makeBrushTool(true)
