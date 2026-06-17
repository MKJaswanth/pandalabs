import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteBug, getBugs, getBugsRaw, isDeleted, mergeById, saveBug, setBugs as setBugsCache, getCurrentUser } from '../utils/storage'
import { deleteBugRemote, saveBugRemote, subscribeBugs, logActivityRemote } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'

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
    const creatorId = auth?.currentUser?.uid || ''
    const creatorName = getCurrentUser() || ''
    const bug = {
      id: newId(),
      createdAt: new Date().toISOString(),
      status: 'Open',
      reportedBy: creatorId,
      reportedByName: creatorName,
      ...data,
    }
    saveBug(projectId, bug)
    setBugs(getBugs(projectId))
    if (remoteReady) {
      saveBugRemote(projectId, bug)
      logActivityRemote({
        id: newId(),
        type: 'bug_created',
        entityType: 'bug',
        entityId: bug.id,
        projectId,
        message: `Bug "${bug.title}" was created`,
        after: bug,
      })
    }
    return bug
  }, [projectId, remoteReady])

  const removeBug = useCallback((id) => {
    const before = getBugs(projectId).find((b) => b.id === id)
    deleteBug(projectId, id)
    setBugs(getBugs(projectId))
    if (remoteReady) {
      deleteBugRemote(projectId, id)
      logActivityRemote({
        id: newId(),
        type: 'bug_deleted',
        entityType: 'bug',
        entityId: id,
        projectId,
        message: `Bug "${before?.title || id}" was deleted`,
        before,
      })
    }
  }, [projectId, remoteReady])

  const updateBug = useCallback((bug) => {
    const before = getBugs(projectId).find((b) => b.id === bug.id)
    saveBug(projectId, bug)
    setBugs(getBugs(projectId))
    if (remoteReady) {
      saveBugRemote(projectId, bug)
      const isStatusChange = before && before.status !== bug.status
      logActivityRemote({
        id: newId(),
        type: isStatusChange ? 'bug_status_changed' : 'bug_updated',
        entityType: 'bug',
        entityId: bug.id,
        projectId,
        message: isStatusChange
          ? `Bug "${bug.title}" status changed to ${bug.status}`
          : `Bug "${bug.title}" was updated`,
        before,
        after: bug,
      })
    }
  }, [projectId, remoteReady])

  return { bugs, addBug, removeBug, updateBug, refresh }
}
