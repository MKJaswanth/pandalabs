import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { PassRing, Bar } from '../components/Charts'
import { useBugs } from '../hooks/useBugs'
import { useProjects } from '../hooks/useProjects'
import { useTestCases } from '../hooks/useTestCases'
import { useTestRuns } from '../hooks/useTestRuns'
import { exportBugs, exportTestCases, exportTestRuns } from '../utils/export'
import { BarChartIcon, DownloadIcon } from '../components/Icons'

export function ProjectReportsPage() {
  const { projectId } = useParams()
  const { projects } = useProjects()
  const { testCases } = useTestCases(projectId)
  const { bugs } = useBugs(projectId)
  const { runs } = useTestRuns(projectId)

  const project = projects.find((p) => p.id === projectId)
  const projectName = project?.name ?? projectId

  const passed   = testCases.filter((t) => t.status === 'Pass').length
  const failed   = testCases.filter((t) => t.status === 'Fail').length
  const blocker  = testCases.filter((t) => t.status === 'Blocker').length
  const skipped  = testCases.filter((t) => t.status === 'Skipped').length
  const pending  = testCases.filter((t) => t.status === 'Not Executed').length
  const total    = testCases.length

  const passRate = total ? Math.round((passed / total) * 100) : 0

  const critical = bugs.filter((b) => b.severity === 'Critical').length
  const major    = bugs.filter((b) => b.severity === 'Major').length
  const minor    = bugs.filter((b) => b.severity === 'Minor').length
  const openBugs = bugs.filter((b) => b.status !== 'Closed').length

  // Derive executive insights
  const insights = []
  if (total > 0) {
    if (blocker > 0) {
      insights.push({
        type: 'danger',
        title: 'Active Blockers',
        text: `There are ${blocker} blocker case(s) preventing complete verification. Resolve these blockers immediately.`,
      })
    }
    if (critical > 0) {
      insights.push({
        type: 'danger',
        title: 'Critical Open Defects',
        text: `There are ${critical} unresolved Critical severity bug(s) logged. Requires immediate engineering fix.`,
      })
    }
    if (passRate < 70) {
      insights.push({
        type: 'warning',
        title: 'Low Pass Rate',
        text: `The project pass rate of ${passRate}% is below the quality threshold (70%). Focus on fixing the ${failed} failing cases.`,
      })
    }
    if (major > 0) {
      insights.push({
        type: 'info',
        title: 'Major Bugs Open',
        text: `There are ${major} open Major severity bug(s). Add these to the next sprint backlog.`,
      })
    }
    if (insights.length === 0) {
      insights.push({
        type: 'success',
        title: 'All Systems Nominal',
        text: 'The project is in a highly stable state: 100% blocker-free, healthy pass rates, and no critical defects.',
      })
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Project-level pass rates, bug severity, and test run history for ${projectName}.`}
        action={
          <div className="page-actions-row">
            <button className="secondary-button" type="button"
              onClick={() => exportTestCases(testCases, projectName)}>
              <DownloadIcon width={14} height={14} /> Export cases
            </button>
            <button className="secondary-button" type="button"
              onClick={() => exportBugs(bugs, projectName)}>
              <DownloadIcon width={14} height={14} /> Export bugs
            </button>
            <button className="secondary-button" type="button"
              onClick={() => exportTestRuns(runs, projectName)}>
              <DownloadIcon width={14} height={14} /> Export runs
            </button>
          </div>
        }
      />

      {/* Summary metrics */}
      <section className="metric-grid" style={{ marginBottom: 18 }}>
        <article className="metric-card">
          <span>Total cases</span><strong>{total}</strong>
        </article>
        <article className="metric-card metric-card--success">
          <span>Pass</span><strong className="metric-passed">{passed}</strong>
        </article>
        <article className="metric-card metric-card--danger">
          <span>Fail</span><strong className="metric-failed">{failed}</strong>
        </article>
        <article className="metric-card">
          <span>Blocker</span><strong style={{ color: blocker > 0 ? '#ff4444' : undefined }}>{blocker}</strong>
        </article>
        <article className="metric-card metric-card--danger">
          <span>Open bugs</span><strong className="metric-failed">{openBugs}</strong>
        </article>
      </section>

      {insights.length > 0 && (
        <section className="panel insights-panel" style={{ marginBottom: 18 }}>
          <div className="section-header">
            <h2>Executive Action Insights</h2>
          </div>
          <div className="insights-list">
            {insights.map((ins, index) => (
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

      <section className="report-grid">
        {/* Pass rate ring + status bars */}
        <article className="panel chart-panel chart-panel--tall">
          <div className="section-header">
            <h2><BarChartIcon width={16} height={16} /> Test results</h2>
          </div>
          <div className="chart-split">
            <PassRing rate={passRate} />
            <div className="chart-bars">
              <Bar label="Pass"         value={passed}  total={total} tone="passed" />
              <Bar label="Fail"         value={failed}  total={total} tone="failed" />
              <Bar label="Blocker"      value={blocker} total={total} tone="blocker" />
              <Bar label="Skipped"      value={skipped} total={total} tone="skipped" />
              <Bar label="Not Executed" value={pending} total={total} tone="pending" />
            </div>
          </div>
        </article>

        {/* Bug severity bars */}
        <article className="panel chart-panel chart-panel--tall">
          <div className="section-header">
            <h2>Bugs by severity</h2>
          </div>
          <div className="chart-bars chart-bars--solo">
            <Bar label="Critical" value={critical} total={bugs.length} tone="failed" />
            <Bar label="Major"    value={major}    total={bugs.length} tone="pending" />
            <Bar label="Minor"    value={minor}    total={bugs.length} tone="passed" />
          </div>
          <div className="bug-status-summary">
            {[['Open', 'failed'], ['In review', 'pending'], ['Closed', 'passed']].map(([s, tone]) => (
              <div key={s} className="bug-status-chip">
                <span className={`bsc-dot bsc-dot--${tone}`} />
                <span>{s}</span>
                <strong>{bugs.filter((b) => b.status === s).length}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* Test run history */}
      <section className="panel">
        <div className="section-header">
          <h2>Test run history</h2>
          {runs.length > 0 && <StatusPill tone="neutral">{runs.length} run{runs.length !== 1 ? 's' : ''}</StatusPill>}
        </div>
        {runs.length === 0 ? (
          <div className="empty-table-row">No test runs recorded yet. Start a test run to see history here.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Build</th>
                  <th>Total</th>
                  <th>Passed</th>
                  <th>Failed</th>
                  <th>Blocker</th>
                  <th>Skipped</th>
                  <th>Pass rate</th>
                  <th>Executed by</th>
                </tr>
              </thead>
              <tbody>
                {[...runs].reverse().map((run) => {
                  const rate = run.total ? Math.round((run.passed / run.total) * 100) : 0
                  return (
                    <tr key={run.id}>
                      <td>{new Date(run.completedAt || run.date).toLocaleString()}</td>
                      <td>
                        <Link to={`/projects/${projectId}/test-runs/${run.id}`} className="text-link">
                          {run.name || 'Test run'}
                        </Link>
                      </td>
                      <td>{run.build || '-'}</td>
                      <td>{run.total}</td>
                      <td className="metric-passed">{run.passed}</td>
                      <td className="metric-failed">{run.failed}</td>
                      <td>{run.blocker ?? 0}</td>
                      <td>{run.skipped ?? 0}</td>
                      <td>
                        <div className="progress-cell" style={{ minWidth: 100 }}>
                          <span>{rate}%</span>
                          <div className="progress-track">
                            <span style={{ width: `${rate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>{run.executedBy || '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  )
}
