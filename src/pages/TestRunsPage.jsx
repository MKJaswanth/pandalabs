import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AttachmentField } from '../components/AttachmentField'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { CheckIcon } from '../components/Icons'
import { useUser } from '../context/UserContext'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import { useBugs } from '../hooks/useBugs'
import { useProjects } from '../hooks/useProjects'
import { useTestCases } from '../hooks/useTestCases'
import { useTestRuns } from '../hooks/useTestRuns'
import { historyEntry, withHistory } from '../utils/history'
import { newId } from '../utils/id'
import { clearRunDraft, getRunDraft, saveRunDraft } from '../utils/runDrafts'
import { STATUS_TONE, TEST_STATUSES, summarizeStatuses } from '../utils/status'

const BUG_STATUSES = ['Open', 'In review', 'Closed']
const SEVERITIES = ['Critical', 'Major', 'Minor']

function failingModules(cases = []) {
  const counts = cases.reduce((acc, tc) => {
    if (tc.status !== 'Fail' && tc.status !== 'Blocker') return acc
    const module = tc.module || 'Unassigned'
    acc[module] = (acc[module] ?? 0) + 1
    return acc
  }, {})
  return Object.entries(counts)
    .map(([module, count]) => ({ module, count }))
    .sort((a, b) => b.count - a.count)
}

