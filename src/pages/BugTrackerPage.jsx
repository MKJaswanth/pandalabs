import { useState } from 'react'
import { EvidenceLinksField } from '../components/EvidenceLinksField'
import { XIcon, ChevronLeftIcon, ChevronRightIcon, SortAscIcon, SortDescIcon, SortNoneIcon } from '../components/Icons'
import { useParams, useSearchParams } from 'react-router-dom'
import { Modal } from '../components/Modal'
import { TagInput, TagList } from '../components/TagInput'
import { PageHeader } from '../components/PageHeader'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import { useUser } from '../context/UserContext'
import { useBugs } from '../hooks/useBugs'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { useTestCases } from '../hooks/useTestCases'
import { useRequirements } from '../hooks/useRequirements'
import { useActivity } from '../hooks/useActivity'
import { useSortable } from '../hooks/useSortable'
import { newId } from '../utils/id'
import { downloadBugTemplate, getReporterName } from '../utils/export'
import { BugBulkUploadModal } from '../components/BugBulkUploadModal'
import { DownloadIcon, UploadIcon } from '../components/Icons'
import { useUserRole } from '../hooks/useUserRole'
import { bugMatchesSearch } from '../utils/entitySearch'

function SortTh({ col, label, active, dir, onSort }) {
  const isActive = active === col
  const Icon = isActive ? (dir === 'asc' ? SortAscIcon : SortDescIcon) : SortNoneIcon
  return (
    <th className={`sortable-th${isActive ? ' sortable-th--active' : ''}`} onClick={() => onSort(col)}>
      {label} <Icon width={12} height={12} />
    </th>
  )
}

const PAGE_SIZES = [10, 25, 100]

const SEVERITIES = ['Critical', 'Major', 'Minor']
const PRIORITIES = ['High', 'Medium', 'Low']
const STATUSES = ['Open', 'In review', 'Closed']
const RETEST_STATUSES = ['Not Retested', 'Passed', 'Failed']

const severityTone = { Critical: 'failed', Major: 'pending', Minor: 'passed' }
const bugStatusTone = { Open: 'failed', 'In review': 'pending', Closed: 'passed' }
const priorityClass = { High: 'priority-high', Medium: 'priority-med', Low: 'priority-low' }

const today = () => new Date().toISOString().slice(0, 10)

const blank = (prefillTcId = '') => ({
  title: '', description: '', severity: 'Major', status: 'Open', linkedTestCase: prefillTcId,
  linkedRequirementId: '',
  sourceBugId: '', module: '', stepsToReproduce: '', expected: '', actual: '',
  priority: 'Medium', environment: '', build: '', assignedTo: '',
  reportedBy: '', reportedDate: today(),
  fixedInBuild: '', retestStatus: 'Not Retested', devRemarks: '', qaRemarks: '',
  evidenceLinks: [], tags: [],
})

const shortId = (id) => id.slice(0, 8).toUpperCase()

