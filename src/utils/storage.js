import { newId } from './id'
import { normalizeTestStatus } from './status'
import { defaultWorkspaceId } from './firebase'

const get = (key) => JSON.parse(localStorage.getItem(key) ?? 'null')
const set = (key, val) => {
  try {
    localStorage.setItem(key, JSON.stringify(val))
    return true
  } catch (err) {
    // QuotaExceededError (5MB cap, often hit by Base64 attachments) or a
    // private-mode write failure. Firestore is the source of truth, so a
    // failed local cache write must NOT throw — that would crash the Firestore
    // snapshot handlers that call this. Log and carry on.
    console.error(`[storage] Failed to persist "${key}" to localStorage:`, err)
    return false
  }
}

// ---------------------------------------------------------------------------
// Cache keys — localStorage is a workspace-scoped CACHE, not the source of
// truth. Namespacing by workspace prevents one workspace's cached data from
// leaking into another (and into a different signed-in session). Firestore is
// authoritative; these keys only hold a local copy / offline fallback.
// `qa_current_user` stays global — it's the local display name, not data.
// ---------------------------------------------------------------------------
const cachePrefix = () => `qa_cache_${defaultWorkspaceId}_`
export const projectsKey    = () => `${cachePrefix()}projects`
export const testCasesKey   = (projectId) => `${cachePrefix()}testcases_${projectId}`
export const bugsKey        = (projectId) => `${cachePrefix()}bugs_${projectId}`
export const runsKey        = (projectId) => `${cachePrefix()}runs_${projectId}`
export const teamMembersKey = () => `${cachePrefix()}team_members`
export const runDraftKey    = (projectId) => `${cachePrefix()}rundraft_${projectId}`

// One-time migration of the old generic keys (qa_projects, qa_testcases_{id}, …)
// to the workspace-namespaced keys. Copies a value across only if the new key
// is empty (never clobbers fresher data), then removes the legacy key. Safe to
// run on every startup; a no-op once migrated.
export function migrateLegacyCache() {
  const moves = []
  for (const key of Object.keys(localStorage)) {
    if (key === 'qa_projects') moves.push([key, projectsKey()])
    else if (key === 'qa_team_members') moves.push([key, teamMembersKey()])
    else if (key.startsWith('qa_testcases_')) moves.push([key, testCasesKey(key.slice('qa_testcases_'.length))])
    else if (key.startsWith('qa_bugs_')) moves.push([key, bugsKey(key.slice('qa_bugs_'.length))])
    else if (key.startsWith('qa_runs_')) moves.push([key, runsKey(key.slice('qa_runs_'.length))])
    else if (key.startsWith('qa_run_draft_')) moves.push([key, runDraftKey(key.slice('qa_run_draft_'.length))])
  }
  moves.forEach(([legacyKey, newKey]) => {
    if (localStorage.getItem(newKey) === null) {
      const val = localStorage.getItem(legacyKey)
      if (val !== null) localStorage.setItem(newKey, val)
    }
    localStorage.removeItem(legacyKey)
  })
  sanitizeAllCache()
}

// Remove every cached record for the current workspace. Used on logout and by
// the conflict modal's "Clear local cache" action. Leaves qa_current_user.
export function clearWorkspaceCache() {
  const prefix = cachePrefix()
  Object.keys(localStorage)
    .filter((key) => key.startsWith(prefix))
    .forEach((key) => localStorage.removeItem(key))
}

// Soft-delete marker. Deleted records are kept in storage (and synced as
// tombstones) so the delete propagates across devices instead of being
// resurrected by a merge. The public getters below hide them.
export const isDeleted = (record) => record?.deleted === true
const excludeDeleted = (list) => list.filter((item) => !isDeleted(item))
const markDeleted = (list, id) => {
  const idx = list.findIndex((item) => item.id === id)
  if (idx >= 0) list[idx] = { ...list[idx], deleted: true, deletedAt: new Date().toISOString() }
  return list
}

