import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import {
  deleteMilestone,
  getCurrentUser,
  getMilestones,
  getMilestonesRaw,
  getTestPlansRaw,
  isDeleted,
  mergeById,
  saveMilestone,
  setMilestones as setMilestonesCache,
  setTestPlans,
} from '../utils/storage'
import { deleteMilestoneRemote, saveMilestoneRemote, saveTestPlanRemote, subscribeMilestones } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'
import { addActivity } from '../utils/activity'

function syncPlanMilestoneLinks(projectId, milestoneId, planIds, remoteReady) {
  const allPlans = getTestPlansRaw(projectId)
  let dirty = false
  allPlans.forEach((plan) => {
    const shouldLink = planIds.includes(plan.id)
    const currentlyLinked = plan.milestoneId === milestoneId
    if (shouldLink && !currentlyLinked) {
      plan.milestoneId = milestoneId
      dirty = true
      if (remoteReady) saveTestPlanRemote(projectId, plan)
    } else if (!shouldLink && currentlyLinked) {
      plan.milestoneId = ''
      dirty = true
      if (remoteReady) saveTestPlanRemote(projectId, plan)
    }
  })
  if (dirty) setTestPlans(projectId, allPlans)
}

export function useMilestones(projectId) {
  const [milestones, setMilestones] = useState(() => getMilestones(projectId))
  const remoteReady = useRemoteSync()

  const refresh = useCallback(() => setMilestones(getMilestones(projectId)), [projectId])

  useEffect(() => {
    if (!remoteReady || !projectId) return undefined
    return subscribeMilestones(projectId, (next) => {
      const merged = mergeById(getMilestonesRaw(projectId), next)
      setMilestonesCache(projectId, merged)
      setMilestones(merged.filter((m) => !isDeleted(m)))
    })
  }, [projectId, remoteReady])

  const addMilestone = useCallback((data) => {
    const milestone = {
      id: newId(),
      testPlanIds: [],
      status: 'Open',
      createdAt: new Date().toISOString(),
      createdBy: auth?.currentUser?.uid || '',
      createdByName: getCurrentUser() || '',
      ...data,
    }
    saveMilestone(projectId, milestone)
    setMilestones(getMilestones(projectId))
    if (remoteReady) saveMilestoneRemote(projectId, milestone)
    addActivity({
      projectId,
      entityType: 'milestone',
      entityId: milestone.id,
      action: 'created',
      title: `Milestone created: ${milestone.name}`,
      after: milestone,
    })
    return milestone
  }, [projectId, remoteReady])

  const updateMilestone = useCallback((milestone) => {
    const updated = { ...milestone, updatedAt: new Date().toISOString() }
    saveMilestone(projectId, updated)
    syncPlanMilestoneLinks(projectId, updated.id, updated.testPlanIds ?? [], remoteReady)
    setMilestones(getMilestones(projectId))
    if (remoteReady) saveMilestoneRemote(projectId, updated)
    addActivity({
      projectId,
      entityType: 'milestone',
      entityId: updated.id,
      action: 'updated',
      title: `Milestone updated: ${updated.name}`,
      after: updated,
    })
    return updated
  }, [projectId, remoteReady])

  const removeMilestone = useCallback((id) => {
    const milestone = getMilestones(projectId).find((m) => m.id === id)
    deleteMilestone(projectId, id)
    syncPlanMilestoneLinks(projectId, id, [], remoteReady)
    setMilestones(getMilestones(projectId))
    if (remoteReady) deleteMilestoneRemote(projectId, id)
    if (milestone) {
      addActivity({
        projectId,
        entityType: 'milestone',
        entityId: id,
        action: 'deleted',
        title: `Milestone deleted: ${milestone.name}`,
      })
    }
  }, [projectId, remoteReady])

  return { milestones, addMilestone, updateMilestone, removeMilestone, refresh }
}
