import { newId } from './id'
import { normalizeTestStatus } from './status'

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
export const getProjectsRaw = () => get('qa_projects') ?? []
export const getProjects = () => excludeDeleted(getProjectsRaw())
export const setProjects = (projects) => set('qa_projects', projects)
export const saveProject = (project) => {
  const list = getProjectsRaw()
  const idx = list.findIndex((p) => p.id === project.id)
  idx >= 0 ? (list[idx] = project) : list.push(project)
  set('qa_projects', list)
}
export const deleteProject = (id) => {
  set('qa_projects', markDeleted(getProjectsRaw(), id))
  localStorage.removeItem(`qa_testcases_${id}`)
  localStorage.removeItem(`qa_bugs_${id}`)
  localStorage.removeItem(`qa_runs_${id}`)
}

// Test cases
const normalizeTestCase = (tc) => ({ ...tc, status: normalizeTestStatus(tc.status) })
export const getTestCasesRaw = (projectId) => {
  const key = `qa_testcases_${projectId}`
  const list = get(key) ?? []
  const normalized = list.map(normalizeTestCase)
  if (JSON.stringify(list) !== JSON.stringify(normalized)) set(key, normalized)
  return normalized
}
export const getTestCases = (projectId) => excludeDeleted(getTestCasesRaw(projectId))
export const setTestCases = (projectId, testCases) =>
  set(`qa_testcases_${projectId}`, testCases.map(normalizeTestCase))
export const saveTestCase = (projectId, tc) => {
  const list = getTestCasesRaw(projectId)
  const idx = list.findIndex((t) => t.id === tc.id)
  const normalized = normalizeTestCase(tc)
  idx >= 0 ? (list[idx] = normalized) : list.push(normalized)
  set(`qa_testcases_${projectId}`, list)
}
export const deleteTestCase = (projectId, id) =>
  set(`qa_testcases_${projectId}`, markDeleted(getTestCasesRaw(projectId), id))

// Bugs
export const getBugsRaw = (projectId) => get(`qa_bugs_${projectId}`) ?? []
export const getBugs = (projectId) => excludeDeleted(getBugsRaw(projectId))
export const setBugs = (projectId, bugs) => set(`qa_bugs_${projectId}`, bugs)
export const saveBug = (projectId, bug) => {
  const list = getBugsRaw(projectId)
  const idx = list.findIndex((b) => b.id === bug.id)
  idx >= 0 ? (list[idx] = bug) : list.push(bug)
  set(`qa_bugs_${projectId}`, list)
}
export const deleteBug = (projectId, id) =>
  set(`qa_bugs_${projectId}`, markDeleted(getBugsRaw(projectId), id))

// Test runs
export const getTestRunsRaw = (projectId) => get(`qa_runs_${projectId}`) ?? []
export const getTestRuns = (projectId) => excludeDeleted(getTestRunsRaw(projectId))
export const setTestRuns = (projectId, runs) => set(`qa_runs_${projectId}`, runs)
export const saveTestRun = (projectId, run) => {
  const list = getTestRunsRaw(projectId)
  const idx = list.findIndex((r) => r.id === run.id)
  idx >= 0 ? (list[idx] = run) : list.push(run)
  set(`qa_runs_${projectId}`, list)
}
export const deleteTestRun = (projectId, id) =>
  set(`qa_runs_${projectId}`, markDeleted(getTestRunsRaw(projectId), id))

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
  const members = get('qa_team_members') ?? []
  if (members.some((member) => typeof member === 'string')) {
    const migrated = members.map((member) =>
      typeof member === 'string' ? { id: newId(), name: member } : member,
    )
    set('qa_team_members', migrated)
    return migrated
  }
  return members
}
export const getTeamMembers = () => excludeDeleted(getTeamMembersRaw())
export const setTeamMembers = (members) => set('qa_team_members', members)
export const deleteTeamMember = (id) =>
  set('qa_team_members', markDeleted(getTeamMembersRaw(), id))
