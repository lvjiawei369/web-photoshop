import { useStore } from '../state/store'
import { getCtx, snapshot } from '../core/document'
import type { ToolImpl } from './types'

function hexToRgba(hex: string): [number, number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
}

const TOLERANCE = 32

function floodFill(canvas: HTMLCanvasElement, sx: number, sy: number, color: [number, number, number, number]) {
  const w = canvas.width
  const h = canvas.height
  sx = Math.floor(sx)
  sy = Math.floor(sy)
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return false
  const ctx = getCtx(canvas)
  const img = ctx.getImageData(0, 0, w, h)
  const d = img.data
  const start = (sy * w + sx) * 4
  const target = [d[start], d[start + 1], d[start + 2], d[start + 3]]
  if (
    Math.abs(target[0] - color[0]) +
      Math.abs(target[1] - color[1]) +
      Math.abs(target[2] - color[2]) +
      Math.abs(target[3] - color[3]) ===
    0
  )
    return false

  const matches = (i: number) =>
    Math.abs(d[i] - target[0]) <= TOLERANCE &&
    Math.abs(d[i + 1] - target[1]) <= TOLERANCE &&
    Math.abs(d[i + 2] - target[2]) <= TOLERANCE &&
    Math.abs(d[i + 3] - target[3]) <= TOLERANCE

  const visited = new Uint8Array(w * h)
  const stack = [sy * w + sx]
  while (stack.length) {
    const p = stack.pop()!
    if (visited[p]) continue
    visited[p] = 1
    const i = p * 4
    if (!matches(i)) continue
    d[i] = color[0]
    d[i + 1] = color[1]
    d[i + 2] = color[2]
    d[i + 3] = color[3]
    const x = p % w
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (p >= w) stack.push(p - w)
    if (p < w * (h - 1)) stack.push(p + w)
  }
  ctx.putImageData(img, 0, 0)
  return true
}

export const fillTool: ToolImpl = {
  cursor: 'crosshair',
  down(c) {
    const s = useStore.getState()
    const layer = s.layers.find((l) => l.id === s.activeLayerId)
    if (!layer || !layer.visible) return
    const before = snapshot(layer.canvas)
    if (floodFill(layer.canvas, c.x, c.y, hexToRgba(s.fgColor))) {
      s.commitLayerChange(layer.id, before, '填充')
      s.touch()
    }
  },
  move() {},
  up() {},
}
