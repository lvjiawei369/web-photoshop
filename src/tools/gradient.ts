import { useStore } from '../state/store'
import { createCanvas, getCtx, snapshot } from '../core/document'
import { commitStrokeCanvas } from './brush'
import type { ToolImpl } from './types'

let start: { x: number; y: number } | null = null
let previewCanvas: HTMLCanvasElement | null = null
let before: ImageData | null = null

function renderGradient(c: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number) {
  const s = useStore.getState()
  const ctx = getCtx(c)
  ctx.clearRect(0, 0, c.width, c.height)
  let g: CanvasGradient
  if (s.gradientKind === 'linear') {
    g = ctx.createLinearGradient(x0, y0, x1, y1)
  } else {
    g = ctx.createRadialGradient(x0, y0, 0, x0, y0, Math.max(1, Math.hypot(x1 - x0, y1 - y0)))
  }
  g.addColorStop(0, s.fgColor)
  g.addColorStop(1, s.bgColor)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, c.width, c.height)
}

export const gradientTool: ToolImpl = {
  cursor: 'crosshair',
  down(c) {
    const s = useStore.getState()
    const layer = s.layers.find((l) => l.id === s.activeLayerId)
    if (!s.doc || !layer || !layer.visible) return
    start = { x: c.x, y: c.y }
    before = snapshot(layer.canvas)
    previewCanvas = createCanvas(s.doc.width, s.doc.height)
    s.set({ stroke: { layerId: layer.id, canvas: previewCanvas, opacity: 1, erase: false } })
  },
  move(c) {
    const s = useStore.getState()
    if (!start || !previewCanvas) return
    renderGradient(previewCanvas, start.x, start.y, c.x, c.y)
    s.set({ toolPreview: { kind: 'gradient', x0: start.x, y0: start.y, x1: c.x, y1: c.y } })
    s.touch()
  },
  up(c) {
    const s = useStore.getState()
    const layer = s.layers.find((l) => l.id === s.stroke?.layerId)
    if (start && previewCanvas && layer && before && (c.x !== start.x || c.y !== start.y)) {
      renderGradient(previewCanvas, start.x, start.y, c.x, c.y)
      commitStrokeCanvas(layer, previewCanvas, 1, false, '渐变', before)
    }
    start = null
    previewCanvas = null
    before = null
    s.set({ stroke: null, toolPreview: null })
    s.touch()
  },
}
