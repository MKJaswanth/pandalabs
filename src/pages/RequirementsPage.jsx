import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { Modal } from '../components/Modal'
import { useRequirements } from '../hooks/useRequirements'
import { useTestCases } from '../hooks/useTestCases'
import { useBugs } from '../hooks/useBugs'
import { RequirementBulkUploadModal } from '../components/RequirementBulkUploadModal'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import { normalizeTestStatus } from '../utils/status'
import { useUserRole } from '../hooks/useUserRole'
import { requirementMatchesSearch } from '../utils/entitySearch'
import { testCaseMatchesSearch } from '../utils/testCaseSearch'

const PRIORITIES = ['High', 'Medium', 'Low']

const blankForm = () => ({ key: '', title: '', description: '', priority: 'Medium', testCaseIds: [] })

// Coverage verdict for a requirement, from its linked (existing) test cases.
function coverageOf(req, tcById) {
  const linked = (req.testCaseIds || []).map((id) => tcById.get(id)).filter(Boolean)
  const total = linked.length
  const passed = linked.filter((t) => normalizeTestStatus(t.status) === 'Pass').length
  const failed = linked.filter((t) => ['Fail', 'Blocker'].includes(normalizeTestStatus(t.status))).length
  const pending = linked.filter((t) => normalizeTestStatus(t.status) === 'Not Executed').length
  let verdict
  if (total === 0) verdict = { label: 'Not covered', tone: 'failed' }
  else if (failed > 0) verdict = { label: 'Failing', tone: 'failed' }
  else if (passed === total) verdict = { label: 'Verified', tone: 'passed' }
  else verdict = { label: 'In progress', tone: 'pending' }
  const pct = total > 0 ? Math.round((passed / total) * 100) : 0
  return { linked, total, passed, failed, pending, verdict, pct }
}

