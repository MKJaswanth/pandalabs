import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteBug, getBugs, getBugsRaw, isDeleted, mergeById, saveBug, setBugs as setBugsCache } from '../utils/storage'
import { deleteBugRemote, saveBugRemote, subscribeBugs } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'

export function useBugs(projectId) {
  const [bugs, setBugs] = useState(() => getBugs(projectId))
  const remoteReady = useRemoteSync()

  const refresh = useCallback(() => setBugs(getBugs(projectId)), [projectId])

  useEffect(() => {
    if (!remoteReady || !projectId) return undefined
    return subscribeBugs(projectId, (nextBugs) => {
      const merged = mergeById(getBugsRaw(projectId), nextBugs)
      setBugsCache(projectId, merged)
      setBugs(merged.filter((bug) => !isDeleted(bug)))
    })
  }, [projectId, remoteReady])

  const addBug = useCallback((data) => {
    const bug = { id: newId(), createdAt: new Date().toISOString(), status: 'Open', ...data }
    saveBug(projectId, bug)
    setBugs(getBugs(projectId))
    if (remoteReady) saveBugRemote(projectId, bug)
    return bug
  }, [projectId, remoteReady])

  const removeBug = useCallback((id) => {
    deleteBug(projectId, id)
    setBugs(getBugs(projectId))
    if (remoteReady) deleteBugRemote(projectId, id)
  }, [projectId, remoteReady])

  const updateBug = useCallback((bug) => {
    saveBug(projectId, bug)
    setBugs(getBugs(projectId))
    if (remoteReady) saveBugRemote(projectId, bug)
  }, [projectId, remoteReady])

  return { bugs, addBug, removeBug, updateBug, refresh }
}
