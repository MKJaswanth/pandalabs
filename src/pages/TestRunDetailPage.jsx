import { useParams, Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { useTestRuns } from '../hooks/useTestRuns'
import { useBugs } from '../hooks/useBugs'
import { STATUS_TONE } from '../utils/status'
import { BugIcon, ShieldCheckIcon, CheckCircleIcon } from '../components/Icons'
import { PassRing, Bar } from '../components/Charts'

function getFailureModules(cases = []) {
  const counts = cases.reduce((acc, testCase) => {
    if (testCase.status !== 'Fail' && testCase.status !== 'Blocker') return acc
    const module = testCase.module || 'Unassigned'
    acc[module] = (acc[module] ?? 0) + 1
    return acc
  }, {})
  return Object.entries(counts)
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count)
}

export function TestRunDetailPage() {
  const { projectId, runId } = useParams()
  const { runs } = useTestRuns(projectId)
  const { bugs } = useBugs(projectId)

  const run = runs.find((r) => r.id === runId)

  if (!run) {
    return (
      <section className="empty-state">
        <h2>Run not found</h2>
        <p>This test run may have been deleted.</p>
        <Link to={`/projects/${projectId}/test-runs`} className="text-link">Back to runs</Link>
      </section>
    )
  }

  const rate = run.total ? Math.round((run.passed / run.total) * 100) : 0
  const failureModules = run.failureModules?.length ? run.failureModules : getFailureModules(run.cases)
  // Only count/show bugs that still exist (a deleted bug is excluded from the
  // useBugs list), so deleted links never appear as active here.
  const activeBugIds = new Set(bugs.map((b) => b.id))
  const bugsLogged = Array.isArray(run.linkedBugIds)
    ? run.linkedBugIds.filter((id) => activeBugIds.has(id)).length
    : (run.bugsLogged ?? 0)
  const passed = run.passed ?? 0
  const failed = run.failed ?? 0
  const blocker = run.blocker ?? 0
  const skipped = run.skipped ?? 0
  const pending = run.pending ?? 0

  return (
    <>
      <PageHeader
        title={run.name || 'Test run details'}
        description={`Executed by ${run.executedBy || 'Unknown'} on ${new Date(run.completedAt || run.date).toLocaleString()}`}
        action={
          <Link to={`/projects/${projectId}/test-runs`} className="secondary-button" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
            Back to runs
          </Link>
        }
      />

      {/* Summary hero with donut ring */}
      <section className="panel run-detail-hero">
        <div className="run-detail-hero-content">
          <PassRing rate={rate} size={130} />
          <div className="run-detail-hero-stats">
            <span className={`run-detail-health-badge run-detail-health-badge--${rate >= 70 ? 'passed' : rate >= 50 ? 'pending' : 'failed'}`}>
              {rate >= 70 ? 'Healthy' : rate >= 50 ? 'Review' : 'At risk'}
            </span>
            <div className="run-detail-stats-grid">
              <div className="run-detail-stat">
                <span>Total cases</span>
                <strong>{run.total}</strong>
              </div>
              <div className="run-detail-stat">
                <span>Passed</span>
                <strong className="metric-passed">{passed}</strong>
              </div>
              <div className="run-detail-stat">
                <span>Failed</span>
                <strong className="metric-failed">{failed}</strong>
              </div>
              <div className="run-detail-stat">
                <span>Blockers</span>
                <strong style={{ color: blocker > 0 ? '#ff4444' : undefined }}>{blocker}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Build, bugs logged, pass rate */}
      <section className="metric-grid mb-md">
        <article className="metric-card">
          <span>Build / Version</span><strong>{run.build || '-'}</strong>
        </article>
        <article className={`metric-card ${bugsLogged > 0 ? 'metric-card--danger' : ''}`}>
          <span><BugIcon width={14} height={14} /> Bugs logged</span>
          <strong className={bugsLogged > 0 ? 'metric-failed' : ''}>{bugsLogged}</strong>
        </article>
        <article className="metric-card metric-card--success">
          <span><CheckCircleIcon width={14} height={14} /> Pass rate</span>
          <strong className="metric-passed">{rate}%</strong>
        </article>
      </section>

      {/* Status distribution bars */}
      <section className="panel chart-panel mb-md">
        <div className="section-header">
          <h2>Status distribution</h2>
        </div>
        <div className="chart-bars chart-bars--solo" style={{ padding: '14px 18px' }}>
          <Bar label="Pass" value={passed} total={run.total} tone="passed" />
          <Bar label="Fail" value={failed} total={run.total} tone="failed" />
          <Bar label="Blocker" value={blocker} total={run.total} tone="blocker" />
          <Bar label="Skipped" value={skipped} total={run.total} tone="skipped" />
          <Bar label="Not Executed" value={pending} total={run.total} tone="pending" />
        </div>
      </section>

      {failureModules.length > 0 && (
        <section className="panel run-detail-insights mb-md">
          <div className="section-header">
            <h2><ShieldCheckIcon width={16} height={16} /> Failure modules</h2>
            <StatusPill tone="failed">{failureModules.length} module{failureModules.length !== 1 ? 's' : ''}</StatusPill>
          </div>
          <div className="run-module-risk-list">
            {failureModules.map((item) => (
              <div className="run-module-risk" key={item.module}>
                <span>{item.module}</span>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="section-header">
          <h2>Run results</h2>
          {run.cases?.length > 0 && <StatusPill tone="neutral">{run.cases.length} cases</StatusPill>}
        </div>
        {!run.cases || run.cases.length === 0 ? (
          <div className="empty-table-row">No case snapshots recorded for this run.</div>
        ) : (
          <div className="table-wrap">
            <table className="run-results-table">
              <colgroup>
                <col className="rr-col-title" />
                <col className="rr-col-module" />
                <col className="rr-col-priority" />
                <col className="rr-col-status" />
                <col className="rr-col-actual" />
              </colgroup>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Module</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actual result</th>
                </tr>
              </thead>
              <tbody>
                {run.cases.map((tc, idx) => (
                  <tr key={tc.testCaseId || idx}>
                    <td className="title-cell">{tc.title}</td>
                    <td>{tc.module || '-'}</td>
                    <td>{tc.priority || '-'}</td>
                    <td>
                      <StatusPill tone={STATUS_TONE[tc.status] ?? 'pending'}>
                        {tc.status}
                      </StatusPill>
                    </td>
                    <td style={{ whiteSpace: 'normal' }}>
                      {tc.actual || <span className="text-muted">Not recorded</span>}
                      {tc.bugId && activeBugIds.has(tc.bugId) && (
                        <div className="mt-xs">
                          <Link to={`/projects/${projectId}/bugs`} className="text-link status-text--failed" style={{ fontSize: '0.85em', display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}>
                            <BugIcon width={12} height={12} /> Bug linked
                          </Link>
                        </div>
                      )}
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
