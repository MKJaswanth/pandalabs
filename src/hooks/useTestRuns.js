import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { getTestRuns, saveTestRun, setTestRuns as setTestRunsCache } from '../utils/storage'
import { isFirebaseEnabled } from '../utils/firebase'
import { saveTestRunRemote, subscribeTestRuns } from '../utils/remoteStorage'

export function useTestRuns(projectId) {
  const [runs, setRuns] = useState(() => getTestRuns(projectId))

  const refresh = useCallback(() => setRuns(getTestRuns(projectId)), [projectId])

  useEffect(() => {
    if (!isFirebaseEnabled || !projectId) return undefined
    return subscribeTestRuns(projectId, (nextRuns) => {
      setTestRunsCache(projectId, nextRuns)
      setRuns(nextRuns)
    })
  }, [projectId])

  const addRun = useCallback((data) => {
    const run = { id: newId(), date: new Date().toISOString(), ...data }
    saveTestRun(projectId, run)
    setRuns(getTestRuns(projectId))
    if (isFirebaseEnabled) saveTestRunRemote(projectId, run)
    return run
  }, [projectId])

  return { runs, addRun, refresh }
}
