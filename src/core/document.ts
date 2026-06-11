import type { Selection } from '../state/store'

export function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function getCtx(c: HTMLCanvasElement): CanvasRenderingContext2D {
  return c.getContext('2d', { willReadFrequently: true })!
}

export function snapshot(c: HTMLCanvasElement): ImageData {
  return getCtx(c).getImageData(0, 0, c.width, c.height)
}

export function restore(c: HTMLCanvasElement, data: ImageData) {
  getCtx(c).putImageData(data, 0, 0)
}

/** Apply the selection shape as a clip path on ctx (caller must save/restore). */
export function clipSelection(ctx: CanvasRenderingContext2D, sel: Selection) {
  ctx.beginPath()
  if (sel.kind === 'rect') {
    ctx.rect(sel.x, sel.y, sel.w, sel.h)
  } else {
    ctx.ellipse(sel.x + sel.w / 2, sel.y + sel.h / 2, sel.w / 2, sel.h / 2, 0, 0, Math.PI * 2)
  }
  ctx.clip()
}
