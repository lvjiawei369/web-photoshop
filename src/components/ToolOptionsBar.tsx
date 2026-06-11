import { useStore } from '../state/store'
import { zoomStep } from '../tools'

const TOOL_NAMES: Record<string, string> = {
  move: '移动',
  'marquee-rect': '矩形选框',
  'marquee-ellipse': '椭圆选框',
  crop: '裁剪',
  eyedropper: '吸管',
  brush: '画笔',
  eraser: '橡皮擦',
  fill: '油漆桶',
  text: '文字',
  hand: '抓手',
  zoom: '缩放',
}

const FONTS = ['sans-serif', 'serif', 'monospace', 'PingFang SC', 'Songti SC', 'Arial', 'Georgia']

export function ToolOptionsBar() {
  const tool = useStore((s) => s.tool)
  const brushSize = useStore((s) => s.brushSize)
  const brushOpacity = useStore((s) => s.brushOpacity)
  const brushHardness = useStore((s) => s.brushHardness)
  const fontSize = useStore((s) => s.fontSize)
  const fontFamily = useStore((s) => s.fontFamily)
  const cropRect = useStore((s) => s.cropRect)
  const set = useStore((s) => s.set)
  const applyCrop = useStore((s) => s.applyCrop)

  return (
    <div className="tool-options">
      <span className="tool-name">{TOOL_NAMES[tool]}</span>

      {(tool === 'brush' || tool === 'eraser') && (
        <>
          <span className="option">
            大小
            <input
              type="range"
              min={1}
              max={200}
              value={brushSize}
              onChange={(e) => set({ brushSize: +e.target.value })}
            />
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

      {(tool === 'marquee-rect' || tool === 'marquee-ellipse') && (
        <span className="option">拖拽创建选区，Cmd+D 取消选择，Delete 清除内容</span>
      )}

      {tool === 'zoom' && (
        <>
          <button onClick={() => zoomStep(1)}>放大</button>
          <button onClick={() => zoomStep(-1)}>缩小</button>
          <button onClick={() => set({ zoom: 1 })}>100%</button>
          <span className="option">单击放大，Alt+单击缩小</span>
        </>
      )}

      {tool === 'move' && <span className="option">拖拽移动当前图层内容</span>}
      {tool === 'fill' && <span className="option">单击以前景色填充相近颜色区域</span>}
      {tool === 'eyedropper' && <span className="option">单击拾取颜色为前景色</span>}
    </div>
  )
}
