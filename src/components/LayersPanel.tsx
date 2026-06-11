import { useEffect, useRef, useState } from 'react'
import { useStore, type Layer } from '../state/store'

function Thumb({ layer, rev }: { layer: Layer; rev: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    const scale = Math.min(c.width / layer.canvas.width, c.height / layer.canvas.height)
    const w = layer.canvas.width * scale
    const h = layer.canvas.height * scale
    ctx.drawImage(layer.canvas, (c.width - w) / 2, (c.height - h) / 2, w, h)
  }, [layer, rev])
  return <canvas ref={ref} className="thumb" width={44} height={34} />
}

export function LayersPanel() {
  const layers = useStore((s) => s.layers)
  const activeLayerId = useStore((s) => s.activeLayerId)
  const rev = useStore((s) => s.rev)
  const set = useStore((s) => s.set)
  const setLayerProps = useStore((s) => s.setLayerProps)
  const addLayer = useStore((s) => s.addLayer)
  const deleteLayer = useStore((s) => s.deleteLayer)
  const duplicateLayer = useStore((s) => s.duplicateLayer)
  const moveLayer = useStore((s) => s.moveLayer)
  const doc = useStore((s) => s.doc)

  const [renaming, setRenaming] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)

  const active = layers.find((l) => l.id === activeLayerId)
  const reversed = [...layers].reverse() // top layer first, like Photoshop

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return
    const from = layers.findIndex((l) => l.id === dragId)
    const to = layers.findIndex((l) => l.id === targetId)
    if (from < 0 || to < 0) return
    moveLayer(from, to)
  }

  return (
    <div className="panels">
      <div className="panel-title">图层</div>
      <div className="layers-controls">
        不透明度
        <input
          type="range"
          min={0}
          max={100}
          disabled={!active}
          value={active ? Math.round(active.opacity * 100) : 100}
          onChange={(e) => active && setLayerProps(active.id, { opacity: +e.target.value / 100 })}
        />
        <span style={{ width: 32, textAlign: 'right' }}>
          {active ? Math.round(active.opacity * 100) : 100}%
        </span>
      </div>
      <div className="layers-list">
        {reversed.map((layer) => (
          <div
            key={layer.id}
            className={`layer-row ${layer.id === activeLayerId ? 'active' : ''} ${
              dragOverId === layer.id && dragId !== layer.id ? 'drag-over' : ''
            }`}
            draggable={renaming !== layer.id}
            onClick={() => set({ activeLayerId: layer.id })}
            onDragStart={() => setDragId(layer.id)}
            onDragOver={(e) => {
              e.preventDefault()
              setDragOverId(layer.id)
            }}
            onDragLeave={() => setDragOverId((id) => (id === layer.id ? null : id))}
            onDrop={() => {
              onDrop(layer.id)
              setDragId(null)
              setDragOverId(null)
            }}
            onDragEnd={() => {
              setDragId(null)
              setDragOverId(null)
            }}
          >
            <button
              className={`eye ${layer.visible ? '' : 'hidden-layer'}`}
              title={layer.visible ? '隐藏图层' : '显示图层'}
              onClick={(e) => {
                e.stopPropagation()
                setLayerProps(layer.id, { visible: !layer.visible })
              }}
            >
              👁
            </button>
            <Thumb layer={layer} rev={rev} />
            <div className="name" onDoubleClick={() => setRenaming(layer.id)}>
              {renaming === layer.id ? (
                <input
                  autoFocus
                  defaultValue={layer.name}
                  onBlur={(e) => {
                    setLayerProps(layer.id, { name: e.target.value || layer.name })
                    setRenaming(null)
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                />
              ) : (
                layer.name
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="layers-footer">
        <button title="新建图层" disabled={!doc} onClick={addLayer}>
          ＋
        </button>
        <button
          title="复制图层"
          disabled={!active}
          onClick={() => active && duplicateLayer(active.id)}
        >
          ⧉
        </button>
        <button
          title="删除图层"
          disabled={!active || layers.length <= 1}
          onClick={() => active && deleteLayer(active.id)}
        >
          🗑
        </button>
      </div>
    </div>
  )
}
