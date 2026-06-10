import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { PassRing, Bar } from '../components/Charts'
import { useProjects } from '../hooks/useProjects'
import { getBugs, getTestCases, getTestRuns } from '../utils/storage'
import { BarChartIcon, ShieldCheckIcon } from '../components/Icons'

export function ReportsPage() {
  const { projects } = useProjects()

  const rows = projects.map((p) => {
    const tcs  = getTestCases(p.id)
    const bugs = getBugs(p.id)
    const runs = getTestRuns(p.id)
    const passed   = tcs.filter((t) => t.status === 'Pass').length
    const failed   = tcs.filter((t) => t.status === 'Fail').length
    const blocker  = tcs.filter((t) => t.status === 'Blocker').length
    const skipped  = tcs.filter((t) => t.status === 'Skipped').length
    const pending  = tcs.filter((t) => t.status === 'Not Executed').length
    const reported = tcs.filter((t) => t.status === 'Reported').length
    const inProg   = tcs.filter((t) => t.status === 'Testing in Progress').length
    const hold     = tcs.filter((t) => t.status === 'Hold').length
    const needCl   = tcs.filter((t) => t.status === 'Need Clarification').length
    const passRate = tcs.length ? Math.round((passed / tcs.length) * 100) : 0
    const coverage = tcs.length ? Math.round(((tcs.length - pending) / tcs.length) * 100) : 0
    const openBugs = bugs.filter((b) => b.status !== 'Closed').length
    return { ...p, total: tcs.length, passed, failed, blocker, skipped, pending, reported, inProg, hold, needCl, passRate, coverage, openBugs, totalRuns: runs.length }
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
      inProg: acc.inProg + r.inProg,
      hold: acc.hold + r.hold,
      needCl: acc.needCl + r.needCl,
      openBugs: acc.openBugs + r.openBugs,
      totalRuns: acc.totalRuns + r.totalRuns,
    }),
    { total: 0, passed: 0, failed: 0, blocker: 0, skipped: 0, pending: 0, reported: 0, inProg: 0, hold: 0, needCl: 0, openBugs: 0, totalRuns: 0 }
  )
  const globalPassRate = totals.total ? Math.round((totals.passed / totals.total) * 100) : 0
  const globalCoverage = totals.total ? Math.round(((totals.total - totals.pending) / totals.total) * 100) : 0

  const failingModules = projects
    .flatMap((project) => getTestCases(project.id).map((tc) => ({ ...tc, project })))
    .filter((tc) => tc.status === 'Fail' || tc.status === 'Blocker')
    .reduce((items, tc) => {
      const mod = tc.module || 'Unassigned'
      const ex = items.find((i) => i.module === mod)
      if (ex) { ex.count++; ex.projects.add(tc.project.name) }
      else items.push({ module: mod, count: 1, projects: new Set([tc.project.name]) })
      return items
    }, [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const globalInsights = []
  if (totals.total > 0) {
    if (totals.blocker > 0) globalInsights.push({ type: 'danger',  title: 'Blockers Alert', text: `${totals.blocker} blocker case${totals.blocker !== 1 ? 's' : ''} active across the portfolio. Resolve before release.` })
    if (totals.failed > 0)  globalInsights.push({ type: 'warning', title: 'Failing Cases',  text: `${totals.failed} failing case${totals.failed !== 1 ? 's' : ''} detected. Examine top failing modules for regressions.` })
    if (totals.openBugs > 0) globalInsights.push({ type: 'info',   title: 'Open Bug Backlog', text: `${totals.openBugs} unresolved bug${totals.openBugs !== 1 ? 's' : ''} across the workspace. Review priorities in the bug tracker.` })
    if (globalInsights.length === 0) globalInsights.push({ type: 'success', title: 'Portfolio Healthy', text: 'All projects report healthy metrics: zero active blockers and zero unresolved defects.' })
  }

  return (
    <>
      <PageHeader
        title="Global reports"
        description="Cross-project testing health at a glance."
      />

      {/* ── Global health summary ───────────────────────────────────────── */}
      <section className="panel report-health-summary">
        <div className="report-health-content">
          <div className="report-health-ring">
            <PassRing rate={globalPassRate} size={140} />
          </div>
          <div className="report-health-details">
            <h2>Global health summary</h2>
            <p className="report-health-subtitle">
              {totals.total} test cases across {projects.length} project{projects.length !== 1 ? 's' : ''}
              {totals.totalRuns > 0 ? ` · ${totals.totalRuns} total runs` : ''}
            </p>
            <div className="report-health-stats">
              {[
                { label: 'Passed',       val: totals.passed,   color: totals.passed > 0 ? 'var(--success)' : undefined },
                { label: 'Failed',       val: totals.failed,   color: totals.failed > 0 ? 'var(--danger)'  : undefined },
                { label: 'Blockers',     val: totals.blocker,  color: totals.blocker > 0 ? '#c00' : undefined },
                { label: 'Not Executed', val: totals.pending,  color: undefined },
                { label: 'Open bugs',    val: totals.openBugs, color: totals.openBugs > 0 ? 'var(--danger)' : undefined },
                { label: 'Coverage',     val: `${globalCoverage}%`, color: undefined },
              ].map(({ label, val, color }) => (
                <div key={label} className="report-health-stat">
                  <span className="report-health-stat-label">{label}</span>
                  <strong style={{ color }}>{val}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Insights ─────────────────────────────────────────────────────── */}
      {globalInsights.length > 0 && (
        <section className="panel insights-panel" style={{ marginBottom: 18 }}>
          <div className="section-header"><h2>Executive insights</h2></div>
          <div className="insights-list">
            {globalInsights.map((ins, i) => (
              <div key={i} className={`insight-item insight-item--${ins.type}`}>
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

      {/* ── Status distribution + failing modules ─────────────────────── */}
      <section className="report-grid" style={{ marginBottom: 18 }}>
        <article className="panel chart-panel chart-panel--tall">
          <div className="section-header"><h2><BarChartIcon width={16} height={16} /> Status distribution</h2></div>
          <div className="chart-bars chart-bars--solo">
            <Bar label="Pass"          value={totals.passed}   total={totals.total} tone="passed" />
            <Bar label="Fail"          value={totals.failed}   total={totals.total} tone="failed" />
            <Bar label="Blocker"       value={totals.blocker}  total={totals.total} tone="blocker" />
            <Bar label="Reported"      value={totals.reported} total={totals.total} tone="reported" />
            <Bar label="In Progress"   value={totals.inProg}   total={totals.total} tone="inprogress" />
            <Bar label="Need Clarif."  value={totals.needCl}   total={totals.total} tone="clarification" />
            <Bar label="Hold"          value={totals.hold}     total={totals.total} tone="hold" />
            <Bar label="Skipped"       value={totals.skipped}  total={totals.total} tone="skipped" />
            <Bar label="Not Executed"  value={totals.pending}  total={totals.total} tone="pending" />
          </div>
        </article>

        <article className="panel report-insight-panel chart-panel--tall">
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
        </article>
      </section>

    </>
  )
}
