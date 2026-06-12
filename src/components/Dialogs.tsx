import { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { snapshot, restore } from '../core/document'
import { applyRenderMasked } from '../core/selection'
import { applyAdjustment, ADJUSTMENTS, type AdjustmentType } from '../filters'

export function NewDocDialog() {
  const set = useStore((s) => s.set)
  const newDoc = useStore((s) => s.newDoc)
  const [w, setW] = useState(800)
  const [h, setH] = useState(600)
  const [bg, setBg] = useState<'white' | 'transparent'>('white')

  function create() {
    if (w > 0 && h > 0) {
      newDoc(Math.min(8000, w), Math.min(8000, h), bg)
      set({ dialog: null })
    }
  }

  return (
    <div className="dialog-backdrop" onPointerDown={() => set({ dialog: null })}>
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
          <button className="secondary" onClick={() => set({ dialog: null })}>
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
  const adjust = useStore((s) => s.adjust) as AdjustmentType
  const set = useStore((s) => s.set)
  const touch = useStore((s) => s.touch)
  const commitLayerChange = useStore((s) => s.commitLayerChange)
  const layer = useStore((s) => s.layers.find((l) => l.id === s.activeLayerId))
  const def = ADJUSTMENTS[adjust]
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(def.params.map((p) => [p.key, p.initial]))
  )
  const beforeRef = useRef<ImageData | null>(null)

  // capture original pixels once so sliders always re-apply from the source
  useEffect(() => {
    if (layer) {
      beforeRef.current = snapshot(layer.canvas)
      // apply initial values immediately (some filters like pixelate have a visible initial state)
      preview({ ...values })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function preview(v: Record<string, number>) {
    setValues(v)
    if (layer && beforeRef.current) {
      const sel = useStore.getState().selection
      applyRenderMasked(layer.canvas, beforeRef.current, sel, (target, src) =>
        applyAdjustment(target, src, adjust, v)
      )
      touch()
    }
  }

  function confirm() {
    if (layer && beforeRef.current) {
      commitLayerChange(layer.id, beforeRef.current, def.label)
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
        <h2>{def.label}</h2>
        {def.params.map((p) => (
          <div className="field" key={p.key}>
            <label>{p.label}</label>
            <input
              type="range"
              min={p.min}
              max={p.max}
              value={values[p.key]}
              onChange={(e) => preview({ ...values, [p.key]: +e.target.value })}
            />
            <span className="value">{adjust === 'levels' && p.key === 'gamma' ? (values[p.key] / 100).toFixed(2) : values[p.key]}</span>
          </div>
        ))}
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

export function ImageSizeDialog() {
  const doc = useStore((s) => s.doc)!
  const set = useStore((s) => s.set)
  const resizeImage = useStore((s) => s.resizeImage)
  const [w, setW] = useState(doc.width)
  const [h, setH] = useState(doc.height)
  const [lockRatio, setLockRatio] = useState(true)
  const ratio = doc.width / doc.height

  return (
    <div className="dialog-backdrop" onPointerDown={() => set({ dialog: null })}>
      <div className="dialog" onPointerDown={(e) => e.stopPropagation()}>
        <h2>图像大小</h2>
        <div className="field">
          <label>宽度</label>
          <input
            type="number"
            min={1}
            max={8000}
            value={w}
            onChange={(e) => {
              const v = +e.target.value
              setW(v)
              if (lockRatio) setH(Math.max(1, Math.round(v / ratio)))
            }}
          />
          <span>px</span>
        </div>
        <div className="field">
          <label>高度</label>
          <input
            type="number"
            min={1}
            max={8000}
            value={h}
            onChange={(e) => {
              const v = +e.target.value
              setH(v)
              if (lockRatio) setW(Math.max(1, Math.round(v * ratio)))
            }}
          />
          <span>px</span>
        </div>
        <div className="field">
          <label></label>
          <label style={{ width: 'auto', textAlign: 'left' }}>
            <input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} /> 约束比例
          </label>
        </div>
        <div className="buttons">
          <button className="secondary" onClick={() => set({ dialog: null })}>
            取消
          </button>
          <button
            className="primary"
            onClick={() => {
              if (w > 0 && h > 0) resizeImage(Math.min(8000, w), Math.min(8000, h))
              set({ dialog: null })
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}

const ANCHORS: [number, number][] = [
  [0, 0], [0.5, 0], [1, 0],
  [0, 0.5], [0.5, 0.5], [1, 0.5],
  [0, 1], [0.5, 1], [1, 1],
]

export function CanvasSizeDialog() {
  const doc = useStore((s) => s.doc)!
  const set = useStore((s) => s.set)
  const resizeCanvas = useStore((s) => s.resizeCanvas)
  const [w, setW] = useState(doc.width)
  const [h, setH] = useState(doc.height)
  const [anchor, setAnchor] = useState(4) // center

  return (
    <div className="dialog-backdrop" onPointerDown={() => set({ dialog: null })}>
      <div className="dialog" onPointerDown={(e) => e.stopPropagation()}>
        <h2>画布大小</h2>
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
          <label>定位</label>
          <div className="anchor-grid">
            {ANCHORS.map(([ax, ay], i) => (
              <button
                key={i}
                className={anchor === i ? 'active' : ''}
                onClick={() => setAnchor(i)}
                title={`${ax},${ay}`}
              />
            ))}
          </div>
        </div>
        <div className="buttons">
          <button className="secondary" onClick={() => set({ dialog: null })}>
            取消
          </button>
          <button
            className="primary"
            onClick={() => {
              const [ax, ay] = ANCHORS[anchor]
              if (w > 0 && h > 0) resizeCanvas(Math.min(8000, w), Math.min(8000, h), ax, ay)
              set({ dialog: null })
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
