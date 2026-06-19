import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import { deleteTeamMember, getTeamMembers, getTeamMembersRaw, isDeleted, mergeById, setTeamMembers } from '../utils/storage'
import { deleteTeamMemberRemote, saveTeamMemberRemote, subscribeTeamMembers, subscribeWorkspaceUsers } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { addActivity } from '../utils/activity'

export function useTeamMembers() {
  const [members, setMembers] = useState(() => getTeamMembers())
  const [workspaceUsers, setWorkspaceUsers] = useState([])
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

  useEffect(() => {
    if (!remoteReady) return undefined
    return subscribeWorkspaceUsers((users) => {
      setWorkspaceUsers(users)
    })
  }, [remoteReady])

  useEffect(() => {
    if (!remoteReady || workspaceUsers.length === 0) return

    const currentTeamRaw = getTeamMembersRaw()
    let changed = false
    const updatedTeam = [...currentTeamRaw]

    workspaceUsers.forEach((wu) => {
      let existing = updatedTeam.find((m) => m.uid === wu.uid)
      if (!existing) {
        existing = updatedTeam.find((m) => !m.uid && m.name.toLowerCase() === wu.name.toLowerCase())
      }

      if (!existing) {
        const newMember = {
          id: newId(),
          uid: wu.uid,
          name: wu.name,
          role: 'Viewer',
        }
        updatedTeam.push(newMember)
        changed = true
        saveTeamMemberRemote(newMember)
        
        addActivity({
          entityType: 'member',
          entityId: newMember.id,
          action: 'created',
          title: `Team member added: ${newMember.name}`,
          details: `Role: Viewer (Workspace Synced)`,
          after: newMember,
        })
      } else {
        let memberUpdated = false
        const nextRecord = { ...existing }
        if (!existing.uid) {
          nextRecord.uid = wu.uid
          memberUpdated = true
        }
        if (existing.name !== wu.name) {
          nextRecord.name = wu.name
          memberUpdated = true
        }
        if (memberUpdated) {
          const idx = updatedTeam.findIndex((m) => m.id === existing.id)
          updatedTeam[idx] = nextRecord
          changed = true
          saveTeamMemberRemote(nextRecord)
          
          addActivity({
            entityType: 'member',
            entityId: nextRecord.id,
            action: 'updated',
            title: `Team member updated: ${nextRecord.name}`,
            details: `Synced workspace user credentials`,
            before: existing,
            after: nextRecord,
          })
        }
      }
    })

    if (changed) {
      setTeamMembers(updatedTeam)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMembers(updatedTeam.filter((m) => !isDeleted(m)))
    }
  }, [remoteReady, workspaceUsers])

  const addMember = useCallback((name, role = 'Tester') => {
    const member = { id: newId(), name: name.trim(), role }
    const updated = [...getTeamMembersRaw(), member]
    setTeamMembers(updated)
    setMembers(updated.filter((m) => !isDeleted(m)))
    if (remoteReady) saveTeamMemberRemote(member)

    addActivity({
      entityType: 'member',
      entityId: member.id,
      action: 'created',
      title: `Team member added: ${member.name}`,
      details: `Role: ${role}`,
      after: member,
    })

    return member
  }, [remoteReady])

  const removeMember = useCallback((id) => {
    const record = getTeamMembersRaw().find((m) => m.id === id)
    deleteTeamMember(id)
    setMembers(getTeamMembers())
    if (remoteReady) {
      deleteTeamMemberRemote(id)
      if (record && record.uid) {
        import('../utils/remoteStorage').then(({ deleteWorkspaceUserRemote }) => {
          deleteWorkspaceUserRemote(record.uid)
        })
      }
    }

    if (record) {
      addActivity({
        entityType: 'member',
        entityId: id,
        action: 'deleted',
        title: `Team member deleted: ${record.name}`,
        before: record,
      })
    }
  }, [remoteReady])

  const updateMember = useCallback((updatedMember) => {
    const before = getTeamMembersRaw().find((m) => m.id === updatedMember.id)
    const updatedRaw = getTeamMembersRaw().map((m) => (m.id === updatedMember.id ? updatedMember : m))
    setTeamMembers(updatedRaw)
    setMembers(updatedRaw.filter((m) => !isDeleted(m)))
    if (remoteReady) saveTeamMemberRemote(updatedMember)

    addActivity({
      entityType: 'member',
      entityId: updatedMember.id,
      action: 'updated',
      title: `Team member updated: ${updatedMember.name}`,
      details: before && before.role !== updatedMember.role ? `Role changed from ${before.role || 'Viewer'} to ${updatedMember.role}` : '',
      before,
      after: updatedMember,
    })
  }, [remoteReady])

  return { members, addMember, removeMember, updateMember }
}
