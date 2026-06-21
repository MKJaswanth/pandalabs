import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { EvidenceLinksField } from '../components/EvidenceLinksField'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { StatusPill } from '../components/StatusPill'
import { StepBuilder } from '../components/StepBuilder'
import { TagInput, TagList } from '../components/TagInput'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import { useUser } from '../context/UserContext'
import { useBugs } from '../hooks/useBugs'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { useTestCases } from '../hooks/useTestCases'
import { useActivity } from '../hooks/useActivity'
import { useSharedSteps } from '../hooks/useSharedSteps'
import { describeTestCaseChanges, historyEntry, withHistory } from '../utils/history'
import { newId } from '../utils/id'
import { STATUS_TONE, TEST_STATUSES } from '../utils/status'
import { ArrowRightIcon } from '../components/Icons'
import { useUserRole } from '../hooks/useUserRole'

const severityTone = { Critical: 'failed', Major: 'pending', Minor: 'passed' }
const PRIORITIES = ['High', 'Med', 'Low']
const SEVERITIES = ['Critical', 'Major', 'Minor']
const BUG_STATUSES = ['Open', 'In review', 'Closed']

export function TestCaseDetailPage() {
  const { projectId, testCaseId } = useParams()
  const { user } = useUser()
  const { isLead } = useUserRole()
  const { testCases, updateTestCase, removeTestCase } = useTestCases(projectId)
  const { bugs, addBug } = useBugs(projectId)
  const { members } = useTeamMembers()
  const { activities } = useActivity()
  const { sharedSteps } = useSharedSteps(projectId)
  const navigate = useNavigate()
  const confirm = useConfirm()
  const toast = useToast()

  const tc = testCases.find((t) => t.id === testCaseId)

  const resolveUserUid = (uid, nameFallback) => {
    if (!uid) return nameFallback || ''
    const isUid = /^[a-zA-Z0-9]{20,36}$/.test(uid)
    if (isUid && nameFallback) return nameFallback
    if (!isUid) return uid
    const act = activities.find((a) => a.actorId === uid)
    if (act && act.actorName) return act.actorName
    const member = members.find((m) => m.id === uid)
    if (member) return member.name
    return nameFallback || uid
  }

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState(null)
  const [showLogBug, setShowLogBug] = useState(false)
  const [bugForm, setBugForm] = useState(null)

  if (!tc) {
    return (
      <section className="empty-state">
        <h2>Test case not found</h2>
        <p>It may have been deleted.</p>
      </section>
    )
  }

  const steps = Array.isArray(tc.steps) ? tc.steps : []
  const linkedBugs = bugs.filter((b) => b.linkedTestCase === testCaseId)
  const allTags = [...new Set(testCases.flatMap((t) => t.tags || []))].sort((a, b) => a.localeCompare(b))

  const openEdit = () => {
    setForm({
      title: tc.title, module: tc.module || '', scenario: tc.scenario || '',
      preconditions: tc.preconditions || '', priority: tc.priority || 'Med',
      assignee: tc.assignee || '', steps: steps.length ? [...steps] : [''],
      testData: tc.testData || '', expected: tc.expected || '', actual: tc.actual || '',
      status: tc.status, devRemarks: tc.devRemarks || '', qaRemarks: tc.qaRemarks || '',
      evidenceLinks: tc.evidenceLinks || [],
      tags: tc.tags || [],
    })
    setEditing(true)
  }

  const handleSave = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const updated = {
      ...tc,
      ...form,
      steps: form.steps.filter(Boolean),
      updatedAt: new Date().toISOString(),
      updatedBy: user,
    }
    const changes = describeTestCaseChanges(tc, updated)
    updateTestCase(changes.length
      ? withHistory(updated, historyEntry('update', user, changes.join(', ')))
      : updated)
    setEditing(false)
    toast.success('Test case saved')
  }

  const openLogBug = () => {
    setBugForm({ title: '', description: '', severity: 'Major', status: 'Open', linkedTestCase: testCaseId, evidenceLinks: [] })
    setShowLogBug(true)
  }

  const handleLogBug = (e) => {
    e.preventDefault()
    if (!bugForm.title.trim()) return

    const initialHistory = {
      id: newId(),
      type: 'created',
      user,
      timestamp: new Date().toISOString(),
      details: 'Bug created (via Test Case)',
    }

    addBug({ ...bugForm, history: [initialHistory] })
    setShowLogBug(false)
    toast.success('Bug logged')
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Delete test case?',
      message: `"${tc.title}" will be permanently removed.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return
    removeTestCase(tc.id)
    toast.success('Test case deleted')
    navigate(`/projects/${projectId}/test-cases`)
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setBug = (k) => (e) => setBugForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <>
      <PageHeader
        title={tc.title}
        description={tc.module ? `Module: ${tc.module}` : 'No module'}
        action={
          isLead && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="secondary-button" type="button" onClick={openEdit}>Edit</button>
              <select
                className="secondary-button"
                value={tc.status}
                aria-label="Set status"
                onChange={(e) => updateTestCase(withHistory(
                  { ...tc, status: e.target.value, updatedAt: new Date().toISOString(), updatedBy: user },
                  historyEntry('status_change', user, `Status changed from ${tc.status} to ${e.target.value}`, tc.status, e.target.value),
                ))}
              >
                {TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <button
                className="danger-button"
                type="button"
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          )
        }
      />

      <section className="detail-layout">
        <div className="detail-main-col">
          {/* Main Info */}
          <div className="panel detail-main">
            <div className="detail-title-row">
              <h2>Overview</h2>
              <StatusPill tone={STATUS_TONE[tc.status]}>{tc.status}</StatusPill>
            </div>
            
            <div className="detail-content-grid">
              <div className="detail-block">
                <h3>Scenario</h3>
                <p>{tc.scenario || <em className="text-muted">No scenario defined.</em>}</p>
              </div>
              
              <div className="detail-block">
                <h3>Pre-conditions</h3>
                <p className={tc.preconditions ? '' : 'text-muted'}>
                  {tc.preconditions || 'None'}
                </p>
              </div>
            </div>
          </div>

          {/* Steps */}
          <div className="panel detail-main">
            <div className="detail-title-row">
              <h2>Steps</h2>
            </div>
            {steps.length === 0 ? (
              <p className="detail-empty">
                No steps defined.
                {isLead && (
                  <>
                    {' '}
                    <button className="link-btn" onClick={openEdit}>Add steps <ArrowRightIcon width={14} height={14} /></button>
                  </>
                )}
              </p>
            ) : (
              <ol className="step-list">
                {steps.map((step, i) => {
                  const isSharedRef = typeof step === 'string' && step.startsWith('shared_step_group:')
                  if (isSharedRef) {
                    const groupId = step.split(':')[1]
                    const group = sharedSteps.find((g) => g.id === groupId)
                    return (
                      <li key={i} className="shared-step-display-item">
                        <div className="shared-step-display-header">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, color: 'var(--primary-color, #1a73e8)' }}>
                            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                          </svg>
                          <strong>{group ? group.name : 'Deleted Shared Step Group'}</strong>
                          <span className="shared-badge">Shared block</span>
                        </div>
                        {group?.steps && (
                          <ol className="shared-step-display-list">
                            {group.steps.map((nested, nIdx) => (
                              <li key={nIdx}>{nested}</li>
                            ))}
                          </ol>
                        )}
                      </li>
                    )
                  }
                  return <li key={i}>{step}</li>
                })}
              </ol>
            )}
          </div>

          {/* Results & Data */}
          <div className="panel detail-main">
            <div className="detail-title-row">
              <h2>Results & Data</h2>
            </div>
            <div className="detail-content-grid">
              <div className="detail-block">
                <h3>Test Data</h3>
                <p className={tc.testData ? 'mono' : 'text-muted'}>{tc.testData || 'None'}</p>
              </div>
              <div className="detail-block">
                <h3>Expected Result</h3>
                <p>{tc.expected || '—'}</p>
              </div>
            </div>
          </div>

          {/* Remarks */}
          {(tc.devRemarks || tc.qaRemarks) && (
            <div className="panel detail-main">
              <div className="detail-title-row">
                <h2>Remarks</h2>
              </div>
              <div className="detail-content-grid">
                {tc.devRemarks && (
                  <div className="detail-block">
                    <h3>Developer Remarks</h3>
                    <p>{tc.devRemarks}</p>
                  </div>
                )}
                {tc.qaRemarks && (
                  <div className="detail-block">
                    <h3>QA Remarks</h3>
                    <p>{tc.qaRemarks}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Evidence links */}
          {tc.evidenceLinks && tc.evidenceLinks.length > 0 && (
            <div className="panel detail-main">
              <div className="detail-title-row">
                <h2>Evidence links</h2>
              </div>
              <div className="attachment-list">
                {tc.evidenceLinks.map((link) => (
                  <div key={link.id} className="attachment-item-wrap">
                    <div className="attachment-item">
                      <span className="attachment-icon">
                        {link.isLegacy ? '📎' : '🔗'}
                      </span>
                      <div className="attachment-info">
                        {link.url ? (
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="attachment-name"
                            style={{ textDecoration: 'underline', color: 'var(--primary-color, #1a73e8)' }}
                          >
                            {link.label}
                          </a>
                        ) : (
                          <span className="attachment-name" style={{ color: 'var(--text-muted, #5f6368)' }}>
                            {link.label}
                          </span>
                        )}
                        <span className="attachment-size">
                          {link.url ? new URL(link.url).hostname : 'No Link'}
                          {link.addedBy && ` • Added by ${link.addedBy}`}
                          {link.addedAt && ` on ${new Date(link.addedAt).toLocaleDateString()}`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Linked bugs */}
          <div className="panel">
            <div className="section-header">
              <h2>Linked bugs <span className="count-badge">{linkedBugs.length}</span></h2>
              <button className="secondary-button" type="button" onClick={openLogBug}>
                + Log bug
              </button>
            </div>
            {linkedBugs.length === 0 ? (
              <div className="empty-table-row">No bugs linked to this test case.</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Bug ID</th><th>Title</th><th>Severity</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {linkedBugs.map((bug) => (
                      <tr key={bug.id}>
                        <td className="mono tc-id">{bug.sourceBugId || bug.id.slice(0, 8).toUpperCase()}</td>
                        <td className="title-cell">
                          <Link to={`/projects/${projectId}/bugs`} className="bug-title-link">
                            {bug.title}
                          </Link>
                        </td>
                        <td><StatusPill tone={severityTone[bug.severity]}>{bug.severity}</StatusPill></td>
                        <td>
                          <span className={`bug-status-text bug-status--${bug.status.toLowerCase().replace(' ', '-')}`}>
                            {bug.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        <aside className="panel detail-aside">
          <dl>
            <div><dt>Priority</dt><dd><span className={`priority-badge priority-${tc.priority?.toLowerCase()}`}>{tc.priority || '—'}</span></dd></div>
            <div><dt>Assignee</dt><dd>{tc.assignee || '—'}</dd></div>
            {tc.tags?.length > 0 && (
              <div><dt>Tags</dt><dd><TagList tags={tc.tags} /></dd></div>
            )}
            <div><dt>Actual result</dt><dd className={tc.actual ? '' : 'text-muted'}>{tc.actual || 'Not recorded'}</dd></div>
            <div><dt>Bugs</dt><dd>{linkedBugs.length} linked</dd></div>
            <div>
              <dt>Created</dt>
              <dd>
                {tc.createdAt ? new Date(tc.createdAt).toLocaleDateString() : '—'}
                {(tc.createdBy || tc.createdByName) && (
                  <span className="text-muted"> by {resolveUserUid(tc.createdBy, tc.createdByName)}</span>
                )}
              </dd>
            </div>
            <div>
              <dt>Last update</dt>
              <dd>
                {tc.updatedAt ? new Date(tc.updatedAt).toLocaleDateString() : (tc.createdAt ? new Date(tc.createdAt).toLocaleDateString() : '—')}
                {(tc.updatedBy || tc.updatedByName || tc.createdBy || tc.createdByName) && (
                  <span className="text-muted"> by {resolveUserUid(tc.updatedBy || tc.createdBy, tc.updatedByName || tc.createdByName)}</span>
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-md">
            <Link className="text-link" to={`/projects/${projectId}/bugs`}>
              View all bugs →
            </Link>
          </div>
        </aside>
      </section>

      {/* Edit TC modal */}
      {editing && form && (
        <Modal title="Edit test case" onClose={() => setEditing(false)}>
          <form className="modal-form" onSubmit={handleSave}>
            <label>Title <span className="required">*</span>
              <input autoFocus value={form.title} onChange={set('title')} />
            </label>
            <div className="form-row">
              <label>Module<input value={form.module} onChange={set('module')} placeholder="Auth, E2E…" /></label>
              <label>Priority
                <select value={form.priority} onChange={set('priority')}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <label>Test Scenario
              <input value={form.scenario} onChange={set('scenario')} placeholder="High-level scenario" />
            </label>
            <label>Pre-conditions
              <textarea rows={2} value={form.preconditions} onChange={set('preconditions')} placeholder="What must be true before this test runs?" />
            </label>
            <label>Steps</label>
            <StepBuilder steps={form.steps} onChange={(steps) => setForm((f) => ({ ...f, steps }))} sharedSteps={sharedSteps} />
            <label>Test Data
              <input value={form.testData} onChange={set('testData')} placeholder="Input values, credentials…" />
            </label>
            <label>Expected result<input value={form.expected} onChange={set('expected')} placeholder="What should happen?" /></label>
            <label>Actual result<input value={form.actual} onChange={set('actual')} placeholder="What actually happened?" /></label>
            <div className="form-row">
              <label>Status
                <select value={form.status} onChange={set('status')}>
                  {TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>Assignee
                <select value={form.assignee} onChange={set('assignee')}>
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>Dev Remarks<input value={form.devRemarks} onChange={set('devRemarks')} placeholder="Notes from developer" /></label>
              <label>QA Remarks<input value={form.qaRemarks} onChange={set('qaRemarks')} placeholder="Notes from QA" /></label>
            </div>
            <label>Tags
              <TagInput
                id="tc-detail-tags"
                value={form.tags || []}
                onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                suggestions={allTags}
                placeholder="e.g. smoke, regression, mobile…"
              />
            </label>
            <div>
              <label>Evidence links</label>
              <EvidenceLinksField
                evidenceLinks={form.evidenceLinks || []}
                onChange={(evidenceLinks) => setForm((f) => ({ ...f, evidenceLinks }))}
                currentUser={user}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="primary-button">Save changes</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Log bug modal pre-filled with this TC */}
      {showLogBug && bugForm && (
        <Modal title="Log bug" onClose={() => setShowLogBug(false)}>
          <form className="modal-form" onSubmit={handleLogBug}>
            <label>Title <span className="required">*</span>
              <input autoFocus value={bugForm.title} onChange={setBug('title')} placeholder="Describe the defect" />
            </label>
            <label>Description
              <textarea value={bugForm.description} onChange={setBug('description')} rows={3} placeholder="Steps to reproduce, environment, notes…" />
            </label>
            <div className="form-row">
              <label>Severity
                <select value={bugForm.severity} onChange={setBug('severity')}>
                  {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>Status
                <select value={bugForm.status} onChange={setBug('status')}>
                  {BUG_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <label>Linked test case
              <input value={tc.title} disabled className="input-disabled" />
            </label>
            <div>
              <label>Evidence links</label>
              <EvidenceLinksField
                evidenceLinks={bugForm.evidenceLinks || []}
                onChange={(evidenceLinks) => setBugForm((f) => ({ ...f, evidenceLinks }))}
                currentUser={user}
              />
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={() => setShowLogBug(false)}>Cancel</button>
              <button type="submit" className="primary-button">Log bug</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
