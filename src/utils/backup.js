import {
  getBugs,
  getCurrentUser,
  getProjects,
  getTeamMembers,
  getTestCases,
  getTestRuns,
  setCurrentUser,
  setTeamMembers,
} from './storage'

const BACKUP_VERSION = 1

const set = (key, value) => localStorage.setItem(key, JSON.stringify(value))

function uniqueById(existing, incoming) {
  const map = new Map(existing.map((item) => [item.id, item]))
  incoming.forEach((item) => map.set(item.id, { ...map.get(item.id), ...item }))
  return [...map.values()]
}

function clearWorkspace() {
  Object.keys(localStorage)
    .filter((key) =>
      key === 'qa_projects' ||
      key === 'qa_team_members' ||
      key === 'qa_current_user' ||
      key.startsWith('qa_testcases_') ||
      key.startsWith('qa_bugs_') ||
      key.startsWith('qa_runs_'))
    .forEach((key) => localStorage.removeItem(key))
}

export function createWorkspaceBackup() {
  const projects = getProjects()
  const projectData = Object.fromEntries(projects.map((project) => [
    project.id,
    {
      testCases: getTestCases(project.id),
      bugs: getBugs(project.id),
      runs: getTestRuns(project.id),
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
    ;['testCases', 'bugs', 'runs'].forEach((key) => {
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
      teamMembers: backup.data.teamMembers.length,
    }
  }, { projects: 0, testCases: 0, bugs: 0, runs: 0, teamMembers: 0 })
}

export function restoreWorkspaceBackup(backup, mode) {
  const incoming = backup.data

  if (mode === 'replace') {
    clearWorkspace()
    set('qa_projects', incoming.projects)
    setTeamMembers(incoming.teamMembers)
    setCurrentUser(incoming.currentUser ?? '')
    incoming.projects.forEach((project) => {
      const data = incoming.projectData[project.id] ?? {}
      set(`qa_testcases_${project.id}`, data.testCases ?? [])
      set(`qa_bugs_${project.id}`, data.bugs ?? [])
      set(`qa_runs_${project.id}`, data.runs ?? [])
    })
  } else {
    const projects = uniqueById(getProjects(), incoming.projects)
    const members = uniqueById(getTeamMembers(), incoming.teamMembers)
    set('qa_projects', projects)
    setTeamMembers(members)
    if (!getCurrentUser() && incoming.currentUser) setCurrentUser(incoming.currentUser)

    incoming.projects.forEach((project) => {
      const data = incoming.projectData[project.id] ?? {}
      set(`qa_testcases_${project.id}`, uniqueById(getTestCases(project.id), data.testCases ?? []))
      set(`qa_bugs_${project.id}`, uniqueById(getBugs(project.id), data.bugs ?? []))
      set(`qa_runs_${project.id}`, uniqueById(getTestRuns(project.id), data.runs ?? []))
    })
  }

  window.dispatchEvent(new Event('qa-projects-changed'))
}
