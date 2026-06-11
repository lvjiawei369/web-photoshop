import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { snapshot, restore } from '../core/document'
import { applyAdjustment, ADJUSTMENT_LABELS, ADJUSTMENT_RANGES } from '../filters'

export function NewDocDialog() {
  const set = useStore((s) => s.set)
  const newDoc = useStore((s) => s.newDoc)
  const [w, setW] = useState(800)
  const [h, setH] = useState(600)
  const [bg, setBg] = useState<'white' | 'transparent'>('white')

  function create() {
    if (w > 0 && h > 0) {
      newDoc(Math.min(8000, w), Math.min(8000, h), bg)
      set({ showNewDoc: false })
    }
  }

  return (
    <div className="dialog-backdrop" onPointerDown={() => set({ showNewDoc: false })}>
      <div className="dialog" onPointerDown={(e) => e.stopPropagation()}>
        <h2>新建文档</h2>
        <div className="field">
          <label>宽度</label>
          <input type="number" min={1} max={8000} value={w} onChange={(e) => setW(+e.target.value)} />
          <span>px</span>
        </div>
        <div className="field">
          <label>高度</label>
          <input type="number" min={1} max={8000} value={h} onChange={(e) => setH(+e.target.value)} />
          <span>px</span>
        </div>
        <div className="field">
          <label>背景</label>
          <select value={bg} onChange={(e) => setBg(e.target.value as 'white' | 'transparent')}>
            <option value="white">白色</option>
            <option value="transparent">透明</option>
          </select>
        </div>
        <div className="buttons">
          <button className="secondary" onClick={() => set({ showNewDoc: false })}>
            取消
          </button>
          <button className="primary" onClick={create}>
            创建
          </button>
        </div>
      </div>
    </div>
  )
}

export function AdjustDialog() {
  const adjust = useStore((s) => s.adjust)!
  const set = useStore((s) => s.set)
  const touch = useStore((s) => s.touch)
  const commitLayerChange = useStore((s) => s.commitLayerChange)
  const layer = useStore((s) => s.layers.find((l) => l.id === s.activeLayerId))
  const range = ADJUSTMENT_RANGES[adjust]
  const [value, setValue] = useState(range.initial)
  const beforeRef = useRef<ImageData | null>(null)

  // capture original pixels once so the slider always re-applies from the source
  useEffect(() => {
    if (layer) beforeRef.current = snapshot(layer.canvas)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function preview(v: number) {
    setValue(v)
    if (layer && beforeRef.current) {
      applyAdjustment(layer.canvas, beforeRef.current, adjust, v)
      touch()
    }
  }

  function confirm() {
    if (layer && beforeRef.current) {
      commitLayerChange(layer.id, beforeRef.current, ADJUSTMENT_LABELS[adjust])
    }
    set({ adjust: null })
  }

  function cancel() {
    if (layer && beforeRef.current) {
      restore(layer.canvas, beforeRef.current)
      touch()
    }
    set({ adjust: null })
  }

  return (
    <div className="dialog-backdrop" onPointerDown={cancel}>
      <div className="dialog" onPointerDown={(e) => e.stopPropagation()}>
        <h2>{ADJUSTMENT_LABELS[adjust]}</h2>
        <div className="field">
          <input
            type="range"
            min={range.min}
            max={range.max}
            value={value}
            onChange={(e) => preview(+e.target.value)}
          />
          <span className="value">{value}</span>
        </div>
        <div className="buttons">
          <button className="secondary" onClick={cancel}>
            取消
          </button>
          <button className="primary" onClick={confirm}>
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
