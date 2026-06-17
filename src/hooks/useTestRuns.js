import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { getTestRuns, getTestRunsRaw, isDeleted, mergeById, saveTestRun, setTestRuns as setTestRunsCache } from '../utils/storage'
import { saveTestRunRemote, subscribeTestRuns } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'

export function useTestRuns(projectId) {
  const [runs, setRuns] = useState(() => getTestRuns(projectId))
  const remoteReady = useRemoteSync()

  const refresh = useCallback(() => setRuns(getTestRuns(projectId)), [projectId])

  useEffect(() => {
    if (!remoteReady || !projectId) return undefined
    return subscribeTestRuns(projectId, (nextRuns) => {
      const merged = mergeById(getTestRunsRaw(projectId), nextRuns)
      setTestRunsCache(projectId, merged)
      setRuns(merged.filter((run) => !isDeleted(run)))
    })
  }, [projectId, remoteReady])

  const addRun = useCallback((data) => {
    const run = { id: newId(), date: new Date().toISOString(), ...data }
    saveTestRun(projectId, run)
    setRuns(getTestRuns(projectId))
    if (remoteReady) saveTestRunRemote(projectId, run)
    return run
  }, [projectId, remoteReady])

  return { runs, addRun, refresh }
}
