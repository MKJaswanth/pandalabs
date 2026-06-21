import {
  bugsKey,
  clearWorkspaceCache,
  getBugs,
  getCurrentUser,
  getProjects,
  getRequirements,
  getTeamMembers,
  getTestCases,
  getTestPlans,
  getMilestones,
  getTestRuns,
  milestonesKey,
  projectsKey,
  requirementsKey,
  runsKey,
  sanitizeRecord,
  setCurrentUser,
  setTeamMembers,
  testCasesKey,
  testPlansKey,
} from './storage'
import {
  clearWorkspaceRemote,
  saveBugRemote,
  saveMilestoneRemote,
  saveProjectRemote,
  saveRequirementRemote,
  saveTeamMemberRemote,
  saveTestCaseRemote,
  saveTestPlanRemote,
  saveTestRunRemote,
} from './remoteStorage'

const BACKUP_VERSION = 1

const set = (key, value) => localStorage.setItem(key, JSON.stringify(value))

function uniqueById(existing, incoming) {
  const map = new Map(existing.map((item) => [item.id, item]))
  incoming.forEach((item) => map.set(item.id, { ...map.get(item.id), ...item }))
  return [...map.values()]
}

export function createWorkspaceBackup() {
  const projects = getProjects()
  const projectData = Object.fromEntries(projects.map((project) => [
    project.id,
    {
      testCases: getTestCases(project.id),
      bugs: getBugs(project.id),
      runs: getTestRuns(project.id),
      requirements: getRequirements(project.id),
      testPlans: getTestPlans(project.id),
      milestones: getMilestones(project.id),
    },
  ]))

  return {
    app: 'qa-manager',
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      currentUser: getCurrentUser(),
      teamMembers: getTeamMembers(),
      projects,
      projectData,
    },
  }
}

