import { useSyncExternalStore } from 'react'
import { history } from '../core/history'
import { useStore } from '../state/store'

export function HistoryPanel() {
  const snap = useSyncExternalStore(history.subscribe, history.getSnapshot)
  const touch = useStore((s) => s.touch)

  function jumpTo(target: number) {
    history.jump(target)
    touch()
  }

  return (
    <div className="history-panel">
      <div className="panel-title">历史记录</div>
      <div className="history-list">
        <div className={`history-item ${snap.index === 0 ? 'current' : ''}`} onClick={() => jumpTo(0)}>
          初始状态
        </div>
        {snap.labels.map((label, i) => (
          <div
            key={i}
            className={`history-item ${snap.index === i + 1 ? 'current' : ''} ${i + 1 > snap.index ? 'future' : ''}`}
            onClick={() => jumpTo(i + 1)}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  )
}
