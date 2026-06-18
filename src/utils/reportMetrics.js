import { normalizeTestStatus } from './status'

export function normalizeBugStatus(status) {
  if (!status) return 'Open'
  const trimmed = String(status).trim().toLowerCase()
  if (trimmed === 'closed' || trimmed === 'close') return 'Closed'
  if (trimmed === 'in review' || trimmed === 'inreview' || trimmed === 'review') return 'In review'
  return 'Open'
}

export function isOpenBug(bug) {
  if (!bug) return false
  return normalizeBugStatus(bug.status) !== 'Closed'
}

export function getActiveBugs(bugs) {
  return (bugs || []).filter(isOpenBug)
}

export function getBugSeverityCounts(bugs) {
  const active = getActiveBugs(bugs)
  let critical = 0
  let major = 0
  let minor = 0
  active.forEach((b) => {
    const sev = String(b.severity || '').trim().toLowerCase()
    if (sev === 'critical') critical++
    else if (sev === 'major') major++
    else if (sev === 'minor') minor++
    else minor++ // default fallback
  })
  return {
    critical,
    major,
    minor,
    totalOpen: active.length
  }
}

export function getTestCaseStatusCounts(testCases) {
  const list = testCases || []
  let passed = 0
  let failed = 0
  let blocker = 0
  let skipped = 0
  let pending = 0
  let reported = 0
  let inProgress = 0
  let hold = 0
  let needClarification = 0

  list.forEach((tc) => {
    const status = normalizeTestStatus(tc.status)
    if (status === 'Pass') passed++
    else if (status === 'Fail') failed++
    else if (status === 'Blocker') blocker++
    else if (status === 'Skipped') skipped++
    else if (status === 'Reported') reported++
    else if (status === 'Testing in Progress') inProgress++
    else if (status === 'Hold') hold++
    else if (status === 'Need Clarification') needClarification++
    else pending++
  })

  const total = list.length
  const executed = total - pending
  const passRate = total ? Math.round((passed / total) * 100) : 0
  const coverage = total ? Math.round((executed / total) * 100) : 0

  return {
    passed,
    failed,
    blocker,
    skipped,
    pending,
    reported,
    inProgress,
    hold,
    needClarification,
    total,
    executed,
    passRate,
    coverage
  }
}

export function getLatestRun(runs, projectId) {
  let list = runs || []
  if (projectId) {
    list = list.filter((r) => !r.projectId || r.projectId === projectId)
  }
  if (list.length === 0) return null
  return [...list].sort((a, b) => new Date(b.completedAt || b.date || 0) - new Date(a.completedAt || a.date || 0))[0] || null
}

export function deriveHealth({ total, passRate, blocker, openBugs }) {
  if (total === 0) return { label: 'No cases', tone: 'neutral' }
  if (blocker > 0 || passRate < 50) return { label: 'At risk', tone: 'failed' }
  if (passRate < 70 || openBugs > 0) return { label: 'Review', tone: 'pending' }
  return { label: 'Healthy', tone: 'passed' }
}

export function nextAction(r) {
  if (r.total === 0) return 'Add test cases'
  if (r.blocker > 0) return 'Resolve blockers'
  if (r.failed > 0) return 'Fix failing cases'
  if (r.openBugs > 0) return 'Triage open bugs'
  if (r.pending > 0) return 'Execute remaining cases'
  if (r.totalRuns === 0) return 'Start a test run'
  if (r.noRecentRun) return 'Schedule a fresh run'
  return 'Maintain coverage'
}

export function deriveReadiness({ total, passRate, blocker, failed, openBugs }) {
  if (total === 0) return { label: 'No data', tone: 'neutral' }
  if (blocker > 0 || passRate < 50) return { label: 'Not ready', tone: 'failed' }
  if (failed > 0 || openBugs > 0 || passRate < 70) return { label: 'Needs review', tone: 'pending' }
  return { label: 'Ready', tone: 'passed' }
}

export function projectAction(r) {
  if (r.total === 0) return { text: 'Add test cases', to: `/projects/${r.id}/test-cases` }
  if (r.blocker > 0) return { text: 'Resolve blockers', to: `/projects/${r.id}/test-cases` }
  if (r.failed > 0) return { text: 'Fix failing cases', to: `/projects/${r.id}/test-cases` }
  if (r.openBugs > 0) return { text: 'Triage bugs', to: `/projects/${r.id}/bugs` }
  if (r.pending > 0) return { text: 'Continue execution', to: `/projects/${r.id}/test-runs` }
  if (r.totalRuns === 0) return { text: 'Start a run', to: `/projects/${r.id}/test-runs` }
  return { text: 'View report', to: `/projects/${r.id}/reports` }
}

