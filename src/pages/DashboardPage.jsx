import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { useUser } from '../context/UserContext'
import { useProjects } from '../hooks/useProjects'
import { useActivity } from '../hooks/useActivity'
import { useWorkspaceData } from '../hooks/useWorkspaceData'
import { getBugs, getTestCases, getTestRuns, getMilestones, getTestPlans } from '../utils/storage'
import { ArrowRightIcon } from '../components/Icons'
import { getProjectReportMetrics, isOpenBug } from '../utils/reportMetrics'
import { getMilestoneMetrics } from '../utils/planMetrics'
import { normalizeTestStatus } from '../utils/status'

function QuickActionIcon({ name }) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    project: <><path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h4" /></>,
    case: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="m3 6 .8.8L5.5 5" /><path d="m3 12 .8.8 1.7-1.8" /><path d="m3 18 .8.8 1.7-1.8" /></>,
    bug: <><path d="M8 8a4 4 0 0 1 8 0v8a4 4 0 0 1-8 0Z" /><path d="M3 13h5" /><path d="M16 13h5" /><path d="M4 20l4-3" /><path d="m16 17 4 3" /><path d="M9 4 7 2" /><path d="m15 4 2-2" /></>,
    report: <><path d="M4 19V5" /><path d="M20 19H4" /><path d="M8 15v-4" /><path d="M13 15V8" /><path d="M18 15v-6" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