// Projects
export const getProjectsRaw = () => get(projectsKey()) ?? []
export const getProjects = () => excludeDeleted(getProjectsRaw())
export const setProjects = (projects) => set(projectsKey(), projects)
export const saveProject = (project) => {
  const list = getProjectsRaw()
  const idx = list.findIndex((p) => p.id === project.id)
  idx >= 0 ? (list[idx] = project) : list.push(project)
  set(projectsKey(), list)
}
export const deleteProject = (id) => {
  set(projectsKey(), markDeleted(getProjectsRaw(), id))
  localStorage.removeItem(testCasesKey(id))
  localStorage.removeItem(bugsKey(id))
  localStorage.removeItem(runsKey(id))
  localStorage.removeItem(requirementsKey(id))
  localStorage.removeItem(testPlansKey(id))
  localStorage.removeItem(milestonesKey(id))
}

export function sanitizeAllCache() {
  const prefix = cachePrefix()
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(prefix)) continue

    try {
      if (key.includes('_testcases_')) {
        const val = get(key)
        if (Array.isArray(val)) {
          const sanitized = val.map((tc) => sanitizeRecord(normalizeTestCase(tc)))
          set(key, sanitized)
        }
      } else if (key.includes('_bugs_')) {
        const val = get(key)
        if (Array.isArray(val)) {
          const sanitized = val.map(sanitizeRecord)
          set(key, sanitized)
        }
      } else if (key.includes('_activities')) {
        const val = get(key)
        if (Array.isArray(val)) {
          const sanitized = val.map(sanitizeActivity)
          set(key, sanitized)
        }
      }
    } catch (err) {
      console.error(`[storage] Error sanitizing key ${key}:`, err)
    }
  }
}

// Test cases
export function sanitizeRecord(record) {
  if (!record) return record
  const sanitized = { ...record }

  if (!sanitized.evidenceLinks) {
    sanitized.evidenceLinks = []
  }

  if (Array.isArray(sanitized.attachments)) {
    sanitized.attachments.forEach((att) => {
      if (att.type === 'drive-link') {
        const url = att.name || att.url || (att.driveId ? `https://drive.google.com/file/d/${att.driveId}/view` : '')
        if (url && !sanitized.evidenceLinks.some((e) => e.url === url)) {
          sanitized.evidenceLinks.push({
            id: att.id || newId(),
            url: url,
            label: 'Migrated Google Drive link',
            addedAt: att.createdAt || new Date().toISOString(),
            addedBy: 'System',
          })
        }
      } else {
        const label = `Legacy file: ${att.name} (File content unavailable)`
        if (!sanitized.evidenceLinks.some((e) => e.label === label)) {
          sanitized.evidenceLinks.push({
            id: att.id || newId(),
            url: '',
            label: label,
            addedAt: att.createdAt || new Date().toISOString(),
            addedBy: 'System',
            isLegacy: true,
          })
        }
      }
    })
    delete sanitized.attachments
  }

  if (sanitized.attachments) {
    delete sanitized.attachments
  }

  return sanitized
}

export function sanitizeActivity(act) {
  if (!act || !act.metadata) return act
  const sanitizedAct = { ...act, metadata: { ...act.metadata } }
  if (sanitizedAct.metadata.before) {
    sanitizedAct.metadata.before = sanitizeRecord(sanitizedAct.metadata.before)
  }
  if (sanitizedAct.metadata.after) {
    sanitizedAct.metadata.after = sanitizeRecord(sanitizedAct.metadata.after)
  }
  return sanitizedAct
}

const normalizeTestCase = (tc) => ({ ...tc, status: normalizeTestStatus(tc.status) })
export const getTestCasesRaw = (projectId) => {
  const key = testCasesKey(projectId)
  const list = get(key) ?? []
  const normalized = list.map((tc) => sanitizeRecord(normalizeTestCase(tc)))
  if (JSON.stringify(list) !== JSON.stringify(normalized)) set(key, normalized)
  return normalized
}
export const getTestCases = (projectId) => excludeDeleted(getTestCasesRaw(projectId))
export const setTestCases = (projectId, testCases) =>
  set(testCasesKey(projectId), testCases.map((tc) => sanitizeRecord(normalizeTestCase(tc))))