export function getProjectReportMetrics({ project, testCases, bugs, runs }) {
  const statusCounts = getTestCaseStatusCounts(testCases)
  const bugCounts = getBugSeverityCounts(bugs)
  const latestRun = getLatestRun(runs, project.id)

  const latestRunDate = latestRun ? (latestRun.completedAt || latestRun.date) : null
  const noRecentRun = !latestRunDate ||
    (Date.now() - new Date(latestRunDate)) / 86400000 > 14

  const totalRuns = (runs || []).filter((r) => !r.projectId || r.projectId === project.id).length

  const health = deriveHealth({
    total: statusCounts.total,
    passRate: statusCounts.passRate,
    blocker: statusCounts.blocker,
    openBugs: bugCounts.totalOpen
  })

  const row = {
    ...project,
    total: statusCounts.total,
    ...statusCounts,
    openBugs: bugCounts.totalOpen,
    critical: bugCounts.critical,
    major: bugCounts.major,
    minor: bugCounts.minor,
    totalRuns,
    latestRun,
    noRecentRun,
    health,
    bugCounts
  }

  row.nextAction = nextAction(row)
  return row
}

export function getGlobalReportMetrics({ projects, getTestCases, getBugs, getTestRuns }) {
  const rows = (projects || []).map((p) => {
    const metrics = getProjectReportMetrics({
      project: p,
      testCases: getTestCases(p.id),
      bugs: getBugs(p.id),
      runs: getTestRuns(p.id)
    })
    metrics.readiness = deriveReadiness({
      total: metrics.total,
      passRate: metrics.passRate,
      blocker: metrics.blocker,
      failed: metrics.failed,
      openBugs: metrics.openBugs
    })
    metrics.action = projectAction(metrics)
    return metrics
  })

  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      passed: acc.passed + r.passed,
      failed: acc.failed + r.failed,
      blocker: acc.blocker + r.blocker,
      skipped: acc.skipped + r.skipped,
      pending: acc.pending + r.pending,
      reported: acc.reported + r.reported,
      inProgress: acc.inProgress + r.inProgress,
      hold: acc.hold + r.hold,
      needClarification: acc.needClarification + r.needClarification,
      openBugs: acc.openBugs + r.openBugs,
      critical: acc.critical + r.critical,
      major: acc.major + r.major,
      minor: acc.minor + r.minor,
      totalRuns: acc.totalRuns + r.totalRuns,
    }),
    { total: 0, passed: 0, failed: 0, blocker: 0, skipped: 0, pending: 0, reported: 0, inProgress: 0, hold: 0, needClarification: 0, openBugs: 0, critical: 0, major: 0, minor: 0, totalRuns: 0 }
  )

  const globalPassRate = totals.total ? Math.round((totals.passed / totals.total) * 100) : 0
  const globalCoverage = totals.total ? Math.round(((totals.total - totals.pending) / totals.total) * 100) : 0
  const globalHealth = deriveHealth({
    total: totals.total,
    passRate: globalPassRate,
    blocker: totals.blocker,
    openBugs: totals.openBugs
  })
  const overallReadiness = deriveReadiness({
    total: totals.total,
    passRate: globalPassRate,
    blocker: totals.blocker,
    failed: totals.failed,
    openBugs: totals.openBugs
  })

  const attentionItems = []
  if (totals.total > 0) {
    if (totals.blocker > 0) {
      attentionItems.push({
        type: 'danger',
        title: 'Blockers Alert',
        text: `${totals.blocker} blocker case${totals.blocker !== 1 ? 's' : ''} active across the portfolio. Resolve before release.`
      })
    }
    if (totals.failed > 0) {
      attentionItems.push({
        type: 'warning',
        title: 'Failing Cases',
        text: `${totals.failed} failing case${totals.failed !== 1 ? 's' : ''} detected. Examine top failing modules for regressions.`
      })
    }
    if (totals.openBugs > 0) {
      attentionItems.push({
        type: 'info',
        title: 'Open Bug Backlog',
        text: `${totals.openBugs} unresolved bug${totals.openBugs !== 1 ? 's' : ''} across the workspace. Review priorities in the bug tracker.`
      })
    }
    if (attentionItems.length === 0) {
      attentionItems.push({
        type: 'success',
        title: 'Portfolio Healthy',
        text: 'All projects report healthy metrics: zero active blockers and zero unresolved defects.'
      })
    }
  }

  return {
    rows,
    totals,
    globalPassRate,
    globalCoverage,
    globalHealth,
    overallReadiness,
    attentionItems
  }
}
