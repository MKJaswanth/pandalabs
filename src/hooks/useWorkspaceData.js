import { useEffect, useState } from 'react'
import { useRemoteSync } from './useRemoteSync'
import { fetchProjectDataOnce } from '../utils/remoteStorage'
import {
  getTestCasesRaw, setTestCases,
  getBugsRaw, setBugs,
  getTestRunsRaw, setTestRuns,
  getRequirementsRaw, setRequirements,
  getTestPlansRaw, setTestPlans,
  getMilestonesRaw, setMilestones,
  mergeById,
} from '../utils/storage'

// Merge one project's freshly-fetched collections into the namespaced cache,
// reusing the same tombstone-aware merge the live subscriptions use.
function mergeProjectData(projectId, data) {
  setTestCases(projectId, mergeById(getTestCasesRaw(projectId), data.testCases))
  setBugs(projectId, mergeById(getBugsRaw(projectId), data.bugs))
  setTestRuns(projectId, mergeById(getTestRunsRaw(projectId), data.runs))
  setRequirements(projectId, mergeById(getRequirementsRaw(projectId), data.requirements))
  setTestPlans(projectId, mergeById(getTestPlansRaw(projectId), data.testPlans))
  setMilestones(projectId, mergeById(getMilestonesRaw(projectId), data.milestones))
}

// Warm the cache for ALL projects so global views (Dashboard, Reports) show
// correct aggregate numbers without the user opening each project first. Each
// per-project fetch bumps the returned version so the consuming component
// recomputes its memoised metrics as data streams in.
export function useWorkspaceData(projects) {
  const remoteReady = useRemoteSync()
  const [version, setVersion] = useState(0)
  const projectIds = projects.map((p) => p.id).join(',')

  useEffect(() => {
    if (!remoteReady || !projectIds) return undefined
    let cancelled = false
    const ids = projectIds.split(',')

    ids.forEach(async (id) => {
      try {
        const data = await fetchProjectDataOnce(id)
        if (cancelled) return
        mergeProjectData(id, data)
        setVersion((v) => v + 1)
      } catch (err) {
        console.error('[useWorkspaceData] prefetch failed for project', id, err)
      }
    })

    return () => { cancelled = true }
  }, [remoteReady, projectIds])

  return version
}