export const saveTestCase = (projectId, tc) => {
  const list = getTestCasesRaw(projectId)
  const idx = list.findIndex((t) => t.id === tc.id)
  const sanitized = sanitizeRecord(normalizeTestCase(tc))
  idx >= 0 ? (list[idx] = sanitized) : list.push(sanitized)
  set(testCasesKey(projectId), list)
}
export const deleteTestCase = (projectId, id) =>
  set(testCasesKey(projectId), markDeleted(getTestCasesRaw(projectId), id))

// Bugs
export const getBugsRaw = (projectId) => {
  const key = bugsKey(projectId)
  const list = get(key) ?? []
  const sanitized = list.map(sanitizeRecord)
  if (JSON.stringify(list) !== JSON.stringify(sanitized)) set(key, sanitized)
  return sanitized
}
export const getBugs = (projectId) => excludeDeleted(getBugsRaw(projectId))
export const setBugs = (projectId, bugs) => set(bugsKey(projectId), bugs.map(sanitizeRecord))
export const saveBug = (projectId, bug) => {
  const list = getBugsRaw(projectId)
  const idx = list.findIndex((b) => b.id === bug.id)
  const sanitized = sanitizeRecord(bug)
  idx >= 0 ? (list[idx] = sanitized) : list.push(sanitized)
  set(bugsKey(projectId), list)
}
export const deleteBug = (projectId, id) =>
  set(bugsKey(projectId), markDeleted(getBugsRaw(projectId), id))

// Test runs
export const getTestRunsRaw = (projectId) => get(runsKey(projectId)) ?? []
export const getTestRuns = (projectId) => excludeDeleted(getTestRunsRaw(projectId))
export const setTestRuns = (projectId, runs) => set(runsKey(projectId), runs)
export const saveTestRun = (projectId, run) => {
  const list = getTestRunsRaw(projectId)
  const idx = list.findIndex((r) => r.id === run.id)
  idx >= 0 ? (list[idx] = run) : list.push(run)
  set(runsKey(projectId), list)
}
export const deleteTestRun = (projectId, id) =>
  set(runsKey(projectId), markDeleted(getTestRunsRaw(projectId), id))

// When a bug is deleted, strip its id from every saved run and the active draft
// run so the UI never shows a stale/deleted bug link. Test case status, actual
// results, and the runs themselves are preserved — only the bug *references*
// are cleared (v1 behaviour). Returns the records that changed so the caller can
// sync them to Firebase.
export function removeBugReferencesFromRuns(projectId, bugId) {
  const changedRuns = []

  const runs = getTestRunsRaw(projectId)
  let runsDirty = false
  runs.forEach((run) => {
    let dirty = false
    if (Array.isArray(run.linkedBugIds) && run.linkedBugIds.includes(bugId)) {
      run.linkedBugIds = run.linkedBugIds.filter((id) => id !== bugId)
      dirty = true
    }
    if (Array.isArray(run.cases)) {
      run.cases.forEach((c) => {
        if (c.bugId === bugId) { c.bugId = ''; dirty = true }
        if (c.linkedBugId === bugId) { c.linkedBugId = ''; dirty = true }
        if (Array.isArray(c.linkedBugIds) && c.linkedBugIds.includes(bugId)) {
          c.linkedBugIds = c.linkedBugIds.filter((id) => id !== bugId)
          dirty = true
        }
      })
    }
    if (dirty) {
      run.bugsLogged = Array.isArray(run.linkedBugIds)
        ? run.linkedBugIds.length
        : Math.max(0, (run.bugsLogged ?? 1) - 1)
      runsDirty = true
      changedRuns.push(run)
    }
  })
  if (runsDirty) setTestRuns(projectId, runs)

  // Active draft run (single per project)
  let changedDraft = null
  const draft = get(runDraftKey(projectId))
  if (draft) {
    let dirty = false
    if (Array.isArray(draft.loggedBugIds) && draft.loggedBugIds.includes(bugId)) {
      draft.loggedBugIds = draft.loggedBugIds.filter((id) => id !== bugId)
      dirty = true
    }
    if (draft.results && typeof draft.results === 'object') {
      Object.entries(draft.results).forEach(([caseId, result]) => {
        if (result && result.bugId === bugId) {
          result.bugId = undefined
          dirty = true
          // Allow the case to be logged again now that its bug is gone.
          if (Array.isArray(draft.loggedBugCaseIds)) {
            draft.loggedBugCaseIds = draft.loggedBugCaseIds.filter((id) => id !== caseId)
          }
        }
      })
    }
    if (dirty) {
      draft.bugsLogged = Array.isArray(draft.loggedBugIds)
        ? draft.loggedBugIds.length
        : Math.max(0, (draft.bugsLogged ?? 1) - 1)
      set(runDraftKey(projectId), draft)
      changedDraft = draft
    }
  }

  return { changedRuns, changedDraft }
}

