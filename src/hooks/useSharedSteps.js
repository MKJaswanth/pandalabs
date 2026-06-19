import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import {
  getSharedSteps,
  getSharedStepsRaw,
  saveSharedStep,
  setSharedSteps as setSharedStepsCache,
  deleteSharedStep,
  isDeleted,
  mergeById,
} from '../utils/storage'
import {
  subscribeSharedSteps,
  saveSharedStepRemote,
  deleteSharedStepRemote,
} from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'

export function useSharedSteps(projectId) {
  const [sharedSteps, setSharedSteps] = useState(() => getSharedSteps(projectId))
  const remoteReady = useRemoteSync()

  useEffect(() => {
    if (!remoteReady || !projectId) return undefined
    return subscribeSharedSteps(projectId, (nextGroups) => {
      const merged = mergeById(getSharedStepsRaw(projectId), nextGroups)
      setSharedStepsCache(projectId, merged)
      setSharedSteps(merged.filter((g) => !isDeleted(g)))
    })
  }, [projectId, remoteReady])

  const addSharedStep = useCallback(
    async (name, description = '', steps = []) => {
      const group = {
        id: newId(),
        createdAt: new Date().toISOString(),
        name,
        description,
        steps,
      }

      saveSharedStep(projectId, group)
      setSharedSteps(getSharedSteps(projectId))

      if (remoteReady) {
        await saveSharedStepRemote(projectId, group)
      }
      return group
    },
    [projectId, remoteReady]
  )

  const updateSharedStep = useCallback(
    async (group) => {
      saveSharedStep(projectId, group)
      setSharedSteps(getSharedSteps(projectId))

      if (remoteReady) {
        await saveSharedStepRemote(projectId, group)
      }
    },
    [projectId, remoteReady]
  )

  const removeSharedStep = useCallback(
    async (id) => {
      deleteSharedStep(projectId, id)
      setSharedSteps(getSharedSteps(projectId))

      if (remoteReady) {
        await deleteSharedStepRemote(projectId, id)
      }
    },
    [projectId, remoteReady]
  )

  return {
    sharedSteps,
    addSharedStep,
    updateSharedStep,
    removeSharedStep,
  }
}
