import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteTestCase, getTestCases, getTestCasesRaw, isDeleted, mergeById, saveTestCase, setTestCases as setTestCasesCache } from '../utils/storage'
import { deleteTestCaseRemote, saveTestCaseRemote, subscribeTestCases } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'

export function useTestCases(projectId) {
  const [testCases, setTestCasesState] = useState(() => getTestCases(projectId))
  const remoteReady = useRemoteSync()

  const refresh = useCallback(() => setTestCasesState(getTestCases(projectId)), [projectId])

  useEffect(() => {
    if (!remoteReady || !projectId) return undefined
    return subscribeTestCases(projectId, (nextCases) => {
      // Merge against raw (incl. tombstones) so a stale snapshot can't wipe
      // local records and deletes still propagate; cache the full merge but
      // only show live records.
      const merged = mergeById(getTestCasesRaw(projectId), nextCases)
      setTestCasesCache(projectId, merged)
      setTestCasesState(merged.filter((tc) => !isDeleted(tc)))
    })
  }, [projectId, remoteReady])

  const addTestCase = useCallback((data) => {
    const tc = { id: newId(), createdAt: new Date().toISOString(), status: 'Not Executed', ...data }
    saveTestCase(projectId, tc)
    setTestCasesState(getTestCases(projectId))
    if (remoteReady) saveTestCaseRemote(projectId, tc)
    return tc
  }, [projectId, remoteReady])

  const removeTestCase = useCallback((id) => {
    deleteTestCase(projectId, id)
    setTestCasesState(getTestCases(projectId))
    if (remoteReady) deleteTestCaseRemote(projectId, id)
  }, [projectId, remoteReady])

  const updateTestCase = useCallback((tc) => {
    saveTestCase(projectId, tc)
    setTestCasesState(getTestCases(projectId))
    if (remoteReady) saveTestCaseRemote(projectId, tc)
  }, [projectId, remoteReady])

  return { testCases, addTestCase, removeTestCase, updateTestCase, refresh }
}