// Merge helpers — used by Firebase subscription callbacks so local records
// are never silently removed when Firestore has fewer items than localStorage.
// incoming (Firebase) wins on field conflicts; local-only records are kept.
// Deletes still propagate because remote deletes are written as tombstones
// (deleted: true), which travel through this merge like any other field.
export function mergeById(existing, incoming) {
  const byId = new Map(existing.map((item) => [item.id, item]))
  incoming.forEach((item) => byId.set(item.id, { ...byId.get(item.id), ...item }))
  return [...byId.values()]
}

// Current user
export const getCurrentUser = () => get('qa_current_user') ?? ''
export const setCurrentUser = (user) => set('qa_current_user', user)

// Team members
export const getTeamMembersRaw = () => {
  const members = get(teamMembersKey()) ?? []
  if (members.some((member) => typeof member === 'string')) {
    const migrated = members.map((member) =>
      typeof member === 'string' ? { id: newId(), name: member } : member,
    )
    set(teamMembersKey(), migrated)
    return migrated
  }
  return members
}
export const getTeamMembers = () => excludeDeleted(getTeamMembersRaw())
export const setTeamMembers = (members) => set(teamMembersKey(), members)
export const deleteTeamMember = (id) =>
  set(teamMembersKey(), markDeleted(getTeamMembersRaw(), id))

// Activities
export const ACTIVITY_HISTORY_LIMIT = 1000
export const activitiesKey = () => `${cachePrefix()}activities`
export const getActivitiesRaw = () => {
  const key = activitiesKey()
  const list = get(key) ?? []
  const sanitized = list.map(sanitizeActivity)
  if (JSON.stringify(list) !== JSON.stringify(sanitized)) set(key, sanitized)
  return sanitized
}
export const setActivities = (activities) => {
  const pruned = activities.slice(0, ACTIVITY_HISTORY_LIMIT)
  const sanitized = pruned.map(sanitizeActivity)
  set(activitiesKey(), sanitized)
}
export const saveActivity = (activity) => {
  const list = getActivitiesRaw()
  if (!list.some((a) => a.id === activity.id)) {
    const sanitized = sanitizeActivity(activity)
    list.push(sanitized)
    list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    setActivities(list)
  }
}

// Notifications
export const notificationsKey = () => `${cachePrefix()}notifications`
export const getNotificationsRaw = () => {
  const key = notificationsKey()
  const list = get(key) ?? []
  const sanitized = list.map(sanitizeRecord)
  if (JSON.stringify(list) !== JSON.stringify(sanitized)) set(key, sanitized)
  return sanitized
}
export const getNotifications = () => excludeDeleted(getNotificationsRaw())
export const setNotifications = (notifications) => set(notificationsKey(), notifications.map(sanitizeRecord))
export const saveNotification = (notification) => {
  const list = getNotificationsRaw()
  const idx = list.findIndex((n) => n.id === notification.id)
  const sanitized = sanitizeRecord(notification)
  idx >= 0 ? (list[idx] = sanitized) : list.push(sanitized)
  set(notificationsKey(), list)
}
export const deleteNotification = (id) =>
  set(notificationsKey(), markDeleted(getNotificationsRaw(), id))

