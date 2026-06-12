import { useStore } from '../state/store'
import { createCanvas, getCtx, snapshot } from '../core/document'
import { commitStrokeCanvas } from './brush'
import type { ToolImpl } from './types'

let start: { x: number; y: number } | null = null
let before: ImageData | null = null

function constrain(x0: number, y0: number, x1: number, y1: number, shift: boolean, shape: string) {
  if (!shift) return { x1, y1 }
  if (shape === 'line') {
    // snap to 45° increments
    const dx = x1 - x0
    const dy = y1 - y0
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
    const len = Math.hypot(dx, dy)
    return { x1: x0 + Math.cos(angle) * len, y1: y0 + Math.sin(angle) * len }
  }
  const size = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  return { x1: x0 + Math.sign(x1 - x0 || 1) * size, y1: y0 + Math.sign(y1 - y0 || 1) * size }
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  shape: 'rect' | 'ellipse' | 'line',
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  fill: boolean,
  strokeWidth: number,
  color: string
) {
  ctx.beginPath()
  if (shape === 'line') {
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, strokeWidth)
    ctx.lineCap = 'round'
    ctx.stroke()
    return
  }
  const x = Math.min(x0, x1)
  const y = Math.min(y0, y1)
  const w = Math.abs(x1 - x0)
  const h = Math.abs(y1 - y0)
  if (shape === 'rect') ctx.rect(x, y, w, h)
  else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  if (fill) {
    ctx.fillStyle = color
    ctx.fill()
  }
  if (strokeWidth > 0) {
    ctx.strokeStyle = color
    ctx.lineWidth = strokeWidth
    ctx.stroke()
  }
}

export const shapeTool: ToolImpl = {
  cursor: 'crosshair',
  down(c) {
    const s = useStore.getState()
    const layer = s.layers.find((l) => l.id === s.activeLayerId)
    if (!s.doc || !layer || !layer.visible) return
    start = { x: c.x, y: c.y }
    before = snapshot(layer.canvas)
  },
  move(c) {
    const s = useStore.getState()
    if (!start) return
    const { x1, y1 } = constrain(start.x, start.y, c.x, c.y, c.e.shiftKey, s.shapeKind)
    s.set({ toolPreview: { kind: 'shape', shape: s.shapeKind, x0: start.x, y0: start.y, x1, y1 } })
  },
  up(c) {
    const s = useStore.getState()
    const layer = s.layers.find((l) => l.id === s.activeLayerId)
    if (start && layer && before && s.doc && (Math.abs(c.x - start.x) > 1 || Math.abs(c.y - start.y) > 1)) {
      const { x1, y1 } = constrain(start.x, start.y, c.x, c.y, c.e.shiftKey, s.shapeKind)
      const temp = createCanvas(s.doc.width, s.doc.height)
      drawShape(
        getCtx(temp),
        s.shapeKind,
        start.x,
        start.y,
        x1,
        y1,
        s.shapeKind === 'line' ? false : s.shapeFill,
        s.shapeKind === 'line' ? Math.max(1, s.shapeStrokeWidth) : s.shapeStrokeWidth,
        s.fgColor
      )
      commitStrokeCanvas(layer, temp, 1, false, '形状', before)
      s.touch()
    }
    start = null
    before = null
    s.set({ toolPreview: null })
  },
}
