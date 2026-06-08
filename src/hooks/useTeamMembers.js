import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { getTeamMembers, setTeamMembers } from '../utils/storage'
import { isFirebaseEnabled } from '../utils/firebase'
import { deleteTeamMemberRemote, saveTeamMemberRemote, subscribeTeamMembers } from '../utils/remoteStorage'

export function useTeamMembers() {
  const [members, setMembers] = useState(() => getTeamMembers())

  useEffect(() => {
    if (!isFirebaseEnabled) return undefined
    return subscribeTeamMembers((nextMembers) => {
      setTeamMembers(nextMembers)
      setMembers(nextMembers)
    })
  }, [])

  const addMember = useCallback((name) => {
    const member = { id: newId(), name: name.trim() }
    const updated = [...getTeamMembers(), member]
    setTeamMembers(updated)
    setMembers(updated)
    if (isFirebaseEnabled) saveTeamMemberRemote(member)
    return member
  }, [])

  const removeMember = useCallback((id) => {
    const updated = getTeamMembers().filter((m) => m.id !== id)
    setTeamMembers(updated)
    setMembers(updated)
    if (isFirebaseEnabled) deleteTeamMemberRemote(id)
  }, [])

  return { members, addMember, removeMember }
}
