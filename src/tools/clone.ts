import { useStore } from '../state/store'
import { createCanvas, getCtx, snapshot } from '../core/document'
import { flatten } from '../core/compositor'
import { interpolate, commitStrokeCanvas } from './brush'
import type { ToolImpl } from './types'

// Clone stamp: Alt+click samples a source point; painting copies pixels from
// the composite image at a fixed offset from the stroke start.

let source: { x: number; y: number } | null = null
let sourceCanvas: HTMLCanvasElement | null = null
let strokeCanvas: HTMLCanvasElement | null = null
let offset: { x: number; y: number } | null = null
let last: { x: number; y: number } | null = null
let before: ImageData | null = null

function cloneStamp(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  if (!sourceCanvas || !offset) return
  ctx.save()
  ctx.beginPath()
  ctx.arc(x, y, size / 2, 0, Math.PI * 2)
  ctx.clip()
  ctx.drawImage(sourceCanvas, -offset.x, -offset.y)
  ctx.restore()
}

export const cloneTool: ToolImpl = {
  cursor: 'crosshair',
  down(c) {
    const s = useStore.getState()
    if (!s.doc) return
    if (c.e.altKey) {
      source = { x: c.x, y: c.y }
      return
    }
    if (!source) return
    const layer = s.layers.find((l) => l.id === s.activeLayerId)
    if (!layer || !layer.visible) return
    sourceCanvas = flatten(s.layers, s.doc.width, s.doc.height)
    offset = { x: c.x - source.x, y: c.y - source.y }
    strokeCanvas = createCanvas(s.doc.width, s.doc.height)
    before = snapshot(layer.canvas)
    cloneStamp(getCtx(strokeCanvas), c.x, c.y, s.brushSize)
    last = { x: c.x, y: c.y }
    s.set({ stroke: { layerId: layer.id, canvas: strokeCanvas, opacity: s.brushOpacity, erase: false } })
    s.touch()
  },
  move(c) {
    const s = useStore.getState()
    if (!strokeCanvas || !last) return
    const ctx = getCtx(strokeCanvas)
    interpolate(last, c.x, c.y, s.brushSize, (px, py) => cloneStamp(ctx, px, py, s.brushSize))
    last = { x: c.x, y: c.y }
    s.touch()
  },
  up() {
    const s = useStore.getState()
    const stroke = s.stroke
    const layer = s.layers.find((l) => l.id === stroke?.layerId)
    if (stroke && layer && before) {
      commitStrokeCanvas(layer, stroke.canvas, stroke.opacity, false, '仿制图章', before)
    }
    strokeCanvas = null
    sourceCanvas = null
    last = null
    before = null
    offset = null
    s.set({ stroke: null })
    s.touch()
  },
}

export function hasCloneSource(): boolean {
  return !!source
}
