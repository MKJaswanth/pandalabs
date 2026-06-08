import { newId } from './id'
import { normalizeTestStatus } from './status'

const get = (key) => JSON.parse(localStorage.getItem(key) ?? 'null')
const set = (key, val) => localStorage.setItem(key, JSON.stringify(val))

// Projects
export const getProjects = () => get('qa_projects') ?? []
export const setProjects = (projects) => set('qa_projects', projects)
export const saveProject = (project) => {
  const list = getProjects()
  const idx = list.findIndex((p) => p.id === project.id)
  idx >= 0 ? (list[idx] = project) : list.push(project)
  set('qa_projects', list)
}
export const deleteProject = (id) => {
  set('qa_projects', getProjects().filter((p) => p.id !== id))
  localStorage.removeItem(`qa_testcases_${id}`)
  localStorage.removeItem(`qa_bugs_${id}`)
  localStorage.removeItem(`qa_runs_${id}`)
}

// Test cases
const normalizeTestCase = (tc) => ({ ...tc, status: normalizeTestStatus(tc.status) })
export const getTestCases = (projectId) => {
  const key = `qa_testcases_${projectId}`
  const list = get(key) ?? []
  const normalized = list.map(normalizeTestCase)
  if (JSON.stringify(list) !== JSON.stringify(normalized)) set(key, normalized)
  return normalized
}
export const setTestCases = (projectId, testCases) =>
  set(`qa_testcases_${projectId}`, testCases.map(normalizeTestCase))
export const saveTestCase = (projectId, tc) => {
  const list = getTestCases(projectId)
  const idx = list.findIndex((t) => t.id === tc.id)
  const normalized = normalizeTestCase(tc)
  idx >= 0 ? (list[idx] = normalized) : list.push(normalized)
  set(`qa_testcases_${projectId}`, list)
}
export const deleteTestCase = (projectId, id) =>
  set(`qa_testcases_${projectId}`, getTestCases(projectId).filter((t) => t.id !== id))

// Bugs
export const getBugs = (projectId) => get(`qa_bugs_${projectId}`) ?? []
export const setBugs = (projectId, bugs) => set(`qa_bugs_${projectId}`, bugs)
export const saveBug = (projectId, bug) => {
  const list = getBugs(projectId)
  const idx = list.findIndex((b) => b.id === bug.id)
  idx >= 0 ? (list[idx] = bug) : list.push(bug)
  set(`qa_bugs_${projectId}`, list)
}
export const deleteBug = (projectId, id) =>
  set(`qa_bugs_${projectId}`, getBugs(projectId).filter((b) => b.id !== id))

// Test runs
export const getTestRuns = (projectId) => get(`qa_runs_${projectId}`) ?? []
export const setTestRuns = (projectId, runs) => set(`qa_runs_${projectId}`, runs)
export const saveTestRun = (projectId, run) => {
  const list = getTestRuns(projectId)
  const idx = list.findIndex((r) => r.id === run.id)
  idx >= 0 ? (list[idx] = run) : list.push(run)
  set(`qa_runs_${projectId}`, list)
}

// Current user
export const getCurrentUser = () => get('qa_current_user') ?? ''
export const setCurrentUser = (user) => set('qa_current_user', user)

// Team members
export const getTeamMembers = () => {
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
export const setTeamMembers = (members) => set('qa_team_members', members)
