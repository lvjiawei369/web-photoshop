import { useEffect } from 'react'
import { useStore, loadImageFile, type ToolId } from './state/store'
import { MenuBar } from './components/MenuBar'
import { Toolbar } from './components/Toolbar'
import { ToolOptionsBar } from './components/ToolOptionsBar'
import { CanvasArea } from './components/CanvasArea'
import { LayersPanel } from './components/LayersPanel'
import { NewDocDialog, AdjustDialog } from './components/Dialogs'

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'move',
  m: 'marquee-rect',
  c: 'crop',
  i: 'eyedropper',
  b: 'brush',
  e: 'eraser',
  g: 'fill',
  t: 'text',
  h: 'hand',
  z: 'zoom',
}

function App() {
  const doc = useStore((s) => s.doc)
  const zoom = useStore((s) => s.zoom)
  const showNewDoc = useStore((s) => s.showNewDoc)
  const adjust = useStore((s) => s.adjust)

  // global keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return
      const s = useStore.getState()
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? s.redo() : s.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        s.deselect()
        return
      }
      if (mod && e.key.toLowerCase() === 'n') {
        e.preventDefault()
        e.shiftKey ? s.addLayer() : s.set({ showNewDoc: true })
        return
      }
      if (mod) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selection) {
          e.preventDefault()
          s.deleteSelectionContent()
        }
        return
      }
      if (e.key === 'Enter' && s.cropRect) {
        s.applyCrop()
        return
      }
      if (e.key === 'Escape') {
        s.set({ cropRect: null, selection: null })
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
      if (e.key.toLowerCase() === 'x') {
        s.set({ fgColor: s.bgColor, bgColor: s.fgColor })
        return
      }
      const key = e.key.toLowerCase()
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
      {showNewDoc && <NewDocDialog />}
      {adjust && <AdjustDialog />}
    </div>
  )
}

export default App
