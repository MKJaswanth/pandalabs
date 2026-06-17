import { useEffect, useState } from 'react'
import { useSyncStatus } from '../hooks/useSyncStatus'

const LABELS = {
  syncing: 'Syncing…',
  synced: 'Synced',
  error: 'Sync failed',
  offline: 'Offline',
}

// Small header pill reflecting the workspace sync state. A browser-offline
// signal always wins over the Firestore status.
export function SyncStatusBadge() {
  const status = useSyncStatus()
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  const effective = online ? status : 'offline'
  const label = LABELS[effective] ?? LABELS.offline

  return (
    <span className={`sync-badge sync-badge--${effective}`} title={`Workspace sync: ${label}`}>
      <span className="sync-badge-dot" aria-hidden="true" />
      {label}
    </span>
  )
}
