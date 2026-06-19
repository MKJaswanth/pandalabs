import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteBug, getBugs, getBugsRaw, isDeleted, mergeById, removeBugReferencesFromRuns, saveBug, setBugs as setBugsCache, getCurrentUser } from '../utils/storage'
import { deleteBugRemote, saveBugRemote, saveRunDraftRemote, saveTestRunRemote, subscribeBugs } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'
import { addActivity } from '../utils/activity'

export function useBugs(projectId) {
  const [bugs, setBugs] = useState(() => getBugs(projectId))
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
    if (!bug.sourceBugId) {
      const projectBugs = getBugs(projectId)
      const numbers = projectBugs.map((b) => {
        const match = /BUG-[A-Z]{2}-(\d+)/.exec(b.sourceBugId)
        return match ? parseInt(match[1], 10) : 0
      })
      const nextNum = Math.max(0, ...numbers) + 1
      const seqStr = String(nextNum).padStart(3, '0')

      const moduleName = (bug.module || '').trim()
      let modCode = 'GE'
      if (moduleName) {
        const alphabetic = moduleName.replace(/[^a-zA-Z]/g, '')
        if (alphabetic.length >= 2) {
          modCode = alphabetic.slice(0, 2).toUpperCase()
        } else if (alphabetic.length === 1) {
          modCode = (alphabetic + 'X').toUpperCase()
        } else {
          modCode = 'GE'
        }
      }
      bug.sourceBugId = `BUG-${modCode}-${seqStr}`
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

    return bug
  }, [projectId, remoteReady])

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
  }, [projectId, remoteReady])

  return { bugs, addBug, removeBug, updateBug, refresh }
}

