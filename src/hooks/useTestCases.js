import { useCallback, useEffect, useRef, useState } from 'react'
import { newId } from '../utils/id'
import { deleteTestCase, getTestCases, getTestCasesRaw, isDeleted, mergeById, saveTestCase, setTestCases as setTestCasesCache, getCurrentUser } from '../utils/storage'
import { deleteTestCaseRemote, saveTestCaseRemote, subscribeTestCases } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'
import { addActivity } from '../utils/activity'
import { describeTestCaseChanges } from '../utils/history'
import { isValidTcId, moduleCode, nextTcId } from '../utils/testCaseId'
import { useNotifications } from './useNotifications'

export function useTestCases(projectId) {
  const [testCases, setTestCasesState] = useState(() => getTestCases(projectId))
  const { sendNotification } = useNotifications()
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

  // One-time backfill: assign canonical TC-XX-NNN ids to any test case with a
  // blank or non-conforming id (e.g. legacy "TC_006" or hex fallbacks). Valid
  // ids are left untouched; numbering continues per module.
  const backfillTcIds = useCallback(() => {
    const current = getTestCases(projectId)
    const invalid = current.filter((t) => !isValidTcId(t.sourceTcId))
    if (invalid.length === 0) return

    const counters = {}
    current.forEach((t) => {
      const match = /^TC-([A-Z]{2})-(\d+)$/.exec(t.sourceTcId || '')
      if (match) counters[match[1]] = Math.max(counters[match[1]] || 0, parseInt(match[2], 10))
    })

    const ordered = [...invalid].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    ordered.forEach((t) => {
      const code = moduleCode(t.module)
      const next = (counters[code] || 0) + 1
      counters[code] = next
      const updated = { ...t, sourceTcId: `TC-${code}-${String(next).padStart(3, '0')}` }
      saveTestCase(projectId, updated)
      if (remoteReady) saveTestCaseRemote(projectId, updated)
    })
    setTestCasesState(getTestCases(projectId))
  }, [projectId, remoteReady])

  const backfilledFor = useRef('')
  useEffect(() => {
    if (!projectId || backfilledFor.current === projectId) return undefined
    if (testCases.length === 0) return undefined
    backfilledFor.current = projectId
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) backfillTcIds() })
    return () => { cancelled = true }
  }, [projectId, testCases.length, backfillTcIds])

  const addTestCase = useCallback((data) => {
    const creatorId = auth?.currentUser?.uid || ''
    const creatorName = getCurrentUser() || ''
    const tc = {
      id: newId(),
      createdAt: new Date().toISOString(),
      status: 'Not Executed',
      ...data,
      createdBy: data.createdBy || creatorId || creatorName || 'Unknown',
      createdByName: data.createdByName || creatorName || 'Unknown',
      updatedBy: data.updatedBy || creatorId || creatorName || 'Unknown',
      updatedByName: data.updatedByName || creatorName || 'Unknown',
    }
    // Always assign a canonical TC-XX-NNN id. Blank ids (normal flow) and
    // invalid ones (e.g. imported "TC_006") are (re)generated per module.
    if (!isValidTcId(tc.sourceTcId)) {
      tc.sourceTcId = nextTcId(tc.module, getTestCases(projectId))
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
      title: `Test case ${tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()} created: ${tc.title}`,
      after: tc,
    })

    if (tc.evidenceLinks?.length > 0) {
      addActivity({
        entityType: 'test_case',
        entityId: tc.id,
        projectId,
        action: 'update',
        title: `In ${tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()} evidence link(s) added: ${tc.evidenceLinks.map((l) => l.label || l.url).join(', ')}`,
      })
    }

    if (tc.assignee) {
      sendNotification({
        recipient: tc.assignee,
        type: 'test_case_assigned',
        entityId: tc.id,
        entityName: tc.sourceTcId || tc.id.slice(0, 8).toUpperCase(),
        message: `${tc.createdByName || 'Someone'} assigned Test Case ${tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()} to you: ${tc.title}`,
        projectId,
      })
    }

    return tc
  }, [projectId, remoteReady, sendNotification])

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
      title: `Test case ${before?.sourceTcId || id.slice(0, 8).toUpperCase()} deleted: ${before?.title || id}`,
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
    const creatorName = getCurrentUser() || ''
    const before = getTestCases(projectId).find((t) => t.id === tc.id)
    const updated = {
      ...tc,
      updatedBy: creatorId || creatorName || 'Unknown',
      updatedByName: creatorName || 'Unknown',
    }
    saveTestCase(projectId, updated)
    setTestCasesState(getTestCases(projectId))
    if (remoteReady) {
      saveTestCaseRemote(projectId, updated)
    }

    const isStatusChange = before && before.status !== updated.status
    const tcId = updated.sourceTcId || updated.id.slice(0, 8).toUpperCase()
    let title = `In ${tcId} details updated: ${updated.title}`
    let details = ''

    if (before) {
      if (isStatusChange) {
        title = `In ${tcId} status changed from ${before.status} to ${updated.status}`
      } else {
        const fieldChanges = describeTestCaseChanges(before, updated)
        if (fieldChanges.length > 0) {
          title = `In ${tcId} ${fieldChanges[0]} for "${updated.title}"`
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

    if (before) {
      const beforeLinks = before.evidenceLinks || []
      const afterLinks = updated.evidenceLinks || []
      const added = afterLinks.filter((al) => !beforeLinks.some((bl) => bl.id === al.id))
      const removed = beforeLinks.filter((bl) => !afterLinks.some((al) => al.id === bl.id))

      added.forEach((link) => {
        addActivity({
          entityType: 'test_case',
          entityId: updated.id,
          projectId,
          action: 'update',
          title: `In ${tcId} evidence link added: ${link.label || link.url}`,
        })
      })

      removed.forEach((link) => {
        addActivity({
          entityType: 'test_case',
          entityId: updated.id,
          projectId,
          action: 'update',
          title: `In ${tcId} evidence link removed: ${link.label || link.url}`,
        })
      })
    }

    const isAssigneeChange = before && before.assignee !== updated.assignee
    if (isAssigneeChange && updated.assignee) {
      sendNotification({
        recipient: updated.assignee,
        type: 'test_case_assigned',
        entityId: updated.id,
        entityName: updated.sourceTcId || updated.id.slice(0, 8).toUpperCase(),
        message: `${updated.updatedByName || 'Someone'} assigned Test Case ${updated.sourceTcId || updated.id.slice(0, 8).toUpperCase()} to you: ${updated.title}`,
        projectId,
      })
    }
  }, [projectId, remoteReady, sendNotification])

  return { testCases, addTestCase, removeTestCase, removeTestCases, updateTestCase, refresh }
}

