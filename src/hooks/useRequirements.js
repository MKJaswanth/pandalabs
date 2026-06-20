import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import {
  deleteRequirement,
  getCurrentUser,
  getRequirements,
  getRequirementsRaw,
  isDeleted,
  mergeById,
  saveRequirement,
  setRequirements as setRequirementsCache,
} from '../utils/storage'
import { deleteRequirementRemote, saveRequirementRemote, subscribeRequirements } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'

export function useRequirements(projectId) {
  const [requirements, setReqs] = useState(() => getRequirements(projectId))
  const remoteReady = useRemoteSync()

  const refresh = useCallback(() => setReqs(getRequirements(projectId)), [projectId])

  useEffect(() => {
    if (!remoteReady || !projectId) return undefined
    return subscribeRequirements(projectId, (next) => {
      const merged = mergeById(getRequirementsRaw(projectId), next)
      setRequirementsCache(projectId, merged)
      setReqs(merged.filter((r) => !isDeleted(r)))
    })
  }, [projectId, remoteReady])

  const addRequirement = useCallback((data) => {
    const req = {
      id: newId(),
      createdAt: new Date().toISOString(),
      testCaseIds: [],
      createdBy: auth?.currentUser?.uid || '',
      createdByName: getCurrentUser() || '',
      ...data,
    }
    saveRequirement(projectId, req)
    setReqs(getRequirements(projectId))
    if (remoteReady) saveRequirementRemote(projectId, req)
    return req
  }, [projectId, remoteReady])

  const updateRequirement = useCallback((req) => {
    const updated = { ...req, updatedAt: new Date().toISOString() }
    saveRequirement(projectId, updated)
    setReqs(getRequirements(projectId))
    if (remoteReady) saveRequirementRemote(projectId, updated)
    return updated
  }, [projectId, remoteReady])

  const removeRequirement = useCallback((id) => {
    deleteRequirement(projectId, id)
    setReqs(getRequirements(projectId))
    if (remoteReady) deleteRequirementRemote(projectId, id)
  }, [projectId, remoteReady])

  return { requirements, addRequirement, updateRequirement, removeRequirement, refresh }
}