export function downloadWorkspaceBackup() {
  const backup = createWorkspaceBackup()
  const stamp = new Date().toISOString().slice(0, 10)
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `qa-manager-backup-${stamp}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function validateWorkspaceBackup(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('This is not valid JSON. Make sure the file was not corrupted.')
  }

  // Accept both 'qa-manager' and 'qa-lab' app identifiers (older backups used 'qa-lab')
  const knownApps = ['qa-manager', 'qa-lab']
  if (!parsed?.data) {
    throw new Error('This file is not a QA Lab workspace backup (missing data field).')
  }
  if (parsed.app && !knownApps.includes(parsed.app)) {
    throw new Error(`Unrecognised backup app identifier "${parsed.app}". Expected a QA Lab backup.`)
  }

  const { projects, teamMembers, projectData } = parsed.data

  if (!Array.isArray(projects)) {
    throw new Error('Backup is missing or has an invalid projects list.')
  }

  // teamMembers is optional in older backups — default to empty array
  if (teamMembers !== undefined && !Array.isArray(teamMembers)) {
    throw new Error('Backup has invalid team members data.')
  }

  // projectData may be absent in minimal backups — default to empty object
  if (projectData !== undefined && (typeof projectData !== 'object' || Array.isArray(projectData))) {
    throw new Error('Backup has invalid project data format.')
  }

  const safeProjectData = projectData ?? {}

  projects.forEach((project) => {
    if (!project?.id || !project?.name) {
      throw new Error('A project entry in the backup is missing a required id or name field.')
    }
    const data = safeProjectData[project.id] ?? {}
    ;['testCases', 'bugs', 'runs', 'requirements', 'testPlans', 'milestones'].forEach((key) => {
      if (data[key] !== undefined && !Array.isArray(data[key])) {
        throw new Error(`Project "${project.name}" has invalid ${key} data (expected an array).`)
      }
    })
  })

  // Normalise to a consistent shape so restoreWorkspaceBackup can assume these fields
  if (!Array.isArray(parsed.data.teamMembers)) parsed.data.teamMembers = []
  if (!parsed.data.projectData) parsed.data.projectData = {}
  if (!parsed.exportedAt) parsed.exportedAt = new Date().toISOString()

  return parsed
}

export function summarizeBackup(backup) {
  const projects = backup.data.projects
  const projectData = backup.data.projectData
  return projects.reduce((summary, project) => {
    const data = projectData[project.id] ?? {}
    return {
      projects: summary.projects + 1,
      testCases: summary.testCases + (data.testCases?.length ?? 0),
      bugs: summary.bugs + (data.bugs?.length ?? 0),
      runs: summary.runs + (data.runs?.length ?? 0),
      requirements: (summary.requirements ?? 0) + (data.requirements?.length ?? 0),
      testPlans: (summary.testPlans ?? 0) + (data.testPlans?.length ?? 0),
      milestones: (summary.milestones ?? 0) + (data.milestones?.length ?? 0),
      teamMembers: backup.data.teamMembers.length,
    }
  }, { projects: 0, testCases: 0, bugs: 0, runs: 0, requirements: 0, testPlans: 0, milestones: 0, teamMembers: 0 })
}

export function restoreWorkspaceBackup(backup, mode) {
  const incoming = backup.data

  if (mode === 'replace') {
    clearWorkspaceCache()
    set(projectsKey(), incoming.projects)
    setTeamMembers(incoming.teamMembers)
    setCurrentUser(incoming.currentUser ?? '')
    incoming.projects.forEach((project) => {
      const data = incoming.projectData[project.id] ?? {}
      const sanitizedTestCases = (data.testCases ?? []).map(sanitizeRecord)
      const sanitizedBugs = (data.bugs ?? []).map(sanitizeRecord)
      set(testCasesKey(project.id), sanitizedTestCases)
      set(bugsKey(project.id), sanitizedBugs)
      set(runsKey(project.id), data.runs ?? [])
      set(requirementsKey(project.id), data.requirements ?? [])
      set(testPlansKey(project.id), data.testPlans ?? [])
      set(milestonesKey(project.id), data.milestones ?? [])
    })
  } else {
    const projects = uniqueById(getProjects(), incoming.projects)
    const members = uniqueById(getTeamMembers(), incoming.teamMembers)
    set(projectsKey(), projects)
    setTeamMembers(members)
    if (!getCurrentUser() && incoming.currentUser) setCurrentUser(incoming.currentUser)

    incoming.projects.forEach((project) => {
      const data = incoming.projectData[project.id] ?? {}
      const sanitizedTestCases = (data.testCases ?? []).map(sanitizeRecord)
      const sanitizedBugs = (data.bugs ?? []).map(sanitizeRecord)
      set(testCasesKey(project.id), uniqueById(getTestCases(project.id), sanitizedTestCases))
      set(bugsKey(project.id), uniqueById(getBugs(project.id), sanitizedBugs))
      set(runsKey(project.id), uniqueById(getTestRuns(project.id), data.runs ?? []))
      set(requirementsKey(project.id), uniqueById(getRequirements(project.id), data.requirements ?? []))
      set(testPlansKey(project.id), uniqueById(getTestPlans(project.id), data.testPlans ?? []))
      set(milestonesKey(project.id), uniqueById(getMilestones(project.id), data.milestones ?? []))
    })
  }

  window.dispatchEvent(new Event('qa-projects-changed'))
}

// Push a full workspace (backup-shaped) to Firestore. Shared by the Backup page
// (restore → cloud) and the workspace conflict modal (upload local → cloud).
// In 'replace' mode the cloud workspace is hard-wiped first. Writes run in
// parallel for speed.
export async function uploadWorkspaceToCloud(backup, mode = 'merge') {
  const { projects = [], teamMembers = [], projectData = {} } = backup.data

  if (mode === 'replace') {
    await clearWorkspaceRemote()
  }

  await Promise.all(teamMembers.map((m) => saveTeamMemberRemote(m)))

  await Promise.all(projects.map(async (project) => {
    await saveProjectRemote(project)
    const data = projectData[project.id] ?? {}
    await Promise.all([
      ...(data.testCases ?? []).map((tc) => saveTestCaseRemote(project.id, tc)),
      ...(data.bugs ?? []).map((bug) => saveBugRemote(project.id, bug)),
      ...(data.runs ?? []).map((run) => saveTestRunRemote(project.id, run)),
      ...(data.requirements ?? []).map((req) => saveRequirementRemote(project.id, req)),
      ...(data.testPlans ?? []).map((plan) => saveTestPlanRemote(project.id, plan)),
      ...(data.milestones ?? []).map((m) => saveMilestoneRemote(project.id, m)),
    ])
  }))
}
