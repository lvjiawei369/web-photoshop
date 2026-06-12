import { useEffect, useRef, useState } from 'react'
import { useStore, loadImageFile } from '../state/store'
import { composite } from '../core/compositor'
import {
  hitTest,
  handlePoints,
  scaleByHandle,
  type TransformState,
  type TransformHandle,
} from '../core/transform'
import { TOOLS, zoomStep } from '../tools'

interface TransformDrag {
  handle: TransformHandle
  startX: number
  startY: number
  t0: TransformState
}

export function CanvasArea() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const openRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const transformDrag = useRef<TransformDrag | null>(null)
  const [textValue, setTextValue] = useState('')

  const doc = useStore((s) => s.doc)
  const rev = useStore((s) => s.rev)
  const zoom = useStore((s) => s.zoom)
  const tool = useStore((s) => s.tool)
  const selection = useStore((s) => s.selection)
  const cropRect = useStore((s) => s.cropRect)
  const toolPreview = useStore((s) => s.toolPreview)
  const transform = useStore((s) => s.transform)
  const textEdit = useStore((s) => s.textEdit)
  const fgColor = useStore((s) => s.fgColor)
  const fontSize = useStore((s) => s.fontSize)
  const fontFamily = useStore((s) => s.fontFamily)
  const set = useStore((s) => s.set)
  const commitText = useStore((s) => s.commitText)

  // composite layers to main canvas on every document change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !doc) return
    const s = useStore.getState()
    composite(canvas, s.layers, s.stroke, s.transform, doc.width, doc.height)
  }, [rev, doc, transform])

  // overlay: marching ants, crop rect, tool previews, transform box
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay || !doc) return
    const ctx = overlay.getContext('2d')!
    let raf = 0
    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, overlay.width, overlay.height)
      const z = zoom
      const offset = (performance.now() / 100) % 8

      if (selection) {
        ctx.save()
        ctx.scale(z, z)
        ctx.lineWidth = 1 / z
        ctx.setLineDash([4 / z, 4 / z])
        ctx.strokeStyle = '#000'
        ctx.lineDashOffset = (-offset + 4) / z
        ctx.stroke(selection.boundary)
        ctx.strokeStyle = '#fff'
        ctx.lineDashOffset = -offset / z
        ctx.stroke(selection.boundary)
        ctx.restore()
      }

      if (cropRect) {
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.beginPath()
        ctx.rect(0, 0, overlay.width, overlay.height)
        ctx.rect(cropRect.x * z, cropRect.y * z, cropRect.w * z, cropRect.h * z)
        ctx.fill('evenodd')
        ctx.strokeStyle = '#ffffff'
        ctx.lineWidth = 1
        ctx.strokeRect(cropRect.x * z, cropRect.y * z, cropRect.w * z, cropRect.h * z)
      }

      if (toolPreview) {
        ctx.setLineDash([])
        ctx.lineWidth = 1
        ctx.strokeStyle = '#1473e6'
        ctx.beginPath()
        if (toolPreview.kind === 'lasso') {
          const pts = toolPreview.points
          if (pts.length > 1) {
            ctx.moveTo(pts[0].x * z, pts[0].y * z)
            for (const p of pts) ctx.lineTo(p.x * z, p.y * z)
          }
        } else if (toolPreview.kind === 'gradient') {
          ctx.moveTo(toolPreview.x0 * z, toolPreview.y0 * z)
          ctx.lineTo(toolPreview.x1 * z, toolPreview.y1 * z)
        } else if (toolPreview.kind === 'shape') {
          const { shape, x0, y0, x1, y1 } = toolPreview
          if (shape === 'line') {
            ctx.moveTo(x0 * z, y0 * z)
            ctx.lineTo(x1 * z, y1 * z)
          } else {
            const x = Math.min(x0, x1) * z
            const y = Math.min(y0, y1) * z
            const w = Math.abs(x1 - x0) * z
            const h = Math.abs(y1 - y0) * z
            if (shape === 'rect') ctx.rect(x, y, w, h)
            else ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
          }
        }
        ctx.stroke()
      }

      if (transform) {
        const pts = handlePoints(transform)
        const order = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
        ctx.setLineDash([])
        ctx.strokeStyle = '#1473e6'
        ctx.lineWidth = 1
        ctx.beginPath()
        const corners = ['nw', 'ne', 'se', 'sw']
        corners.forEach((k, i) => {
          const p = pts[k]
          if (i === 0) ctx.moveTo(p.x * z, p.y * z)
          else ctx.lineTo(p.x * z, p.y * z)
        })
        ctx.closePath()
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        for (const k of order) {
          const p = pts[k]
          ctx.fillRect(p.x * z - 4, p.y * z - 4, 8, 8)
          ctx.strokeRect(p.x * z - 4, p.y * z - 4, 8, 8)
        }
      }

      if (selection || cropRect || toolPreview || transform) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [selection, cropRect, toolPreview, transform, doc, zoom])

  // ctrl/cmd + wheel zoom (needs non-passive listener)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      zoomStep(e.deltaY < 0 ? 1 : -1)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // focus text input when editing starts
  useEffect(() => {
    if (textEdit) {
      setTextValue('')
      setTimeout(() => textRef.current?.focus(), 0)
    }
  }, [textEdit])

  function toDocCoords(e: React.PointerEvent): { x: number; y: number } {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom }
  }

  function handlePointer(kind: 'down' | 'move' | 'up') {
    return (e: React.PointerEvent) => {
      if (!doc) return
      const { x, y } = toDocCoords(e)
      const s = useStore.getState()

      // free transform interaction takes priority over tools
      if (s.transform) {
        if (kind === 'down') {
          if (e.button !== 0) return
          e.currentTarget.setPointerCapture(e.pointerId)
          const handle = hitTest(s.transform, x, y, 6 / zoom + 4)
          if (handle) transformDrag.current = { handle, startX: x, startY: y, t0: s.transform }
        } else if (kind === 'move' && transformDrag.current && e.buttons & 1) {
          const { handle, startX, startY, t0 } = transformDrag.current
          if (handle === 'move') {
            set({ transform: { ...t0, x: t0.x + (x - startX), y: t0.y + (y - startY) } })
          } else if (handle === 'rotate') {
            const cx = t0.x + t0.w / 2
            const cy = t0.y + t0.h / 2
            const a0 = Math.atan2(startY - cy, startX - cx)
            const a1 = Math.atan2(y - cy, x - cx)
            let rot = t0.rotation + a1 - a0
            if (e.shiftKey) rot = Math.round(rot / (Math.PI / 12)) * (Math.PI / 12)
            set({ transform: { ...t0, rotation: rot } })
          } else {
            set({ transform: scaleByHandle(t0, handle, x, y, e.shiftKey) })
          }
        } else if (kind === 'up') {
          transformDrag.current = null
        }
        return
      }

      if (kind === 'down') {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      if (kind === 'move' && !(e.buttons & 1)) return
      TOOLS[tool][kind]({ x, y, e: e.nativeEvent, scrollEl: scrollRef.current })
    }
  }

  async function onOpenFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const img = await loadImageFile(file)
    useStore.getState().openImage(img, file.name.replace(/\.[^.]+$/, ''))
  }

  if (!doc) {
    return (
      <div className="canvas-area" ref={scrollRef}>
        <div className="welcome">
          <h1>Web Photoshop</h1>
          <p>新建一个文档，或打开一张图片开始编辑</p>
          <div className="actions">
            <button onClick={() => set({ dialog: 'new' })}>新建文档</button>
            <button className="secondary" onClick={() => openRef.current?.click()}>
              打开图片
            </button>
          </div>
          <input ref={openRef} type="file" accept="image/*" hidden onChange={onOpenFile} />
        </div>
      </div>
    )
  }

  const displayW = Math.round(doc.width * zoom)
  const displayH = Math.round(doc.height * zoom)
  const cursor = transform ? 'default' : TOOLS[tool].cursor

  return (
    <div className="canvas-area" ref={scrollRef}>
      <div className="canvas-wrapper">
        <div
          className="canvas-stack"
          style={{ width: displayW, height: displayH, cursor }}
          onPointerDown={handlePointer('down')}
          onPointerMove={handlePointer('move')}
          onPointerUp={handlePointer('up')}
        >
          <canvas
            ref={canvasRef}
            width={doc.width}
            height={doc.height}
            style={{ width: displayW, height: displayH }}
          />
          <canvas ref={overlayRef} className="overlay" width={displayW} height={displayH} />
          {textEdit && (
            <textarea
              ref={textRef}
              className="text-edit"
              value={textValue}
              spellCheck={false}
              style={{
                left: textEdit.x * zoom,
                top: textEdit.y * zoom,
                color: fgColor,
                font: `${fontSize * zoom}px ${fontFamily}`,
              }}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitText(textValue)
                } else if (e.key === 'Escape') {
                  set({ textEdit: null })
                }
              }}
              onBlur={() => commitText(textValue)}
              onPointerDown={(e) => e.stopPropagation()}
            />
          )}
        </div>
      </div>
    </div>
  )
}
