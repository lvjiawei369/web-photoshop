import { create } from 'zustand'
import { createCanvas, getCtx, snapshot, restore } from '../core/document'
import { flatten } from '../core/compositor'
import { history } from '../core/history'
import {
  type SelectionState,
  makeShapeSelection,
  invertSelection,
  drawThroughMask,
} from '../core/selection'
import { type TransformState, makeTransform, drawTransformed } from '../core/transform'

export type BlendMode = GlobalCompositeOperation

export const BLEND_MODES: { value: BlendMode; label: string }[] = [
  { value: 'source-over', label: '正常' },
  { value: 'multiply', label: '正片叠底' },
  { value: 'screen', label: '滤色' },
  { value: 'overlay', label: '叠加' },
  { value: 'darken', label: '变暗' },
  { value: 'lighten', label: '变亮' },
  { value: 'color-dodge', label: '颜色减淡' },
  { value: 'color-burn', label: '颜色加深' },
  { value: 'hard-light', label: '强光' },
  { value: 'soft-light', label: '柔光' },
  { value: 'difference', label: '差值' },
  { value: 'exclusion', label: '排除' },
  { value: 'hue', label: '色相' },
  { value: 'saturation', label: '饱和度' },
  { value: 'color', label: '颜色' },
  { value: 'luminosity', label: '明度' },
]

export interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number // 0..1
  blendMode: BlendMode
  canvas: HTMLCanvasElement
}

export type ToolId =
  | 'move'
  | 'marquee-rect'
  | 'marquee-ellipse'
  | 'lasso'
  | 'wand'
  | 'crop'
  | 'eyedropper'
  | 'brush'
  | 'eraser'
  | 'clone'
  | 'gradient'
  | 'fill'
  | 'shape'
  | 'text'
  | 'hand'
  | 'zoom'

export type Selection = SelectionState

export interface StrokePreview {
  layerId: string
  canvas: HTMLCanvasElement
  opacity: number
  erase: boolean
}

export interface TextEdit {
  x: number
  y: number
}

export type ToolPreview =
  | { kind: 'lasso'; points: { x: number; y: number }[] }
  | { kind: 'shape'; shape: 'rect' | 'ellipse' | 'line'; x0: number; y0: number; x1: number; y1: number }
  | { kind: 'gradient'; x0: number; y0: number; x1: number; y1: number }

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

let layerCounter = 0

function newLayer(w: number, h: number, name?: string): Layer {
  layerCounter++
  return {
    id: crypto.randomUUID(),
    name: name ?? `图层 ${layerCounter}`,
    visible: true,
    opacity: 1,
    blendMode: 'source-over',
    canvas: createCanvas(w, h),
  }
}

interface State {
  doc: { width: number; height: number } | null
  layers: Layer[] // index 0 = bottom
  activeLayerId: string | null
  tool: ToolId
  fgColor: string
  bgColor: string
  brushSize: number
  brushOpacity: number // 0..1
  brushHardness: number // 0..1
  wandTolerance: number
  fillTolerance: number
  gradientKind: 'linear' | 'radial'
  shapeKind: 'rect' | 'ellipse' | 'line'
  shapeFill: boolean
  shapeStrokeWidth: number
  fontSize: number
  fontFamily: string
  zoom: number
  selection: Selection | null
  cropRect: Rect | null
  stroke: StrokePreview | null
  toolPreview: ToolPreview | null
  transform: TransformState | null
  textEdit: TextEdit | null
  adjust: string | null
  dialog: 'new' | 'imageSize' | 'canvasSize' | null
  rev: number

  touch(): void
  setTool(t: ToolId): void
  set(partial: Partial<State>): void

  newDoc(w: number, h: number, bg: 'white' | 'transparent'): void
  openImage(img: HTMLImageElement, name: string): void
  closeDoc(): void

  addLayer(): void
  deleteLayer(id: string): void
  duplicateLayer(id: string): void
  setLayerProps(id: string, patch: Partial<Pick<Layer, 'name' | 'visible' | 'opacity' | 'blendMode'>>): void
  moveLayer(from: number, to: number): void
  mergeDown(): void
  flattenImage(): void

  commitLayerChange(layerId: string, before: ImageData, label: string): void

  selectAll(): void
  invertSel(): void
  deselect(): void
  deleteSelectionContent(): void

  applyCrop(): void
  commitText(value: string): void

