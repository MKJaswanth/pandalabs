import { useCallback, useEffect, useState } from 'react'
import { WorkspaceSyncContext } from './WorkspaceSyncContextCore'
import { useRemoteSync } from '../hooks/useRemoteSync'
import { getProjectsOnce } from '../utils/remoteStorage'
import { clearWorkspaceCache, getProjectsRaw, isDeleted, mergeById, setProjects } from '../utils/storage'
import { createWorkspaceBackup, downloadWorkspaceBackup, uploadWorkspaceToCloud } from '../utils/backup'
import { setSyncStatus } from '../utils/syncStatus'

const PROJECTS_CHANGED = 'qa-projects-changed'

// Owns the authoritative workspace load for a real signed-in user. Until the
// first cloud read completes the app is gated (see WorkspaceGate) so cached
// localStorage data is never shown as final, and an empty cloud that collides
// with local work raises a conflict instead of silently winning or losing.
//
// status: 'offline' (guest/local-only) | 'syncing' | 'synced' | 'conflict' | 'error'
export function WorkspaceSyncProvider({ children }) {
  const remoteReady = useRemoteSync()
  const [status, setStatus] = useState(remoteReady ? 'syncing' : 'offline')

  // Async load. Status is only set AFTER the first await — the synchronous
  // initial value (above) and the `retry` handler cover the 'syncing' state, so
  // this effect never calls setState synchronously. remoteReady is stable for
  // the provider's lifetime (sign-in/out remounts it).
  const loadWorkspace = useCallback(async () => {
    if (!remoteReady) {
      setSyncStatus('offline')
      return
    }
    setSyncStatus('syncing')
    try {
      const cloud = await getProjectsOnce()
      const cloudLive = cloud.filter((p) => !isDeleted(p))
      const localLive = getProjectsRaw().filter((p) => !isDeleted(p))

      if (cloudLive.length > 0) {
        // Cloud is authoritative — seed the local cache from it (cloud wins on
        // conflicts; any local-only record is preserved by the merge).
        setProjects(mergeById(getProjectsRaw(), cloud))
        window.dispatchEvent(new Event(PROJECTS_CHANGED))
        setStatus('synced')
        setSyncStatus('synced')
      } else if (localLive.length > 0) {
        // Cloud empty but this browser has work — never silently discard it.
        setStatus('conflict')
        setSyncStatus('error')
      } else {
        setStatus('synced')
        setSyncStatus('synced')
      }
    } catch (err) {
      console.error('[workspaceSync] Initial workspace load failed:', err)
      setStatus('error')
      setSyncStatus('error')
    }
  }, [remoteReady])

  // One-shot workspace load on mount. loadWorkspace only calls setState after
  // an await, so this doesn't cause synchronous cascading renders — the lint
  // rule just can't see that across the useCallback boundary.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadWorkspace() }, [loadWorkspace])

  // Called from the error screen's button (an event handler, not an effect), so
  // setting 'syncing' synchronously here is fine and gives instant feedback.
  const retry = useCallback(() => {
    setStatus('syncing')
    loadWorkspace()
  }, [loadWorkspace])

  const uploadLocalToCloud = useCallback(async () => {
    setStatus('syncing')
    setSyncStatus('syncing')
    try {
      await uploadWorkspaceToCloud(createWorkspaceBackup(), 'merge')
      setStatus('synced')
      setSyncStatus('synced')
    } catch (err) {
      console.error('[workspaceSync] Upload to cloud failed:', err)
      setStatus('conflict')
      setSyncStatus('error')
    }
  }, [])

  const clearLocalAndContinue = useCallback(() => {
    clearWorkspaceCache()
    window.dispatchEvent(new Event(PROJECTS_CHANGED))
    setStatus('synced')
    setSyncStatus('synced')
  }, [])

  const value = {
    status,
    retry,
    uploadLocalToCloud,
    clearLocalAndContinue,
    downloadBackup: downloadWorkspaceBackup,
  }

  return (
    <WorkspaceSyncContext.Provider value={value}>
      {children}
    </WorkspaceSyncContext.Provider>
  )
}
