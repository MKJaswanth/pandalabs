import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { PassRing, Bar, RunTrend } from '../components/Charts'
import { useBugs } from '../hooks/useBugs'
import { useProjects } from '../hooks/useProjects'
import { useTestCases } from '../hooks/useTestCases'
import { useTestRuns } from '../hooks/useTestRuns'
import { exportBugs, exportTestCases, exportTestRuns } from '../utils/export'
import { BarChartIcon, DownloadIcon, PrintIcon, ChevronLeftIcon, ChevronRightIcon } from '../components/Icons'
import { normalizeTestStatus } from '../utils/status'
import { getProjectReportMetrics, getActiveBugs, isOpenBug, normalizeBugStatus } from '../utils/reportMetrics'


const enc = (value) => encodeURIComponent(value)

export function ProjectReportsPage() {
  const { projectId } = useParams()
  const { projects } = useProjects()
  const { testCases } = useTestCases(projectId)
  const { bugs } = useBugs(projectId)
  const { runs } = useTestRuns(projectId)
  const [runPage, setRunPage] = useState(1)

  const project = projects.find((p) => p.id === projectId)
  const projectName = project?.name ?? projectId

  const metrics = getProjectReportMetrics({
    project: project || { id: projectId, name: projectName },
    testCases,
    bugs,
    runs
  })

  const {
    passed,
    failed,
    blocker,
    skipped,
    pending,
    reported,
    inProgress,
    hold,
    needClarification: needClarif,
    total,
    coverage,
    passRate,
    critical,
    major,
    minor,
    openBugs
  } = metrics

  const activeBugs = getActiveBugs(bugs)

  // Module breakdown — sorted worst first
  const moduleMap = testCases.reduce((acc, tc) => {
    const mod = tc.module || 'Unassigned'
    if (!acc[mod]) acc[mod] = { total: 0, passed: 0, failed: 0, blocker: 0, pending: 0 }
    acc[mod].total++
    const norm = normalizeTestStatus(tc.status)
    if (norm === 'Pass') acc[mod].passed++
    else if (norm === 'Fail') acc[mod].failed++
    else if (norm === 'Blocker') acc[mod].blocker++
    else if (norm === 'Not Executed') acc[mod].pending++
    return acc
  }, {})
  const moduleStats = Object.entries(moduleMap).map(([mod, s]) => ({
    module: mod, ...s,
    passRate: s.total ? Math.round((s.passed / s.total) * 100) : 0,
    openBugs: bugs.filter((b) => (b.module || 'Unassigned') === mod && isOpenBug(b)).length,
  })).sort((a, b) => {
    if (b.blocker !== a.blocker) return b.blocker - a.blocker
    if (b.failed !== a.failed) return b.failed - a.failed
    return a.passRate - b.passRate
  })

  // Run history — newest first
  const sortedRuns = [...runs].reverse()
  // Trend uses oldest→newest order (left→right)
  const trendRuns = sortedRuns.slice(0, 8).reverse()

  const runPageSize = 3
  const totalRunPages = Math.max(1, Math.ceil(sortedRuns.length / runPageSize))
  const currentRunPage = Math.min(runPage, totalRunPages)
  const runStartIndex = (currentRunPage - 1) * runPageSize
  const pagedRuns = sortedRuns.slice(runStartIndex, runStartIndex + runPageSize)
  const runRangeStart = sortedRuns.length ? runStartIndex + 1 : 0
  const runRangeEnd = Math.min(runStartIndex + runPageSize, sortedRuns.length)

  const insights = []
  if (total > 0) {
    if (blocker > 0) insights.push({ type: 'danger',  title: 'Active Blockers', text: `${blocker} blocker case${blocker !== 1 ? 's' : ''} preventing complete verification. Resolve immediately.`, to: `/projects/${projectId}/test-cases?status=Blocker` })
    if (critical > 0) insights.push({ type: 'danger', title: 'Critical Defects', text: `${critical} unresolved Critical severity bug${critical !== 1 ? 's' : ''} require immediate engineering attention.`, to: `/projects/${projectId}/bugs?severity=Critical` })
    if (passRate < 70) insights.push({ type: 'warning', title: 'Low Pass Rate', text: `Pass rate ${passRate}% is below the 70% quality threshold. ${failed} failing case${failed !== 1 ? 's' : ''} need attention.`, to: failed > 0 ? `/projects/${projectId}/test-cases?status=Fail` : `/projects/${projectId}/test-runs` })
    if (major > 0) insights.push({ type: 'info', title: 'Major Bugs Open', text: `${major} open Major severity bug${major !== 1 ? 's' : ''} - add to the next sprint backlog.`, to: `/projects/${projectId}/bugs?severity=Major` })
    if (coverage < 80 && pending > 0) insights.push({ type: 'info', title: 'Low Coverage', text: `${pending} case${pending !== 1 ? 's' : ''} still not executed (${100 - coverage}% untested). Run a test cycle to improve coverage.`, to: `/projects/${projectId}/test-cases?status=${enc('Not Executed')}` })
    if (insights.length === 0) insights.push({ type: 'success', title: 'All Systems Nominal', text: 'Blocker-free, healthy pass rate, no critical defects. Ship with confidence.' })
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description={`Pass rates, bug severity, and run history for ${projectName}.`}
        action={
          <div className="page-actions-row">
            <button className="secondary-button" type="button" onClick={() => exportTestCases(testCases, projectName)}>
              <DownloadIcon width={14} height={14} /> Cases
            </button>
            <button className="secondary-button" type="button" onClick={() => exportBugs(bugs, projectName)}>
              <DownloadIcon width={14} height={14} /> Bugs
            </button>
            <button className="secondary-button" type="button" onClick={() => exportTestRuns(runs, projectName)}>
              <DownloadIcon width={14} height={14} /> Runs
            </button>
            <button className="secondary-button" type="button" onClick={() => window.print()}>
              <PrintIcon width={14} height={14} /> Print
            </button>
          </div>
        }
      />

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <section className="rpt-kpi-strip">
        <Link to={`/projects/${projectId}/test-cases`} className="rpt-kpi rpt-kpi-link">
          <span>Total cases</span>
          <strong>{total}</strong>
        </Link>
        <Link to={`/projects/${projectId}/test-cases?status=Pass`} className="rpt-kpi rpt-kpi--pass rpt-kpi-link">
          <span>Passed</span>
          <strong>{passed}</strong>
        </Link>
        <Link to={`/projects/${projectId}/test-cases?status=Fail`} className="rpt-kpi rpt-kpi--fail rpt-kpi-link">
          <span>Failed</span>
          <strong>{failed}</strong>
        </Link>
        <Link to={`/projects/${projectId}/test-cases?status=Blocker`} className="rpt-kpi rpt-kpi--blocker rpt-kpi-link">
          <span>Blockers</span>
          <strong>{blocker}</strong>
        </Link>
        <Link to={`/projects/${projectId}/bugs?status=Open`} className="rpt-kpi rpt-kpi--bug rpt-kpi-link">
          <span>Open bugs</span>
          <strong>{openBugs}</strong>
        </Link>
        <Link to={`/projects/${projectId}/test-cases?status=${enc('Not Executed')}`} className="rpt-kpi rpt-kpi--coverage rpt-kpi-link">
          <span>Coverage</span>
          <strong>{coverage}%</strong>
        </Link>
        <Link to={`/projects/${projectId}/test-runs`} className="rpt-kpi rpt-kpi--runs rpt-kpi-link">
          <span>Runs</span>
          <strong>{runs.length}</strong>
        </Link>
      </section>

      {/* ── Insights ───────────────────────────────────────────────────────── */}
      {insights.length > 0 && (
        <section className="panel insights-panel mb-md">
          <div className="section-header"><h2>Action insights</h2></div>
          <div className="insights-list">
            {insights.map((ins, i) => {
              const InsightTag = ins.to ? Link : 'div'
              return (
              <InsightTag key={i} className={`insight-item insight-item--${ins.type} report-action-link`} {...(ins.to ? { to: ins.to } : {})}>
                <div className="insight-badge-dot" />
                <div className="insight-content">
                  <strong>{ins.title}</strong>
                  <p>{ins.text}</p>
                </div>
              </InsightTag>
            )})}
          </div>
        </section>
      )}

      {/* ── Charts row ─────────────────────────────────────────────────────── */}
      <section className="report-grid">
        {/* Test results */}
        <article className="panel chart-panel chart-panel--tall">
          <div className="section-header">
            <h2><BarChartIcon width={16} height={16} /> Test results</h2>
          </div>
          <div className="chart-split">
            <PassRing rate={passRate} />
            <div className="chart-bars">
              <Bar label="Pass"             value={passed}     total={total} tone="passed" />
              <Bar label="Fail"             value={failed}     total={total} tone="failed" />
              <Bar label="Blocker"          value={blocker}    total={total} tone="blocker" />
              <Bar label="Reported"         value={reported}   total={total} tone="reported" />
              <Bar label="In Progress"      value={inProgress} total={total} tone="inprogress" />
              <Bar label="Need Clarif."     value={needClarif} total={total} tone="clarification" />
              <Bar label="Hold"             value={hold}       total={total} tone="hold" />
              <Bar label="Skipped"          value={skipped}    total={total} tone="skipped" />
              <Bar label="Not Executed"     value={pending}    total={total} tone="pending" />
            </div>
          </div>
        </article>

        {/* Bugs + run trend */}
        <article className="panel chart-panel chart-panel--tall">
          <div className="section-header"><h2>Bugs by severity</h2></div>
          <div className="chart-bars chart-bars--solo">
            <Link to={`/projects/${projectId}/bugs?severity=Critical`} className="chart-link-row"><Bar label="Critical" value={critical} total={activeBugs.length} tone="failed" /></Link>
            <Link to={`/projects/${projectId}/bugs?severity=Major`} className="chart-link-row"><Bar label="Major" value={major} total={activeBugs.length} tone="pending" /></Link>
            <Link to={`/projects/${projectId}/bugs?severity=Minor`} className="chart-link-row"><Bar label="Minor" value={minor} total={activeBugs.length} tone="passed" /></Link>
          </div>
          <div className="bug-status-summary">
            {[['Open', 'failed'], ['In review', 'pending'], ['Closed', 'passed']].map(([s, tone]) => (
              <Link key={s} to={`/projects/${projectId}/bugs?status=${enc(s)}`} className="bug-status-chip bug-status-chip-link">
                <span className={`bsc-dot bsc-dot--${tone}`} />
                <span>{s}</span>
                <strong>{bugs.filter((b) => normalizeBugStatus(b.status) === s).length}</strong>
              </Link>
            ))}
          </div>

          {trendRuns.length >= 2 && (
            <>
              <div className="section-header mt-md"><h2>Pass rate trend</h2></div>
              <div className="rpt-trend-row">
                <RunTrend runs={trendRuns} />
                <div className="rpt-trend-labels">
                  {trendRuns.slice(-4).map((run, i) => {
                    const rate = run.total ? Math.round((run.passed / run.total) * 100) : 0
                    const tone = rate >= 70 ? 'passed' : rate >= 50 ? 'pending' : 'failed'
                    return (
                      <div key={run.id} className="rpt-trend-label-row">
                        <span className={`run-stat-dot run-stat-dot--${tone}`} />
                        <span className="rpt-trend-name">{run.name || `Run ${i + 1}`}</span>
                        <strong className={`status-text--${tone}`}>{rate}%</strong>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </article>
      </section>

      {/* ── Test run history ───────────────────────────────────────────────── */}
      <section className="panel mb-md">
        <div className="section-header">
          <h2>Run history</h2>
          {runs.length > 0 && <StatusPill tone="neutral">{runs.length} run{runs.length !== 1 ? 's' : ''}</StatusPill>}
        </div>
        {runs.length === 0 ? (
          <div className="empty-table-row">No test runs yet. Start a test run to see history here.</div>
        ) : (
          <>
            <div className="table-wrap" style={{ borderBottom: 'none', borderRadius: '10px 10px 0 0' }}>
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Name</th>
                    <th>Build</th>
                    <th className="rpt-run-col-total">Total</th>
                    <th className="rpt-run-col-pass">Pass</th>
                    <th className="rpt-run-col-fail">Fail</th>
                    <th className="rpt-run-col-block">Blocker</th>
                    <th className="rpt-run-col-skip">Skip</th>
                    <th className="rpt-run-col-rate">Pass rate</th>
                    <th>By</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedRuns.map((run) => {
                    const rate = run.total ? Math.round((run.passed / run.total) * 100) : 0
                    const tone = rate >= 70 ? 'passed' : rate >= 50 ? 'pending' : 'failed'
                    return (
                      <tr key={run.id}>
                        <td>{new Date(run.completedAt || run.date).toLocaleString()}</td>
                        <td>
                          <Link to={`/projects/${projectId}/test-runs/${run.id}`} className="text-link">
                            {run.name || 'Test run'}
                          </Link>
                        </td>
                        <td>{run.build || '—'}</td>
                        <td>{run.total}</td>
                        <td className="metric-passed">{run.passed}</td>
                        <td className="metric-failed">{run.failed}</td>
                        <td>{run.blocker ?? 0}</td>
                        <td>{run.skipped ?? 0}</td>
                        <td>
                          <div className="progress-cell">
                            <span className={`status-text--${tone}`}>{rate}%</span>
                            <div className="progress-track">
                              <span style={{
                                width: `${rate}%`,
                                background: tone === 'passed' ? 'var(--success)' : tone === 'pending' ? 'var(--warning)' : 'var(--danger)',
                              }} />
                            </div>
                          </div>
                        </td>
                        <td>{run.executedBy || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {runs.length > 0 && (
              <div className="table-pagination" aria-label="Run history pagination" style={{ borderTop: '1px solid var(--border)', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="pagination-summary">{runRangeStart}-{runRangeEnd} of {sortedRuns.length}</span>
                <div className="pagination-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button 
                    className="secondary-button icon-button" 
                    type="button" 
                    aria-label="Previous runs page" 
                    disabled={currentRunPage === 1} 
                    onClick={() => setRunPage(Math.max(1, currentRunPage - 1))}
                  >
                    <ChevronLeftIcon width={14} height={14} />
                  </button>
                  <span className="page-indicator">{currentRunPage} / {totalRunPages}</span>
                  <button 
                    className="secondary-button icon-button" 
                    type="button" 
                    aria-label="Next runs page" 
                    disabled={currentRunPage === totalRunPages} 
                    onClick={() => setRunPage(Math.min(totalRunPages, currentRunPage + 1))}
                  >
                    <ChevronRightIcon width={14} height={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Module breakdown ───────────────────────────────────────────────── */}
      {moduleStats.length > 0 && (
        <section className="panel mb-md">
          <div className="section-header">
            <h2>Module breakdown</h2>
            <StatusPill tone="neutral">{moduleStats.length} module{moduleStats.length !== 1 ? 's' : ''}</StatusPill>
          </div>
          <div className="table-wrap">
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>Module</th>
                  <th className="rpt-mod-col-cases">Cases</th>
                  <th className="rpt-mod-col-pass">Pass</th>
                  <th className="rpt-mod-col-fail">Fail+Bloc</th>
                  <th className="rpt-mod-col-bugs">Open bugs</th>
                  <th className="rpt-mod-col-rate">Pass rate</th>
                  <th className="rpt-mod-col-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {moduleStats.map((m) => {
                  const problems = m.failed + m.blocker
                  const health = m.blocker > 0 ? 'blocker' : problems > 0 ? 'failed' : m.passRate >= 70 ? 'passed' : 'pending'
                  const healthLabel = m.blocker > 0 ? 'Blocker' : problems > 0 ? 'Failing' : m.passRate >= 70 ? 'Good' : 'Review'
                  return (
                    <tr key={m.module}>
                      <td><Link className="text-link" to={`/projects/${projectId}/test-cases?module=${enc(m.module)}`}><strong>{m.module}</strong></Link></td>
                      <td><Link className="text-link" to={`/projects/${projectId}/test-cases?module=${enc(m.module)}`}>{m.total}</Link></td>
                      <td><Link className="text-link metric-passed" to={`/projects/${projectId}/test-cases?module=${enc(m.module)}&status=Pass`}>{m.passed}</Link></td>
                      <td><Link className={`text-link ${problems > 0 ? 'metric-failed' : ''}`} to={`/projects/${projectId}/test-cases?module=${enc(m.module)}&status=${m.blocker > 0 ? 'Blocker' : 'Fail'}`}>{problems || '—'}</Link></td>
                      <td><Link className={`text-link ${m.openBugs > 0 ? 'metric-failed' : ''}`} to={`/projects/${projectId}/bugs?module=${enc(m.module)}&status=Open`}>{m.openBugs || '—'}</Link></td>
                      <td>
                        <div className="progress-cell">
                          <span>{m.passRate}%</span>
                          <div className="progress-track">
                            <span style={{
                              width: `${m.passRate}%`,
                              background: m.passRate >= 70 ? 'var(--success)' : m.passRate >= 50 ? 'var(--warning)' : 'var(--danger)',
                            }} />
                          </div>
                        </div>
                      </td>
                      <td><span className={`status-pill status-pill--${health}`}>{healthLabel}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
