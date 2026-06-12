import { useEffect } from 'react'
import { useStore, loadImageFile, type ToolId } from './state/store'
import { zoomStep, zoomFit } from './tools'
import { MenuBar } from './components/MenuBar'
import { Toolbar } from './components/Toolbar'
import { ToolOptionsBar } from './components/ToolOptionsBar'
import { CanvasArea } from './components/CanvasArea'
import { LayersPanel } from './components/LayersPanel'
import { NewDocDialog, AdjustDialog, ImageSizeDialog, CanvasSizeDialog } from './components/Dialogs'

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'move',
  m: 'marquee-rect',
  l: 'lasso',
  w: 'wand',
  c: 'crop',
  i: 'eyedropper',
  b: 'brush',
  e: 'eraser',
  s: 'clone',
  g: 'gradient',
  u: 'shape',
  t: 'text',
  h: 'hand',
  z: 'zoom',
}

function App() {
  const doc = useStore((s) => s.doc)
  const zoom = useStore((s) => s.zoom)
  const dialog = useStore((s) => s.dialog)
  const adjust = useStore((s) => s.adjust)

  // global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      const s = useStore.getState()
      const mod = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (mod) {
        if (key === 'z') {
          e.preventDefault()
          e.shiftKey ? s.redo() : s.undo()
        } else if (key === 'a') {
          e.preventDefault()
          s.selectAll()
        } else if (key === 'd') {
          e.preventDefault()
          s.deselect()
        } else if (key === 'i' && e.shiftKey) {
          e.preventDefault()
          s.invertSel()
        } else if (key === 't') {
          e.preventDefault()
          s.startTransform()
        } else if (key === 'e') {
          e.preventDefault()
          s.mergeDown()
        } else if (key === 'n') {
          e.preventDefault()
          e.shiftKey ? s.addLayer() : s.set({ dialog: 'new' })
        } else if (key === '=' || key === '+') {
          e.preventDefault()
          zoomStep(1)
        } else if (key === '-') {
          e.preventDefault()
          zoomStep(-1)
        } else if (key === '0') {
          e.preventDefault()
          zoomFit()
        } else if (key === '1') {
          e.preventDefault()
          s.set({ zoom: 1 })
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selection) {
          e.preventDefault()
          s.deleteSelectionContent()
        }
        return
      }
      if (e.key === 'Enter') {
        if (s.transform) s.applyTransform()
        else if (s.cropRect) s.applyCrop()
        return
      }
      if (e.key === 'Escape') {
        if (s.transform) s.cancelTransform()
        else s.set({ cropRect: null, selection: null })
        return
      }
      if (e.key === '[') {
        s.set({ brushSize: Math.max(1, s.brushSize - 5) })
        return
      }
      if (e.key === ']') {
        s.set({ brushSize: Math.min(400, s.brushSize + 5) })
        return
      }
      if (key === 'x') {
        s.set({ fgColor: s.bgColor, bgColor: s.fgColor })
        return
      }
      if (key === 'm' && s.tool === 'marquee-rect') {
        s.setTool('marquee-ellipse')
        return
      }
      const tool = TOOL_KEYS[key]
      if (tool) s.setTool(tool)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // drag & drop image anywhere to open
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault()
    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      const file = e.dataTransfer?.files?.[0]
      if (!file || !file.type.startsWith('image/')) return
      const img = await loadImageFile(file)
      useStore.getState().openImage(img, file.name.replace(/\.[^.]+$/, ''))
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('drop', onDrop)
    }
  }, [])

  return (
    <div className="app">
      <MenuBar />
      <ToolOptionsBar />
      <div className="main">
        <Toolbar />
        <CanvasArea />
        <LayersPanel />
      </div>
      <div className="statusbar">
        <span>{Math.round(zoom * 100)}%</span>
        {doc && (
          <span>
            文档：{doc.width} × {doc.height} px
          </span>
        )}
        <span>Web Photoshop — 演示原型</span>
      </div>
      {dialog === 'new' && <NewDocDialog />}
      {dialog === 'imageSize' && doc && <ImageSizeDialog />}
      {dialog === 'canvasSize' && doc && <CanvasSizeDialog />}
      {adjust && <AdjustDialog />}
    </div>
  )
}

export default App