export function RequirementsPage() {
  const { projectId, requirementId } = useParams()
  const { requirements, addRequirement, updateRequirement, removeRequirement } = useRequirements(projectId)
  const { testCases } = useTestCases(projectId)
  const { bugs } = useBugs(projectId)
  const { isLead } = useUserRole()
  const confirm = useConfirm()
  const toast = useToast()

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blankForm)
  const [tcSearch, setTcSearch] = useState('')
  const [search, setSearch] = useState('')
  const [showImport, setShowImport] = useState(false)

  const tcById = useMemo(() => new Map(testCases.map((tc) => [tc.id, tc])), [testCases])

  // Newest requirements first.
  const rows = [...requirements]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .map((req) => ({ req, cov: coverageOf(req, tcById) }))

  const filteredRows = useMemo(() => {
    return rows.filter(({ req }) => requirementMatchesSearch(req, search))
  }, [rows, search])

  const uncoveredCount = rows.filter(({ cov }) => cov.total === 0).length

  const totalReqs = requirements.length
  const coveredReqs = rows.filter((r) => r.cov.total > 0).length
  const verifiedReqs = rows.filter((r) => r.cov.verdict.label === 'Verified').length
  const failingReqs = rows.filter((r) => r.cov.verdict.label === 'Failing').length
  const verifiedPct = totalReqs ? Math.round((verifiedReqs / totalReqs) * 100) : 0

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const openAdd = () => { setEditing(null); setForm(blankForm()); setTcSearch(''); setShowForm(true) }
  const openEdit = (req) => {
    setEditing(req)
    setForm({
      key: req.key || '',
      title: req.title || '',
      description: req.description || '',
      priority: req.priority || 'Medium',
      testCaseIds: req.testCaseIds || [],
    })
    setTcSearch('')
    setShowForm(true)
  }

  const toggleTc = (id) => setForm((f) => ({
    ...f,
    testCaseIds: f.testCaseIds.includes(id) ? f.testCaseIds.filter((x) => x !== id) : [...f.testCaseIds, id],
  }))

  const submit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (editing) {
      updateRequirement({ ...editing, ...form, title: form.title.trim() })
      toast.success('Requirement updated')
    } else {
      addRequirement({ ...form, title: form.title.trim() })
      toast.success('Requirement added')
    }
    setShowForm(false)
  }

  const handleDelete = async (req) => {
    const ok = await confirm({
      title: 'Delete requirement?',
      message: `"${req.title}" will be removed. Linked test cases are not affected.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) { removeRequirement(req.id); toast.success('Requirement deleted') }
  }

  const filteredTcs = testCases.filter((tc) => {
    return testCaseMatchesSearch(tc, tcSearch)
  })

  if (requirementId) {
    const detail = rows.find(({ req }) => req.id === requirementId)
    if (!detail) {
      return (
        <>
          <PageHeader
            title="Requirement not found"
            description="This requirement may have been deleted or is no longer available."
            action={<Link to={`/projects/${projectId}/requirements`} className="secondary-button">Back to requirements</Link>}
          />
          <section className="empty-state">
            <h2>No matching requirement</h2>
            <p>Open the requirements list to review current coverage records.</p>
          </section>
        </>
      )
    }

    const { req, cov } = detail
    const linkedBugs = bugs.filter((b) => b.linkedRequirementId === req.id)
    return (
      <>
        <PageHeader
          title={req.key ? `${req.key}: ${req.title}` : req.title}
          description="Requirement coverage details and linked test cases."
          action={
            <div className="page-actions-row">
              <Link to={`/projects/${projectId}/requirements`} className="secondary-button">Back</Link>
              {cov.total > 0 && isLead && (
                <Link 
                  to={`/projects/${projectId}/test-runs?runCases=${req.testCaseIds.join(',')}&reqId=${req.id}&reqKey=${encodeURIComponent(req.key || '')}&reqTitle=${encodeURIComponent(req.title)}`} 
                  className="primary-button"
                  style={{ textDecoration: 'none' }}
                >
                  Run linked tests ({cov.total})
                </Link>
              )}
              <button className="secondary-button" type="button" onClick={() => openEdit(req)}>Edit requirement</button>
            </div>
          }
        />

        <section className="panel req-detail-page">
          <div className="req-detail-header">
            <div>
              <span className="mono tc-id">{req.key || 'Requirement'}</span>
              <h2>{req.title}</h2>
              {req.description && <p className="req-detail-desc">{req.description}</p>}
            </div>
            <StatusPill tone={cov.verdict.tone}>{cov.verdict.label}</StatusPill>
          </div>

          <div className="req-detail-meta">
            <div><span>Priority</span><strong>{req.priority || 'Medium'}</strong></div>
            <div><span>Linked cases</span><strong>{cov.total}</strong></div>
            <div><span>Passed</span><strong>{cov.passed}</strong></div>
            <div><span>Failed/blocking</span><strong>{cov.failed}</strong></div>
            <div><span>Progress</span><strong>{cov.pct}%</strong></div>
          </div>

          <div className="req-progress-cell req-detail-progress">
            <div className="req-progress-track">
              <span className="req-progress-fill" style={{ width: `${cov.pct}%` }} />
            </div>
            <span className="req-progress-pct">{cov.pct}%</span>
          </div>

          <div className="section-header req-detail-section-head">
            <h2>Linked test cases</h2>
            <StatusPill tone="neutral">{cov.total}</StatusPill>
          </div>

          {cov.linked.length === 0 ? (
            <div className="req-detail-empty">
              <p>No test cases are linked yet. Edit this requirement to add coverage.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>TC ID</th>
                    <th>Title</th>
                    <th>Module</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cov.linked.map((tc) => (
                    <tr key={tc.id}>
                      <td className="mono tc-id">{tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()}</td>
                      <td><Link className="text-link" to={`/projects/${projectId}/test-cases/${tc.id}`}>{tc.title}</Link></td>
                      <td>{tc.module || '—'}</td>
                      <td>{tc.priority || '—'}</td>
                      <td><StatusPill tone={normalizeTestStatus(tc.status) === 'Pass' ? 'passed' : ['Fail', 'Blocker'].includes(normalizeTestStatus(tc.status)) ? 'failed' : 'pending'}>{tc.status || 'Not Executed'}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="section-header req-detail-section-head">
            <h2>Linked bugs</h2>
            <StatusPill tone="neutral">{linkedBugs.length}</StatusPill>
          </div>

          {linkedBugs.length === 0 ? (
            <div className="req-detail-empty">
              <p>No bugs linked to this requirement yet.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Bug ID</th>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {linkedBugs.map((bug) => (
                    <tr key={bug.id}>
                      <td className="mono tc-id">{bug.sourceBugId || bug.id.slice(0, 8).toUpperCase()}</td>
                      <td><Link className="text-link" to={`/projects/${projectId}/bugs`}>{bug.title}</Link></td>
                      <td>{bug.severity || '—'}</td>
                      <td><StatusPill tone={bug.status === 'Closed' ? 'passed' : 'failed'}>{bug.status}</StatusPill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {showForm && (
          <Modal title={editing ? 'Edit requirement' : 'New requirement'} onClose={() => setShowForm(false)}>
            <form className="modal-form" onSubmit={submit}>
              <div className="form-row">
                <label>
                  Key
                  <input value={form.key} onChange={set('key')} placeholder="REQ-001 (optional)" />
                </label>
                <label>
                  Priority
                  <select value={form.priority} onChange={set('priority')}>
                    {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </label>
              </div>
              <label>
                Title <span className="required">*</span>
                <input autoFocus value={form.title} onChange={set('title')} placeholder="User can reset password via email" />
              </label>
              <label>
                Description
                <textarea rows={3} value={form.description} onChange={set('description')} placeholder="What this requirement means / acceptance criteria…" />
              </label>
              <div>
                <label>Linked test cases <span className="hint">({form.testCaseIds.length} selected)</span></label>
                <input
                  value={tcSearch}
                  onChange={(e) => setTcSearch(e.target.value)}
                  placeholder="Search test cases…"
                  style={{ marginBottom: 8 }}
                />
                <div className="req-tc-picker">
                  {testCases.length === 0 ? (
                    <p className="panel-empty-text">No test cases in this project yet.</p>
                  ) : filteredTcs.length === 0 ? (
                    <p className="panel-empty-text">No matches.</p>
                  ) : (
                    filteredTcs.map((tc) => (
                      <label key={tc.id} className="req-tc-option">
                        <input
                          className="row-checkbox"
                          type="checkbox"
                          checked={form.testCaseIds.includes(tc.id)}
                          onChange={() => toggleTc(tc.id)}
                        />
                        <span className="mono req-tc-id">{tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()}</span>
                        <span className="req-tc-title" title={tc.title}>{tc.title}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={!form.title.trim()}>
                  {editing ? 'Save' : 'Add requirement'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Requirements"
        description="Track which features are covered by tests and whether they pass."
        action={
          <div className="page-actions-row">
            <button className="secondary-button" type="button" onClick={() => setShowImport(true)}>Import CSV</button>
            <button className="primary-button" type="button" onClick={openAdd}>+ Add requirement</button>
          </div>
        }
      />

      {totalReqs > 0 && (
        <section className="req-coverage-strip">
          <div className="req-coverage-summary">
            <div className="req-coverage-hero">
              <span className="req-coverage-rate">{verifiedPct}<span className="req-coverage-pct">%</span></span>
              <div className="req-coverage-meta">
                <strong>verified</strong>
                <span>{verifiedReqs} of {totalReqs} requirements</span>
              </div>
            </div>
            <div className="req-coverage-bar">
              {totalReqs > 0 && (
                <>
                  {verifiedReqs > 0 && <span className="req-coverage-seg req-coverage-seg--verified" style={{ flex: verifiedReqs }} title={`Verified: ${verifiedReqs}`} />}
                  {(() => { const inProg = coveredReqs - verifiedReqs; return inProg > 0 && <span className="req-coverage-seg req-coverage-seg--inprogress" style={{ flex: inProg }} title={`In progress: ${inProg}`} /> })()}
                  {(() => { const uncovered = totalReqs - coveredReqs; return uncovered > 0 && <span className="req-coverage-seg req-coverage-seg--uncovered" style={{ flex: uncovered }} title={`Not covered: ${uncovered}`} /> })()}
                </>
              )}
            </div>
          </div>
          <div className="req-coverage-stats">
            <div className="req-stat">
              <span className="req-stat-dot req-stat-dot--total" />
              <span className="req-stat-label">Total</span>
              <strong>{totalReqs}</strong>
            </div>
            <div className="req-stat">
              <span className="req-stat-dot req-stat-dot--covered" />
              <span className="req-stat-label">Covered</span>
              <strong>{coveredReqs}</strong>
            </div>
            <div className="req-stat">
              <span className="req-stat-dot req-stat-dot--verified" />
              <span className="req-stat-label">Verified</span>
              <strong>{verifiedReqs}</strong>
            </div>
            <div className="req-stat">
              <span className="req-stat-dot req-stat-dot--failing" />
              <span className="req-stat-label">Failing</span>
              <strong>{failingReqs}</strong>
            </div>
            <div className="req-stat">
              <span className="req-stat-dot req-stat-dot--uncovered" />
              <span className="req-stat-label">Uncovered</span>
              <strong>{uncoveredCount}</strong>
            </div>
          </div>
        </section>
      )}

      <section className="panel">
        <div className="section-header">
          <h2>Requirements</h2>
          {totalReqs > 0 && <StatusPill tone="neutral">{totalReqs}</StatusPill>}
        </div>
        {totalReqs > 0 && (
          <div className="toolbar">
            <input
              type="search"
              placeholder="Search requirements…"
              aria-label="Search requirements"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

          </div>
        )}
        {totalReqs === 0 ? (
          <div className="req-empty-state">
            <div className="req-empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                <path d="m9 11 3 3L22 4" />
              </svg>
            </div>
            <h3>No requirements yet</h3>
            <p>Add your first requirement and link the test cases that verify it.</p>
            <button className="primary-button" type="button" onClick={openAdd}>+ Add requirement</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="req-table">
              <colgroup>
                <col className="req-col-key" />
                <col className="req-col-title" />
                <col className="req-col-priority" />
                <col className="req-col-coverage" />
                <col className="req-col-bar" />
                <col className="req-col-status" />
                <col className="req-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Requirement</th>
                  <th>Priority</th>
                  <th>Coverage</th>
                  <th>Progress</th>
                  <th>Status</th>
                  <th className="row-actions"></th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <span className="empty-table-message">No requirements match your search.</span>
                    </td>
                  </tr>
                ) : filteredRows.map(({ req, cov }) => (
                  <tr key={req.id}>
                    <td className="mono tc-id req-col-key-cell">
                      <Link className="text-link" to={`/projects/${projectId}/requirements/${req.id}`}>
                        {req.key || 'View'}
                      </Link>
                    </td>
                    <td className="title-cell req-col-title-cell">
                      <Link className="text-link" to={`/projects/${projectId}/requirements/${req.id}`} style={{ fontWeight: 700, textDecoration: 'none' }}>
                        {req.title}
                      </Link>
                      {req.description && <p className="req-desc" style={{ marginTop: '4px' }}>{req.description}</p>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select
                        className={`inline-select status-select priority-${(req.priority || 'medium').toLowerCase()}`}
                        value={req.priority || 'Medium'}
                        aria-label="Requirement priority"
                        onChange={(e) => updateRequirement({ ...req, priority: e.target.value })}
                      >
                        {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td>
                      {cov.total === 0
                        ? <span className="req-cov-none">No cases</span>
                        : <span className="req-cov-text">{cov.total} case{cov.total !== 1 ? 's' : ''} · {cov.passed} pass{cov.failed ? ` · ${cov.failed} fail` : ''}</span>
                      }
                    </td>
                    <td>
                      {cov.total > 0 ? (
                        <div className="req-progress-cell">
                          <div className="req-progress-track">
                            <span className="req-progress-fill" style={{ width: `${cov.pct}%` }} />
                          </div>
                          <span className="req-progress-pct">{cov.pct}%</span>
                        </div>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td><StatusPill tone={cov.verdict.tone}>{cov.verdict.label}</StatusPill></td>
                    <td className="row-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="row-actions-inner">
                        {cov.total > 0 && isLead && (
                          <Link 
                            className="icon-btn-action" 
                            to={`/projects/${projectId}/test-runs?runCases=${req.testCaseIds.join(',')}&reqId=${req.id}&reqKey=${encodeURIComponent(req.key || '')}&reqTitle=${encodeURIComponent(req.title)}`} 
                            title="Run linked tests"
                            aria-label="Run linked tests"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3" fill="#10b981" />
                            </svg>
                          </Link>
                        )}
                        <button className="icon-btn-action" type="button" aria-label="Edit requirement" title="Edit" onClick={() => openEdit(req)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className="icon-btn-action text-danger" type="button" aria-label="Delete requirement" title="Delete" onClick={() => handleDelete(req)}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <Modal title={editing ? 'Edit requirement' : 'New requirement'} onClose={() => setShowForm(false)}>
          <form className="modal-form" onSubmit={submit}>
            <div className="form-row">
              <label>
                Key
                <input value={form.key} onChange={set('key')} placeholder="REQ-001 (optional)" />
              </label>
              <label>
                Priority
                <select value={form.priority} onChange={set('priority')}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <label>
              Title <span className="required">*</span>
              <input autoFocus value={form.title} onChange={set('title')} placeholder="User can reset password via email" />
            </label>
            <label>
              Description
              <textarea rows={3} value={form.description} onChange={set('description')} placeholder="What this requirement means / acceptance criteria…" />
            </label>
            <div>
              <label>Linked test cases <span className="hint">({form.testCaseIds.length} selected)</span></label>
              <input
                value={tcSearch}
                onChange={(e) => setTcSearch(e.target.value)}
                placeholder="Search test cases…"
                style={{ marginBottom: 8 }}
              />
              <div className="req-tc-picker">
                {testCases.length === 0 ? (
                  <p className="panel-empty-text">No test cases in this project yet.</p>
                ) : filteredTcs.length === 0 ? (
                  <p className="panel-empty-text">No matches.</p>
                ) : (
                  filteredTcs.map((tc) => (
                    <label key={tc.id} className="req-tc-option">
                      <input
                        className="row-checkbox"
                        type="checkbox"
                        checked={form.testCaseIds.includes(tc.id)}
                        onChange={() => toggleTc(tc.id)}
                      />
                      <span className="mono req-tc-id">{tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()}</span>
                      <span className="req-tc-title" title={tc.title}>{tc.title}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => setShowForm(false)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={!form.title.trim()}>
                {editing ? 'Save' : 'Add requirement'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      <RequirementBulkUploadModal
        open={showImport}
        onClose={() => setShowImport(false)}
        testCases={testCases}
        projectId={projectId}
        onImport={(data) => addRequirement(data)}
      />
    </>
  )
}
