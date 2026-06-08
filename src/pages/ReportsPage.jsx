import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { PassRing, Bar } from '../components/Charts'
import { useProjects } from '../hooks/useProjects'
import { getBugs, getTestCases, getTestRuns } from '../utils/storage'
import { BarChartIcon, TrendingUpIcon, ShieldCheckIcon } from '../components/Icons'

export function ReportsPage() {
  const { projects } = useProjects()

  const rows = projects.map((p) => {
    const tcs   = getTestCases(p.id)
    const bugs  = getBugs(p.id)
    const runs  = getTestRuns(p.id)
    const passed   = tcs.filter((t) => t.status === 'Pass').length
    const failed   = tcs.filter((t) => t.status === 'Fail').length
    const blocker  = tcs.filter((t) => t.status === 'Blocker').length
    const skipped  = tcs.filter((t) => t.status === 'Skipped').length
    const pending  = tcs.filter((t) => t.status === 'Not Executed').length
    const passRate = tcs.length ? Math.round((passed / tcs.length) * 100) : 0
    const openBugs = bugs.filter((b) => b.status !== 'Closed').length
    const totalRuns = runs.length
    return { ...p, total: tcs.length, passed, failed, blocker, skipped, pending, passRate, openBugs, totalRuns }
  })

  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + r.total,
      passed: acc.passed + r.passed,
      failed: acc.failed + r.failed,
      blocker: acc.blocker + r.blocker,
      skipped: acc.skipped + r.skipped,
      pending: acc.pending + r.pending,
      openBugs: acc.openBugs + r.openBugs,
      totalRuns: acc.totalRuns + r.totalRuns,
    }),
    { total: 0, passed: 0, failed: 0, blocker: 0, skipped: 0, pending: 0, openBugs: 0, totalRuns: 0 }
  )
  const globalPassRate = totals.total
    ? Math.round((totals.passed / totals.total) * 100)
    : 0
  const failingModules = projects
    .flatMap((project) => getTestCases(project.id).map((testCase) => ({ ...testCase, project })))
    .filter((testCase) => testCase.status === 'Fail' || testCase.status === 'Blocker')
    .reduce((items, testCase) => {
      const moduleName = testCase.module || 'Unassigned'
      const existing = items.find((item) => item.module === moduleName)
      if (existing) {
        existing.count += 1
        existing.projects.add(testCase.project.name)
      } else {
        items.push({ module: moduleName, count: 1, projects: new Set([testCase.project.name]) })
      }
      return items
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  // Derive global executive insights
  const globalInsights = []
  if (totals.total > 0) {
    if (totals.blocker > 0) {
      globalInsights.push({
        type: 'danger',
        title: 'Blockers Alert',
        text: `There are ${totals.blocker} blocker test case(s) active across the project portfolio. Resolve these blockers to restore complete testing operations.`,
      })
    }
    if (totals.failed > 0) {
      globalInsights.push({
        type: 'warning',
        title: 'Failing Test Cases',
        text: `There are ${totals.failed} failing test case(s) detected. Examine top failing modules to identify regressions.`,
      })
    }
    if (totals.openBugs > 0) {
      globalInsights.push({
        type: 'info',
        title: 'Open Issues backlog',
        text: `A total of ${totals.openBugs} unresolved bug(s) are active in your workspaces. Review priorities in settings/bug tracker.`,
      })
    }
    if (globalInsights.length === 0) {
      globalInsights.push({
        type: 'success',
        title: 'Entire Portfolio Healthy',
        text: 'All projects report healthy metrics: 100% execution pass rate, with zero active blockers and zero unresolved defects.',
      })
    }
  }

  return (
    <>
      <PageHeader
        title="Global reports"
        description="Cross-project testing health at a glance."
      />

      {/* Global health summary */}
      <section className="panel report-health-summary">
        <div className="report-health-content">
          <div className="report-health-ring">
            <PassRing rate={globalPassRate} size={140} />
          </div>
          <div className="report-health-details">
            <h2>Global health summary</h2>
            <p className="report-health-subtitle">
              {totals.total} test cases across {projects.length} project{projects.length !== 1 ? 's' : ''}
              {totals.totalRuns > 0 ? ` · ${totals.totalRuns} total runs executed` : ''}
            </p>
            <div className="report-health-stats">
              <div className="report-health-stat">
                <span className="report-health-stat-label">Total cases</span>
                <strong>{totals.total}</strong>
              </div>
              <div className="report-health-stat">
                <span className="report-health-stat-label">Passed</span>
                <strong className="metric-passed">{totals.passed}</strong>
              </div>
              <div className="report-health-stat">
                <span className="report-health-stat-label">Failed</span>
                <strong className="metric-failed">{totals.failed}</strong>
              </div>
              <div className="report-health-stat">
                <span className="report-health-stat-label">Blockers</span>
                <strong style={{ color: totals.blocker > 0 ? '#ff4444' : undefined }}>{totals.blocker}</strong>
              </div>
              <div className="report-health-stat">
                <span className="report-health-stat-label">Open bugs</span>
                <strong className={totals.openBugs > 0 ? 'metric-failed' : ''}>{totals.openBugs}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {globalInsights.length > 0 && (
        <section className="panel insights-panel" style={{ marginBottom: 18 }}>
          <div className="section-header">
            <h2>Executive Action Insights</h2>
          </div>
          <div className="insights-list">
            {globalInsights.map((ins, index) => (
              <div key={index} className={`insight-item insight-item--${ins.type}`}>
                <div className="insight-badge-dot" />
                <div className="insight-content">
                  <strong>{ins.title}</strong>
                  <p>{ins.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Status distribution bar */}
      <section className="panel chart-panel" style={{ marginBottom: 18 }}>
        <div className="section-header">
          <h2><BarChartIcon width={16} height={16} /> Status distribution</h2>
        </div>
        <div className="chart-bars chart-bars--solo" style={{ padding: '14px 18px' }}>
          <Bar label="Pass" value={totals.passed} total={totals.total} tone="passed" />
          <Bar label="Fail" value={totals.failed} total={totals.total} tone="failed" />
          <Bar label="Blocker" value={totals.blocker} total={totals.total} tone="blocker" />
          <Bar label="Skipped" value={totals.skipped} total={totals.total} tone="skipped" />
          <Bar label="Not Executed" value={totals.pending} total={totals.total} tone="pending" />
        </div>
      </section>

      {/* Top failing modules */}
      <section className="panel report-insight-panel" style={{ marginBottom: 18 }}>
        <div className="section-header">
          <h2><ShieldCheckIcon width={16} height={16} /> Top failing modules</h2>
          {failingModules.length > 0 && (
            <StatusPill tone="failed">{failingModules.length} module{failingModules.length !== 1 ? 's' : ''}</StatusPill>
          )}
        </div>
        {failingModules.length === 0 ? (
          <div className="empty-table-row">No failing modules right now. All systems look healthy.</div>
        ) : (
          <div className="module-risk-list">
            {failingModules.map((item) => (
              <div key={item.module} className="module-risk-row">
                <div>
                  <strong>{item.module}</strong>
                  <span>{[...item.projects].join(', ')}</span>
                </div>
                <StatusPill tone="failed">{item.count} failing</StatusPill>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Project comparison table */}
      <section className="panel">
        <div className="section-header">
          <h2><TrendingUpIcon width={16} height={16} /> Project comparison</h2>
        </div>
        {rows.length === 0 ? (
          <div className="empty-table-row">
            No projects yet. <Link to="/projects">Create one →</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Cases</th>
                  <th>Pass</th>
                  <th>Fail</th>
                  <th>Blocker</th>
                  <th>Skipped</th>
                  <th>Open bugs</th>
                  <th>Runs</th>
                  <th>Pass rate</th>
                  <th>Health</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`/projects/${r.id}/reports`}>{r.name}</Link>
                    </td>
                    <td>{r.total}</td>
                    <td className="metric-passed">{r.passed}</td>
                    <td className="metric-failed">{r.failed}</td>
                    <td style={{ color: r.blocker > 0 ? '#ff4444' : undefined, fontWeight: r.blocker > 0 ? 700 : undefined }}>{r.blocker}</td>
                    <td>{r.skipped}</td>
                    <td className={r.openBugs > 0 ? 'metric-failed' : ''}>{r.openBugs}</td>
                    <td>{r.totalRuns}</td>
                    <td>
                      <div className="progress-cell" style={{ minWidth: 110 }}>
                        <span>{r.passRate}%</span>
                        <div className="progress-track">
                          <span style={{ width: `${r.passRate}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusPill tone={r.passRate >= 70 ? 'passed' : r.passRate >= 50 ? 'pending' : 'failed'}>
                        {r.passRate >= 70 ? 'Good' : r.passRate >= 50 ? 'Review' : 'At risk'}
                      </StatusPill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
