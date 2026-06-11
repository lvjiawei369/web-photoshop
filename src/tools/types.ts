export interface ToolContext {
  /** Pointer position in document coordinates */
  x: number
  y: number
  e: PointerEvent
  /** Scroll container of the canvas area (for hand tool) */
  scrollEl: HTMLElement | null
}

export interface ToolImpl {
  cursor: string
  down(c: ToolContext): void
  move(c: ToolContext): void
  up(c: ToolContext): void
}
