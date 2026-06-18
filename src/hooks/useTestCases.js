import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteTestCase, getTestCases, getTestCasesRaw, isDeleted, mergeById, saveTestCase, setTestCases as setTestCasesCache } from '../utils/storage'
import { deleteTestCaseRemote, saveTestCaseRemote, subscribeTestCases } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'
import { addActivity } from '../utils/activity'
import { describeTestCaseChanges } from '../utils/history'

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
    }

    addActivity({
      entityType: 'test_case',
      entityId: tc.id,
      projectId,
      action: 'created',
      title: `Test case created: ${tc.title}`,
      after: tc,
    })

    return tc
  }, [projectId, remoteReady])

  const removeTestCase = useCallback((id) => {
    const before = getTestCases(projectId).find((t) => t.id === id)
    deleteTestCase(projectId, id)
    setTestCasesState(getTestCases(projectId))
    if (remoteReady) {
      deleteTestCaseRemote(projectId, id)
    }

    addActivity({
      entityType: 'test_case',
      entityId: id,
      projectId,
      action: 'deleted',
      title: `Test case deleted: ${before?.title || id}`,
      before,
    })
  }, [projectId, remoteReady])

  const removeTestCases = useCallback((ids) => {
    ids.forEach((id) => {
      deleteTestCase(projectId, id)
      if (remoteReady) {
        deleteTestCaseRemote(projectId, id)
      }
    })
    setTestCasesState(getTestCases(projectId))
  }, [projectId, remoteReady])

  const updateTestCase = useCallback((tc) => {
    const creatorId = auth?.currentUser?.uid || ''
    const before = getTestCases(projectId).find((t) => t.id === tc.id)
    const updated = { ...tc, updatedBy: creatorId }
    saveTestCase(projectId, updated)
    setTestCasesState(getTestCases(projectId))
    if (remoteReady) {
      saveTestCaseRemote(projectId, updated)
    }

    const isStatusChange = before && before.status !== updated.status
    let title = `Test case updated: ${updated.title}`
    let details = ''

    if (before) {
      if (isStatusChange) {
        title = `Status changed from ${before.status} to ${updated.status}`
      } else {
        const fieldChanges = describeTestCaseChanges(before, updated)
        if (fieldChanges.length > 0) {
          title = `${fieldChanges[0]} for "${updated.title}"`
          details = fieldChanges.join(', ')
        }
      }
    }

    addActivity({
      entityType: 'test_case',
      entityId: updated.id,
      projectId,
      action: isStatusChange ? 'status_changed' : 'updated',
      title,
      details,
      before,
      after: updated,
    })
  }, [projectId, remoteReady])

  return { testCases, addTestCase, removeTestCase, removeTestCases, updateTestCase, refresh }
}

