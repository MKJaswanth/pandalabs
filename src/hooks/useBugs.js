import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteBug, getBugs, saveBug, setBugs as setBugsCache } from '../utils/storage'
import { isFirebaseEnabled } from '../utils/firebase'
import { deleteBugRemote, saveBugRemote, subscribeBugs } from '../utils/remoteStorage'

export function useBugs(projectId) {
  const [bugs, setBugs] = useState(() => getBugs(projectId))

  const refresh = useCallback(() => setBugs(getBugs(projectId)), [projectId])

  useEffect(() => {
    if (!isFirebaseEnabled || !projectId) return undefined
    return subscribeBugs(projectId, (nextBugs) => {
      setBugsCache(projectId, nextBugs)
      setBugs(nextBugs)
    })
  }, [projectId])

  const addBug = useCallback((data) => {
    const bug = { id: newId(), createdAt: new Date().toISOString(), status: 'Open', ...data }
    saveBug(projectId, bug)
    setBugs(getBugs(projectId))
    if (isFirebaseEnabled) saveBugRemote(projectId, bug)
    return bug
  }, [projectId])

  const removeBug = useCallback((id) => {
    deleteBug(projectId, id)
    setBugs(getBugs(projectId))
    if (isFirebaseEnabled) deleteBugRemote(projectId, id)
  }, [projectId])

  const updateBug = useCallback((bug) => {
    saveBug(projectId, bug)
    setBugs(getBugs(projectId))
    if (isFirebaseEnabled) saveBugRemote(projectId, bug)
  }, [projectId])

  return { bugs, addBug, removeBug, updateBug, refresh }
}
