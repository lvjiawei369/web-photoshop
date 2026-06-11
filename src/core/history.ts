export interface HistoryEntry {
  label: string
  undo(): void
  redo(): void
}

const LIMIT = 30
const undoStack: HistoryEntry[] = []
const redoStack: HistoryEntry[] = []

export const history = {
  push(entry: HistoryEntry) {
    undoStack.push(entry)
    if (undoStack.length > LIMIT) undoStack.shift()
    redoStack.length = 0
  },
  undo() {
    const e = undoStack.pop()
    if (!e) return false
    e.undo()
    redoStack.push(e)
    return true
  },
  redo() {
    const e = redoStack.pop()
    if (!e) return false
    e.redo()
    undoStack.push(e)
    return true
  },
  clear() {
    undoStack.length = 0
    redoStack.length = 0
  },
  canUndo: () => undoStack.length > 0,
  canRedo: () => redoStack.length > 0,
}
