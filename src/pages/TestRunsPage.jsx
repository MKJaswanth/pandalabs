import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { CheckIcon } from '../components/Icons'
import { useUser } from '../context/UserContext'
import { useBugs } from '../hooks/useBugs'
import { useProjects } from '../hooks/useProjects'
import { useTestCases } from '../hooks/useTestCases'
import { useTestRuns } from '../hooks/useTestRuns'
import { historyEntry, withHistory } from '../utils/history'
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
  return (
    <div className="run-summary-grid">
      <article className="run-summary-total"><span>Total</span><strong>{summary.total}</strong></article>
      <article><span>Pass</span><strong className="metric-passed">{summary.passed}</strong></article>
      <article><span>Fail</span><strong className="metric-failed">{summary.failed}</strong></article>
      <article><span>Blocker</span><strong className="metric-failed">{summary.blocker}</strong></article>
      <article><span>Skipped</span><strong>{summary.skipped}</strong></article>
      <article className="run-summary-rate">
        <span>Pass rate</span>
        <strong>{rate}%</strong>
        <div className="progress-track"><span style={{ width: `${rate}%` }} /></div>
      </article>
    </div>
  )
}

export function TestRunsPage() {
  const { projectId } = useParams()
  const { user } = useUser()
  const { projects } = useProjects()
  const { testCases, updateTestCase } = useTestCases(projectId)
  const { addBug } = useBugs(projectId)
  const { runs, addRun } = useTestRuns(projectId)
  const project = projects.find((p) => p.id === projectId)

  const [mode, setMode] = useState('setup')
  const [runName, setRunName] = useState('')
  const [build, setBuild] = useState('')
  const [selectedIds, setSelectedIds] = useState(() => testCases.map((tc) => tc.id))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [results, setResults] = useState({})
  const [savedRun, setSavedRun] = useState(null)
  const [bugForm, setBugForm] = useState(null)
  const [bugsLogged, setBugsLogged] = useState(0)

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

  const toggleCase = (id) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
  }

  const startRun = () => {
    const initial = Object.fromEntries(selectedCases.map((tc) => [
      tc.id,
      { status: 'Not Executed', actual: '' },
    ]))
    setResults(initial)
    setCurrentIndex(0)
    setSavedRun(null)
    setBugsLogged(0)
    setMode('execute')
  }

  const startRunWithIds = (ids) => {
    setSelectedIds(ids)
    const cases = testCases.filter((tc) => ids.includes(tc.id))
    setResults(Object.fromEntries(cases.map((tc) => [
      tc.id,
      { status: 'Not Executed', actual: '' },
    ])))
    setCurrentIndex(0)
    setSavedRun(null)
    setBugsLogged(0)
    setMode('execute')
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
        module: tc.module,
        priority: tc.priority,
        assignee: tc.assignee,
        expected: tc.expected,
        status: result.status,
        actual: result.actual,
      }
    })
    const summary = summarizeStatuses(executed)
    const run = addRun({
      name: runName.trim() || `${project?.name ?? 'Project'} run`,
      build: build.trim(),
      executedBy: user,
      completedAt: new Date().toISOString(),
      cases: executed,
      bugsLogged,
      failureModules: failingModules(executed),
      ...summary,
    })
    setSavedRun(run)
    setMode('complete')
  }

  const openRunBug = () => {
    if (!currentCase) return
    setBugForm({
      title: `${currentCase.title} failed during execution`,
      description: currentResult?.actual ? `Actual result: ${currentResult.actual}` : '',
      severity: currentResult?.status === 'Blocker' ? 'Critical' : 'Major',
      status: 'Open',
      linkedTestCase: currentCase.id,
    })
  }

  const setBug = (key) => (event) => setBugForm((current) => ({ ...current, [key]: event.target.value }))

  const handleRunBug = (event) => {
    event.preventDefault()
    if (!bugForm?.title.trim()) return
    addBug({
      ...bugForm,
      history: [historyEntry('created', user, 'Bug created during test run execution')],
    })
    setBugsLogged((count) => count + 1)
    setBugForm(null)
  }

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
      if (event.key === 'ArrowRight') setCurrentIndex((index) => Math.min(selectedCases.length - 1, index + 1))
      if (event.key === 'ArrowLeft') setCurrentIndex((index) => Math.max(0, index - 1))
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [bugForm, currentCase, mode, selectedCases.length])

  return (
    <>
      <PageHeader
        title="Test runs"
        description="Select test cases, execute them, and save run history for release reporting."
      />

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
                      <td><span className={`status-pill status-pill--${STATUS_TONE[tc.status] ?? 'pending'}`}>{tc.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
              <span>← → navigate cases</span>
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
            <h2>Live summary</h2>
            <RunSummary summary={liveSummary} />
            <div className="run-side-section">
              <h3>Failure modules</h3>
              {moduleRisks.length ? (
                moduleRisks.slice(0, 4).map((item) => (
                  <div className="run-module-risk" key={item.module}>
                    <span>{item.module}</span>
                    <strong>{item.count}</strong>
                  </div>
                ))
              ) : (
                <p className="muted-text">No failed modules yet.</p>
              )}
            </div>
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
            <Link to={`/projects/${projectId}/test-runs/${savedRun.id}`} className="primary-button" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
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
