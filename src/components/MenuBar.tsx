import { useEffect, useRef, useState } from 'react'
import { useStore, loadImageFile } from '../state/store'
import { applyInstantFilter } from '../filters'
import { snapshot } from '../core/document'
import { history } from '../core/history'

interface MenuItem {
  label: string
  shortcut?: string
  disabled?: boolean
  action?: () => void
  divider?: boolean
}

export function MenuBar() {
  const [open, setOpen] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const s = useStore()

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])

  const hasDoc = !!s.doc
  const activeLayer = s.layers.find((l) => l.id === s.activeLayerId)

  function instantFilter(type: 'grayscale' | 'invert', label: string) {
    if (!activeLayer) return
    const before = snapshot(activeLayer.canvas)
    applyInstantFilter(activeLayer.canvas, type)
    s.commitLayerChange(activeLayer.id, before, label)
    s.touch()
  }

  const menus: Record<string, MenuItem[]> = {
    文件: [
      { label: '新建…', shortcut: '⌘N', action: () => s.set({ showNewDoc: true }) },
      { label: '打开…', shortcut: '⌘O', action: () => fileRef.current?.click() },
      { label: '', divider: true },
      { label: '导出为 PNG', disabled: !hasDoc, action: () => s.exportImage('png') },
      { label: '导出为 JPEG', disabled: !hasDoc, action: () => s.exportImage('jpeg') },
      { label: '', divider: true },
      { label: '关闭文档', disabled: !hasDoc, action: () => s.closeDoc() },
    ],
    编辑: [
      { label: '还原', shortcut: '⌘Z', disabled: !history.canUndo(), action: () => s.undo() },
      { label: '重做', shortcut: '⇧⌘Z', disabled: !history.canRedo(), action: () => s.redo() },
      { label: '', divider: true },
      { label: '取消选择', shortcut: '⌘D', disabled: !s.selection, action: () => s.deselect() },
      { label: '清除选区内容', shortcut: 'Delete', disabled: !s.selection, action: () => s.deleteSelectionContent() },
    ],
    图像: [
      { label: '亮度…', disabled: !activeLayer, action: () => s.set({ adjust: 'brightness' }) },
      { label: '对比度…', disabled: !activeLayer, action: () => s.set({ adjust: 'contrast' }) },
      { label: '饱和度…', disabled: !activeLayer, action: () => s.set({ adjust: 'saturation' }) },
      { label: '高斯模糊…', disabled: !activeLayer, action: () => s.set({ adjust: 'blur' }) },
      { label: '', divider: true },
      { label: '灰度', disabled: !activeLayer, action: () => instantFilter('grayscale', '灰度') },
      { label: '反相', disabled: !activeLayer, action: () => instantFilter('invert', '反相') },
    ],
    图层: [
      { label: '新建图层', shortcut: '⇧⌘N', disabled: !hasDoc, action: () => s.addLayer() },
      {
        label: '复制图层',
        disabled: !activeLayer,
        action: () => activeLayer && s.duplicateLayer(activeLayer.id),
      },
      {
        label: '删除图层',
        disabled: !activeLayer || s.layers.length <= 1,
        action: () => activeLayer && s.deleteLayer(activeLayer.id),
      },
    ],
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const img = await loadImageFile(file)
    s.openImage(img, file.name.replace(/\.[^.]+$/, ''))
  }

  return (
    <div className="menubar">
      <span className="logo">Ps</span>
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} className={`menu ${open === name ? 'open' : ''}`}>
          <button
            onPointerDown={(e) => {
              e.stopPropagation()
              setOpen(open === name ? null : name)
            }}
            onPointerEnter={() => open && setOpen(name)}
          >
            {name}
          </button>
          {open === name && (
            <div className="menu-dropdown" onPointerDown={(e) => e.stopPropagation()}>
              {items.map((item, i) =>
                item.divider ? (
                  <hr key={i} />
                ) : (
                  <button
                    key={i}
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(null)
                      item.action?.()
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFileChosen} />
    </div>
  )
}
