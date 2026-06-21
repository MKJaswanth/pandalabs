import { useCallback, useEffect, useRef, useState } from 'react'
import { newId } from '../utils/id'
import { deleteBug, getBugs, getBugsRaw, isDeleted, mergeById, removeBugReferencesFromRuns, saveBug, setBugs as setBugsCache, getCurrentUser } from '../utils/storage'
import { isValidBugId, moduleCode, nextBugId } from '../utils/bugId'
import { deleteBugRemote, saveBugRemote, saveRunDraftRemote, saveTestRunRemote, subscribeBugs } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'
import { addActivity } from '../utils/activity'
import { useNotifications } from './useNotifications'

export function useBugs(projectId) {
  const [bugs, setBugs] = useState(() => getBugs(projectId))
  const { sendNotification } = useNotifications()
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

  // One-time backfill: assign canonical BUG-XX-NNN ids to any bug with a blank
  // or non-conforming id. Existing valid ids are left untouched so references
  // people already know don't shift. Numbering continues per module from the
  // highest existing valid id for that module.
  const backfillBugIds = useCallback(() => {
    const current = getBugs(projectId)
    const invalid = current.filter((b) => !isValidBugId(b.sourceBugId))
    if (invalid.length === 0) return

    const counters = {}
    current.forEach((b) => {
      const match = /^BUG-([A-Z]{2})-(\d+)$/.exec(b.sourceBugId || '')
      if (match) counters[match[1]] = Math.max(counters[match[1]] || 0, parseInt(match[2], 10))
    })

    // Oldest first so numbering follows creation order.
    const ordered = [...invalid].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
    ordered.forEach((b) => {
      const code = moduleCode(b.module)
      const next = (counters[code] || 0) + 1
      counters[code] = next
      const updated = { ...b, sourceBugId: `BUG-${code}-${String(next).padStart(3, '0')}` }
      saveBug(projectId, updated)
      if (remoteReady) saveBugRemote(projectId, updated)
    })
    setBugs(getBugs(projectId))
  }, [projectId, remoteReady])

  const backfilledFor = useRef('')
  useEffect(() => {
    if (!projectId || backfilledFor.current === projectId) return undefined
    if (bugs.length === 0) return undefined
    backfilledFor.current = projectId
    // Defer so the state update happens outside the synchronous effect body.
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) backfillBugIds() })
    return () => { cancelled = true }
  }, [projectId, bugs.length, backfillBugIds])

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
    if (!bug.reportedDate) {
      bug.reportedDate = new Date().toISOString().slice(0, 10)
    }
    // Always enforce the canonical BUG-XX-NNN format. Blank IDs (normal flow)
    // and invalid ones (free-form or imported) are (re)generated per module.
    if (!isValidBugId(bug.sourceBugId)) {
      bug.sourceBugId = nextBugId(bug.module, getBugs(projectId))
    }
    saveBug(projectId, bug)
    setBugs(getBugs(projectId))
    if (remoteReady) {
      saveBugRemote(projectId, bug)
    }

    addActivity({
      entityType: 'bug',
      entityId: bug.id,
      projectId,
      action: 'created',
      title: bug.metadata?.autoLogged
        ? `Bug ${bug.sourceBugId} logged from failed test run: ${bug.title}`
        : `Bug ${bug.sourceBugId} logged: ${bug.title}`,
      after: bug,
    })

    if (bug.evidenceLinks?.length > 0) {
      addActivity({
        entityType: 'bug',
        entityId: bug.id,
        projectId,
        action: 'update',
        title: `In ${bug.sourceBugId || bug.id.slice(0, 8).toUpperCase()} evidence link(s) added: ${bug.evidenceLinks.map((l) => l.label || l.url).join(', ')}`,
      })
    }

    if (bug.assignedTo) {
      sendNotification({
        recipient: bug.assignedTo,
        type: 'bug_assigned',
        entityId: bug.id,
        entityName: bug.sourceBugId,
        message: `${creatorName || 'Someone'} assigned Bug ${bug.sourceBugId} to you: ${bug.title}`,
        projectId,
      })
    }

    return bug
  }, [projectId, remoteReady, sendNotification])

  const removeBug = useCallback((id) => {
    const before = getBugs(projectId).find((b) => b.id === id)
    deleteBug(projectId, id)
    // Cascade: strip this bug's id from saved runs and the active draft so the
    // UI never shows a stale link. Returns the records that changed so we can
    // mirror the cleanup to Firebase.
    const { changedRuns, changedDraft } = removeBugReferencesFromRuns(projectId, id)
    setBugs(getBugs(projectId))
    if (remoteReady) {
      deleteBugRemote(projectId, id)
      changedRuns.forEach((run) => saveTestRunRemote(projectId, run))
      if (changedDraft) saveRunDraftRemote(projectId, changedDraft)
    }

    addActivity({
      entityType: 'bug',
      entityId: id,
      projectId,
      action: 'deleted',
      title: `Bug ${before?.sourceBugId || id.slice(0, 8).toUpperCase()} deleted: ${before?.title || id}`,
      before,
    })
  }, [projectId, remoteReady])

  const updateBug = useCallback((bug) => {
    const before = getBugs(projectId).find((b) => b.id === bug.id)
    saveBug(projectId, bug)
    setBugs(getBugs(projectId))
    if (remoteReady) {
      saveBugRemote(projectId, bug)
    }

    const isStatusChange = before && before.status !== bug.status
    const isPriorityChange = before && (before.priority ?? 'Medium') !== (bug.priority ?? 'Medium')
    const isSeverityChange = before && before.severity !== bug.severity
    const isAssigneeChange = before && before.assignedTo !== bug.assignedTo
    let action = 'updated'
    const bugId = bug.sourceBugId || bug.id.slice(0, 8).toUpperCase()
    let title = `In ${bugId} details updated: ${bug.title}`

    if (before) {
      if (isStatusChange) {
        action = 'status_changed'
        title = `In ${bugId} status changed from ${before.status} to ${bug.status}`
      } else if (isPriorityChange) {
        action = 'priority_changed'
        title = `In ${bugId} priority changed from ${before.priority ?? 'Medium'} to ${bug.priority ?? 'Medium'}`
      } else if (isSeverityChange) {
        action = 'severity_changed'
        title = `In ${bugId} severity changed from ${before.severity} to ${bug.severity}`
      } else if (isAssigneeChange) {
        action = 'assigned'
        title = bug.assignedTo
          ? `In ${bugId} assigned to ${bug.assignedTo}`
          : `In ${bugId} unassigned`
      }
    }

    addActivity({
      entityType: 'bug',
      entityId: bug.id,
      projectId,
      action,
      title,
      before,
      after: bug,
    })

    if (before) {
      const beforeLinks = before.evidenceLinks || []
      const afterLinks = bug.evidenceLinks || []
      const added = afterLinks.filter((al) => !beforeLinks.some((bl) => bl.id === al.id))
      const removed = beforeLinks.filter((bl) => !afterLinks.some((al) => al.id === bl.id))

      added.forEach((link) => {
        addActivity({
          entityType: 'bug',
          entityId: bug.id,
          projectId,
          action: 'update',
          title: `In ${bugId} evidence link added: ${link.label || link.url}`,
        })
      })

      removed.forEach((link) => {
        addActivity({
          entityType: 'bug',
          entityId: bug.id,
          projectId,
          action: 'update',
          title: `In ${bugId} evidence link removed: ${link.label || link.url}`,
        })
      })
    }

    if (isAssigneeChange && bug.assignedTo) {
      const senderName = getCurrentUser() || 'Someone'
      sendNotification({
        recipient: bug.assignedTo,
        type: 'bug_assigned',
        entityId: bug.id,
        entityName: bug.sourceBugId || bug.id.slice(0, 8).toUpperCase(),
        message: `${senderName} assigned Bug ${bug.sourceBugId || bug.id.slice(0, 8).toUpperCase()} to you: ${bug.title}`,
        projectId,
      })
    }
  }, [projectId, remoteReady, sendNotification])

  return { bugs, addBug, removeBug, updateBug, refresh }
}

