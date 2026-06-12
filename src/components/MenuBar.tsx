import { useEffect, useRef, useState } from 'react'
import { useStore, loadImageFile } from '../state/store'
import { applyInstantFilter, INSTANT_FILTER_LABELS, type InstantFilterType, type AdjustmentType } from '../filters'
import { applyRenderMasked } from '../core/selection'
import { snapshot } from '../core/document'
import { history } from '../core/history'

interface MenuItem {
  label: string
  shortcut?: string
  disabled?: boolean
  action?: () => void
  divider?: boolean
  header?: boolean
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
  const activeIndex = s.layers.findIndex((l) => l.id === s.activeLayerId)

  function instantFilter(type: InstantFilterType) {
    if (!activeLayer) return
    const before = snapshot(activeLayer.canvas)
    applyRenderMasked(activeLayer.canvas, before, s.selection, (target, src) =>
      applyInstantFilter(target, src, type)
    )
    s.commitLayerChange(activeLayer.id, before, INSTANT_FILTER_LABELS[type])
    s.touch()
  }

  const adjustItem = (type: AdjustmentType, label: string): MenuItem => ({
    label: `${label}…`,
    disabled: !activeLayer,
    action: () => s.set({ adjust: type }),
  })

  const menus: Record<string, MenuItem[]> = {
    文件: [
      { label: '新建…', shortcut: '⌘N', action: () => s.set({ dialog: 'new' }) },
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
      { label: '自由变换', shortcut: '⌘T', disabled: !activeLayer, action: () => s.startTransform() },
      { label: '', divider: true },
      { label: '全选', shortcut: '⌘A', disabled: !hasDoc, action: () => s.selectAll() },
      { label: '取消选择', shortcut: '⌘D', disabled: !s.selection, action: () => s.deselect() },
      { label: '反选', shortcut: '⇧⌘I', disabled: !s.selection, action: () => s.invertSel() },
      { label: '清除选区内容', shortcut: 'Delete', disabled: !s.selection, action: () => s.deleteSelectionContent() },
    ],
    图像: [
      { label: '图像大小…', disabled: !hasDoc, action: () => s.set({ dialog: 'imageSize' }) },
      { label: '画布大小…', disabled: !hasDoc, action: () => s.set({ dialog: 'canvasSize' }) },
      { label: '', divider: true },
      { label: '旋转画布', header: true },
      { label: '顺时针 90°', disabled: !hasDoc, action: () => s.rotateCanvas('cw') },
      { label: '逆时针 90°', disabled: !hasDoc, action: () => s.rotateCanvas('ccw') },
      { label: '180°', disabled: !hasDoc, action: () => s.rotateCanvas('180') },
      { label: '水平翻转', disabled: !hasDoc, action: () => s.rotateCanvas('flipH') },
      { label: '垂直翻转', disabled: !hasDoc, action: () => s.rotateCanvas('flipV') },
      { label: '', divider: true },
      { label: '调整', header: true },
      adjustItem('brightness', '亮度'),
      adjustItem('contrast', '对比度'),
      adjustItem('saturation', '饱和度'),
      adjustItem('hsl', '色相/饱和度'),
      adjustItem('levels', '色阶'),
      { label: '灰度', disabled: !activeLayer, action: () => instantFilter('grayscale') },
      { label: '反相', shortcut: '⌘I', disabled: !activeLayer, action: () => instantFilter('invert') },
    ],
    图层: [
      { label: '新建图层', shortcut: '⇧⌘N', disabled: !hasDoc, action: () => s.addLayer() },
      { label: '复制图层', disabled: !activeLayer, action: () => activeLayer && s.duplicateLayer(activeLayer.id) },
      {
        label: '删除图层',
        disabled: !activeLayer || s.layers.length <= 1,
        action: () => activeLayer && s.deleteLayer(activeLayer.id),
      },
      { label: '', divider: true },
      { label: '旋转/翻转图层', header: true },
      { label: '顺时针 90°', disabled: !activeLayer, action: () => s.rotateLayer('cw') },
      { label: '逆时针 90°', disabled: !activeLayer, action: () => s.rotateLayer('ccw') },
      { label: '180°', disabled: !activeLayer, action: () => s.rotateLayer('180') },
      { label: '水平翻转', disabled: !activeLayer, action: () => s.rotateLayer('flipH') },
      { label: '垂直翻转', disabled: !activeLayer, action: () => s.rotateLayer('flipV') },
      { label: '', divider: true },
      { label: '向下合并', shortcut: '⌘E', disabled: activeIndex < 1, action: () => s.mergeDown() },
      { label: '拼合图像', disabled: s.layers.length <= 1, action: () => s.flattenImage() },
    ],
    滤镜: [
      adjustItem('blur', '高斯模糊'),
      adjustItem('pixelate', '像素化'),
      adjustItem('noise', '添加噪点'),
      { label: '', divider: true },
      { label: '锐化', disabled: !activeLayer, action: () => instantFilter('sharpen') },
      { label: '浮雕', disabled: !activeLayer, action: () => instantFilter('emboss') },
      { label: '棕褐色', disabled: !activeLayer, action: () => instantFilter('sepia') },
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
                ) : item.header ? (
                  <div key={i} className="menu-header">
                    {item.label}
                  </div>
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
