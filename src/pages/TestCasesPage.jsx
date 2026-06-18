import { useMemo, useState } from 'react'
import { UploadIcon, DownloadIcon, PencilIcon, CopyIcon, XIcon, ChevronLeftIcon, ChevronRightIcon, SortAscIcon, SortDescIcon, SortNoneIcon } from '../components/Icons'
import { useSortable } from '../hooks/useSortable'
import { Link, useParams } from 'react-router-dom'
import { BulkUploadModal } from '../components/BulkUploadModal'
import { Modal } from '../components/Modal'
import { PageHeader } from '../components/PageHeader'
import { StepBuilder } from '../components/StepBuilder'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { useTestCases } from '../hooks/useTestCases'
import { useProjects } from '../hooks/useProjects'
import { useUser } from '../context/UserContext'
import { describeTestCaseChanges, historyEntry, withHistory } from '../utils/history'
import { STATUS_TONE, TEST_STATUSES } from '../utils/status'
import { exportTestCases } from '../utils/export'
import { addActivity } from '../utils/activity'

function SortTh({ col, label, active, dir, onSort }) {
  const isActive = active === col
  const Icon = isActive ? (dir === 'asc' ? SortAscIcon : SortDescIcon) : SortNoneIcon
  return (
    <th className={`sortable-th${isActive ? ' sortable-th--active' : ''}`} onClick={() => onSort(col)}>
      {label} <Icon width={12} height={12} />
    </th>
  )
}

const PRIORITIES = ['High', 'Med', 'Low']
const PAGE_SIZES = [10, 25, 100]

const blankForm = () => ({
  title: '', module: '', scenario: '', preconditions: '', priority: 'Med',
  assignee: '', steps: [''], testData: '', expected: '', actual: '',
  status: 'Not Executed', devRemarks: '', qaRemarks: '',
})