  startTransform(): void
  applyTransform(): void
  cancelTransform(): void
  rotateLayer(kind: 'cw' | 'ccw' | '180' | 'flipH' | 'flipV'): void

  resizeImage(w: number, h: number): void
  resizeCanvas(w: number, h: number, ax: number, ay: number): void
  rotateCanvas(kind: 'cw' | 'ccw' | '180' | 'flipH' | 'flipV'): void

  exportImage(format: 'png' | 'jpeg'): void
  undo(): void
  redo(): void
}

export const useStore = create<State>((set, get) => ({
  doc: null,
  layers: [],
  activeLayerId: null,
  tool: 'brush',
  fgColor: '#000000',
  bgColor: '#ffffff',
  brushSize: 20,
  brushOpacity: 1,
  brushHardness: 1,
  wandTolerance: 32,
  fillTolerance: 32,
  gradientKind: 'linear',
  shapeKind: 'rect',
  shapeFill: true,
  shapeStrokeWidth: 0,
  fontSize: 48,
  fontFamily: 'sans-serif',
  zoom: 1,
  selection: null,
  cropRect: null,
  stroke: null,
  toolPreview: null,
  transform: null,
  textEdit: null,
  adjust: null,
  dialog: null,
  rev: 0,

  touch: () => set((s) => ({ rev: s.rev + 1 })),
  setTool: (tool) => set({ tool, cropRect: null, textEdit: null, toolPreview: null }),
  set: (partial) => set(partial),

  newDoc(w, h, bg) {
    layerCounter = 0
    const layer = newLayer(w, h, '背景')
    if (bg === 'white') {
      const ctx = getCtx(layer.canvas)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
    }
    history.clear()
    set((s) => ({
      doc: { width: w, height: h },
      layers: [layer],
      activeLayerId: layer.id,
      selection: null,
      cropRect: null,
      transform: null,
      zoom: 1,
      rev: s.rev + 1,
    }))
  },

  openImage(img, name) {
    const { doc } = get()
    if (!doc) {
      layerCounter = 0
      const layer = newLayer(img.width, img.height, name)
      getCtx(layer.canvas).drawImage(img, 0, 0)
      history.clear()
      set((s) => ({
        doc: { width: img.width, height: img.height },
        layers: [layer],
        activeLayerId: layer.id,
        selection: null,
        zoom: 1,
        rev: s.rev + 1,
      }))
    } else {
      const layer = newLayer(doc.width, doc.height, name)
      const ctx = getCtx(layer.canvas)
      ctx.drawImage(img, (doc.width - img.width) / 2, (doc.height - img.height) / 2)
      const index = get().layers.length
      const apply = () =>
        set((s) => ({ layers: [...s.layers, layer], activeLayerId: layer.id, rev: s.rev + 1 }))
      history.push({
        label: '置入图片',
        redo: apply,
        undo: () =>
          set((s) => ({
            layers: s.layers.filter((l) => l.id !== layer.id),
            activeLayerId: s.layers[index - 1]?.id ?? null,
            rev: s.rev + 1,
          })),
      })
      apply()
    }
  },

  closeDoc() {
    history.clear()
    set((s) => ({
      doc: null,
      layers: [],
      activeLayerId: null,
      selection: null,
      cropRect: null,
      transform: null,
      rev: s.rev + 1,
    }))
  },

  addLayer() {
    const { doc, layers, activeLayerId } = get()
    if (!doc) return
    const layer = newLayer(doc.width, doc.height)
    const at = layers.findIndex((l) => l.id === activeLayerId) + 1 || layers.length
    const apply = () =>
      set((s) => {
        const arr = [...s.layers]
        arr.splice(at, 0, layer)
        return { layers: arr, activeLayerId: layer.id, rev: s.rev + 1 }
      })
    history.push({
      label: '新建图层',
      redo: apply,
      undo: () =>
        set((s) => ({
          layers: s.layers.filter((l) => l.id !== layer.id),
          activeLayerId: activeLayerId,
          rev: s.rev + 1,
        })),
    })
    apply()
  },

  deleteLayer(id) {
    const { layers } = get()
    if (layers.length <= 1) return
    const index = layers.findIndex((l) => l.id === id)
    if (index < 0) return
    const layer = layers[index]
    const apply = () =>
      set((s) => {
        const arr = s.layers.filter((l) => l.id !== id)
        return {
          layers: arr,
          activeLayerId: s.activeLayerId === id ? (arr[Math.max(0, index - 1)]?.id ?? null) : s.activeLayerId,
          rev: s.rev + 1,
        }
      })
    history.push({
      label: '删除图层',
      redo: apply,
      undo: () =>
        set((s) => {
          const arr = [...s.layers]
          arr.splice(index, 0, layer)
          return { layers: arr, activeLayerId: layer.id, rev: s.rev + 1 }
        }),
    })
    apply()
  },

  duplicateLayer(id) {
    const { layers, doc } = get()
    if (!doc) return
    const index = layers.findIndex((l) => l.id === id)
    if (index < 0) return
    const src = layers[index]
    const copy = newLayer(doc.width, doc.height, `${src.name} 副本`)
    copy.opacity = src.opacity
    copy.blendMode = src.blendMode
    getCtx(copy.canvas).drawImage(src.canvas, 0, 0)
    const apply = () =>
      set((s) => {
        const arr = [...s.layers]
        arr.splice(index + 1, 0, copy)
        return { layers: arr, activeLayerId: copy.id, rev: s.rev + 1 }
      })
    history.push({
      label: '复制图层',
      redo: apply,
      undo: () =>
        set((s) => ({
          layers: s.layers.filter((l) => l.id !== copy.id),
          activeLayerId: src.id,
          rev: s.rev + 1,
        })),
    })
    apply()
  },

  setLayerProps(id, patch) {
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
      rev: s.rev + 1,
    }))
  },

  moveLayer(from, to) {
    if (from === to) return
    const apply = (f: number, t: number) =>
      set((s) => {
        const arr = [...s.layers]
        const [l] = arr.splice(f, 1)
        arr.splice(t, 0, l)
        return { layers: arr, rev: s.rev + 1 }
      })
    history.push({ label: '移动图层', redo: () => apply(from, to), undo: () => apply(to, from) })
    apply(from, to)
  },

  mergeDown() {
    const { layers, activeLayerId } = get()
    const index = layers.findIndex((l) => l.id === activeLayerId)
    if (index < 1) return
    const upper = layers[index]
    const lower = layers[index - 1]
    const lowerBefore = snapshot(lower.canvas)
    const apply = () => {
      const ctx = getCtx(lower.canvas)
      ctx.save()
      ctx.globalAlpha = upper.opacity
      ctx.globalCompositeOperation = upper.blendMode
      ctx.drawImage(upper.canvas, 0, 0)
      ctx.restore()
      set((s) => ({
        layers: s.layers.filter((l) => l.id !== upper.id),
        activeLayerId: lower.id,
        rev: s.rev + 1,
      }))
    }
    history.push({
      label: '向下合并',
      redo: apply,
      undo: () => {
        restore(lower.canvas, lowerBefore)
        set((s) => {
          const arr = [...s.layers]
          arr.splice(index, 0, upper)
          return { layers: arr, activeLayerId: upper.id, rev: s.rev + 1 }
        })
      },
    })
    apply()
  },

  flattenImage() {
    const { doc, layers } = get()
    if (!doc || layers.length <= 1) return
    const prevLayers = layers
    const prevActive = get().activeLayerId
    const merged = newLayer(doc.width, doc.height, '背景')
    getCtx(merged.canvas).drawImage(flatten(layers, doc.width, doc.height), 0, 0)
    const apply = () =>
      set((s) => ({ layers: [merged], activeLayerId: merged.id, rev: s.rev + 1 }))
    history.push({
      label: '拼合图像',
      redo: apply,
      undo: () =>
        set((s) => ({ layers: prevLayers, activeLayerId: prevActive, rev: s.rev + 1 })),
    })
    apply()
  },

  commitLayerChange(layerId, before, label) {
    const layer = get().layers.find((l) => l.id === layerId)
    if (!layer) return
    const after = snapshot(layer.canvas)
    const touch = get().touch
    history.push({
      label,
      undo: () => {
        restore(layer.canvas, before)
        touch()
      },
      redo: () => {
        restore(layer.canvas, after)
        touch()
      },
    })
  },

  selectAll() {
    const { doc } = get()
    if (!doc) return
    set({ selection: makeShapeSelection('rect', 0, 0, doc.width, doc.height, doc.width, doc.height) })
  },

  invertSel() {
    const { selection, doc } = get()
    if (!selection || !doc) return
    set({ selection: invertSelection(selection, doc.width, doc.height) })
  },

  deselect: () => set({ selection: null }),

  deleteSelectionContent() {
    const { selection, layers, activeLayerId, commitLayerChange } = get()
    const layer = layers.find((l) => l.id === activeLayerId)
    if (!selection || !layer) return
    const before = snapshot(layer.canvas)
    const ctx = getCtx(layer.canvas)
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.drawImage(selection.mask, 0, 0)
    ctx.restore()
    commitLayerChange(layer.id, before, '清除选区')
    get().touch()
  },

  applyCrop() {
    const { cropRect, doc } = get()
    if (!cropRect || !doc) return
    const r = {
      x: Math.round(cropRect.x),
      y: Math.round(cropRect.y),
      w: Math.max(1, Math.round(cropRect.w)),
      h: Math.max(1, Math.round(cropRect.h)),
    }
    transformAllLayers(get, set, '裁剪', r.w, r.h, (ctx, full) => ctx.drawImage(full, -r.x, -r.y))
    set({ cropRect: null })
  },

  commitText(value) {
    const { textEdit, doc, fgColor, fontSize, fontFamily, layers, activeLayerId } = get()
    if (!textEdit || !doc) return
    const text = value.trim()
    if (!text) {
      set({ textEdit: null })
      return
    }
    const layer = newLayer(doc.width, doc.height, text.slice(0, 12))
    const ctx = getCtx(layer.canvas)
    ctx.fillStyle = fgColor
    ctx.font = `${fontSize}px ${fontFamily}`
    ctx.textBaseline = 'top'
    const lines = text.split('\n')
    lines.forEach((line, i) => ctx.fillText(line, textEdit.x, textEdit.y + i * fontSize * 1.2))
    const at = layers.findIndex((l) => l.id === activeLayerId) + 1 || layers.length
    const prevActive = activeLayerId
    const apply = () =>
      set((s) => {
        const arr = [...s.layers]
        arr.splice(at, 0, layer)
        return { layers: arr, activeLayerId: layer.id, textEdit: null, rev: s.rev + 1 }
      })
    history.push({
      label: '文字',
      redo: apply,
      undo: () =>
        set((s) => ({
          layers: s.layers.filter((l) => l.id !== layer.id),
          activeLayerId: prevActive,
          rev: s.rev + 1,
        })),
    })
    apply()
  },

  startTransform() {
    const { layers, activeLayerId, transform } = get()
    if (transform) return
    const layer = layers.find((l) => l.id === activeLayerId)
    if (!layer) return
    const before = snapshot(layer.canvas)
    const t = makeTransform(layer.id, layer.canvas, before)
    if (!t) return
    // clear the layer so the compositor shows only the transform preview
    getCtx(layer.canvas).clearRect(0, 0, layer.canvas.width, layer.canvas.height)
    set((s) => ({ transform: t, selection: null, rev: s.rev + 1 }))
  },

  applyTransform() {
    const { transform, layers, commitLayerChange, touch } = get()
    const layer = layers.find((l) => l.id === transform?.layerId)
    if (!transform || !layer) return
    const ctx = getCtx(layer.canvas)
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
    drawTransformed(ctx, transform)
    commitLayerChange(layer.id, transform.before, '自由变换')
    set({ transform: null })
    touch()
  },

  cancelTransform() {
    const { transform, layers, touch } = get()
    const layer = layers.find((l) => l.id === transform?.layerId)
    if (transform && layer) restore(layer.canvas, transform.before)
    set({ transform: null })
    touch()
  },

  rotateLayer(kind) {
    const { layers, activeLayerId, doc, commitLayerChange, touch } = get()
    const layer = layers.find((l) => l.id === activeLayerId)
    if (!layer || !doc) return
    const before = snapshot(layer.canvas)
    const copy = createCanvas(doc.width, doc.height)
    getCtx(copy).drawImage(layer.canvas, 0, 0)
    const ctx = getCtx(layer.canvas)
    ctx.clearRect(0, 0, doc.width, doc.height)
    ctx.save()
    ctx.translate(doc.width / 2, doc.height / 2)
    if (kind === 'cw') ctx.rotate(Math.PI / 2)
    else if (kind === 'ccw') ctx.rotate(-Math.PI / 2)
    else if (kind === '180') ctx.rotate(Math.PI)
    else if (kind === 'flipH') ctx.scale(-1, 1)
    else ctx.scale(1, -1)
    ctx.drawImage(copy, -doc.width / 2, -doc.height / 2)
    ctx.restore()
    const labels = { cw: '旋转图层 90°', ccw: '旋转图层 -90°', '180': '旋转图层 180°', flipH: '水平翻转图层', flipV: '垂直翻转图层' }
    commitLayerChange(layer.id, before, labels[kind])
    touch()
  },

  resizeImage(w, h) {
    const { doc } = get()
    if (!doc || w < 1 || h < 1) return
    const sx = w / doc.width
    const sy = h / doc.height
    transformAllLayers(get, set, '图像大小', w, h, (ctx, full) => {
      ctx.scale(sx, sy)
      ctx.drawImage(full, 0, 0)
    })
  },

  resizeCanvas(w, h, ax, ay) {
    const { doc } = get()
    if (!doc || w < 1 || h < 1) return
    const dx = Math.round((w - doc.width) * ax)
    const dy = Math.round((h - doc.height) * ay)
    transformAllLayers(get, set, '画布大小', w, h, (ctx, full) => ctx.drawImage(full, dx, dy))
  },

  rotateCanvas(kind) {
    const { doc } = get()
    if (!doc) return
    const { width: ow, height: oh } = doc
    const swap = kind === 'cw' || kind === 'ccw'
    const nw = swap ? oh : ow
    const nh = swap ? ow : oh
    const labels = { cw: '旋转画布 90°', ccw: '旋转画布 -90°', '180': '旋转画布 180°', flipH: '水平翻转画布', flipV: '垂直翻转画布' }
    transformAllLayers(get, set, labels[kind], nw, nh, (ctx, full) => {
      ctx.translate(nw / 2, nh / 2)
      if (kind === 'cw') ctx.rotate(Math.PI / 2)
      else if (kind === 'ccw') ctx.rotate(-Math.PI / 2)
      else if (kind === '180') ctx.rotate(Math.PI)
      else if (kind === 'flipH') ctx.scale(-1, 1)
      else ctx.scale(1, -1)
      ctx.drawImage(full, -ow / 2, -oh / 2)
    })
  },

  exportImage(format) {
    const { doc, layers } = get()
    if (!doc) return
    const c = flatten(layers, doc.width, doc.height, format === 'jpeg' ? '#ffffff' : undefined)
    c.toBlob(
      (blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `未标题-1.${format === 'jpeg' ? 'jpg' : 'png'}`
        a.click()
        URL.revokeObjectURL(url)
      },
      `image/${format}`,
      0.92
    )
  },

  undo() {
    if (get().transform) {
      get().cancelTransform()
      return
    }
    if (history.undo()) get().touch()
  },
  redo() {
    if (history.redo()) get().touch()
  },
}))

