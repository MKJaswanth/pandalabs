import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteTestCase, getTestCases, getTestCasesRaw, isDeleted, mergeById, saveTestCase, setTestCases as setTestCasesCache } from '../utils/storage'
import { deleteTestCaseRemote, saveTestCaseRemote, subscribeTestCases, logActivityRemote } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'

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
    const creatorId = auth?.currentUser?.uid || ''
    const tc = {
      id: newId(),
      createdAt: new Date().toISOString(),
      status: 'Not Executed',
      createdBy: creatorId,
      updatedBy: creatorId,
      ...data,
    }
    saveTestCase(projectId, tc)
    setTestCasesState(getTestCases(projectId))
    if (remoteReady) {
      saveTestCaseRemote(projectId, tc)
      logActivityRemote({
        id: newId(),
        type: 'test_case_created',
        entityType: 'test_case',
        entityId: tc.id,
        projectId,
        message: `Test case "${tc.title}" was created`,
        after: tc,
      })
    }
    return tc
  }, [projectId, remoteReady])

  const removeTestCase = useCallback((id) => {
    const before = getTestCases(projectId).find((t) => t.id === id)
    deleteTestCase(projectId, id)
    setTestCasesState(getTestCases(projectId))
    if (remoteReady) {
      deleteTestCaseRemote(projectId, id)
      logActivityRemote({
        id: newId(),
        type: 'test_case_deleted',
        entityType: 'test_case',
        entityId: id,
        projectId,
        message: `Test case "${before?.title || id}" was deleted`,
        before,
      })
    }
  }, [projectId, remoteReady])

  const updateTestCase = useCallback((tc) => {
    const creatorId = auth?.currentUser?.uid || ''
    const before = getTestCases(projectId).find((t) => t.id === tc.id)
    const updated = { ...tc, updatedBy: creatorId }
    saveTestCase(projectId, updated)
    setTestCasesState(getTestCases(projectId))
    if (remoteReady) {
      saveTestCaseRemote(projectId, updated)
      const isStatusChange = before && before.status !== updated.status
      logActivityRemote({
        id: newId(),
        type: isStatusChange ? 'test_case_status_changed' : 'test_case_updated',
        entityType: 'test_case',
        entityId: updated.id,
        projectId,
        message: isStatusChange 
          ? `Test case "${updated.title}" status changed to ${updated.status}`
          : `Test case "${updated.title}" was updated`,
        before,
        after: updated,
      })
    }
  }, [projectId, remoteReady])

  return { testCases, addTestCase, removeTestCase, updateTestCase, refresh }
}