export function DashboardPage() {
  const { user } = useUser()
  const { projects } = useProjects()
  const { activities: allActivities } = useActivity()
  // Warm the cache for every project so the aggregate metrics below are correct
  // even before the user opens each project. Bumps as each project's data lands.
  const dataVersion = useWorkspaceData(projects)

  const activities = useMemo(() => {
    return allActivities.slice(0, 5)
  }, [allActivities])

  const enriched = useMemo(() => {
    return projects.map((p) => {
      const cases = getTestCases(p.id)
      const bugs = getBugs(p.id)
      const runs = getTestRuns(p.id)
      const metrics = getProjectReportMetrics({ project: p, testCases: cases, bugs, runs })
      return { ...p, cases: metrics.total, openBugs: metrics.openBugs, passRate: metrics.passRate, latestRun: metrics.latestRun }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion intentionally re-runs this cache-backed read as prefetch lands
  }, [projects, dataVersion])

  const totalCases = useMemo(() => enriched.reduce((s, p) => s + p.cases, 0), [enriched])
  const totalOpenBugs = useMemo(() => enriched.reduce((s, p) => s + p.openBugs, 0), [enriched])
  const avgPassRate = useMemo(() => {
    return enriched.length
      ? Math.round(enriched.reduce((s, p) => s + p.passRate, 0) / enriched.length)
      : 0
  }, [enriched])

  const metrics = useMemo(() => [
    { label: 'Projects', value: projects.length, tone: 'neutral' },
    { label: 'Test cases', value: totalCases, tone: 'neutral' },
    { label: 'Bugs open', value: totalOpenBugs, tone: totalOpenBugs > 0 ? 'danger' : 'neutral' },
    { label: 'Pass rate', value: `${avgPassRate}%`, tone: avgPassRate >= 70 ? 'success' : avgPassRate >= 50 ? 'warning' : 'danger' },
  ], [projects.length, totalCases, totalOpenBugs, avgPassRate])

  // Aggregate stats across all projects
  const { allBugs, allBlockers, allRuns } = useMemo(() => {
    const bugsList = []
    const blockersList = []
    const runsList = []

    projects.forEach((p) => {
      const pCases = getTestCases(p.id)
      const pBugs = getBugs(p.id)
      const pRuns = getTestRuns(p.id).filter((r) => !r.projectId || r.projectId === p.id)

      bugsList.push(...pBugs.map(b => ({ ...b, projectId: p.id, projectName: p.name })))
      blockersList.push(...pCases.filter(c => normalizeTestStatus(c.status) === 'Blocker').map(c => ({ ...c, projectId: p.id, projectName: p.name })))
      runsList.push(...pRuns.map(r => ({ ...r, projectId: p.id, projectName: p.name })))
    })

    return { allBugs: bugsList, allBlockers: blockersList, allRuns: runsList }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion intentionally re-runs this cache-backed read as prefetch lands
  }, [projects, dataVersion])

  // Sort and filter lists
  const activeBugs = useMemo(() => {
    return allBugs
      .filter(isOpenBug)
      .sort((a, b) => {
        const sevOrder = { Critical: 0, Major: 1, Minor: 2 }
        const sevA = sevOrder[a.severity] ?? 3
        const sevB = sevOrder[b.severity] ?? 3
        if (sevA !== sevB) return sevA - sevB
        return new Date(b.reportedDate || b.createdAt) - new Date(a.reportedDate || a.createdAt)
      })
      .slice(0, 5)
  }, [allBugs])

  const recentRuns = useMemo(() => {
    return allRuns
      .sort((a, b) => new Date(b.completedAt || b.date) - new Date(a.completedAt || a.date))
      .slice(0, 5)
  }, [allRuns])

  const upcomingMilestones = useMemo(() => {
    const items = []
    projects.forEach((p) => {
      const milestones = getMilestones(p.id)
      const plans = getTestPlans(p.id)
      const runs = getTestRuns(p.id)
      milestones
        .filter((m) => m.status !== 'Completed')
        .forEach((milestone) => {
          const metrics = getMilestoneMetrics(milestone, plans, runs)
          items.push({
            milestone,
            metrics,
            projectId: p.id,
            projectName: p.name,
          })
        })
    })
    return items
      .sort((a, b) => {
        const aDue = a.milestone.dueDate || '9999-12-31'
        const bDue = b.milestone.dueDate || '9999-12-31'
        return aDue.localeCompare(bDue)
      })
      .slice(0, 5)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dataVersion intentionally re-runs this cache-backed read as prefetch lands
  }, [projects, dataVersion])

  const severityTone = { Critical: 'failed', Major: 'pending', Minor: 'passed' }

  // Empty state — no projects at all
  if (projects.length === 0) {
    return (
      <>
        <PageHeader
          title={`Welcome, ${user}`}
          description="Your QA workspace is ready. Create your first project to get started."
        />
        <section className="dashboard-empty">
          <div className="dashboard-empty-icon" aria-hidden>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 11 2 2 4-4" />
            </svg>
          </div>
          <h2>No projects yet</h2>
          <p>Create a project to start tracking test cases, bugs, and pass rates.</p>
          <Link to="/projects" className="primary-button" style={{ textDecoration: 'none' }}>
            + Create first project
          </Link>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={`Good day, ${user}`}
        description="Global testing health across active QA projects."
      />

      {/* Main Metric Cards */}
      <section className="metric-grid" aria-label="QA metrics">
        {metrics.map((m) => (
          <article className={`metric-card metric-card--${m.tone}`} key={m.label}>
            <span>{m.label}</span>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      {/* Projects Overview */}
      <section className="panel mt-lg">
        <div className="section-header">
          <h2>Projects at a glance</h2>
          <Link to="/projects" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            View all <ArrowRightIcon width={14} height={14} />
          </Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Test cases</th>
                <th>Bugs open</th>
                <th>Pass rate</th>
                <th>Health</th>
              </tr>
            </thead>
            <tbody>
              {enriched.map((p) => (
                <tr key={p.id}>
                  <td><Link to={`/projects/${p.id}/test-cases`}>{p.name}</Link></td>
                  <td>{p.cases}</td>
                  <td className={p.openBugs > 0 ? 'metric-failed' : ''}>{p.openBugs}</td>
                  <td>
                    <div className="progress-cell">
                      <span>{p.passRate}%</span>
                      <div className="progress-track">
                        <span style={{ width: `${p.passRate}%` }} />
                      </div>
                    </div>
                  </td>
                  <td>
                    <StatusPill tone={p.passRate >= 70 ? 'passed' : p.passRate >= 50 ? 'pending' : 'failed'}>
                      {p.passRate >= 70 ? 'Good' : p.passRate >= 50 ? 'Review' : 'At risk'}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mobile-card-list">
          {enriched.map((p) => (
            <article className="mobile-card" key={p.id}>
              <div className="mobile-card-header">
                <Link to={`/projects/${p.id}/test-cases`} className="mobile-card-title-link">
                  {p.name}
                </Link>
                <StatusPill tone={p.passRate >= 70 ? 'passed' : p.passRate >= 50 ? 'pending' : 'failed'}>
                  {p.passRate >= 70 ? 'Good' : p.passRate >= 50 ? 'Review' : 'At risk'}
                </StatusPill>
              </div>
              <div className="mobile-card-details">
                <div>
                  <span>Test cases:</span>
                  <strong>{p.cases}</strong>
                </div>
                <div>
                  <span>Open bugs:</span>
                  <strong className={p.openBugs > 0 ? 'metric-failed' : ''}>{p.openBugs}</strong>
                </div>
                <div>
                  <span>Pass rate:</span>
                  <strong>{p.passRate}%</strong>
                </div>
                <div>
                  <span>Latest run:</span>
                  <strong>{p.latestRun?.name ?? 'None'}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="quick-actions mt-lg mb-lg">
        <Link to="/projects" className="quick-action-card">
          <span className="qa-icon"><QuickActionIcon name="project" /></span>
          <span>New project</span>
        </Link>
        <Link to={`/projects/${enriched[0]?.id}/test-cases`} className="quick-action-card">
          <span className="qa-icon"><QuickActionIcon name="case" /></span>
          <span>Add test case</span>
        </Link>
        <Link to={`/projects/${enriched[0]?.id}/bugs`} className="quick-action-card">
          <span className="qa-icon"><QuickActionIcon name="bug" /></span>
          <span>Log bug</span>
        </Link>
        <Link to="/reports" className="quick-action-card">
          <span className="qa-icon"><QuickActionIcon name="report" /></span>
          <span>View reports</span>
        </Link>
      </section>

      {/* The Four Insight Blocks */}
      <div className="dashboard-details-grid">
        {/* Recent Activity */}
        <section className="panel dashboard-detail-panel">
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Recent activity</h2>
            <Link className="text-link" to="/activity" style={{ fontSize: '12.5px' }}>
              View all →
            </Link>
          </div>
          {activities.length === 0 ? (
            <p className="panel-empty-text">No activity logged yet.</p>
          ) : (
            <div className="dashboard-list">
              {activities.map((act) => (
                <div className="dashboard-list-item" key={act.id}>
                  <div className="list-item-main">
                    <span className="list-item-title" style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      <strong>{act.actorName || 'System'}</strong>: {act.title}
                    </span>
                  </div>
                  <div className="list-item-meta">
                    <span className="meta-date">{new Date(act.createdAt).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* High-priority bugs */}
        <section className="panel dashboard-detail-panel">
          <div className="section-header">
            <h2>High-priority bugs</h2>
            {activeBugs.length > 0 && (
              <StatusPill tone="failed">{allBugs.filter(isOpenBug).length} open</StatusPill>
            )}
          </div>
          {activeBugs.length === 0 ? (
            <p className="panel-empty-text">No unresolved bugs reported.</p>
          ) : (
            <div className="dashboard-list">
              {activeBugs.map((bug) => (
                <div className="dashboard-list-item" key={bug.id}>
                  <div className="list-item-main">
                    <span className={`status-pill status-pill--${severityTone[bug.severity] || 'neutral'}`} style={{ fontSize: '9px', minHeight: '16px', padding: '0 4px' }}>
                      {bug.severity}
                    </span>
                    <Link to={`/projects/${bug.projectId}/bugs`} className="list-item-title">
                      {bug.title}
                    </Link>
                  </div>
                  <div className="list-item-meta">
                    <span className="meta-project">{bug.projectName}</span>
                    <span className="meta-status"> · {bug.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Runs */}
        <section className="panel dashboard-detail-panel">
          <div className="section-header">
            <h2>Recent runs</h2>
          </div>
          {recentRuns.length === 0 ? (
            <p className="panel-empty-text">No test runs recorded yet.</p>
          ) : (
            <div className="dashboard-list">
              {recentRuns.map((run) => {
                const passRate = run.total ? Math.round((run.passed / run.total) * 100) : 0
                return (
                  <div className="dashboard-list-item" key={run.id}>
                    <div className="list-item-main">
                      <Link to={`/projects/${run.projectId}/test-runs/${run.id}`} className="list-item-title">{run.name || 'Regression Run'}</Link>
                      <span className="list-item-badge text-muted">{passRate}% pass</span>
                    </div>
                    <div className="list-item-meta">
                      <span className="meta-project">{run.projectName}</span>
                      <span className="meta-date"> · {new Date(run.completedAt || run.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Active Blockers */}
        <section className="panel dashboard-detail-panel">
          <div className="section-header">
            <h2>Active blockers</h2>
            <StatusPill tone={allBlockers.length > 0 ? 'blocker' : 'passed'}>
              {allBlockers.length} active
            </StatusPill>
          </div>
          {allBlockers.length === 0 ? (
            <p className="panel-empty-text">No active blockers. Testing is clear!</p>
          ) : (
            <div className="dashboard-list">
              {allBlockers.slice(0, 5).map((tc) => (
                <div className="dashboard-list-item" key={tc.id}>
                  <div className="list-item-main">
                    <span className="mono list-item-id">{tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()}</span>
                    <Link to={`/projects/${tc.projectId}/test-cases/${tc.id}`} className="list-item-title">{tc.title}</Link>
                  </div>
                  <div className="list-item-meta">
                    <span className="meta-project">{tc.projectName}</span>
                    {tc.assignee && <span className="meta-assignee"> · {tc.assignee}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {upcomingMilestones.length > 0 && (
        <section className="panel dashboard-detail-panel" style={{ marginTop: 16 }}>
          <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Release milestones</h2>
            <StatusPill tone="neutral">{upcomingMilestones.length} active</StatusPill>
          </div>
          <div className="dashboard-list">
            {upcomingMilestones.map(({ milestone, metrics, projectId, projectName }) => (
              <div className="dashboard-list-item" key={`${projectId}-${milestone.id}`}>
                <div className="list-item-main">
                  <Link to={`/projects/${projectId}/test-plans`} className="list-item-title">{milestone.name}</Link>
                  <span className={`list-item-badge ${metrics.onTrack ? 'text-success' : 'text-danger'}`}>
                    {metrics.progressPct}% · {metrics.onTrack ? 'On track' : 'At risk'}
                  </span>
                </div>
                <div className="list-item-meta">
                  <span className="meta-project">{projectName}</span>
                  {milestone.dueDate && (
                    <span className="meta-date">
                      {' · Due '}{new Date(milestone.dueDate).toLocaleDateString()}
                      {metrics.overdue ? ' (overdue)' : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