export function TestCasesPage() {
  const { projectId } = useParams()
  const { testCases, addTestCase, updateTestCase, removeTestCase, removeTestCases } = useTestCases(projectId)
  const { members } = useTeamMembers()
  const { projects } = useProjects()
  const { user } = useUser()
  const projectName = projects.find((p) => p.id === projectId)?.name ?? projectId
  const confirm = useConfirm()
  const toast = useToast()

  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [editTc, setEditTc] = useState(null)   // tc being edited
  const [form, setForm] = useState(blankForm)
  const [search, setSearch] = useState('')
  const [fPriority, setFPriority] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fModule, setFModule] = useState('')
  const [fAssignee, setFAssignee] = useState('')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkStatus, setBulkStatus] = useState('Pass')
  // Add a computed _tcId field so useSortable can sort by TC ID as a plain string
  const sortableTestCases = useMemo(
    () => testCases.map((tc) => ({
      ...tc,
      _tcId: tc.sourceTcId || tc.id.slice(0, 8).toUpperCase(),
    })),
    [testCases],
  )
  const { sorted: sortedCases, sortKey: tcSortKey, sortDir: tcSortDir, toggle: tcToggle } = useSortable(sortableTestCases)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const updateListControl = (setter) => (e) => {
    setter(e.target.value)
    setPage(1)
  }
  const clearFilters = () => { setSearch(''); setFPriority(''); setFStatus(''); setFModule(''); setFAssignee(''); setPage(1) }
  const activeFilterCount = [search, fPriority, fStatus, fModule, fAssignee].filter(Boolean).length

  const handleAdd = (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.expected.trim()) return
    if (editTc) {
      const updated = { ...editTc, ...form, steps: form.steps.filter(Boolean), updatedAt: new Date().toISOString(), updatedBy: user }
      const changes = describeTestCaseChanges(editTc, updated)
      updateTestCase(changes.length
        ? withHistory(updated, historyEntry('update', user, changes.join(', ')))
        : updated)
      setEditTc(null)
      toast.success('Test case updated')
    } else {
      addTestCase({
        ...form,
        steps: form.steps.filter(Boolean),
        history: [historyEntry('created', user, 'Test case created')],
      })
      toast.success('Test case added')
    }
    setForm(blankForm)
    setShowAdd(false)
  }

  const openEdit = (tc) => {
    setEditTc(tc)
    setForm({
      title: tc.title || '', module: tc.module || '', scenario: tc.scenario || '',
      preconditions: tc.preconditions || '', priority: tc.priority || 'Med',
      assignee: tc.assignee || '', steps: tc.steps?.length ? [...tc.steps] : [''],
      testData: tc.testData || '', expected: tc.expected || '', actual: tc.actual || '',
      status: tc.status || 'Not Executed', devRemarks: tc.devRemarks || '', qaRemarks: tc.qaRemarks || '',
    })
    setShowAdd(true)
  }

  const close = () => { setShowAdd(false); setEditTc(null); setForm(blankForm) }
  const toggleSelected = (id) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id])
  }

  const toggleVisiblePage = () => {
    const pageIds = pagedCases.map((tc) => tc.id)
    const allSelected = pageIds.every((id) => selectedIds.includes(id))
    setSelectedIds((ids) => allSelected
      ? ids.filter((id) => !pageIds.includes(id))
      : [...new Set([...ids, ...pageIds])])
  }

  const applyBulkStatus = () => {
    testCases
      .filter((tc) => selectedIds.includes(tc.id))
      .forEach((tc) => updateTestCase(withHistory(
        { ...tc, status: bulkStatus, updatedAt: new Date().toISOString(), updatedBy: user },
        historyEntry('status_change', user, `Status changed from ${tc.status} to ${bulkStatus}`, tc.status, bulkStatus),
      )))
    setSelectedIds([])
  }

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return
    const ok = await confirm({
      title: 'Delete selected test cases?',
      message: `Are you sure you want to permanently remove the ${selectedIds.length} selected test cases? This action cannot be undone.`,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) {
      const count = selectedIds.length
      const deletedIds = [...selectedIds]
      removeTestCases(deletedIds)
      setSelectedIds([])
      toast.success(`${count} test cases deleted`)
      await addActivity({
        entityType: 'test_case',
        action: 'deleted',
        title: `Deleted ${count} selected test cases`,
        projectId,
        metadata: {
          deletedIds,
          count,
        },
      })
    }
  }

  const cloneCase = (tc) => {
    const clone = {
      ...tc,
      title: `${tc.title} (Copy)`,
      status: 'Not Executed',
      actual: '',
      createdAt: new Date().toISOString(),
      updatedAt: undefined,
      updatedBy: undefined,
      history: [historyEntry('cloned', user, `Cloned from ${tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()}`)],
    }
    delete clone.id
    delete clone.createdBy
    delete clone.createdByName
    delete clone.updatedByName
    addTestCase(clone)
  }

  // Derive unique module values for filter dropdown
  const modules = [...new Set(testCases.map((t) => t.module).filter(Boolean))]
  const assignees = [...new Set(testCases.map((t) => t.assignee).filter(Boolean))]

  const visible = sortedCases.filter((tc) => {
    if (search && !tc.title.toLowerCase().includes(search.toLowerCase())) return false
    if (fPriority && tc.priority !== fPriority) return false
    if (fStatus && tc.status !== fStatus) return false
    if (fModule && tc.module !== fModule) return false
    if (fAssignee && tc.assignee !== fAssignee) return false
    return true
  })
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const pagedCases = visible.slice(startIndex, startIndex + pageSize)
  const rangeStart = visible.length === 0 ? 0 : startIndex + 1
  const rangeEnd = Math.min(startIndex + pageSize, visible.length)

  return (
    <>
      <PageHeader
        title="Test cases"
        description="Filter, review, and prepare cases for the next test run."
        action={
          <div className="page-actions-row">
            <button
              className="secondary-button"
              type="button"
              onClick={() => exportTestCases(visible, projectName)}
              disabled={visible.length === 0}
            >
              <DownloadIcon width={14} height={14} /> Export
            </button>
            <button className="secondary-button" type="button" onClick={() => setShowBulk(true)}>
              <UploadIcon width={14} height={14} /> Bulk upload
            </button>
            <button className="primary-button" type="button" onClick={() => setShowAdd(true)}>
              + Add case
            </button>
          </div>
        }
      />

      <section className="panel">
        <div className="toolbar">
          <input
            type="search"
            placeholder="Search test cases…"
            aria-label="Search"
            value={search}
            onChange={updateListControl(setSearch)}
          />
          <select aria-label="Module filter" value={fModule} onChange={updateListControl(setFModule)} className={fModule ? 'filter-active' : ''}>
            <option value="">Module</option>
            {modules.map((m) => <option key={m}>{m}</option>)}
          </select>
          <select aria-label="Priority filter" value={fPriority} onChange={updateListControl(setFPriority)} className={fPriority ? 'filter-active' : ''}>
            <option value="">Priority</option>
            {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
          </select>
          <select aria-label="Status filter" value={fStatus} onChange={updateListControl(setFStatus)} className={fStatus ? 'filter-active' : ''}>
            <option value="">Status</option>
            {TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <select aria-label="Assignee filter" value={fAssignee} onChange={updateListControl(setFAssignee)} className={fAssignee ? 'filter-active' : ''}>
            <option value="">Assignee</option>
            {assignees.map((a) => <option key={a}>{a}</option>)}
          </select>
          <div className="toolbar-info">
            {activeFilterCount > 0 && (
              <button className="filter-clear-btn" type="button" onClick={clearFilters}>
                Clear ({activeFilterCount})
              </button>
            )}
            <span>{visible.length} of {sortedCases.length}</span>
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="empty-table-row">No test cases found.</div>
        ) : (
          <>
          <div className="bulk-action-bar">
            <span>{selectedIds.length} selected</span>
            <select aria-label="Bulk status" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
              {TEST_STATUSES.filter((status) => status !== 'Not Executed').map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
            <button className="secondary-button" type="button" disabled={selectedIds.length === 0} onClick={applyBulkStatus}>
              Mark selected
            </button>
            <button className="danger-button" type="button" disabled={selectedIds.length === 0} onClick={handleBulkDelete}>
              Delete selected
            </button>
          </div>
          <div className="table-wrap">
            <table className="tc-table">
              <colgroup>
                <col className="tc-col-check" />
                <col className="tc-col-id" />
                <col className="tc-col-title" />
                <col className="tc-col-module" />
                <col className="tc-col-priority" />
                <col className="tc-col-status" />
                <col className="tc-col-assignee" />
                <col className="tc-col-actions" />
              </colgroup>
              <thead>
                <tr>
                  <th>
                    <input
                      className="row-checkbox"
                      type="checkbox"
                      aria-label="Select visible rows"
                      checked={pagedCases.length > 0 && pagedCases.every((tc) => selectedIds.includes(tc.id))}
                      onChange={toggleVisiblePage}
                    />
                  </th>
                  <SortTh col="_tcId" label="TC ID" active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                  <SortTh col="title"    label="Title"    active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                  <SortTh col="module"   label="Module"   active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                  <SortTh col="priority" label="Priority" active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                  <SortTh col="status"   label="Status"   active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                  <SortTh col="assignee" label="Assignee" active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {pagedCases.map((tc) => (
                  <tr key={tc.id}>
                    <td>
                      <input
                        className="row-checkbox"
                        type="checkbox"
                        aria-label={`Select ${tc.title}`}
                        checked={selectedIds.includes(tc.id)}
                        onChange={() => toggleSelected(tc.id)}
                      />
                    </td>
                    <td className="mono tc-id">{tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()}</td>
                    <td className="title-cell">
                      <Link to={`/projects/${projectId}/test-cases/${tc.id}`}>{tc.title}</Link>
                    </td>
                    <td>{tc.module || '—'}</td>
                    <td>
                      <select
                        className={`inline-select status-select priority-${(tc.priority || 'Med').toLowerCase()}`}
                        value={tc.priority || 'Med'}
                        aria-label="Priority"
                        onChange={(e) => updateTestCase(withHistory(
                          { ...tc, priority: e.target.value, updatedAt: new Date().toISOString(), updatedBy: user },
                          historyEntry('priority_change', user, `Priority changed from ${tc.priority} to ${e.target.value}`, tc.priority, e.target.value),
                        ))}
                      >
                        {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                      </select>
                    </td>
                    <td>
                      <select
                        className={`inline-select status-select status-select--${STATUS_TONE[tc.status] ?? 'neutral'}`}
                        value={tc.status}
                        aria-label="Status"
                        onChange={(e) => updateTestCase(withHistory(
                          { ...tc, status: e.target.value, updatedAt: new Date().toISOString(), updatedBy: user },
                          historyEntry('status_change', user, `Status changed from ${tc.status} to ${e.target.value}`, tc.status, e.target.value),
                        ))}
                      >
                        {TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>{tc.assignee || '—'}</td>
                    <td className="row-actions">
                      <div className="row-actions-inner">
                        <button className="row-action-btn" type="button" aria-label="Edit"
                          onClick={() => openEdit(tc)}><PencilIcon width={13} height={13} /></button>
                        <button className="row-action-btn" type="button" aria-label="Clone"
                          onClick={() => cloneCase(tc)}><CopyIcon width={13} height={13} /></button>
                        <button className="row-delete" type="button" aria-label="Delete"
                          onClick={async () => {
                            const ok = await confirm({ title: 'Delete test case?', message: `"${tc.title}" will be permanently removed.`, confirmLabel: 'Delete', danger: true })
                            if (ok) { removeTestCase(tc.id); toast.success('Test case deleted') }
                          }}><XIcon width={12} height={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mobile-card-list">
            {pagedCases.map((tc) => (
              <div className="mobile-card" key={tc.id}>
                <div className="mobile-card-header">
                  <span className="mono tc-id">{tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()}</span>
                  <div className="mobile-card-header-badges">
                    <select
                      className={`inline-select status-select priority-${(tc.priority || 'Med').toLowerCase()}`}
                      value={tc.priority || 'Med'}
                      aria-label="Priority"
                      onChange={(e) => updateTestCase(withHistory(
                        { ...tc, priority: e.target.value, updatedAt: new Date().toISOString(), updatedBy: user },
                        historyEntry('priority_change', user, `Priority changed from ${tc.priority} to ${e.target.value}`, tc.priority, e.target.value),
                      ))}
                    >
                      {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                    </select>
                    <select
                      className={`inline-select status-select status-select--${STATUS_TONE[tc.status] ?? 'neutral'}`}
                      value={tc.status}
                      aria-label="Status"
                      onChange={(e) => updateTestCase(withHistory(
                        { ...tc, status: e.target.value, updatedAt: new Date().toISOString(), updatedBy: user },
                        historyEntry('status_change', user, `Status changed from ${tc.status} to ${e.target.value}`, tc.status, e.target.value),
                      ))}
                    >
                      {TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <h3 className="mobile-card-title">
                  <Link to={`/projects/${projectId}/test-cases/${tc.id}`}>{tc.title}</Link>
                </h3>
                <div className="mobile-card-details">
                  <div>
                    <span>Module:</span>
                    <strong>{tc.module || '—'}</strong>
                  </div>
                  <div>
                    <span>Assignee:</span>
                    <strong>{tc.assignee || '—'}</strong>
                  </div>
                </div>
                <div className="mobile-card-actions">
                  <Link className="secondary-button mobile-card-action-btn" to={`/projects/${projectId}/test-cases/${tc.id}`}>
                    Open
                  </Link>
                  <button className="secondary-button mobile-card-action-btn" type="button" onClick={() => openEdit(tc)}>
                    Edit
                  </button>
                  <button className="secondary-button mobile-card-action-btn" type="button" onClick={() => cloneCase(tc)}>
                    Clone
                  </button>
                  <button className="danger-button mobile-card-action-btn" type="button"
                    onClick={async () => {
                      const ok = await confirm({ title: 'Delete test case?', message: `"${tc.title}" will be permanently removed.`, confirmLabel: 'Delete', danger: true })
                      if (ok) { removeTestCase(tc.id); toast.success('Test case deleted') }
                    }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          </>
        )}

        {visible.length > 0 && (
          <div className="table-pagination" aria-label="Table pagination">
            <div className="rows-per-page">
              <span>Rows</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <span className="pagination-summary">
              {rangeStart}-{rangeEnd} of {visible.length}
            </span>
            <div className="pagination-actions">
              <button
                className="secondary-button icon-button"
                type="button"
                aria-label="Previous page"
                disabled={currentPage === 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                <ChevronLeftIcon width={14} height={14} />
              </button>
              <span className="page-indicator">{currentPage} / {totalPages}</span>
              <button
                className="secondary-button icon-button"
                type="button"
                aria-label="Next page"
                disabled={currentPage === totalPages}
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              >
                <ChevronRightIcon width={14} height={14} />
              </button>
            </div>
          </div>
        )}
      </section>

      {showBulk && (
        <BulkUploadModal
          projectId={projectId}
          existingTestCases={testCases}
          onImport={(tc) => addTestCase(tc)}
          onUpdate={(tc) => updateTestCase(tc)}
          onClose={() => setShowBulk(false)}
        />
      )}

      {showAdd && (
        <Modal title={editTc ? 'Edit test case' : 'New test case'} onClose={close}>
          <form className="modal-form" onSubmit={handleAdd}>
            <label>
              Test Case Title <span className="required">*</span>
              <input autoFocus value={form.title} onChange={set('title')} placeholder="What is being tested?" />
            </label>
            <div className="form-row">
              <label>
                Module
                <input value={form.module} onChange={set('module')} placeholder="Auth, E2E…" list="module-suggestions" />
                <datalist id="module-suggestions">
                  {modules.map((m) => <option key={m} value={m} />)}
                </datalist>
              </label>
              <label>
                Priority
                <select value={form.priority} onChange={set('priority')}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
            </div>
            <label>
              Test Scenario
              <input value={form.scenario} onChange={set('scenario')} placeholder="High-level scenario being covered" />
            </label>
            <label>
              Pre-conditions
              <textarea rows={2} value={form.preconditions} onChange={set('preconditions')} placeholder="What must be true before this test runs?" />
            </label>
            <label>Steps</label>
            <StepBuilder steps={form.steps} onChange={(steps) => setForm((f) => ({ ...f, steps }))} />
            <label>
              Test Data
              <input value={form.testData} onChange={set('testData')} placeholder="Input values, credentials, sample data…" />
            </label>
            <label>
              Expected Result <span className="required">*</span>
              <input value={form.expected} onChange={set('expected')} placeholder="What should happen?" />
            </label>
            <label>
              Actual Result
              <input value={form.actual} onChange={set('actual')} placeholder="What actually happened?" />
            </label>
            <div className="form-row">
              <label>
                Status
                <select value={form.status} onChange={set('status')}>
                  {TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>
                Assignee
                <select value={form.assignee} onChange={set('assignee')}>
                  <option value="">Unassigned</option>
                  {members.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Dev Remarks
                <input value={form.devRemarks} onChange={set('devRemarks')} placeholder="Notes from developer" />
              </label>
              <label>
                QA Remarks
                <input value={form.qaRemarks} onChange={set('qaRemarks')} placeholder="Notes from QA" />
              </label>
            </div>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={close}>Cancel</button>
              <button type="submit" className="primary-button">{editTc ? 'Save changes' : 'Add test case'}</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
