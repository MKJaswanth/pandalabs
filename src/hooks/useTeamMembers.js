import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteTeamMember, getTeamMembers, getTeamMembersRaw, isDeleted, mergeById, setTeamMembers } from '../utils/storage'
import { deleteTeamMemberRemote, saveTeamMemberRemote, subscribeTeamMembers } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'

export function useTeamMembers() {
  const [members, setMembers] = useState(() => getTeamMembers())
  const remoteReady = useRemoteSync()

  useEffect(() => {
    if (!remoteReady) return undefined
    return subscribeTeamMembers((nextMembers) => {
      // Merge against raw so a stale snapshot can't wipe local members and
      // deletes still propagate; show only live members.
      const merged = mergeById(getTeamMembersRaw(), nextMembers)
      setTeamMembers(merged)
      setMembers(merged.filter((m) => !isDeleted(m)))
    })
  }, [remoteReady])

  const addMember = useCallback((name) => {
    const member = { id: newId(), name: name.trim() }
    const updated = [...getTeamMembersRaw(), member]
    setTeamMembers(updated)
    setMembers(updated.filter((m) => !isDeleted(m)))
    if (remoteReady) saveTeamMemberRemote(member)
    return member
  }, [remoteReady])

  const removeMember = useCallback((id) => {
    deleteTeamMember(id)
    setMembers(getTeamMembers())
    if (remoteReady) deleteTeamMemberRemote(id)
  }, [remoteReady])

  return { members, addMember, removeMember }
}
