import { create } from 'zustand'
import { createCanvas, getCtx, snapshot, restore, clipSelection } from '../core/document'
import { flatten } from '../core/compositor'
import { history } from '../core/history'

export interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number // 0..1
  canvas: HTMLCanvasElement
}

export type ToolId =
  | 'move'
  | 'marquee-rect'
  | 'marquee-ellipse'
  | 'crop'
  | 'eyedropper'
  | 'brush'
  | 'eraser'
  | 'fill'
  | 'text'
  | 'hand'
  | 'zoom'

export interface Selection {
  kind: 'rect' | 'ellipse'
  x: number
  y: number
  w: number
  h: number
}

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
  fontSize: number
  fontFamily: string
  zoom: number
  selection: Selection | null
  cropRect: Rect | null
  stroke: StrokePreview | null
  textEdit: TextEdit | null
  adjust: 'brightness' | 'contrast' | 'saturation' | 'blur' | null
  showNewDoc: boolean
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
  setLayerProps(id: string, patch: Partial<Pick<Layer, 'name' | 'visible' | 'opacity'>>): void
  moveLayer(from: number, to: number): void

  /** Push a history entry for pixel changes on a layer; call with the ImageData captured BEFORE the change. */
  commitLayerChange(layerId: string, before: ImageData, label: string): void

  deselect(): void
  deleteSelectionContent(): void
  applyCrop(): void
  commitText(value: string): void
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
  fontSize: 48,
  fontFamily: 'sans-serif',
  zoom: 1,
  selection: null,
  cropRect: null,
  stroke: null,
  textEdit: null,
  adjust: null,
  showNewDoc: false,
  rev: 0,

  touch: () => set((s) => ({ rev: s.rev + 1 })),
  setTool: (tool) => set({ tool, cropRect: null, textEdit: null }),
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
    set((s) => ({ doc: null, layers: [], activeLayerId: null, selection: null, cropRect: null, rev: s.rev + 1 }))
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

  deselect: () => set({ selection: null }),

  deleteSelectionContent() {
    const { selection, layers, activeLayerId, commitLayerChange } = get()
    const layer = layers.find((l) => l.id === activeLayerId)
    if (!selection || !layer) return
    const before = snapshot(layer.canvas)
    const ctx = getCtx(layer.canvas)
    ctx.save()
    clipSelection(ctx, selection)
    ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height)
    ctx.restore()
    commitLayerChange(layer.id, before, '清除选区')
    get().touch()
  },

  applyCrop() {
    const { cropRect, doc, layers, touch } = get()
    if (!cropRect || !doc) return
    const r = {
      x: Math.round(cropRect.x),
      y: Math.round(cropRect.y),
      w: Math.max(1, Math.round(cropRect.w)),
      h: Math.max(1, Math.round(cropRect.h)),
    }
    const prevDoc = { ...doc }
    const prevData = layers.map((l) => ({ layer: l, data: snapshot(l.canvas) }))
    const apply = () => {
      for (const { layer, data } of prevData) {
        const full = createCanvas(prevDoc.width, prevDoc.height)
        getCtx(full).putImageData(data, 0, 0)
        layer.canvas.width = r.w
        layer.canvas.height = r.h
        getCtx(layer.canvas).drawImage(full, -r.x, -r.y)
      }
      set((s) => ({ doc: { width: r.w, height: r.h }, cropRect: null, selection: null, rev: s.rev + 1 }))
    }
    history.push({
      label: '裁剪',
      redo: apply,
      undo: () => {
        for (const { layer, data } of prevData) {
          layer.canvas.width = prevDoc.width
          layer.canvas.height = prevDoc.height
          restore(layer.canvas, data)
        }
        set((s) => ({ doc: prevDoc, rev: s.rev + 1 }))
        touch()
      },
    })
    apply()
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
    if (history.undo()) get().touch()
  },
  redo() {
    if (history.redo()) get().touch()
  },
}))

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
