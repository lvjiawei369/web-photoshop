import { useEffect, useRef, useState } from 'react'
import { useStore, loadImageFile } from '../state/store'
import { composite } from '../core/compositor'
import { TOOLS, zoomStep } from '../tools'

export function CanvasArea() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const openRef = useRef<HTMLInputElement>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)
  const [textValue, setTextValue] = useState('')

  const doc = useStore((s) => s.doc)
  const rev = useStore((s) => s.rev)
  const zoom = useStore((s) => s.zoom)
  const tool = useStore((s) => s.tool)
  const selection = useStore((s) => s.selection)
  const cropRect = useStore((s) => s.cropRect)
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
    composite(canvas, s.layers, s.stroke, doc.width, doc.height)
  }, [rev, doc])

  // marching ants / crop rect on overlay (display resolution for crisp lines)
  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay || !doc) return
    const ctx = overlay.getContext('2d')!
    let raf = 0
    const draw = () => {
      ctx.clearRect(0, 0, overlay.width, overlay.height)
      const offset = (performance.now() / 100) % 8
      const z = zoom
      ctx.lineWidth = 1
      if (selection) {
        ctx.setLineDash([4, 4])
        for (const color of ['#000', '#fff'] as const) {
          ctx.strokeStyle = color
          ctx.lineDashOffset = color === '#fff' ? -offset : -offset + 4
          ctx.beginPath()
          if (selection.kind === 'rect') {
            ctx.rect(selection.x * z, selection.y * z, selection.w * z, selection.h * z)
          } else {
            ctx.ellipse(
              (selection.x + selection.w / 2) * z,
              (selection.y + selection.h / 2) * z,
              (selection.w / 2) * z,
              (selection.h / 2) * z,
              0,
              0,
              Math.PI * 2
            )
          }
          ctx.stroke()
        }
      }
      if (cropRect) {
        ctx.setLineDash([])
        ctx.fillStyle = 'rgba(0,0,0,0.5)'
        ctx.beginPath()
        ctx.rect(0, 0, overlay.width, overlay.height)
        ctx.rect(cropRect.x * z, cropRect.y * z, cropRect.w * z, cropRect.h * z)
        ctx.fill('evenodd')
        ctx.strokeStyle = '#ffffff'
        ctx.strokeRect(cropRect.x * z, cropRect.y * z, cropRect.w * z, cropRect.h * z)
      }
      if (selection || cropRect) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [selection, cropRect, doc, zoom])

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
      if (kind === 'down') {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
      }
      if (kind === 'move' && !(e.buttons & 1)) return
      const { x, y } = toDocCoords(e)
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
            <button onClick={() => set({ showNewDoc: true })}>新建文档</button>
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

  return (
    <div className="canvas-area" ref={scrollRef}>
      <div className="canvas-wrapper">
        <div
          className="canvas-stack"
          style={{ width: displayW, height: displayH, cursor: TOOLS[tool].cursor }}
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