type Get = () => State
type Set = (partial: Partial<State> | ((s: State) => Partial<State>)) => void

/** Resize/redraw every layer (crop, image size, canvas size, rotate canvas) with full undo. */
function transformAllLayers(
  get: Get,
  set: Set,
  label: string,
  newW: number,
  newH: number,
  draw: (ctx: CanvasRenderingContext2D, full: HTMLCanvasElement) => void
) {
  const { doc, layers } = get()
  if (!doc) return
  const prevDoc = { ...doc }
  const prevData = layers.map((l) => ({ layer: l, data: snapshot(l.canvas) }))
  const apply = () => {
    for (const { layer, data } of prevData) {
      const full = createCanvas(prevDoc.width, prevDoc.height)
      getCtx(full).putImageData(data, 0, 0)
      layer.canvas.width = newW
      layer.canvas.height = newH
      const ctx = getCtx(layer.canvas)
      ctx.save()
      draw(ctx, full)
      ctx.restore()
    }
    set((s) => ({ doc: { width: newW, height: newH }, selection: null, rev: s.rev + 1 }))
  }
  history.push({
    label,
    redo: apply,
    undo: () => {
      for (const { layer, data } of prevData) {
        layer.canvas.width = prevDoc.width
        layer.canvas.height = prevDoc.height
        restore(layer.canvas, data)
      }
      set((s) => ({ doc: prevDoc, selection: null, rev: s.rev + 1 }))
    },
  })
  apply()
}

export { drawThroughMask }

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = reject
    img.src = url
  })
}
