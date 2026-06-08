import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteTestCase, getTestCases, saveTestCase, setTestCases as setTestCasesCache } from '../utils/storage'
import { isFirebaseEnabled } from '../utils/firebase'
import { deleteTestCaseRemote, saveTestCaseRemote, subscribeTestCases } from '../utils/remoteStorage'

export function useTestCases(projectId) {
  const [testCases, setTestCasesState] = useState(() => getTestCases(projectId))

  const refresh = useCallback(() => setTestCasesState(getTestCases(projectId)), [projectId])

  useEffect(() => {
    if (!isFirebaseEnabled || !projectId) return undefined
    return subscribeTestCases(projectId, (nextCases) => {
      setTestCasesCache(projectId, nextCases)
      setTestCasesState(nextCases)
    })
  }, [projectId])

  const addTestCase = useCallback((data) => {
    const tc = { id: newId(), createdAt: new Date().toISOString(), status: 'Not Executed', ...data }
    saveTestCase(projectId, tc)
    setTestCasesState(getTestCases(projectId))
    if (isFirebaseEnabled) saveTestCaseRemote(projectId, tc)
    return tc
  }, [projectId])

  const removeTestCase = useCallback((id) => {
    deleteTestCase(projectId, id)
    setTestCasesState(getTestCases(projectId))
    if (isFirebaseEnabled) deleteTestCaseRemote(projectId, id)
  }, [projectId])

  const updateTestCase = useCallback((tc) => {
    saveTestCase(projectId, tc)
    setTestCasesState(getTestCases(projectId))
    if (isFirebaseEnabled) saveTestCaseRemote(projectId, tc)
  }, [projectId])

  return { testCases, addTestCase, removeTestCase, updateTestCase, refresh }
}
