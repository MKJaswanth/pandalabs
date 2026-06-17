import { useEffect, useState } from 'react'
import { getSyncStatus, subscribeSyncStatus } from '../utils/syncStatus'

// Subscribe a component to the global Firestore sync status.
export function useSyncStatus() {
  const [status, setStatus] = useState(getSyncStatus)
  useEffect(() => subscribeSyncStatus(setStatus), [])
  return status
}
