import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { useProjects } from '../hooks/useProjects'
import { getBugs, getTestCases, getTestRuns } from '../utils/storage'
import { normalizeTestStatus } from '../utils/status'
import { getGlobalReportMetrics, isOpenBug } from '../utils/reportMetrics'

const STALE_DAYS = 14

const formatRunDate = (dateValue) => {
  if (!dateValue) return ''
  const date = new Date(dateValue)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString()
}

const plural = (count, singular, pluralLabel = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralLabel}`

export function ReportsPage() {
  const { projects } = useProjects()
  const [nowTs] = useState(() => Date.now())

  const {
    rows,
    totals,
    globalPassRate: passRate,
    globalCoverage: coverage,
    overallReadiness
  } = getGlobalReportMetrics({ projects, getTestCases, getBugs, getTestRuns })

  const executed = totals.total - totals.pending
  const readyCount = rows.filter((r) => r.readiness.label === 'Ready').length
  const staleCount = rows.filter((r) => r.total > 0 && r.noRecentRun).length

  // Build moduleRisk
  const moduleRisk = {}
  projects.forEach((p) => {
    const pCases = getTestCases(p.id)
    const pBugs = getBugs(p.id).filter(isOpenBug)

    // Collect all modules referenced by failing cases or open bugs
    const modules = new Set()
    pCases.forEach((t) => {
      const status = normalizeTestStatus(t.status)
      if (status === 'Fail' || status === 'Blocker') {
        modules.add(t.module || 'Unassigned')
      }
    })
    pBugs.forEach((b) => {
      modules.add(b.module || 'Unassigned')
    })

    modules.forEach((mod) => {
      if (!moduleRisk[mod]) {
        moduleRisk[mod] = {
          module: mod,
          score: 0,
          highestSeverity: 'Minor',
          highestPriority: 'Low',
          failures: 0,
          blockers: 0,
          criticalBugs: 0,
          majorBugs: 0,
          minorBugs: 0
        }
      }

      const modInfo = moduleRisk[mod]

      // Evaluate failing cases in this module
      pCases.forEach((t) => {
        if ((t.module || 'Unassigned') === mod) {
          const status = normalizeTestStatus(t.status)
          if (status === 'Fail' || status === 'Blocker') {
            const weight = status === 'Blocker' ? 30 : 20
            if (status === 'Blocker') {
              modInfo.blockers++
              modInfo.highestSeverity = 'Critical'
            } else {
              modInfo.failures++
            }

            const priority = String(t.priority || 'Medium').trim().toLowerCase()
            let prioMult = 1.0
            if (priority === 'high') {
              prioMult = 1.5
              if (modInfo.highestPriority !== 'High') modInfo.highestPriority = 'High'
            } else if (priority === 'low') {
              prioMult = 0.5
            } else {
              if (modInfo.highestPriority === 'Low') modInfo.highestPriority = 'Medium'
            }

            modInfo.score += weight * prioMult
          }
        }
      })

      // Evaluate open bugs in this module
      pBugs.forEach((b) => {
        if ((b.module || 'Unassigned') === mod) {
          let weight = 10
          const sev = String(b.severity || 'Minor').trim().toLowerCase()
          if (sev === 'critical') {
            weight = 30
            modInfo.criticalBugs++
            modInfo.highestSeverity = 'Critical'
          } else if (sev === 'major') {
            weight = 20
            modInfo.majorBugs++
            if (modInfo.highestSeverity !== 'Critical') modInfo.highestSeverity = 'Major'
          } else {
            modInfo.minorBugs++
            if (modInfo.highestSeverity !== 'Critical' && modInfo.highestSeverity !== 'Major') {
              modInfo.highestSeverity = 'Minor'
            }
          }

          const priority = String(b.priority || 'Medium').trim().toLowerCase()
          let prioMult = 1.0
          if (priority === 'high') {
            prioMult = 1.5
            if (modInfo.highestPriority !== 'High') modInfo.highestPriority = 'High'
          } else if (priority === 'low') {
            prioMult = 0.5
          } else {
            if (modInfo.highestPriority === 'Low') modInfo.highestPriority = 'Medium'
          }

          modInfo.score += weight * prioMult
        }
      })
    })
  })

  const riskAreas = Object.values(moduleRisk)
    .map((m) => {
      let tone = 'neutral'
      if (m.highestSeverity === 'Critical') tone = 'failed'
      else if (m.highestSeverity === 'Major') tone = 'pending'

      const parts = []
      if (m.blockers > 0) parts.push(`${m.blockers} blocker${m.blockers !== 1 ? 's' : ''}`)
      if (m.failures > 0) parts.push(`${m.failures} fail${m.failures !== 1 ? 's' : ''}`)
      const bugsCount = m.criticalBugs + m.majorBugs + m.minorBugs
      if (bugsCount > 0) parts.push(`${bugsCount} bug${bugsCount !== 1 ? 's' : ''}`)

      return {
        ...m,
        tone,
        details: parts.join(' · ') || '1 issue'
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const riskMaxScore = riskAreas[0]?.score || 0

  // ── Quality signals (the scan layer a QA lead reads first) ─────────────
  const signals = [
    {
      key: 'coverage',
      label: 'Test coverage',
      value: `${coverage}%`,
      tone: coverage >= 90 ? 'passed' : coverage >= 60 ? 'pending' : 'failed',
      sub: `${executed} of ${totals.total} executed · ${totals.pending} not run`,
    },
    {
      key: 'defects',
      label: 'Open defects',
      value: totals.openBugs,
      tone: totals.critical > 0 ? 'failed' : totals.openBugs > 0 ? 'pending' : 'passed',
      severities: [
        { label: 'Critical', value: totals.critical, tone: 'critical' },
        { label: 'Major', value: totals.major, tone: 'major' },
        { label: 'Minor', value: totals.minor, tone: 'minor' },
      ],
    },
    {
      key: 'ready',
      label: 'Projects ready',
      value: `${readyCount}/${rows.length}`,
      tone: readyCount === rows.length ? 'passed' : readyCount > 0 ? 'pending' : 'failed',
      sub: readyCount === rows.length ? 'All projects release-ready' : `${rows.length - readyCount} not yet ready`,
    },
    {
      key: 'stale',
      label: 'Stale projects',
      value: staleCount,
      tone: staleCount > 0 ? 'pending' : 'passed',
      sub: staleCount > 0 ? `No run in ${STALE_DAYS}+ days` : 'All recently executed',
    },
  ]

  // ── What needs attention (max 5) ───────────────────────────────────────
  const attentionItems = []
  if (totals.blocker > 0) {
    attentionItems.push({ tone: 'failed', text: `${plural(totals.blocker, 'blocker case')} blocking release` })
  }
  if (totals.critical > 0) {
    attentionItems.push({ tone: 'failed', text: `${plural(totals.critical, 'critical bug')} open` })
  }
  if (totals.openBugs - totals.critical > 0) {
    const rest = totals.openBugs - totals.critical
    attentionItems.push({ tone: 'pending', text: `${plural(rest, 'other open bug')} ${rest === 1 ? 'needs' : 'need'} triage` })
  }
  if (totals.failed > 0) {
    attentionItems.push({ tone: 'pending', text: `${plural(totals.failed, 'failing case')} ${totals.failed === 1 ? 'needs' : 'need'} attention` })
  }
  if (staleCount > 0 && attentionItems.length < 5) {
    attentionItems.push({ tone: 'neutral', text: `${plural(staleCount, 'project')} ${staleCount === 1 ? 'has' : 'have'} no run in ${STALE_DAYS}+ days` })
  }
  if (totals.pending > 0 && attentionItems.length < 5) {
    attentionItems.push({ tone: 'neutral', text: `${plural(totals.pending, 'case')} still pending execution` })
  }
  if (attentionItems.length === 0 && totals.total > 0) {
    attentionItems.push({ tone: 'passed', text: 'No blockers, no failing cases, no open bugs' })
  }
  if (totals.total === 0 && projects.length > 0) {
    attentionItems.push({ tone: 'neutral', text: 'Create test cases to start generating readiness data' })
  }

  // ── Status distribution for the minimal bar ───────────────────────────
  const statusBreakdown = [
    { label: 'Pass', value: totals.passed, tone: 'passed' },
    { label: 'Fail', value: totals.failed, tone: 'failed' },
    { label: 'Blocker', value: totals.blocker, tone: 'blocker' },
    { label: 'Skipped', value: totals.skipped, tone: 'skipped' },
    { label: 'Pending', value: totals.pending, tone: 'pending' },
  ].filter((s) => s.value > 0)

  // Empty state
  if (projects.length === 0) {
    return (
      <>
        <PageHeader
          title="Release readiness"
          description="See what can ship, what is blocked, and the next QA action."
        />
        <div className="rr-empty">
          <span className="rr-empty-icon" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19V5" /><path d="M20 19H4" /><path d="M8 15v-4" /><path d="M13 15V8" /><path d="M18 15v-6" />
            </svg>
          </span>
          <h2>No release data yet</h2>
          <p>Create test cases and complete a test run to generate readiness.</p>
          <Link to="/projects" className="primary-button">Go to projects</Link>
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Release readiness"
        description="See what can ship, what is blocked, and the next QA action."
        action={<span className="rr-asof">As of {new Date(nowTs).toLocaleDateString()}</span>}
      />

      {/* ── 1. Readiness summary ──────────────────────────────────────── */}
      <section className="rr-banner">
        <div className="rr-banner-status">
          <span className={`rr-readiness-dot rr-readiness-dot--${overallReadiness.tone}`} />
          <span className={`rr-readiness-label status-text--${overallReadiness.tone}`}>{overallReadiness.label}</span>
        </div>
        <div className="rr-banner-stats">
          <div className="rr-stat">
            <span className="rr-stat-val">{passRate}%</span>
            <span className="rr-stat-label">Pass rate</span>
          </div>
          <div className="rr-stat">
            <span className="rr-stat-val">{executed}<span className="rr-stat-dim">/{totals.total}</span></span>
            <span className="rr-stat-label">Executed</span>
          </div>
          <div className="rr-stat">
            <span className="rr-stat-val">{totals.openBugs}</span>
            <span className="rr-stat-label">Open bugs</span>
          </div>
          <div className="rr-stat">
            <span className="rr-stat-val">{totals.blocker}</span>
            <span className="rr-stat-label">Blockers</span>
          </div>
        </div>
        {totals.total > 0 && (
          <div className="rr-banner-bar">
            <div className="rr-stacked-bar">
              {statusBreakdown.map((s) => (
                <span
                  key={s.label}
                  className={`rr-stacked-seg rr-stacked-seg--${s.tone}`}
                  style={{ flex: s.value }}
                  title={`${s.label}: ${s.value}`}
                />
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── 2. Quality signals ────────────────────────────────────────── */}
      <section className="rr-signals" aria-label="Quality signals">
        {signals.map((sig) => (
          <article key={sig.key} className="rr-signal-card">
            <span className="rr-signal-label">{sig.label}</span>
            <span className={`rr-signal-value status-text--${sig.tone}`}>{sig.value}</span>
            {sig.severities ? (
              <div className="rr-sev-row">
                {sig.severities.map((sv) => (
                  <span key={sv.label} className={`rr-sev rr-sev--${sv.tone}`} title={`${sv.label}: ${sv.value}`}>
                    {sv.value} {sv.label}
                  </span>
                ))}
              </div>
            ) : (
              <span className="rr-signal-sub">{sig.sub}</span>
            )}
          </article>
        ))}
      </section>

      {/* ── 3. What needs attention ────────────────────────────────────── */}
      {attentionItems.length > 0 && (
        <section className="rr-section">
          <h2 className="rr-section-title">What needs attention</h2>
          <div className="rr-attention-list">
            {attentionItems.map((item, i) => (
              <div key={i} className={`rr-attention-item rr-attention-item--${item.tone}`}>
                <span className={`rr-attention-dot rr-attention-dot--${item.tone}`} />
                <span className="rr-attention-text">{item.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 4. Top risk areas (failing modules) ───────────────────────── */}
      {riskAreas.length > 0 && (
        <section className="rr-section">
          <div className="rr-section-head">
            <h2 className="rr-section-title">Top risk areas</h2>
            <span className="rr-section-note">Modules with failing or blocked cases</span>
          </div>
          <div className="rr-risk-list">
            {riskAreas.map((m) => (
              <div key={m.module} className="rr-risk-row">
                <span className="rr-risk-name">{m.module}</span>
                <div className="rr-risk-bar" aria-hidden="true">
                  <span
                    className={`rr-risk-fill rr-risk-fill--${m.tone}`}
                    style={{ width: `${riskMaxScore ? Math.round((m.score / riskMaxScore) * 100) : 0}%` }}
                  />
                </div>
                <span className="rr-risk-count">{m.details}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 5. Project readiness ──────────────────────────────────────── */}
      <section className="rr-section">
        <div className="rr-section-head">
          <h2 className="rr-section-title">Project readiness</h2>
          <span className="rr-section-note">{plural(rows.length, 'project')}</span>
        </div>

        <div className="rr-project-list" aria-label="Project readiness">
          <div className="rr-project-list-head" aria-hidden="true">
            <span>Project</span>
            <span>Status</span>
            <span>Pass rate</span>
            <span>Executed</span>
            <span>Issues</span>
            <span>Latest run</span>
            <span>Next action</span>
          </div>
          {rows.map((r) => (
            <article key={r.id} className="rr-project-row">
              <div className="rr-project-main">
                <Link to={`/projects/${r.id}/reports`} className="rr-project-link">{r.name}</Link>
                <span className="rr-row-subtext">{r.totalRuns ? plural(r.totalRuns, 'run') : 'No runs yet'}</span>
              </div>

              <div className="rr-project-status">
                <StatusPill tone={r.readiness.tone}>{r.readiness.label}</StatusPill>
              </div>

              <div className="rr-rate-cell">
                <span className={`rr-rate-value status-text--${r.readiness.tone}`}>{r.passRate}%</span>
                <div className="rr-mini-bar" aria-hidden="true">
                  <span className={`rr-mini-fill rr-mini-fill--${r.readiness.tone}`} style={{ width: `${r.passRate}%` }} />
                </div>
                <span className="rr-row-subtext">Pass rate</span>
              </div>

              <div className="rr-row-metric">
                <strong>{r.passed}</strong>
                <span>of {r.total} cases</span>
              </div>

              <div className="rr-issue-stack">
                <span className={r.failed > 0 ? 'metric-failed' : ''}><strong>{r.failed}</strong> Failed</span>
                <span className={r.blocker > 0 ? 'metric-failed' : ''}><strong>{r.blocker}</strong> Blockers</span>
                <span className={r.openBugs > 0 ? 'metric-failed' : ''}><strong>{r.openBugs}</strong> Open Bugs</span>
              </div>

              <div className="rr-run-cell">
                {r.latestRun ? (
                  <>
                    <span className="rr-run-info">{r.latestRun.name}</span>
                    <span className={`rr-run-date${r.noRecentRun ? ' rr-run-date--stale' : ''}`}>
                      {formatRunDate(r.latestRun.completedAt || r.latestRun.date)}
                      {r.noRecentRun ? ' · stale' : ''}
                    </span>
                  </>
                ) : (
                  <span className={`rr-muted${r.total > 0 ? ' rr-run-date--stale' : ''}`}>No completed run</span>
                )}
              </div>

              <div className="rr-action-cell">
                <Link to={r.action.to} className="rr-action-link">{r.action.text}</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </>
  )
}
