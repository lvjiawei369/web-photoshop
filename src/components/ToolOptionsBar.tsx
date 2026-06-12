import { useStore } from '../state/store'
import { zoomStep, zoomFit } from '../tools'

const TOOL_NAMES: Record<string, string> = {
  move: '移动',
  'marquee-rect': '矩形选框',
  'marquee-ellipse': '椭圆选框',
  lasso: '套索',
  wand: '魔棒',
  crop: '裁剪',
  eyedropper: '吸管',
  brush: '画笔',
  eraser: '橡皮擦',
  clone: '仿制图章',
  gradient: '渐变',
  fill: '油漆桶',
  shape: '形状',
  text: '文字',
  hand: '抓手',
  zoom: '缩放',
}

const FONTS = ['sans-serif', 'serif', 'monospace', 'PingFang SC', 'Songti SC', 'Arial', 'Georgia']

function BrushOptions() {
  const brushSize = useStore((s) => s.brushSize)
  const brushOpacity = useStore((s) => s.brushOpacity)
  const brushHardness = useStore((s) => s.brushHardness)
  const set = useStore((s) => s.set)
  return (
    <>
      <span className="option">
        大小
        <input type="range" min={1} max={200} value={brushSize} onChange={(e) => set({ brushSize: +e.target.value })} />
        <span className="value">{brushSize}px</span>
      </span>
      <span className="option">
        不透明度
        <input
          type="range"
          min={1}
          max={100}
          value={Math.round(brushOpacity * 100)}
          onChange={(e) => set({ brushOpacity: +e.target.value / 100 })}
        />
        <span className="value">{Math.round(brushOpacity * 100)}%</span>
      </span>
      <span className="option">
        硬度
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(brushHardness * 100)}
          onChange={(e) => set({ brushHardness: +e.target.value / 100 })}
        />
        <span className="value">{Math.round(brushHardness * 100)}%</span>
      </span>
    </>
  )
}

export function ToolOptionsBar() {
  const tool = useStore((s) => s.tool)
  const fontSize = useStore((s) => s.fontSize)
  const fontFamily = useStore((s) => s.fontFamily)
  const cropRect = useStore((s) => s.cropRect)
  const transform = useStore((s) => s.transform)
  const wandTolerance = useStore((s) => s.wandTolerance)
  const fillTolerance = useStore((s) => s.fillTolerance)
  const gradientKind = useStore((s) => s.gradientKind)
  const shapeKind = useStore((s) => s.shapeKind)
  const shapeFill = useStore((s) => s.shapeFill)
  const shapeStrokeWidth = useStore((s) => s.shapeStrokeWidth)
  const set = useStore((s) => s.set)
  const applyCrop = useStore((s) => s.applyCrop)
  const applyTransform = useStore((s) => s.applyTransform)
  const cancelTransform = useStore((s) => s.cancelTransform)

  if (transform) {
    return (
      <div className="tool-options">
        <span className="tool-name">自由变换</span>
        <span className="option">拖拽移动 / 角点缩放(Shift 等比) / 框外旋转，Enter 应用，Esc 取消</span>
        <button onClick={applyTransform}>应用</button>
        <button onClick={cancelTransform}>取消</button>
      </div>
    )
  }

  return (
    <div className="tool-options">
      <span className="tool-name">{TOOL_NAMES[tool]}</span>

      {(tool === 'brush' || tool === 'eraser' || tool === 'clone') && <BrushOptions />}
      {tool === 'clone' && <span className="option">Alt+单击取样，然后拖拽涂抹</span>}

      {tool === 'wand' && (
        <span className="option">
          容差
          <input type="range" min={0} max={150} value={wandTolerance} onChange={(e) => set({ wandTolerance: +e.target.value })} />
          <span className="value">{wandTolerance}</span>
        </span>
      )}

      {tool === 'fill' && (
        <span className="option">
          容差
          <input type="range" min={0} max={150} value={fillTolerance} onChange={(e) => set({ fillTolerance: +e.target.value })} />
          <span className="value">{fillTolerance}</span>
        </span>
      )}

      {tool === 'gradient' && (
        <>
          <span className="option">
            类型
            <select value={gradientKind} onChange={(e) => set({ gradientKind: e.target.value as 'linear' | 'radial' })}>
              <option value="linear">线性</option>
              <option value="radial">径向</option>
            </select>
          </span>
          <span className="option">从前景色到背景色，拖拽确定方向</span>
        </>
      )}

      {tool === 'shape' && (
        <>
          <span className="option">
            形状
            <select value={shapeKind} onChange={(e) => set({ shapeKind: e.target.value as 'rect' | 'ellipse' | 'line' })}>
              <option value="rect">矩形</option>
              <option value="ellipse">椭圆</option>
              <option value="line">直线</option>
            </select>
          </span>
          {shapeKind !== 'line' && (
            <span className="option">
              <label>
                <input type="checkbox" checked={shapeFill} onChange={(e) => set({ shapeFill: e.target.checked })} /> 填充
              </label>
            </span>
          )}
          <span className="option">
            描边
            <input
              type="number"
              min={0}
              max={100}
              value={shapeStrokeWidth}
              style={{ width: 48 }}
              onChange={(e) => set({ shapeStrokeWidth: Math.max(0, +e.target.value || 0) })}
            />
            px
          </span>
          <span className="option">Shift 等比/45°</span>
        </>
      )}

      {tool === 'text' && (
        <>
          <span className="option">
            字体
            <select value={fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </span>
          <span className="option">
            字号
            <input
              type="number"
              min={8}
              max={400}
              value={fontSize}
              style={{ width: 56 }}
              onChange={(e) => set({ fontSize: +e.target.value || 48 })}
            />
          </span>
          <span className="option">在画布上单击输入文字，Enter 确认</span>
        </>
      )}

      {tool === 'crop' && (
        <>
          <span className="option">拖拽框选裁剪区域，Enter 应用 / Esc 取消</span>
          {cropRect && (
            <>
              <button onClick={applyCrop}>应用</button>
              <button onClick={() => set({ cropRect: null })}>取消</button>
            </>
          )}
        </>
      )}

      {(tool === 'marquee-rect' || tool === 'marquee-ellipse' || tool === 'lasso') && (
        <span className="option">拖拽创建选区，Cmd+D 取消选择，Delete 清除内容，Shift+Cmd+I 反选</span>
      )}

      {tool === 'zoom' && (
        <>
          <button onClick={() => zoomStep(1)}>放大</button>
          <button onClick={() => zoomStep(-1)}>缩小</button>
          <button onClick={() => set({ zoom: 1 })}>100%</button>
          <button onClick={zoomFit}>适合窗口</button>
          <span className="option">单击放大，Alt+单击缩小</span>
        </>
      )}

      {tool === 'move' && <span className="option">拖拽移动当前图层内容，Cmd+T 自由变换</span>}
      {tool === 'eyedropper' && <span className="option">单击拾取前景色，Alt+单击拾取背景色</span>}
    </div>
  )
}
