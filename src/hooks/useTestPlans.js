import { useCallback, useEffect, useState } from 'react'
import { newId } from '../utils/id'
import {
  deleteTestPlan,
  getCurrentUser,
  getTestPlans,
  getTestPlansRaw,
  getTestRunsRaw,
  isDeleted,
  mergeById,
  saveTestPlan,
  saveTestRun,
  setTestPlans as setTestPlansCache,
  setTestRuns,
} from '../utils/storage'
import { deleteTestPlanRemote, saveTestPlanRemote, saveTestRunRemote, subscribeTestPlans } from '../utils/remoteStorage'
import { useRemoteSync } from './useRemoteSync'
import { auth } from '../utils/firebase'
import { addActivity } from '../utils/activity'

export function useTestPlans(projectId) {
  const [plans, setPlans] = useState(() => getTestPlans(projectId))
  const remoteReady = useRemoteSync()

  const refresh = useCallback(() => setPlans(getTestPlans(projectId)), [projectId])

  useEffect(() => {
    if (!remoteReady || !projectId) return undefined
    return subscribeTestPlans(projectId, (next) => {
      const merged = mergeById(getTestPlansRaw(projectId), next)
      setTestPlansCache(projectId, merged)
      setPlans(merged.filter((p) => !isDeleted(p)))
    })
  }, [projectId, remoteReady])

  const addPlan = useCallback((data) => {
    const plan = {
      id: newId(),
      requirementIds: [],
      milestoneId: '',
      status: 'Open',
      createdAt: new Date().toISOString(),
      createdBy: auth?.currentUser?.uid || '',
      createdByName: getCurrentUser() || '',
      ...data,
    }
    saveTestPlan(projectId, plan)
    setPlans(getTestPlans(projectId))
    if (remoteReady) saveTestPlanRemote(projectId, plan)
    addActivity({
      projectId,
      entityType: 'test_plan',
      entityId: plan.id,
      action: 'created',
      title: `Test plan created: ${plan.name}`,
      after: plan,
    })
    return plan
  }, [projectId, remoteReady])

  const updatePlan = useCallback((plan) => {
    const updated = { ...plan, updatedAt: new Date().toISOString() }
    saveTestPlan(projectId, updated)
    setPlans(getTestPlans(projectId))
    if (remoteReady) saveTestPlanRemote(projectId, updated)
    addActivity({
      projectId,
      entityType: 'test_plan',
      entityId: updated.id,
      action: 'updated',
      title: `Test plan updated: ${updated.name}`,
      after: updated,
    })
    return updated
  }, [projectId, remoteReady])

  const removePlan = useCallback((id) => {
    const plan = getTestPlans(projectId).find((p) => p.id === id)
    deleteTestPlan(projectId, id)
    
    // Clear testPlanId on all runs associated with this plan
    const allRuns = getTestRunsRaw(projectId)
    let dirty = false
    allRuns.forEach((run) => {
      if (run.testPlanId === id) {
        run.testPlanId = ''
        dirty = true
        if (remoteReady) saveTestRunRemote(projectId, run)
      }
    })
    if (dirty) setTestRuns(projectId, allRuns)

    setPlans(getTestPlans(projectId))
    if (remoteReady) deleteTestPlanRemote(projectId, id)
    if (plan) {
      addActivity({
        projectId,
        entityType: 'test_plan',
        entityId: id,
        action: 'deleted',
        title: `Test plan deleted: ${plan.name}`,
      })
    }
  }, [projectId, remoteReady])

  const linkRunToPlan = useCallback((planId, runId) => {
    const runs = getTestRunsRaw(projectId)
    const run = runs.find((r) => r.id === runId)
    if (run) {
      saveTestRun(projectId, { ...run, testPlanId: planId })
      if (remoteReady) saveTestRunRemote(projectId, { ...run, testPlanId: planId })
    }
  }, [projectId, remoteReady])

  return { plans, addPlan, updatePlan, removePlan, linkRunToPlan, refresh }
}
