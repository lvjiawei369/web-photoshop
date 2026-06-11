import { useStore, type ToolId } from '../state/store'

const ICONS: Record<ToolId, React.ReactNode> = {
  move: (
    <svg viewBox="0 0 20 20">
      <path d="M10 2v16M2 10h16M10 2l-2.5 2.5M10 2l2.5 2.5M10 18l-2.5-2.5M10 18l2.5-2.5M2 10l2.5-2.5M2 10l2.5 2.5M18 10l-2.5-2.5M18 10l-2.5 2.5" />
    </svg>
  ),
  'marquee-rect': (
    <svg viewBox="0 0 20 20">
      <rect x="3" y="4" width="14" height="12" strokeDasharray="3 2" />
    </svg>
  ),
  'marquee-ellipse': (
    <svg viewBox="0 0 20 20">
      <ellipse cx="10" cy="10" rx="7" ry="6" strokeDasharray="3 2" />
    </svg>
  ),
  crop: (
    <svg viewBox="0 0 20 20">
      <path d="M5 2v13h13M2 5h13v13" />
    </svg>
  ),
  eyedropper: (
    <svg viewBox="0 0 20 20">
      <path d="M12.5 7.5L4 16l-1.5.5L3 15l8.5-8.5M11 5l4 4M13 3.5a2 2 0 013.5 3.5l-2 2-4-4 2-1.5z" />
    </svg>
  ),
  brush: (
    <svg viewBox="0 0 20 20">
      <path d="M16 3l-8 8 1 1 8-8a.7.7 0 00-1-1zM8 12c-2 0-3 1-3.5 3-.2.8-1 1.3-1.5 1.5 3 1.5 6-.5 6-2.5L8 12z" />
    </svg>
  ),
  eraser: (
    <svg viewBox="0 0 20 20">
      <path d="M8 16l-4.5-4.5a1 1 0 010-1.4l6.6-6.6a1 1 0 011.4 0l4.5 4.5a1 1 0 010 1.4L10 16H8zM6 8.5L11.5 14M8 16h9" />
    </svg>
  ),
  fill: (
    <svg viewBox="0 0 20 20">
      <path d="M9 2v3M9 5l6 6-6 6-5.5-5.5a1 1 0 010-1.4L9 5zM4 11h10M16.5 14.5s1.5 2 1.5 3a1.5 1.5 0 01-3 0c0-1 1.5-3 1.5-3z" />
    </svg>
  ),
  text: (
    <svg viewBox="0 0 20 20">
      <path d="M4 4h12M10 4v13M7 17h6M4 4v2.5M16 4v2.5" />
    </svg>
  ),
  hand: (
    <svg viewBox="0 0 20 20">
      <path d="M7 9V4.5a1.2 1.2 0 012.4 0V9m0-5.5a1.2 1.2 0 012.4 0V9m0-4a1.2 1.2 0 012.4 0v6.5c0 3.5-2 6-5 6s-4.2-1.5-5.6-4.5L2.5 10A1.2 1.2 0 014.6 9L7 12" />
    </svg>
  ),
  zoom: (
    <svg viewBox="0 0 20 20">
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.5 12.5L17 17M6.5 8.5h4M8.5 6.5v4" />
    </svg>
  ),
}

const GROUPS: { id: ToolId; label: string; key: string }[][] = [
  [
    { id: 'move', label: '移动工具', key: 'V' },
    { id: 'marquee-rect', label: '矩形选框工具', key: 'M' },
    { id: 'marquee-ellipse', label: '椭圆选框工具', key: 'M' },
    { id: 'crop', label: '裁剪工具', key: 'C' },
    { id: 'eyedropper', label: '吸管工具', key: 'I' },
  ],
  [
    { id: 'brush', label: '画笔工具', key: 'B' },
    { id: 'eraser', label: '橡皮擦工具', key: 'E' },
    { id: 'fill', label: '油漆桶工具', key: 'G' },
    { id: 'text', label: '文字工具', key: 'T' },
  ],
  [
    { id: 'hand', label: '抓手工具', key: 'H' },
    { id: 'zoom', label: '缩放工具', key: 'Z' },
  ],
]

export function Toolbar() {
  const tool = useStore((s) => s.tool)
  const fgColor = useStore((s) => s.fgColor)
  const bgColor = useStore((s) => s.bgColor)
  const set = useStore((s) => s.set)
  const setTool = useStore((s) => s.setTool)

  return (
    <div className="toolbar">
      {GROUPS.map((group, gi) => (
        <div key={gi} style={{ display: 'contents' }}>
          {gi > 0 && <hr />}
          {group.map((t) => (
            <button
              key={t.id}
              className={tool === t.id ? 'active' : ''}
              title={`${t.label} (${t.key})`}
              onClick={() => setTool(t.id)}
            >
              {ICONS[t.id]}
            </button>
          ))}
        </div>
      ))}
      <div className="color-swatches" title="前景色 / 背景色 (X 互换)">
        <div className="swatch bg" style={{ background: bgColor }}>
          <input type="color" value={bgColor} onChange={(e) => set({ bgColor: e.target.value })} />
        </div>
        <div className="swatch fg" style={{ background: fgColor }}>
          <input type="color" value={fgColor} onChange={(e) => set({ fgColor: e.target.value })} />
        </div>
      </div>
    </div>
  )
}
