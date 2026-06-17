import { bugsKey, projectsKey, runsKey, teamMembersKey, testCasesKey } from './storage'

const DEMO_PROJECT_IDS = ['proj-ecommerce', 'proj-admin', 'proj-mobile']
const DEMO_MEMBER_IDS = ['member-ahmed', 'member-sara', 'member-maya', 'member-leo']
const DEMO_USERS = ['Ahmed', 'Sara', 'Maya', 'Leo']

const get = (key) => JSON.parse(localStorage.getItem(key) ?? 'null')
const set = (key, value) => localStorage.setItem(key, JSON.stringify(value))

export function cleanupLegacyDemoData() {
  const projects = get(projectsKey()) ?? []
  const demoProjectIds = new Set(DEMO_PROJECT_IDS)
  const remainingProjects = projects.filter((project) => !demoProjectIds.has(project.id))

  if (remainingProjects.length !== projects.length) {
    set(projectsKey(), remainingProjects)
    DEMO_PROJECT_IDS.forEach((projectId) => {
      localStorage.removeItem(testCasesKey(projectId))
      localStorage.removeItem(bugsKey(projectId))
      localStorage.removeItem(runsKey(projectId))
    })
  }

  const members = get(teamMembersKey()) ?? []
  const remainingMembers = members.filter((member) => !DEMO_MEMBER_IDS.includes(member.id))
  if (remainingMembers.length !== members.length) set(teamMembersKey(), remainingMembers)

  const currentUser = get('qa_current_user')
  if (typeof currentUser === 'string' && DEMO_USERS.includes(currentUser)) {
    localStorage.removeItem('qa_current_user')
  }

  localStorage.removeItem('qa_seeded_v1')
}