function BugForm({ form, setForm, testCases, requirements = [], members, onCancel, onSubmit, submitLabel, history = [], activities = [], disabled = false, tagSuggestions = [] }) {
  const { user } = useUser()
  const set = (key) => (e) => setForm((c) => ({ ...c, [key]: e.target.value }))

  return (
    <form className="modal-form" onSubmit={onSubmit}>
      <fieldset disabled={disabled} style={{ border: 'none', padding: 0, margin: 0, display: 'contents' }}>
      <label>
        Title <span className="required">*</span>
        <input autoFocus value={form.title} onChange={set('title')} placeholder="Describe the defect" />
      </label>

      <div className="form-row">
        <label>
          Bug ID <span className="hint">(auto-assigned)</span>
          <input
            value={form.sourceBugId || 'Assigned automatically on save'}
            readOnly
            disabled
            className="input-disabled"
            aria-label="Bug ID (auto-assigned)"
          />
        </label>
        <label>
          Module
          <input value={form.module} onChange={set('module')} placeholder="e.g. Auth, Checkout" />
        </label>
      </div>

      <label>
        Description
        <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Brief summary of the defect" />
      </label>

      <label>
        Steps to Reproduce
        <textarea value={form.stepsToReproduce} onChange={set('stepsToReproduce')} rows={3} placeholder={'1. Go to…\n2. Click…\n3. Observe…'} />
      </label>

      <div className="form-row">
        <label>
          Expected Result
          <textarea value={form.expected} onChange={set('expected')} rows={2} placeholder="What should happen" />
        </label>
        <label>
          Actual Result
          <textarea value={form.actual} onChange={set('actual')} rows={2} placeholder="What actually happened" />
        </label>
      </div>

      <div className="form-row">
        <label>
          Severity
          <select value={form.severity} onChange={set('severity')}>
            {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Priority
          <select value={form.priority} onChange={set('priority')}>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
      </div>

      <div className="form-row">
        <label>
          Status
          <select value={form.status} onChange={set('status')}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>
          Retest Status
          <select value={form.retestStatus} onChange={set('retestStatus')}>
            {RETEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
      </div>

      <label>
        Linked test case
        <select value={form.linkedTestCase} onChange={set('linkedTestCase')}>
          <option value="">None</option>
          {testCases.map((tc) => (
            <option key={tc.id} value={tc.id}>{tc.title}</option>
          ))}
        </select>
      </label>

      <label>
        Linked requirement
        <select value={form.linkedRequirementId} onChange={set('linkedRequirementId')}>
          <option value="">None</option>
          {requirements.map((req) => (
            <option key={req.id} value={req.id}>{req.key ? `${req.key}: ` : ''}{req.title}</option>
          ))}
        </select>
      </label>

      <div className="form-row">
        <label>
          Assigned To
          <select value={form.assignedTo} onChange={set('assignedTo')}>
            <option value="">Unassigned</option>
            {members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
          </select>
        </label>
        <label>
          Reported By
          <input value={form.reportedBy} onChange={set('reportedBy')} placeholder="Reporter name" />
        </label>
      </div>

      <div className="form-row">
        <label>
          Reported Date
          <input type="date" value={form.reportedDate} onChange={set('reportedDate')} />
        </label>
        <label>
          Environment
          <input value={form.environment} onChange={set('environment')} placeholder="e.g. Staging, iOS 17" />
        </label>
      </div>

      <div className="form-row">
        <label>
          Build / Version
          <input value={form.build} onChange={set('build')} placeholder="e.g. v2.3.1" />
        </label>
        <label>
          Fixed In Build
          <input value={form.fixedInBuild} onChange={set('fixedInBuild')} placeholder="e.g. v2.3.2" />
        </label>
      </div>

      <div className="form-row">
        <label>
          Developer Remarks
          <textarea value={form.devRemarks} onChange={set('devRemarks')} rows={2} placeholder="Developer notes" />
        </label>
        <label>
          QA Remarks
          <textarea value={form.qaRemarks} onChange={set('qaRemarks')} rows={2} placeholder="QA notes" />
        </label>
      </div>

      <label>
        Tags
        <TagInput
          id="bug-tags"
          value={form.tags || []}
          onChange={(tags) => setForm((c) => ({ ...c, tags }))}
          suggestions={tagSuggestions}
          placeholder="e.g. regression, flaky, P1…"
        />
      </label>

      <div>
        <label>Evidence links</label>
        <EvidenceLinksField
          evidenceLinks={form.evidenceLinks || []}
          onChange={(evidenceLinks) => setForm((c) => ({ ...c, evidenceLinks }))}
          currentUser={user}
        />
      </div>

      {(activities.length > 0 || history.length > 0) && (
        <div className="bug-history">
          <h3>Activity log</h3>
          <div className="history-list">
            {activities.length > 0 ? (
              activities.map((entry) => (
                <div key={entry.id} className="history-entry">
                  <span className="history-details">
                    <strong>{entry.actorName || 'System'}</strong>: {entry.title}
                    {entry.details && (
                      <span className="history-detail-sub">
                        {entry.details}
                      </span>
                    )}
                  </span>
                  <span className="history-meta">
                    {entry.actorName || 'Unknown user'} • {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
              ))
            ) : (
              history.slice().reverse().map((entry) => (
                <div key={entry.id} className="history-entry">
                  <span className="history-details">{entry.details}</span>
                  <span className="history-meta">
                    {entry.user || 'Unknown user'} • {new Date(entry.timestamp).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      </fieldset>

      <div className="modal-footer">
        <button type="button" className="secondary-button" onClick={onCancel}>{disabled ? 'Close' : 'Cancel'}</button>
        {!disabled && <button type="submit" className="primary-button">{submitLabel}</button>}
      </div>
    </form>
  )
}

export function BugTrackerPage() {
  const { projectId } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useUser()
  const { isTester, isViewer } = useUserRole()
  const { bugs, addBug, removeBug, updateBug } = useBugs(projectId)
  const { testCases } = useTestCases(projectId)
  const { requirements } = useRequirements(projectId)
  const { members } = useTeamMembers()
  const { getActivitiesByEntity } = useActivity()
  const confirm = useConfirm()
  const toast = useToast()

  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(blank)
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [fSeverity, setFSeverity] = useState(() => searchParams.get('severity') || '')
  const [fStatus, setFStatus] = useState(() => searchParams.get('status') || '')
  const [fModule, setFModule] = useState(() => searchParams.get('module') || '')
  const [fAssignee, setFAssignee] = useState(() => searchParams.get('assignee') || '')
  const [fTag, setFTag] = useState(() => searchParams.get('tag') || '')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const { sorted: sortedBugs, sortKey: bugSortKey, sortDir: bugSortDir, toggle: bugToggle } = useSortable(bugs)

  const openAdd = () => {
    setForm({ ...blank(), reportedBy: user })
    setShowAdd(true)
  }

  const openEdit = (bug) => {
    setEditing(bug)
    setForm({
      title:            bug.title,
      description:      bug.description || '',
      severity:         bug.severity,
      status:           bug.status,
      linkedTestCase:   bug.linkedTestCase || '',
      linkedRequirementId: bug.linkedRequirementId || '',
      sourceBugId:      bug.sourceBugId || '',
      module:           bug.module || '',
      stepsToReproduce: bug.stepsToReproduce || '',
      expected:         bug.expected || '',
      actual:           bug.actual || '',
      priority:         bug.priority || 'Medium',
      environment:      bug.environment || '',
      build:            bug.build || '',
      assignedTo:       bug.assignedTo || '',
      reportedBy:       getReporterName(bug.reportedBy, bug.reportedByName),
      reportedDate:     bug.reportedDate || today(),
      fixedInBuild:     bug.fixedInBuild || '',
      retestStatus:     bug.retestStatus || 'Not Retested',
      devRemarks:       bug.devRemarks || '',
      qaRemarks:        bug.qaRemarks || '',
      evidenceLinks:    bug.evidenceLinks || [],
      tags:             bug.tags || [],
    })
  }

  const recordHistory = (bug, type, details, from, to) => {
    const entry = { id: newId(), type, user, timestamp: new Date().toISOString(), details, from, to }
    return { ...bug, history: [...(bug.history || []), entry] }
  }

  const handleAdd = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    const initialHistory = {
      id: newId(), type: 'created', user,
      timestamp: new Date().toISOString(), details: 'Bug created',
    }
    addBug({ ...form, history: [initialHistory] })
    setShowAdd(false)
    toast.success('Bug logged')
  }

  const handleEdit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return

    let updatedBug = { ...editing, ...form }

    if (editing.status !== form.status) {
      updatedBug = recordHistory(
        updatedBug, 'status_change',
        `Status changed from ${editing.status} to ${form.status}`,
        editing.status, form.status
      )
    } else {
      const changed = Object.keys(form).some(
        (k) => k !== 'status' && String(editing[k] ?? '') !== String(form[k] ?? '')
      )
      if (changed) updatedBug = recordHistory(updatedBug, 'update', 'Bug details updated')
    }

    updateBug(updatedBug)
    setEditing(null)
    toast.success('Bug updated')
  }

  const handleInlineStatusChange = (bug, newStatus) => {
    const updated = recordHistory(
      { ...bug, status: newStatus },
      'status_change',
      `Status changed from ${bug.status} to ${newStatus}`,
      bug.status, newStatus
    )
    updateBug(updated)
  }

  const handleInlinePriorityChange = (bug, newPriority) => {
    const updated = recordHistory(
      { ...bug, priority: newPriority },
      'priority_change',
      `Priority changed from ${bug.priority ?? 'Medium'} to ${newPriority}`,
      bug.priority ?? 'Medium', newPriority
    )
    updateBug(updated)
  }

  const handleInlineSeverityChange = (bug, newSeverity) => {
    const updated = recordHistory(
      { ...bug, severity: newSeverity },
      'severity_change',
      `Severity changed from ${bug.severity} to ${newSeverity}`,
      bug.severity, newSeverity
    )
    updateBug(updated)
  }


  const bugModules = [...new Set(bugs.map((b) => b.module).filter(Boolean))]
  const bugAssignees = [...new Set(bugs.map((b) => b.assignedTo).filter(Boolean))]
  const allTags = [...new Set(bugs.flatMap((b) => b.tags || []))].sort((a, b) => a.localeCompare(b))

  const visible = sortedBugs.filter((b) => {
    if (!bugMatchesSearch(b, search)) return false
    if (fSeverity && b.severity !== fSeverity) return false
    if (fStatus && b.status !== fStatus) return false
    if (fModule && b.module !== fModule) return false
    if (fAssignee && b.assignedTo !== fAssignee) return false
    if (fTag && !(b.tags || []).includes(fTag)) return false
    return true
  })
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const pagedBugs = visible.slice(startIndex, startIndex + pageSize)
  const rangeStart = visible.length === 0 ? 0 : startIndex + 1
  const rangeEnd = Math.min(startIndex + pageSize, visible.length)

  const updateListControl = (setter) => (e) => { setter(e.target.value); setPage(1) }
  const clearFilters = () => { setSearch(''); setFSeverity(''); setFStatus(''); setFModule(''); setFAssignee(''); setFTag(''); setPage(1) }
  const activeFilterCount = [search, fSeverity, fStatus, fModule, fAssignee, fTag].filter(Boolean).length
  const filterByTag = (tag) => { setFTag((cur) => (cur === tag ? '' : tag)); setPage(1) }

  return (
    <>
      <PageHeader
        title="Bug tracker"
        description="Track defects by severity, status, and linked test case."
        action={
          <div className="page-actions-row">
            <button className="secondary-button" type="button" onClick={downloadBugTemplate}>
              <DownloadIcon width={14} height={14} /> Bug template
            </button>
            {!isViewer && (
              <>
                <button className="secondary-button" type="button" onClick={() => setShowImport(true)}>
                  <UploadIcon width={14} height={14} /> Import bugs
                </button>
                <button className="primary-button" type="button" onClick={openAdd}>+ Log bug</button>
              </>
            )}
          </div>
        }
      />

      <section className="panel">
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search bugs…"
            aria-label="Search bugs"
            value={search}
            onChange={updateListControl(setSearch)}
          />
          <select aria-label="Severity filter" value={fSeverity} onChange={updateListControl(setFSeverity)} className={fSeverity ? 'filter-active' : ''}>
            <option value="">Severity</option>
            {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select aria-label="Status filter" value={fStatus} onChange={updateListControl(setFStatus)} className={fStatus ? 'filter-active' : ''}>
            <option value="">Status</option>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          {bugModules.length > 0 && (
            <select aria-label="Module filter" value={fModule} onChange={updateListControl(setFModule)} className={fModule ? 'filter-active' : ''}>
              <option value="">Module</option>
              {bugModules.map((m) => <option key={m}>{m}</option>)}
            </select>
          )}
          {bugAssignees.length > 0 && (
            <select aria-label="Assignee filter" value={fAssignee} onChange={updateListControl(setFAssignee)} className={fAssignee ? 'filter-active' : ''}>
              <option value="">Assignee</option>
              {bugAssignees.map((a) => <option key={a}>{a}</option>)}
            </select>
          )}
          {allTags.length > 0 && (
            <select aria-label="Tag filter" value={fTag} onChange={updateListControl(setFTag)} className={fTag ? 'filter-active' : ''}>
              <option value="">Tag</option>
              {allTags.map((t) => <option key={t}>{t}</option>)}
            </select>
          )}
          <div className="toolbar-info">
            {activeFilterCount > 0 && (
              <button className="filter-clear-btn" type="button" onClick={clearFilters}>
                Clear ({activeFilterCount})
              </button>
            )}
            <span>{visible.length} of {sortedBugs.length}</span>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="empty-table-row">No bugs found.</div>
        ) : (
          <>
          <div className="table-wrap">
            <table className="bug-table">
              <colgroup>
                <col className="bug-col-id" />
                <col className="bug-col-title" />
                <col className="bug-col-module" />
                <col className="bug-col-severity" />
                <col className="bug-col-priority" />
                <col className="bug-col-status" />
                <col className="bug-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>Bug ID</th>
                  <SortTh col="title"    label="Title"    active={bugSortKey} dir={bugSortDir} onSort={bugToggle} />
                  <SortTh col="module"   label="Module"   active={bugSortKey} dir={bugSortDir} onSort={bugToggle} />
                  <SortTh col="severity" label="Severity" active={bugSortKey} dir={bugSortDir} onSort={bugToggle} />
                  <SortTh col="priority" label="Priority" active={bugSortKey} dir={bugSortDir} onSort={bugToggle} />
                  <SortTh col="status"   label="Status"   active={bugSortKey} dir={bugSortDir} onSort={bugToggle} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedBugs.map((bug) => (
                  <tr key={bug.id}>
                    <td className="mono tc-id">{bug.sourceBugId || shortId(bug.id)}</td>
                    <td className="title-cell">
                      <button className="link-btn" type="button" onClick={() => openEdit(bug)}>{bug.title}</button>
                      {bug.description && <p className="bug-desc">{bug.description}</p>}
                      {(bug.environment || bug.build) && (
                        <p className="bug-desc text-muted">
                          {[bug.environment, bug.build].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <TagList tags={bug.tags} onTagClick={filterByTag} activeTag={fTag} />
                    </td>
                    <td>{bug.module || '—'}</td>
                    <td>
                      <select
                        className={`inline-select status-select status-select--${severityTone[bug.severity] || 'neutral'}`}
                        value={bug.severity}
                        aria-label="Bug severity"
                        disabled={isViewer}
                        onChange={(e) => handleInlineSeverityChange(bug, e.target.value)}
                      >
                        {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        className={`inline-select status-select ${priorityClass[bug.priority ?? 'Medium'] ?? 'priority-med'}`}
                        value={bug.priority ?? 'Medium'}
                        aria-label="Bug priority"
                        disabled={isViewer}
                        onChange={(e) => handleInlinePriorityChange(bug, e.target.value)}
                      >
                        {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        className={`inline-select status-select status-select--${bugStatusTone[bug.status] || 'neutral'}`}
                        value={bug.status}
                        aria-label="Bug status"
                        disabled={isViewer}
                        onChange={(e) => handleInlineStatusChange(bug, e.target.value)}
                      >
                        {STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      {!isTester && (
                        <button
                          className="row-delete"
                          type="button"
                          aria-label="Delete bug"
                          onClick={async () => {
                            const ok = await confirm({ title: 'Delete bug?', message: `"${bug.title}" will be permanently removed.`, confirmLabel: 'Delete', danger: true })
                            if (ok) { removeBug(bug.id); toast.success('Bug deleted') }
                          }}
                        >
                          <XIcon width={12} height={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-card-list">
            {pagedBugs.map((bug) => (
              <div className="mobile-card" key={bug.id}>
                <div className="mobile-card-header">
                  <span className="mono tc-id">{bug.sourceBugId || shortId(bug.id)}</span>
                  <div className="mobile-card-header-badges">
                    <select
                      className={`inline-select status-select status-select--${severityTone[bug.severity] || 'neutral'}`}
                      value={bug.severity}
                      aria-label="Bug severity"
                      disabled={isViewer}
                      onChange={(e) => handleInlineSeverityChange(bug, e.target.value)}
                    >
                      {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                    <select
                      className="inline-select status-select status-select--neutral"
                      value={bug.status}
                      aria-label="Bug status"
                      disabled={isViewer}
                      onChange={(e) => handleInlineStatusChange(bug, e.target.value)}
                    >
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <h3 className="mobile-card-title">
                  <button className="link-btn" type="button" onClick={() => openEdit(bug)}>{bug.title}</button>
                </h3>
                {bug.description && <p className="mobile-card-desc">{bug.description}</p>}
                <TagList tags={bug.tags} onTagClick={filterByTag} activeTag={fTag} />
                <div className="mobile-card-details">
                  <div>
                    <span>Severity:</span>
                    <strong>{bug.severity}</strong>
                  </div>
                  <div>
                    <span>Priority:</span>
                    <strong>
                      <select
                        className={`inline-select status-select ${priorityClass[bug.priority ?? 'Medium'] ?? 'priority-med'}`}
                        value={bug.priority ?? 'Medium'}
                        aria-label="Bug priority"
                        disabled={isViewer}
                        onChange={(e) => handleInlinePriorityChange(bug, e.target.value)}
                      >
                        {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </strong>
                  </div>
                  <div>
                    <span>Module:</span>
                    <strong>{bug.module || '—'}</strong>
                  </div>
                  {(bug.environment || bug.build) && (
                    <div>
                      <span>Env/Build:</span>
                      <strong>{[bug.environment, bug.build].filter(Boolean).join(' · ')}</strong>
                    </div>
                  )}
                </div>
                <div className="mobile-card-actions">
                  <button className="secondary-button mobile-card-action-btn" type="button" onClick={() => openEdit(bug)}>
                    Open & Edit
                  </button>
                  {!isTester && (
                    <button className="danger-button mobile-card-action-btn" type="button"
                      onClick={async () => {
                        const ok = await confirm({ title: 'Delete bug?', message: `"${bug.title}" will be permanently removed.`, confirmLabel: 'Delete', danger: true })
                        if (ok) { removeBug(bug.id); toast.success('Bug deleted') }
                      }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="table-pagination" aria-label="Table pagination">
            <div className="rows-per-page">
              <span>Rows</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }}
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <span className="pagination-summary">{rangeStart}-{rangeEnd} of {visible.length}</span>
            <div className="pagination-actions">
              <button className="secondary-button icon-button" type="button" aria-label="Previous page" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>
                <ChevronLeftIcon width={14} height={14} />
              </button>
              <span className="page-indicator">{currentPage} / {totalPages}</span>
              <button className="secondary-button icon-button" type="button" aria-label="Next page" disabled={currentPage === totalPages} onClick={() => setPage(Math.min(totalPages, currentPage + 1))}>
                <ChevronRightIcon width={14} height={14} />
              </button>
            </div>
          </div>
          </>
        )}
      </section>

      {showAdd && (
        <Modal title="Log bug" onClose={() => setShowAdd(false)}>
          <BugForm
            form={form}
            setForm={setForm}
            testCases={testCases}
            requirements={requirements}
            members={members}
            onCancel={() => setShowAdd(false)}
            onSubmit={handleAdd}
            submitLabel="Log bug"
            tagSuggestions={allTags}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={isViewer ? 'Bug details' : 'Edit bug'} onClose={() => setEditing(null)}>
          <BugForm
            form={form}
            setForm={setForm}
            testCases={testCases}
            requirements={requirements}
            members={members}
            history={editing.history}
            activities={getActivitiesByEntity('bug', editing.id)}
            onCancel={() => setEditing(null)}
            onSubmit={handleEdit}
            submitLabel="Save changes"
            disabled={isViewer}
            tagSuggestions={allTags}
          />
        </Modal>
      )}

      {showImport && (
        <BugBulkUploadModal
          existingBugs={bugs}
          testCases={testCases}
          onImport={addBug}
          onClose={() => setShowImport(false)}
        />
      )}
    </>
  )
}