// Shared Steps
export const sharedStepsKey = (projectId) => `${cachePrefix()}sharedsteps_${projectId}`
export const getSharedStepsRaw = (projectId) => {
  const key = sharedStepsKey(projectId)
  const list = get(key) ?? []
  const sanitized = list.map(sanitizeRecord)
  if (JSON.stringify(list) !== JSON.stringify(sanitized)) set(key, sanitized)
  return sanitized
}
export const getSharedSteps = (projectId) => excludeDeleted(getSharedStepsRaw(projectId))
export const setSharedSteps = (projectId, sharedSteps) => set(sharedStepsKey(projectId), sharedSteps.map(sanitizeRecord))
export const saveSharedStep = (projectId, group) => {
  const list = getSharedStepsRaw(projectId)
  const idx = list.findIndex((g) => g.id === group.id)
  const sanitized = sanitizeRecord(group)
  idx >= 0 ? (list[idx] = sanitized) : list.push(sanitized)
  set(sharedStepsKey(projectId), list)
}
export const deleteSharedStep = (projectId, id) =>
  set(sharedStepsKey(projectId), markDeleted(getSharedStepsRaw(projectId), id))

// Requirements (link test cases → requirements for coverage)
export const requirementsKey = (projectId) => `${cachePrefix()}requirements_${projectId}`
export const getRequirementsRaw = (projectId) => get(requirementsKey(projectId)) ?? []
export const getRequirements = (projectId) => excludeDeleted(getRequirementsRaw(projectId))
export const setRequirements = (projectId, requirements) => set(requirementsKey(projectId), requirements)
export const saveRequirement = (projectId, requirement) => {
  const list = getRequirementsRaw(projectId)
  const idx = list.findIndex((r) => r.id === requirement.id)
  idx >= 0 ? (list[idx] = requirement) : list.push(requirement)
  set(requirementsKey(projectId), list)
}
export const deleteRequirement = (projectId, id) =>
  set(requirementsKey(projectId), markDeleted(getRequirementsRaw(projectId), id))

// Test plans (group test runs by release/sprint)
export const testPlansKey = (projectId) => `${cachePrefix()}testplans_${projectId}`
export const getTestPlansRaw = (projectId) => get(testPlansKey(projectId)) ?? []
export const getTestPlans = (projectId) => excludeDeleted(getTestPlansRaw(projectId))
export const setTestPlans = (projectId, plans) => set(testPlansKey(projectId), plans)
export const saveTestPlan = (projectId, plan) => {
  const list = getTestPlansRaw(projectId)
  const idx = list.findIndex((p) => p.id === plan.id)
  idx >= 0 ? (list[idx] = plan) : list.push(plan)
  set(testPlansKey(projectId), list)
}
export const deleteTestPlan = (projectId, id) =>
  set(testPlansKey(projectId), markDeleted(getTestPlansRaw(projectId), id))

// Milestones (release deadlines linked to test plans)
export const milestonesKey = (projectId) => `${cachePrefix()}milestones_${projectId}`
export const getMilestonesRaw = (projectId) => get(milestonesKey(projectId)) ?? []
export const getMilestones = (projectId) => excludeDeleted(getMilestonesRaw(projectId))
export const setMilestones = (projectId, milestones) => set(milestonesKey(projectId), milestones)
export const saveMilestone = (projectId, milestone) => {
  const list = getMilestonesRaw(projectId)
  const idx = list.findIndex((m) => m.id === milestone.id)
  idx >= 0 ? (list[idx] = milestone) : list.push(milestone)
  set(milestonesKey(projectId), list)
}
export const deleteMilestone = (projectId, id) =>
  set(milestonesKey(projectId), markDeleted(getMilestonesRaw(projectId), id))
