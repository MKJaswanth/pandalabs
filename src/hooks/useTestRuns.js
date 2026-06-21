import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { getTestRuns, getTestRunsRaw, isDeleted, mergeById, saveTestRun, setTestRuns as setTestRunsCache, getCurrentUser } from '../utils/storage'
import { saveTestRunRemote, subscribeTestRuns } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'

export function useTestRuns(projectId) {
  const [runs, setRuns] = useState(() => getTestRuns(projectId).filter((run) => !run.projectId || run.projectId === projectId))
  const remoteReady = useRemoteSync()

  const refresh = useCallback(() => setRuns(getTestRuns(projectId).filter((run) => !run.projectId || run.projectId === projectId)), [projectId])

  useEffect(() => {
    if (!remoteReady || !projectId) return undefined
    return subscribeTestRuns(projectId, (nextRuns) => {
      const merged = mergeById(getTestRunsRaw(projectId), nextRuns)
      setTestRunsCache(projectId, merged)
      setRuns(merged.filter((run) => !isDeleted(run) && (!run.projectId || run.projectId === projectId)))
    })
  }, [projectId, remoteReady])

  const addRun = useCallback((data) => {
    const creatorId = auth?.currentUser?.uid || ''
    const creatorName = getCurrentUser() || ''
    const run = {
      id: newId(),
      date: new Date().toISOString(),
      executedById: creatorId,
      executedByName: creatorName,
      ...data,
    }
    saveTestRun(projectId, run)
    setRuns(getTestRuns(projectId))
    if (remoteReady) saveTestRunRemote(projectId, run)
    return run
  }, [projectId, remoteReady])

  const updateRun = useCallback((run) => {
    const updated = { ...run, updatedAt: new Date().toISOString() }
    saveTestRun(projectId, updated)
    setRuns(getTestRuns(projectId).filter((r) => !isDeleted(r) && (!r.projectId || r.projectId === projectId)))
    if (remoteReady) saveTestRunRemote(projectId, updated)
    return updated
  }, [projectId, remoteReady])

  return { runs, addRun, updateRun, refresh }
}
