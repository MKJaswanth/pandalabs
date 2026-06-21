/** Metrics for test plans and milestones. */

function isRunComplete(run) {
  return Boolean(run?.completedAt)
}

export function getPlanMetrics(plan, runs = []) {
  const linkedRuns = runs.filter((r) => r.testPlanId === plan?.id)
  const completedRuns = linkedRuns.filter(isRunComplete)
  const totalCases = linkedRuns.reduce((s, r) => s + (r.total ?? 0), 0)
  const passedCases = linkedRuns.reduce((s, r) => s + (r.passed ?? 0), 0)
  const passRate = totalCases ? Math.round((passedCases / totalCases) * 100) : 0
  const progressPct = linkedRuns.length
    ? Math.round((completedRuns.length / linkedRuns.length) * 100)
    : 0

  return {
    linkedRuns,
    totalRuns: linkedRuns.length,
    completedRuns: completedRuns.length,
    progressPct,
    passRate,
    totalCases,
    passedCases,
  }
}

export function getMilestoneMetrics(milestone, plans = [], runs = []) {
  const planIds = new Set([
    ...(milestone?.testPlanIds ?? []),
    ...plans.filter((p) => p.milestoneId === milestone?.id).map((p) => p.id),
  ])
  const linkedPlans = plans.filter((p) => planIds.has(p.id))
  const linkedPlanIds = new Set(linkedPlans.map((p) => p.id))
  const linkedRuns = runs.filter((r) => r.testPlanId && linkedPlanIds.has(r.testPlanId))
  const completedRuns = linkedRuns.filter(isRunComplete)
  const totalCases = linkedRuns.reduce((s, r) => s + (r.total ?? 0), 0)
  const passedCases = linkedRuns.reduce((s, r) => s + (r.passed ?? 0), 0)
  const passRate = totalCases ? Math.round((passedCases / totalCases) * 100) : 0
  const progressPct = linkedRuns.length
    ? Math.round((completedRuns.length / linkedRuns.length) * 100)
    : 0

  let daysLeft = null
  let onTrack = true
  if (milestone?.dueDate) {
    const due = new Date(milestone.dueDate)
    due.setHours(23, 59, 59, 999)
    daysLeft = Math.ceil((due - new Date()) / 86400000)
    if (daysLeft < 0) {
      onTrack = progressPct >= 100 || milestone?.status === 'Completed'
    } else if (daysLeft <= 3) {
      onTrack = progressPct >= 80
    } else {
      onTrack = progressPct >= 50 || daysLeft > 7
    }
  }

  return {
    linkedPlans,
    linkedRuns,
    totalPlans: linkedPlans.length,
    totalRuns: linkedRuns.length,
    completedRuns: completedRuns.length,
    progressPct,
    passRate,
    totalCases,
    passedCases,
    daysLeft,
    onTrack,
    overdue: daysLeft !== null && daysLeft < 0 && milestone?.status !== 'Completed',
  }
}
