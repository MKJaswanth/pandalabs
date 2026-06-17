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
}

// Test cases
const normalizeTestCase = (tc) => ({ ...tc, status: normalizeTestStatus(tc.status) })
export const getTestCasesRaw = (projectId) => {
  const key = testCasesKey(projectId)
  const list = get(key) ?? []
  const normalized = list.map(normalizeTestCase)
  if (JSON.stringify(list) !== JSON.stringify(normalized)) set(key, normalized)
  return normalized
}
export const getTestCases = (projectId) => excludeDeleted(getTestCasesRaw(projectId))
export const setTestCases = (projectId, testCases) =>
  set(testCasesKey(projectId), testCases.map(normalizeTestCase))
export const saveTestCase = (projectId, tc) => {
  const list = getTestCasesRaw(projectId)
  const idx = list.findIndex((t) => t.id === tc.id)
  const normalized = normalizeTestCase(tc)
  idx >= 0 ? (list[idx] = normalized) : list.push(normalized)
  set(testCasesKey(projectId), list)
}
export const deleteTestCase = (projectId, id) =>
  set(testCasesKey(projectId), markDeleted(getTestCasesRaw(projectId), id))

// Bugs
export const getBugsRaw = (projectId) => get(bugsKey(projectId)) ?? []
export const getBugs = (projectId) => excludeDeleted(getBugsRaw(projectId))
export const setBugs = (projectId, bugs) => set(bugsKey(projectId), bugs)
export const saveBug = (projectId, bug) => {
  const list = getBugsRaw(projectId)
  const idx = list.findIndex((b) => b.id === bug.id)
  idx >= 0 ? (list[idx] = bug) : list.push(bug)
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
