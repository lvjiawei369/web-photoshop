import { useStore } from '../state/store'
import { createCanvas, getCtx, snapshot, clipSelection } from '../core/document'
import type { ToolImpl, ToolContext } from './types'

// Strokes are drawn at full alpha onto a temp canvas, previewed by the
// compositor with the brush opacity, and merged into the layer on pointer-up.
// This matches Photoshop semantics: opacity applies per stroke, not per segment.

let strokeCanvas: HTMLCanvasElement | null = null
let last: { x: number; y: number } | null = null
let before: ImageData | null = null

function stamp(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, hardness: number) {
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

function strokeTo(x: number, y: number) {
  const s = useStore.getState()
  if (!strokeCanvas || !last) return
  const ctx = strokeCanvas.getContext('2d')!
  ctx.fillStyle = s.tool === 'eraser' ? '#000000' : s.fgColor
  const dx = x - last.x
  const dy = y - last.y
  const dist = Math.hypot(dx, dy)
  const step = Math.max(1, s.brushSize / 6)
  const steps = Math.ceil(dist / step)
  for (let i = 1; i <= steps; i++) {
    stamp(ctx, last.x + (dx * i) / steps, last.y + (dy * i) / steps, s.brushSize, s.brushHardness)
  }
  last = { x, y }
  s.touch()
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
      strokeTo(c.x, c.y)
    },
    up() {
      const s = useStore.getState()
      const stroke = s.stroke
      const layer = s.layers.find((l) => l.id === stroke?.layerId)
      if (stroke && layer && before) {
        const ctx = getCtx(layer.canvas)
        ctx.save()
        if (s.selection) clipSelection(ctx, s.selection)
        ctx.globalAlpha = stroke.opacity
        ctx.globalCompositeOperation = stroke.erase ? 'destination-out' : 'source-over'
        ctx.drawImage(stroke.canvas, 0, 0)
        ctx.restore()
        s.commitLayerChange(layer.id, before, stroke.erase ? '橡皮擦' : '画笔')
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
