import { useUser } from '../context/UserContext'
import { useTeamMembers } from './useTeamMembers'
import { auth } from '../utils/firebase'
import { getTeamMembersRaw, isDeleted } from '../utils/storage'

export function useUserRole() {
  const { user } = useUser()
  const { members } = useTeamMembers()

  const email = auth?.currentUser?.email || ''
  const isAdminEmail = email.toLowerCase() === 'jaswanth@gmail.com'

  const currentMember = members.find((m) => {
    if (auth?.currentUser?.uid && m.uid === auth.currentUser.uid) return true
    return m.name.toLowerCase() === (user || '').toLowerCase()
  })

  // Detect if user has been explicitly deleted/blocked from workspace
  const rawMembers = getTeamMembersRaw()
  const rawRecord = rawMembers.find((m) => {
    if (auth?.currentUser?.uid && m.uid === auth.currentUser.uid) return true
    return m.name.toLowerCase() === (user || '').toLowerCase()
  })
  const userIsDeleted = rawRecord ? isDeleted(rawRecord) : false

  let role
  if (isAdminEmail) {
    role = 'QA Lead'
  } else if (userIsDeleted) {
    role = 'None'
  } else if (currentMember) {
    role = currentMember.role || 'Viewer'
  } else {
    // Prevent lockout of first/unassigned workspace users
    role = members.length === 0 ? 'QA Lead' : 'Viewer'
  }

  return {
    role,
    isLead: role === 'QA Lead',
    isTester: role === 'Tester',
    isViewer: role === 'Viewer',
    isDeleted: userIsDeleted && !isAdminEmail, // admins can never be deleted
  }
}

