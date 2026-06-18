import { useCallback, useEffect, useState } from 'react'
import { getActivitiesRaw, setActivities as setActivitiesCache, mergeById } from '../utils/storage'
import { subscribeActivity } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { addActivity as logActivityHelper } from '../utils/activity'

export function useActivity() {
  const remoteReady = useRemoteSync()
  const [activities, setActivitiesState] = useState(() => {
    const raw = getActivitiesRaw()
    return raw.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  })
  const [loading, setLoading] = useState(remoteReady)

  const refresh = useCallback(() => {
    const raw = getActivitiesRaw()
    const sorted = raw.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    setActivitiesState(sorted)
    setLoading(false)
  }, [])

  useEffect(() => {
    window.addEventListener('qa-activities-changed', refresh)
    return () => window.removeEventListener('qa-activities-changed', refresh)
  }, [refresh])

  useEffect(() => {
    if (!remoteReady) {
      return undefined
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true)
    return subscribeActivity((nextActivities) => {
      const merged = mergeById(getActivitiesRaw(), nextActivities)
      const sorted = merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      setActivitiesCache(sorted)
      setActivitiesState(sorted)
      setLoading(false)
    })
  }, [remoteReady])

  const addActivity = useCallback(async (params) => {
    await logActivityHelper(params)
    refresh()
  }, [refresh])

  const getActivitiesByProject = useCallback((projectId) => {
    return activities.filter((act) => act.projectId === projectId)
  }, [activities])

  const getActivitiesByEntity = useCallback((entityType, entityId) => {
    return activities.filter((act) => act.entityType === entityType && act.entityId === entityId)
  }, [activities])

  return {
    activities,
    loading,
    addActivity,
    getActivitiesByProject,
    getActivitiesByEntity,
    refresh
  }
}
