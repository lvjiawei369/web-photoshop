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
