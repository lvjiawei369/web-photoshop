import { useStore, type ToolId } from '../state/store'
import { snapshot, getCtx } from '../core/document'
import { flatten } from '../core/compositor'
import { brushTool, eraserTool } from './brush'
import { fillTool } from './fill'
import type { ToolImpl, ToolContext } from './types'

// --- move ---
let moveStart: { x: number; y: number; data: ImageData; before: ImageData } | null = null

const moveTool: ToolImpl = {
  cursor: 'move',
  down(c) {
    const s = useStore.getState()
    const layer = s.layers.find((l) => l.id === s.activeLayerId)
    if (!layer) return
    const data = snapshot(layer.canvas)
    moveStart = { x: c.x, y: c.y, data, before: data }
  },
  move(c) {
    const s = useStore.getState()
    const layer = s.layers.find((l) => l.id === s.activeLayerId)
    if (!moveStart || !layer) return
    const ctx = getCtx(layer.canvas)
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
    ctx.putImageData(moveStart.data, Math.round(c.x - moveStart.x), Math.round(c.y - moveStart.y))
    s.touch()
  },
  up(c) {
    const s = useStore.getState()
    const layer = s.layers.find((l) => l.id === s.activeLayerId)
    if (moveStart && layer && (Math.round(c.x - moveStart.x) || Math.round(c.y - moveStart.y))) {
      s.commitLayerChange(layer.id, moveStart.before, '移动')
    }
    moveStart = null
  },
}

// --- marquee ---
function makeMarqueeTool(kind: 'rect' | 'ellipse'): ToolImpl {
  let start: { x: number; y: number } | null = null
  let dragged = false
  return {
    cursor: 'crosshair',
    down(c) {
      start = { x: c.x, y: c.y }
      dragged = false
    },
    move(c) {
      if (!start) return
      dragged = true
      useStore.getState().set({
        selection: {
          kind,
          x: Math.min(start.x, c.x),
          y: Math.min(start.y, c.y),
          w: Math.abs(c.x - start.x),
          h: Math.abs(c.y - start.y),
        },
      })
    },
    up() {
      const s = useStore.getState()
      if (!dragged || (s.selection && (s.selection.w < 2 || s.selection.h < 2))) {
        s.set({ selection: null })
      }
      start = null
    },
  }
}

// --- crop ---
let cropStart: { x: number; y: number } | null = null

const cropTool: ToolImpl = {
  cursor: 'crosshair',
  down(c) {
    cropStart = { x: c.x, y: c.y }
  },
  move(c) {
    if (!cropStart) return
    const s = useStore.getState()
    const doc = s.doc
    if (!doc) return
    const clampX = (v: number) => Math.max(0, Math.min(doc.width, v))
    const clampY = (v: number) => Math.max(0, Math.min(doc.height, v))
    s.set({
      cropRect: {
        x: clampX(Math.min(cropStart.x, c.x)),
        y: clampY(Math.min(cropStart.y, c.y)),
        w: clampX(Math.max(cropStart.x, c.x)) - clampX(Math.min(cropStart.x, c.x)),
        h: clampY(Math.max(cropStart.y, c.y)) - clampY(Math.min(cropStart.y, c.y)),
      },
    })
  },
  up() {
    const s = useStore.getState()
    if (s.cropRect && (s.cropRect.w < 2 || s.cropRect.h < 2)) s.set({ cropRect: null })
    cropStart = null
  },
}

// --- eyedropper ---
const eyedropperTool: ToolImpl = {
  cursor: 'crosshair',
  down(c) {
    const s = useStore.getState()
    if (!s.doc) return
    const flat = flatten(s.layers, s.doc.width, s.doc.height)
    const x = Math.floor(c.x)
    const y = Math.floor(c.y)
    if (x < 0 || y < 0 || x >= s.doc.width || y >= s.doc.height) return
    const [r, g, b, a] = getCtx(flat).getImageData(x, y, 1, 1).data
    if (a === 0) return
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
    s.set({ fgColor: hex })
  },
  move(c) {
    if (c.e.buttons & 1) eyedropperTool.down(c)
  },
  up() {},
}

// --- text ---
const textTool: ToolImpl = {
  cursor: 'text',
  down(c) {
    const s = useStore.getState()
    if (s.textEdit) return // existing edit is committed by the overlay's blur handler
    s.set({ textEdit: { x: c.x, y: c.y } })
  },
  move() {},
  up() {},
}

// --- hand ---
let handStart: { sx: number; sy: number; left: number; top: number } | null = null

const handTool: ToolImpl = {
  cursor: 'grab',
  down(c) {
    if (!c.scrollEl) return
    handStart = { sx: c.e.clientX, sy: c.e.clientY, left: c.scrollEl.scrollLeft, top: c.scrollEl.scrollTop }
  },
  move(c) {
    if (!handStart || !c.scrollEl) return
    c.scrollEl.scrollLeft = handStart.left - (c.e.clientX - handStart.sx)
    c.scrollEl.scrollTop = handStart.top - (c.e.clientY - handStart.sy)
  },
  up() {
    handStart = null
  },
}

// --- zoom ---
const ZOOM_LEVELS = [0.125, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 8]

export function zoomStep(direction: 1 | -1) {
  const s = useStore.getState()
  const i = ZOOM_LEVELS.findIndex((z) => z >= s.zoom - 1e-6)
  const next = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, (i < 0 ? ZOOM_LEVELS.length - 1 : i) + direction))]
  s.set({ zoom: next })
}

const zoomTool: ToolImpl = {
  cursor: 'zoom-in',
  down(c) {
    zoomStep(c.e.altKey ? -1 : 1)
  },
  move() {},
  up() {},
}

export const TOOLS: Record<ToolId, ToolImpl> = {
  move: moveTool,
  'marquee-rect': makeMarqueeTool('rect'),
  'marquee-ellipse': makeMarqueeTool('ellipse'),
  crop: cropTool,
  eyedropper: eyedropperTool,
  brush: brushTool,
  eraser: eraserTool,
  fill: fillTool,
  text: textTool,
  hand: handTool,
  zoom: zoomTool,
}

export type { ToolImpl, ToolContext }