function RunSummary({ summary }) {
  const rate = summary.total ? Math.round((summary.passed / summary.total) * 100) : 0
  const pending = summary.pending ?? 0
  const executed = summary.total - pending

  const allStats = [
    { label: 'Pass',               count: summary.passed,                 tone: 'passed' },
    { label: 'Fail',               count: summary.failed,                 tone: 'failed' },
    { label: 'Blocker',            count: summary.blocker,                tone: 'blocker' },
    { label: 'Reported',           count: summary.reported ?? 0,          tone: 'reported' },
    { label: 'In Progress',        count: summary.testingInProgress ?? 0, tone: 'inprogress' },
    { label: 'Need Clarification', count: summary.needClarification ?? 0, tone: 'clarification' },
    { label: 'Hold',               count: summary.hold ?? 0,              tone: 'hold' },
    { label: 'Skipped',            count: summary.skipped,                tone: 'skipped' },
    { label: 'Not Executed',       count: pending,                        tone: 'pending' },
  ]

  const alwaysShow = new Set(['passed', 'failed', 'blocker', 'pending'])
  const visibleStats = allStats.filter((s) => s.count > 0 || alwaysShow.has(s.tone))

  return (
    <div className="run-summary">
      <div className="run-summary-hero">
        <span className="run-summary-rate-num">{rate}<span className="run-summary-rate-pct">%</span></span>
        <div className="run-summary-meta">
          <strong>pass rate</strong>
          <span>{executed} / {summary.total} executed</span>
        </div>
      </div>

      <div className="run-stacked-bar">
        {summary.total === 0
          ? <span className="run-stacked-seg run-stacked-seg--pending" style={{ flex: 1 }} />
          : allStats.filter((s) => s.count > 0).map((s) => (
            <span
              key={s.tone}
              className={`run-stacked-seg run-stacked-seg--${s.tone}`}
              style={{ flex: s.count }}
              title={`${s.label}: ${s.count}`}
            />
          ))
        }
      </div>

      <div className="run-stat-rows">
        {visibleStats.map(({ label, count, tone }) => (
          <div key={label} className="run-stat-row">
            <span className={`run-stat-dot run-stat-dot--${tone}`} />
            <span className="run-stat-label">{label}</span>
            <span className={`run-stat-count${count > 0 ? ` status-text--${tone}` : ''}`}>{count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function TestRunsPage() {
  const { projectId } = useParams()
  const { user } = useUser()
  const confirm = useConfirm()
  const toast = useToast()
  const { projects } = useProjects()
  const { testCases, updateTestCase } = useTestCases(projectId)
  const { addBug } = useBugs(projectId)
  const { runs, addRun } = useTestRuns(projectId)
  const project = projects.find((p) => p.id === projectId)

  // Persisted draft loaded once at mount — shows resume banner until consumed or dismissed
  const [draft, setDraft] = useState(() => getRunDraft(projectId))

  const [mode, setMode] = useState('setup')
  const [runName, setRunName] = useState('')
  const [build, setBuild] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => testCases.map((tc) => tc.id))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState({})
  const [savedRun, setSavedRun] = useState(null)
  const [bugForm, setBugForm] = useState(null)
  const [bugsLogged, setBugsLogged] = useState(0)
  // track which case IDs already have a bug logged (to avoid duplicates at finish)
  const [loggedBugCaseIds, setLoggedBugCaseIds] = useState([])
  // track IDs of bugs logged manually during execution
  const [loggedBugIds, setLoggedBugIds] = useState([])
  const [startedAt, setStartedAt] = useState(null)

  const selectedCases = useMemo(
    () => testCases.filter((tc) => selectedIds.includes(tc.id)),
    [selectedIds, testCases],
  )
  const currentCase = selectedCases[currentIndex]
  const currentResult = currentCase
    ? results[currentCase.id] ?? { status: currentCase.status ?? 'Not Executed', actual: currentCase.actual ?? '' }
    : null

  const resultItems = selectedCases.map((tc) => ({
    ...tc,
    status: results[tc.id]?.status ?? tc.status ?? 'Not Executed',
  }))
  const liveSummary = summarizeStatuses(resultItems)
  const latestRuns = [...runs].reverse().slice(0, 5)
  const completedCount = selectedCases.filter((tc) => {
    const status = results[tc.id]?.status ?? tc.status ?? 'Not Executed'
    return status !== 'Not Executed'
  }).length
  const progressPercent = selectedCases.length ? Math.round((completedCount / selectedCases.length) * 100) : 0
  const moduleRisks = failingModules(resultItems)

  // Elapsed time ticker — updates every 30 s while executing
  const [elapsed, setElapsed] = useState('')
  useEffect(() => {
    if (mode !== 'execute' || !startedAt) return
    const fmt = () => {
      const mins = Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000)
      if (mins < 1) setElapsed('just started')
      else if (mins < 60) setElapsed(`${mins}m`)
      else { const h = Math.floor(mins / 60); const m = mins % 60; setElapsed(m ? `${h}h ${m}m` : `${h}h`) }
    }
    fmt()
    const id = setInterval(fmt, 30000)
    return () => clearInterval(id)
  }, [mode, startedAt])

  const jumpToNextPending = () => {
    // Search forward from current position first, then wrap around
    const after = selectedCases.findIndex((tc, idx) => {
      if (idx <= currentIndex) return false
      return (results[tc.id]?.status ?? tc.status ?? 'Not Executed') === 'Not Executed'
    })
    if (after !== -1) { setCurrentIndex(after); return }
    const from0 = selectedCases.findIndex((tc) =>
      (results[tc.id]?.status ?? tc.status ?? 'Not Executed') === 'Not Executed',
    )
    if (from0 !== -1) setCurrentIndex(from0)
  }

  const toggleCase = (id) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
  }

  const startRun = () => {
    const initial = Object.fromEntries(selectedCases.map((tc) => [
      tc.id,
      { status: 'Not Executed', actual: '' },
    ]))
    const now = new Date().toISOString()
    setResults(initial)
    setCurrentIndex(0)
    setSavedRun(null)
    setBugsLogged(0)
    setLoggedBugCaseIds([])
    setLoggedBugIds([])
    setStartedAt(now)
    setDraft(null)
    setMode('execute')
    // Persist draft synchronously so a refresh right after Start still offers resume
    saveRunDraft(projectId, {
      runName,
      build,
      selectedIds,
      currentIndex: 0,
      results: initial,
      bugsLogged: 0,
      loggedBugCaseIds: [],
      loggedBugIds: [],
      startedAt: now,
    })
  }

  const startRunWithIds = (ids) => {
    setSelectedIds(ids)
    const cases = testCases.filter((tc) => ids.includes(tc.id))
    const initial = Object.fromEntries(cases.map((tc) => [
      tc.id,
      { status: 'Not Executed', actual: '' },
    ]))
    const now = new Date().toISOString()
    setResults(initial)
    setCurrentIndex(0)
    setSavedRun(null)
    setBugsLogged(0)
    setLoggedBugCaseIds([])
    setLoggedBugIds([])
    setStartedAt(now)
    setDraft(null)
    setMode('execute')
    saveRunDraft(projectId, {
      runName,
      build,
      selectedIds: ids,
      currentIndex: 0,
      results: initial,
      bugsLogged: 0,
      loggedBugCaseIds: [],
      loggedBugIds: [],
      startedAt: now,
    })
  }

  const updateCurrent = (patch) => {
    if (!currentCase) return
    setResults((prev) => ({
      ...prev,
      [currentCase.id]: { ...currentResult, ...patch },
    }))
  }

  const finishRun = () => {
    const executed = selectedCases.map((tc) => {
      const result = results[tc.id] ?? { status: tc.status ?? 'Not Executed', actual: tc.actual ?? '' }
      updateTestCase(withHistory(
        { ...tc, status: result.status, actual: result.actual, updatedAt: new Date().toISOString(), updatedBy: user },
        historyEntry('execution', user, `Executed in run as ${result.status}`, tc.status, result.status),
      ))
      return {
        testCaseId: tc.id,
        title: tc.title,
        module: tc.module ?? '',
        priority: tc.priority ?? '',
        assignee: tc.assignee ?? '',
        expected: tc.expected ?? '',
        status: result.status,
        actual: result.actual ?? '',
      }
    })

    const summary = summarizeStatuses(executed)
    const passRate = summary.total ? Math.round((summary.passed / summary.total) * 100) : 0
    const runId = newId()

    // Auto-create bugs for Fail/Blocker cases that didn't have a bug logged manually
    const autoBugIds = []
    const failedUnlogged = executed.filter(
      (tc) => (tc.status === 'Fail' || tc.status === 'Blocker') && !loggedBugCaseIds.includes(tc.testCaseId),
    )
    for (const tc of failedUnlogged) {
      const bug = addBug({
        title: `${tc.title} failed during run`,
        description: tc.actual ? `Actual result: ${tc.actual}` : '',
        severity: tc.status === 'Blocker' ? 'Critical' : 'Major',
        status: 'Open',
        linkedTestCase: tc.testCaseId,
        module: tc.module || '',
        priority: tc.priority || '',
        reportedBy: user,
        linkedRunId: runId,
        history: [historyEntry('created', user, 'Auto-created from failed test run execution')],
      })
      autoBugIds.push(bug.id)
    }

    const totalBugsLogged = bugsLogged + autoBugIds.length
    const allLinkedBugIds = [...loggedBugIds, ...autoBugIds]

    const run = addRun({
      id: runId,
      name: runName.trim() || `${project?.name ?? 'Project'} run`,
      build: build.trim() || '',
      executedBy: user ?? '',
      startedAt: startedAt ?? new Date().toISOString(),
      completedAt: new Date().toISOString(),
      cases: executed,
      bugsLogged: totalBugsLogged,
      linkedBugIds: allLinkedBugIds,
      failureModules: failingModules(executed),
      passRate,
      ...summary,
    })

    // Draft is no longer needed — run was persisted successfully
    clearRunDraft(projectId)
    setDraft(null)

    setSavedRun(run)
    setMode('complete')

    if (autoBugIds.length > 0) {
      toast.info(`Run saved. ${autoBugIds.length} bug${autoBugIds.length !== 1 ? 's' : ''} auto-logged for failed cases.`)
    } else {
      toast.success('Run saved successfully.')
    }
  }

  const openRunBug = () => {
    if (!currentCase) return
    setBugForm({
      title: `${currentCase.title} failed during execution`,
      description: currentResult?.actual ? `Actual result: ${currentResult.actual}` : '',
      severity: currentResult?.status === 'Blocker' ? 'Critical' : 'Major',
      status: 'Open',
      linkedTestCase: currentCase.id,
      attachments: [],
    })
  }

  const setBug = (key) => (event) => setBugForm((current) => ({ ...current, [key]: event.target.value }))

  const handleRunBug = (event) => {
    event.preventDefault()
    if (!bugForm?.title.trim()) return
    const bug = addBug({
      ...bugForm,
      reportedBy: user,
      history: [historyEntry('created', user, 'Bug created during test run execution')],
    })
    setBugsLogged((count) => count + 1)
    setLoggedBugCaseIds((ids) => [...ids, currentCase.id])
    setLoggedBugIds((ids) => [...ids, bug.id])
    setBugForm(null)
    toast.success('Bug logged.')
  }

  // ── Draft: resume ──────────────────────────────────────────────────────────
  const resumeDraft = () => {
    if (!draft) return
    // Discard any case IDs that have since been deleted from the project
    const validIds = (draft.selectedIds ?? []).filter((id) => testCases.some((tc) => tc.id === id))
    if (validIds.length === 0) {
      clearRunDraft(projectId)
      setDraft(null)
      toast.warning('All test cases from the saved draft no longer exist. Draft discarded.')
      return
    }
    const safeIndex = Math.min(draft.currentIndex ?? 0, validIds.length - 1)
    setRunName(draft.runName ?? '')
    setBuild(draft.build ?? '')
    setSelectedIds(validIds)
    setCurrentIndex(safeIndex)
    setResults(draft.results ?? {})
    setBugsLogged(draft.bugsLogged ?? 0)
    setLoggedBugCaseIds(draft.loggedBugCaseIds ?? [])
    setLoggedBugIds(draft.loggedBugIds ?? [])
    setStartedAt(draft.startedAt ?? new Date().toISOString())
    setSavedRun(null)
    setDraft(null)
    setMode('execute')
  }

  // ── Draft: discard ─────────────────────────────────────────────────────────
  const discardDraft = async () => {
    const ok = await confirm({
      title: 'Discard draft?',
      message: 'The saved progress for this test run will be permanently deleted.',
      confirmLabel: 'Discard',
      danger: true,
    })
    if (!ok) return
    clearRunDraft(projectId)
    setDraft(null)
    toast.success('Draft discarded.')
  }

  // ── Draft: autosave during execution ───────────────────────────────────────
  useEffect(() => {
    if (mode !== 'execute') return
    saveRunDraft(projectId, {
      runName,
      build,
      selectedIds,
      currentIndex,
      results,
      bugsLogged,
      loggedBugCaseIds,
      loggedBugIds,
      startedAt,
    })
  }, [mode, projectId, runName, build, selectedIds, currentIndex, results, bugsLogged, loggedBugCaseIds, loggedBugIds, startedAt])

  // ── Keyboard shortcuts during execution ────────────────────────────────────
  useEffect(() => {
    if (mode !== 'execute' || bugForm) return
    const handler = (event) => {
      const target = event.target
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT') return
      const setShortcutStatus = (status) => {
        if (!currentCase) return
        setResults((prev) => ({
          ...prev,
          [currentCase.id]: {
            ...(prev[currentCase.id] ?? { status: currentCase.status ?? 'Not Executed', actual: currentCase.actual ?? '' }),
            status,
          },
        }))
      }
      if (event.key === 'p' || event.key === 'P') setShortcutStatus('Pass')
      if (event.key === 'f' || event.key === 'F') setShortcutStatus('Fail')
      if (event.key === 'b' || event.key === 'B') setShortcutStatus('Blocker')
      if (event.key === 's' || event.key === 'S') setShortcutStatus('Skipped')
      if (event.key === 'r' || event.key === 'R') setShortcutStatus('Reported')
      if (event.key === 'h' || event.key === 'H') setShortcutStatus('Hold')
      if (event.key === 'i' || event.key === 'I') setShortcutStatus('Testing in Progress')
      if (event.key === 'n' || event.key === 'N') setShortcutStatus('Need Clarification')
      if (event.key === 'ArrowRight') setCurrentIndex((index) => Math.min(selectedCases.length - 1, index + 1))
      if (event.key === 'ArrowLeft') setCurrentIndex((index) => Math.max(0, index - 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [bugForm, currentCase, mode, selectedCases.length])

  // Derive a human-readable draft age string for the banner
  const draftAge = draft?.startedAt
    ? new Date(draft.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null
  const draftExecutedCount = Object.values(draft?.results ?? {}).filter((r) => r.status !== 'Not Executed').length

  return (
    <>
      <PageHeader
        title="Test runs"
        description="Select test cases, execute them, and save run history for release reporting."
      />

      {mode === 'setup' && draft && (
        <div className="run-draft-banner">
          <div className="run-draft-banner-text">
            <strong>Unfinished run</strong>
            <span>
              {draft.runName || 'Unnamed run'}
              {draftAge ? ` • started ${draftAge}` : ''}
              {' • '}
              {draft.selectedIds?.length ?? 0} case{(draft.selectedIds?.length ?? 0) !== 1 ? 's' : ''},
              {' '}{draftExecutedCount} executed
            </span>
          </div>
          <button className="secondary-button" type="button" onClick={resumeDraft}>Resume run</button>
          <button className="secondary-button" type="button" onClick={discardDraft}>Discard</button>
        </div>
      )}

      {mode === 'setup' && (
        <section className="panel run-setup">
          <div className="run-config">
            <label>
              Run name
              <input value={runName} onChange={(e) => setRunName(e.target.value)} placeholder="Regression cycle, build smoke..." />
            </label>
            <label>
              Build / version
              <input value={build} onChange={(e) => setBuild(e.target.value)} placeholder="v1.8.0, staging-42..." />
            </label>
          </div>

          <div className="section-header">
            <h2>Select cases</h2>
            <div className="run-selection-actions">
              <button className="secondary-button" type="button" onClick={() => setSelectedIds(testCases.map((tc) => tc.id))}>Select all</button>
              <button className="secondary-button" type="button" onClick={() => setSelectedIds([])}>Clear</button>
              <button className="primary-button" type="button" disabled={selectedIds.length === 0} onClick={startRun}>
                Start run ({selectedIds.length})
              </button>
            </div>
          </div>

          {testCases.length === 0 ? (
            <div className="empty-table-row">No test cases available for this project.</div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>TC ID</th>
                    <th>Title</th>
                    <th>Module</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {testCases.map((tc) => (
                    <tr key={tc.id}>
                      <td>
                        <input
                          className="row-checkbox"
                          type="checkbox"
                          aria-label={`Select ${tc.title}`}
                          checked={selectedIds.includes(tc.id)}
                          onChange={() => toggleCase(tc.id)}
                        />
                      </td>
                      <td className="mono tc-id">{tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()}</td>
                      <td>{tc.title}</td>
                      <td>{tc.module || '-'}</td>
                      <td>{tc.priority}</td>
                      <td>
                        <select
                          className={`inline-select status-select status-select--${STATUS_TONE[tc.status] ?? 'pending'}`}
                          value={tc.status}
                          aria-label={`Status for ${tc.title}`}
                          onChange={(e) => updateTestCase(withHistory(
                            { ...tc, status: e.target.value, updatedAt: new Date().toISOString(), updatedBy: user },
                            historyEntry('status', user, `Status changed to ${e.target.value}`, tc.status, e.target.value),
                          ))}
                        >
                          {TEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {mode === 'execute' && selectedCases.length === 0 && (
        <section className="panel" style={{ textAlign: 'center', padding: '32px 20px' }}>
          <p className="muted-text">No test cases available for this run. They may have been deleted.</p>
          <button className="secondary-button" type="button" style={{ marginTop: 12 }} onClick={() => { clearRunDraft(projectId); setMode('setup') }}>
            Back to setup
          </button>
        </section>
      )}

      {mode === 'execute' && currentCase && (
        <div className="run-execution-layout">
          <section className="panel run-case-panel">
            <div className="run-progress-row">
              <span>Case {currentIndex + 1} of {selectedCases.length}</span>
              <strong>{progressPercent}% executed</strong>
              <div className="progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
            </div>
            <div className="run-current-id">
              <span className="mono">{currentCase.sourceTcId || currentCase.id.slice(0, 8).toUpperCase()}</span>
              <span className={`status-pill status-pill--${STATUS_TONE[currentResult.status] ?? 'pending'}`}>{currentResult.status}</span>
            </div>
            <h2>{currentCase.title}</h2>
            <dl className="run-case-meta">
              <div><dt>Module</dt><dd>{currentCase.module || '-'}</dd></div>
              <div><dt>Priority</dt><dd>{currentCase.priority}</dd></div>
              <div><dt>Assignee</dt><dd>{currentCase.assignee || '-'}</dd></div>
            </dl>

            <div className="run-case-block">
              <h3>Steps</h3>
              {currentCase.steps?.length ? (
                <ol className="step-list">
                  {currentCase.steps.map((step, index) => <li key={`${step}-${index}`}>{step}</li>)}
                </ol>
              ) : <p className="muted-text">No steps recorded.</p>}
            </div>

            <div className="run-case-block">
              <h3>Expected result</h3>
              <p>{currentCase.expected || '-'}</p>
            </div>

            <label className="run-actual-field">
              Actual result
              <textarea
                rows={4}
                value={currentResult.actual}
                onChange={(e) => updateCurrent({ actual: e.target.value })}
                placeholder="What happened during execution?"
              />
            </label>

            <div className="run-status-actions" aria-label="Execution status">
              {TEST_STATUSES.filter((s) => s !== 'Not Executed').map((status) => (
                <button
                  key={status}
                  className={`status-choice status-choice--${STATUS_TONE[status]}${currentResult.status === status ? ' active' : ''}`}
                  type="button"
                  onClick={() => updateCurrent({ status })}
                >
                  {status}
                </button>
              ))}
              <button className="secondary-button" type="button" onClick={openRunBug}>
                + Log bug
              </button>
            </div>
            <div className="shortcut-hints" aria-label="Keyboard shortcuts">
              <span>P Pass</span>
              <span>F Fail</span>
              <span>B Blocker</span>
              <span>S Skip</span>
              <span>R Reported</span>
              <span>H Hold</span>
              <span>I In Progress</span>
              <span>N Need Clarification</span>
              <span>← → navigate</span>
            </div>

            <div className="run-nav-actions">
              <button className="secondary-button" type="button" disabled={currentIndex === 0} onClick={() => setCurrentIndex((i) => i - 1)}>
                Previous
              </button>
              {currentIndex < selectedCases.length - 1 ? (
                <button className="primary-button" type="button" onClick={() => setCurrentIndex((i) => i + 1)}>
                  Next case
                </button>
              ) : (
                <button className="primary-button" type="button" onClick={finishRun}>
                  Finish run
                </button>
              )}
            </div>
          </section>

          <aside className="panel run-side-panel">
            <div className="run-side-header">
              <h2>Live summary</h2>
              <button className="run-jump-btn" type="button" onClick={jumpToNextPending} title="Jump to next unexecuted case">
                Next pending ↓
              </button>
            </div>
            {elapsed && (
              <div className="run-elapsed">
                <span>Elapsed</span>
                <strong>{elapsed}</strong>
              </div>
            )}
            <RunSummary summary={liveSummary} />
            <div className="run-side-section">
              <h3>At-risk modules</h3>
              {moduleRisks.length ? (
                moduleRisks.slice(0, 4).map((item) => (
                  <div className="run-module-risk" key={item.module}>
                    <span>{item.module}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p className="muted-text">No failures yet.</p>
              )}
            </div>
            <div className="run-side-section">
              <h3>Cases</h3>
              <div className="run-case-list">
                {selectedCases.map((tc, index) => {
                  const status = results[tc.id]?.status ?? tc.status ?? 'Not Executed'
                  return (
                    <button
                      key={tc.id}
                      type="button"
                      className={index === currentIndex ? 'active' : ''}
                      onClick={() => setCurrentIndex(index)}
                    >
                      <span>{index + 1}. {tc.title}</span>
                      <strong className={`status-text--${STATUS_TONE[status] ?? 'pending'}`}>{status}</strong>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>
        </div>
      )}

      {bugForm && currentCase && (
        <Modal title="Log bug during run" onClose={() => setBugForm(null)}>
          <form className="modal-form" onSubmit={handleRunBug}>
            <label>
              Title <span className="required">*</span>
              <input autoFocus value={bugForm.title} onChange={setBug('title')} placeholder="Describe the defect" />
            </label>
            <label>
              Description
              <textarea rows={3} value={bugForm.description} onChange={setBug('description')} placeholder="Steps to reproduce, environment, notes..." />
            </label>
            <div className="form-row">
              <label>
                Severity
                <select value={bugForm.severity} onChange={setBug('severity')}>
                  {SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={bugForm.status} onChange={setBug('status')}>
                  {BUG_STATUSES.map((status) => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
            <label>
              Linked test case
              <input value={currentCase.title} disabled className="input-disabled" />
            </label>
            <div>
              <label>Attachments <span className="hint">(max 1MB per file)</span></label>
              <AttachmentField
                attachments={bugForm.attachments || []}
                onChange={(attachments) => setBugForm((prev) => ({ ...prev, attachments }))}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => setBugForm(null)}>Cancel</button>
              <button type="submit" className="primary-button">Log bug</button>
            </div>
          </form>
        </Modal>
      )}

      {mode === 'complete' && savedRun && (
        <section className="panel run-complete-panel">
          <span className="run-complete-mark"><CheckIcon width={24} height={24} /></span>
          <h2>Run saved</h2>
          <p>{savedRun.name} was saved to test run history and the latest test case statuses were updated.</p>
          <RunSummary summary={savedRun} />
          {savedRun.failureModules?.length > 0 && (
            <div className="run-complete-insights">
              <h3>Needs attention</h3>
              {savedRun.failureModules.slice(0, 4).map((item) => (
                <span key={item.module}>{item.module}: {item.count}</span>
              ))}
            </div>
          )}
          <div className="run-nav-actions">
            <button className="secondary-button" type="button" onClick={() => setMode('setup')}>Start another run</button>
            <button
              className="secondary-button"
              type="button"
              disabled={!savedRun.cases?.some((tc) => tc.status === 'Fail' || tc.status === 'Blocker')}
              onClick={() => startRunWithIds(savedRun.cases.filter((tc) => tc.status === 'Fail' || tc.status === 'Blocker').map((tc) => tc.testCaseId))}
            >
              Rerun failed only
            </button>
            <Link to={`/projects/${projectId}/test-runs/${savedRun.id}`} className="primary-button" style={{ textDecoration: 'none' }}>
              View run details
            </Link>
          </div>
        </section>
      )}

      {mode === 'setup' && latestRuns.length > 0 && (
        <section className="panel">
          <div className="section-header"><h2>Recent runs</h2></div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Total</th>
                  <th>Pass</th>
                  <th>Fail</th>
                  <th>Blocker</th>
                  <th>Executed by</th>
                </tr>
              </thead>
              <tbody>
                {latestRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.completedAt || run.date).toLocaleString()}</td>
                    <td>
                      <Link to={`/projects/${projectId}/test-runs/${run.id}`} className="text-link">
                        {run.name || 'Test run'}
                      </Link>
                    </td>
                    <td>{run.total}</td>
                    <td className="metric-passed">{run.passed}</td>
                    <td className="metric-failed">{run.failed}</td>
                    <td>{run.blocker ?? 0}</td>
                    <td>{run.executedBy || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
