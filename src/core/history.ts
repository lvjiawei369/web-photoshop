export interface HistoryEntry {
  label: string
  undo(): void
  redo(): void
}

const LIMIT = 30
let entries: HistoryEntry[] = []
let index = 0 // number of applied entries
const listeners = new Set<() => void>()
let snapshot: { labels: string[]; index: number } = { labels: [], index: 0 }

function emit() {
  snapshot = { labels: entries.map((e) => e.label), index }
  listeners.forEach((l) => l())
}

export const history = {
  push(entry: HistoryEntry) {
    entries.length = index
    entries.push(entry)
    if (entries.length > LIMIT) entries.shift()
    index = entries.length
    emit()
  },
  undo() {
    if (index === 0) return false
    entries[--index].undo()
    emit()
    return true
  },
  redo() {
    if (index >= entries.length) return false
    entries[index++].redo()
    emit()
    return true
  },
  /** Jump to a specific state: target = number of applied entries. */
  jump(target: number) {
    target = Math.max(0, Math.min(entries.length, target))
    while (index > target) entries[--index].undo()
    while (index < target) entries[index++].redo()
    emit()
  },
  clear() {
    entries = []
    index = 0
    emit()
  },
  canUndo: () => index > 0,
  canRedo: () => index < entries.length,
  getSnapshot: () => snapshot,
  subscribe(fn: () => void) {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}
