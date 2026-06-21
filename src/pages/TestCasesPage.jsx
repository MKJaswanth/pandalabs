import { useMemo, useState } from 'react'
import { UploadIcon, DownloadIcon, PencilIcon, CopyIcon, XIcon, ChevronLeftIcon, ChevronRightIcon, SortAscIcon, SortDescIcon, SortNoneIcon, ArrowRightIcon } from '../components/Icons'
import { useSortable } from '../hooks/useSortable'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { BulkUploadModal } from '../components/BulkUploadModal'
import { Modal } from '../components/Modal'
import { TagInput, TagList } from '../components/TagInput'
import { PageHeader } from '../components/PageHeader'
import { StepBuilder } from '../components/StepBuilder'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import { useTeamMembers } from '../hooks/useTeamMembers'
import { useTestCases } from '../hooks/useTestCases'
import { useBugs } from '../hooks/useBugs'
import { useProjects } from '../hooks/useProjects'
import { useUser } from '../context/UserContext'
import { useSharedSteps } from '../hooks/useSharedSteps'
import { useUserRole } from '../hooks/useUserRole'
import { describeTestCaseChanges, historyEntry, withHistory } from '../utils/history'
import { STATUS_TONE, TEST_STATUSES, normalizeTestStatus } from '../utils/status'
import { exportTestCases } from '../utils/export'
import { addActivity } from '../utils/activity'
import { newId } from '../utils/id'

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
const SEVERITIES = ['Critical', 'Major', 'Minor']
const BUG_STATUSES = ['Open', 'In review', 'Closed']

const getTestCaseDisplayId = (tc) => tc.sourceTcId || tc.id.slice(0, 8).toUpperCase()

const blankForm = () => ({
  title: '', module: '', scenario: '', preconditions: '', priority: 'Med',
  assignee: '', steps: [''], testData: '', expected: '', actual: '',
  status: 'Not Executed', devRemarks: '', qaRemarks: '', tags: [],
})

export function TestCasesPage() {
  const { projectId } = useParams()
  const [searchParams] = useSearchParams()
  const { testCases, addTestCase, updateTestCase, removeTestCase, removeTestCases } = useTestCases(projectId)
  const { addBug } = useBugs(projectId)
  const { members } = useTeamMembers()
  const { projects } = useProjects()
  const { user } = useUser()
  const { isLead } = useUserRole()
  const projectName = projects.find((p) => p.id === projectId)?.name ?? projectId
  const confirm = useConfirm()
  const toast = useToast()

  const [showAdd, setShowAdd] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [editTc, setEditTc] = useState(null)   // tc being edited
  const [form, setForm] = useState(blankForm)
  const [search, setSearch] = useState(() => searchParams.get('search') || '')
  const [fPriority, setFPriority] = useState(() => searchParams.get('priority') || '')
  const [fStatus, setFStatus] = useState(() => searchParams.get('status') || '')
  const [fModule, setFModule] = useState(() => searchParams.get('module') || '')
  const [fAssignee, setFAssignee] = useState(() => searchParams.get('assignee') || '')
  const [fTag, setFTag] = useState(() => searchParams.get('tag') || '')
  const [pageSize, setPageSize] = useState(10)
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkStatus, setBulkStatus] = useState('Pass')

  const [activeTab, setActiveTab] = useState('cases') // 'cases' | 'shared-steps'
  const [showBugModal, setShowBugModal] = useState(false)
  const [bugForm, setBugForm] = useState(null)
  const [failedTcId, setFailedTcId] = useState(null)
  const { sharedSteps, addSharedStep, updateSharedStep, removeSharedStep } = useSharedSteps(projectId)
  const [showSharedModal, setShowSharedModal] = useState(false)
  const [editSharedGroup, setEditSharedGroup] = useState(null)
  const [sharedForm, setSharedForm] = useState({ name: '', description: '', steps: [''] })
  const [sharedSearch, setSharedSearch] = useState('')

  const handleSaveSharedGroup = async (e) => {
    e.preventDefault()
    if (!sharedForm.name.trim()) return
    const filteredSteps = sharedForm.steps.filter(Boolean)
    if (editSharedGroup) {
      await updateSharedStep({
        ...editSharedGroup,
        name: sharedForm.name,
        description: sharedForm.description,
        steps: filteredSteps,
        updatedAt: new Date().toISOString(),
      })
      toast.success('Shared step group updated')
    } else {
      await addSharedStep(sharedForm.name, sharedForm.description, filteredSteps)
      toast.success('Shared step group created')
    }
    setShowSharedModal(false)
    setEditSharedGroup(null)
    setSharedForm({ name: '', description: '', steps: [''] })
  }

  const openAddShared = () => {
    setEditSharedGroup(null)
    setSharedForm({ name: '', description: '', steps: [''] })
    setShowSharedModal(true)
  }

  const openEditShared = (group) => {
    setEditSharedGroup(group)
    setSharedForm({
      name: group.name,
      description: group.description || '',
      steps: group.steps?.length ? [...group.steps] : [''],
    })
    setShowSharedModal(true)
  }

  const handleDeleteShared = async (group) => {
    const isLinked = testCases.some((tc) =>
      tc.steps?.some((step) => step === `shared_step_group:${group.id}`)
    )
    const msg = isLinked
      ? `This shared step group is currently referenced by some test cases. Deleting it will show warning logs in those cases. Are you sure you want to delete "${group.name}"?`
      : `Are you sure you want to delete shared steps "${group.name}"?`
    
    const ok = await confirm({
      title: 'Delete shared steps?',
      message: msg,
      confirmLabel: 'Delete',
      danger: true,
    })
    if (ok) {
      await removeSharedStep(group.id)
      toast.success('Shared step group deleted')
    }
  }
  // Add a computed _tcId field so useSortable can sort by TC ID as a plain string
  const sortableTestCases = useMemo(
    () => testCases.map((tc) => ({
      ...tc,
      _tcId: getTestCaseDisplayId(tc),
    })),
    [testCases],
  )
  const { sorted: sortedCases, sortKey: tcSortKey, sortDir: tcSortDir, toggle: tcToggle } = useSortable(sortableTestCases)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const updateListControl = (setter) => (e) => {
    setter(e.target.value)
    setPage(1)
  }

  // When a TC status changes to Fail, prompt to log a bug (pre-filled, linked to the TC).
  const handleTcStatusChange = (tc, newStatus) => {
    const updated = { ...tc, status: newStatus, updatedAt: new Date().toISOString(), updatedBy: user }
    const changes = describeTestCaseChanges(tc, updated)
    updateTestCase(changes.length
      ? withHistory(updated, historyEntry('update', user, changes.join(', ')))
      : updated)

    // If changing TO Fail, offer to log a bug.
    if (normalizeTestStatus(newStatus) === 'Fail') {
      setBugForm({
        title: `Failed: ${tc.title}`,
        description: '',
        severity: 'Major',
        status: 'Open',
        linkedTestCase: tc.id,
        linkedRequirementId: '',
        module: tc.module || '',
        evidenceLinks: [],
        tags: [],
      })
      setFailedTcId(tc.id)
      setShowBugModal(true)
    }
  }

  const handleBugSubmit = (e) => {
    e.preventDefault()
    if (!bugForm.title.trim()) return
    const initialHistory = {
      id: newId(),
      type: 'created',
      user,
      timestamp: new Date().toISOString(),
      details: 'Bug created (from failed test case)',
    }
    addBug({ ...bugForm, history: [initialHistory] })
    setShowBugModal(false)
    setBugForm(null)
    setFailedTcId(null)
    toast.success('Bug logged')
  }

  const handleBugCancel = () => {
    setShowBugModal(false)
    setBugForm(null)
    setFailedTcId(null)
  }

  const setBug = (k) => (e) => setBugForm((f) => ({ ...f, [k]: e.target.value }))
  const clearFilters = () => { setSearch(''); setFPriority(''); setFStatus(''); setFModule(''); setFAssignee(''); setFTag(''); setPage(1) }
  const activeFilterCount = [search, fPriority, fStatus, fModule, fAssignee, fTag].filter(Boolean).length
  const filterByTag = (tag) => { setFTag((cur) => (cur === tag ? '' : tag)); setPage(1) }

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
      tags: tc.tags || [],
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
      history: [historyEntry('cloned', user, `Cloned from ${getTestCaseDisplayId(tc)}`)],
    }
    delete clone.id
    delete clone.sourceTcId   // clone gets its own fresh TC-XX-NNN id
    delete clone.createdBy
    delete clone.createdByName
    delete clone.updatedByName
    addTestCase(clone)
  }

  // Derive unique module values for filter dropdown
  const modules = [...new Set(testCases.map((t) => t.module).filter(Boolean))]
  const assignees = [...new Set(testCases.map((t) => t.assignee).filter(Boolean))]
  const allTags = [...new Set(testCases.flatMap((t) => t.tags || []))].sort((a, b) => a.localeCompare(b))

  const visible = sortedCases.filter((tc) => {
    if (search && !tc.title.toLowerCase().includes(search.toLowerCase())) return false
    if (fPriority && tc.priority !== fPriority) return false
    if (fStatus && tc.status !== fStatus) return false
    if (fModule && tc.module !== fModule) return false
    if (fAssignee && tc.assignee !== fAssignee) return false
    if (fTag && !(tc.tags || []).includes(fTag)) return false
    return true
  })
  const totalPages = Math.max(1, Math.ceil(visible.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const pagedCases = visible.slice(startIndex, startIndex + pageSize)
  const rangeStart = visible.length === 0 ? 0 : startIndex + 1
  const rangeEnd = Math.min(startIndex + pageSize, visible.length)
  const visibleSharedSteps = sharedSteps.filter((group) => !sharedSearch || group.name.toLowerCase().includes(sharedSearch.toLowerCase()))

  return (
    <>
      <PageHeader
        title="Test cases"
        description="Filter, review, and prepare cases for the next test run."
        action={
          activeTab === 'cases' ? (
            <div className="page-actions-row">
              <button
                className="secondary-button"
                type="button"
                onClick={() => exportTestCases(visible, projectName)}
                disabled={visible.length === 0}
              >
                <DownloadIcon width={14} height={14} /> Export
              </button>
              {isLead && (
                <>
                  <button className="secondary-button" type="button" onClick={() => setShowBulk(true)}>
                    <UploadIcon width={14} height={14} /> Bulk upload
                  </button>
                  <button className="primary-button" type="button" onClick={() => setShowAdd(true)}>
                    + Add case
                  </button>
                </>
              )}
            </div>
          ) : (
            isLead && (
              <div className="page-actions-row">
                <button className="primary-button" type="button" onClick={openAddShared}>
                  + Add shared steps
                </button>
              </div>
            )
          )
        }
      />

      <div className="tab-navigation" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'cases' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('cases')}
        >
          All Test Cases ({testCases.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'shared-steps' ? 'tab-btn--active' : ''}`}
          onClick={() => setActiveTab('shared-steps')}
        >
          Shared Steps Library ({sharedSteps.length})
        </button>
      </div>

      {activeTab === 'cases' ? (
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
            {assignees.length > 0 && (
              <select aria-label="Assignee filter" value={fAssignee} onChange={updateListControl(setFAssignee)} className={fAssignee ? 'filter-active' : ''}>
                <option value="">Assignee</option>
                {assignees.map((a) => <option key={a}>{a}</option>)}
              </select>
            )}
            {allTags.length > 0 && (
              <select aria-label="Tag filter" value={fTag} onChange={updateListControl(setFTag)} className={fTag ? 'filter-active' : ''}>
                <option value="">Tag</option>
                {allTags.map((t) => <option key={t}>{t}</option>)}
              </select>
            )}
            {activeFilterCount > 0 && (
              <button className="link-btn clear-filters-btn" type="button" onClick={clearFilters}>
                Clear filters ({activeFilterCount})
              </button>
            )}
          </div>

          {selectedIds.length > 0 && (
            <div className="bulk-bar" aria-label="Bulk actions">
              <span>{selectedIds.length} case(s) selected</span>
              {isLead ? (
                <div className="bulk-actions">
                  <select
                    aria-label="Bulk status select"
                    value={bulkStatus}
                    onChange={(e) => setBulkStatus(e.target.value)}
                  >
                    {TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={applyBulkStatus}
                  >
                    Apply status
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={handleBulkDelete}
                  >
                    Delete selected
                  </button>
                </div>
              ) : (
                <span className="text-muted" style={{ fontSize: 11, fontStyle: 'italic' }}>Actions restricted (read-only)</span>
              )}
            </div>
          )}

          {visible.length === 0 ? (
            <div className="empty-table-row">No test cases found.</div>
          ) : (
            <>
            <div className="table-wrap">
              <table className="tc-table">
                <colgroup>
                  <col className="tc-col-check" />
                  <col className="tc-col-id" />
                  <col className="tc-col-title" />
                  <col className="tc-col-module" />
                  <col className="tc-col-priority" />
                  <col className="tc-col-assignee" />
                  <col className="tc-col-status" />
                  <col className="tc-col-actions" />
                </colgroup>
                <thead>
                  <tr>
                    <th className="checkbox-th">
                      <input
                        type="checkbox"
                        aria-label="Select all cases"
                        checked={pagedCases.length > 0 && pagedCases.every((tc) => selectedIds.includes(tc.id))}
                        onChange={toggleVisiblePage}
                      />
                    </th>
                    <th>
                      <SortTh col="_tcId" label="ID" active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                    </th>
                    <th>
                      <SortTh col="title" label="Title" active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                    </th>
                    <th>
                      <SortTh col="module" label="Module" active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                    </th>
                    <th>
                      <SortTh col="priority" label="Priority" active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                    </th>
                    <th>
                      <SortTh col="assignee" label="Assignee" active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                    </th>
                    <th>
                      <SortTh col="status" label="Status" active={tcSortKey} dir={tcSortDir} onSort={tcToggle} />
                    </th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedCases.map((tc) => (
                    <tr key={tc.id} className={selectedIds.includes(tc.id) ? 'row-selected' : ''}>
                      <td className="checkbox-td">
                        <input
                          type="checkbox"
                          aria-label={`Select ${tc.title}`}
                          checked={selectedIds.includes(tc.id)}
                          onChange={() => toggleSelected(tc.id)}
                        />
                      </td>
                      <td className="mono">{getTestCaseDisplayId(tc)}</td>
                      <td>
                        <Link className="tc-title-link" to={`/projects/${projectId}/test-cases/${tc.id}`}>
                          {tc.title}
                        </Link>
                        <TagList tags={tc.tags} onTagClick={filterByTag} activeTag={fTag} />
                      </td>
                      <td>{tc.module || '—'}</td>
                      <td>
                        <select
                          className={`inline-select priority-${(tc.priority || 'Med').toLowerCase()}`}
                          value={tc.priority || 'Med'}
                          aria-label="Priority"
                          disabled={!isLead}
                          onChange={(e) => updateTestCase(withHistory(
                            { ...tc, priority: e.target.value, updatedAt: new Date().toISOString(), updatedBy: user },
                            historyEntry('priority_change', user, `Priority changed from ${tc.priority} to ${e.target.value}`, tc.priority, e.target.value),
                          ))}
                        >
                          {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                        </select>
                      </td>
                      <td>{tc.assignee || '—'}</td>
                      <td>
                        <select
                          className={`inline-select status-select status-select--${STATUS_TONE[tc.status] ?? 'neutral'}`}
                          value={tc.status}
                          aria-label="Status"
                          disabled={!isLead}
                          onChange={(e) => handleTcStatusChange(tc, e.target.value)}
                        >
                          {TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-row-actions">
                          <Link className="icon-btn-action" to={`/projects/${projectId}/test-cases/${tc.id}`} title="View detail" aria-label="View detail">
                            <ArrowRightIcon width={14} height={14} />
                          </Link>
                          {isLead && (
                            <>
                              <button type="button" className="icon-btn-action" onClick={() => openEdit(tc)} title="Edit" aria-label="Edit">
                                <PencilIcon width={14} height={14} />
                              </button>
                              <button className="icon-btn-action" type="button" onClick={() => cloneCase(tc)} title="Clone" aria-label="Clone">
                                <CopyIcon width={14} height={14} />
                              </button>
                              <button className="icon-btn-action text-danger" type="button" title="Delete" aria-label="Delete"
                                onClick={async () => {
                                  const ok = await confirm({ title: 'Delete test case?', message: `"${tc.title}" will be permanently removed.`, confirmLabel: 'Delete', danger: true })
                                  if (ok) { removeTestCase(tc.id); toast.success('Test case deleted') }
                                }}>
                                <XIcon width={14} height={14} />
                              </button>
                            </>
                          )}
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
                    <span className="mono tc-id">{getTestCaseDisplayId(tc)}</span>
                    <div className="mobile-card-header-badges">
                      <select
                        className={`inline-select status-select priority-${(tc.priority || 'Med').toLowerCase()}`}
                        value={tc.priority || 'Med'}
                        aria-label="Priority"
                        disabled={!isLead}
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
                        disabled={!isLead}
                        onChange={(e) => handleTcStatusChange(tc, e.target.value)}
                      >
                        {TEST_STATUSES.map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <h3 className="mobile-card-title">
                    <Link to={`/projects/${projectId}/test-cases/${tc.id}`}>{tc.title}</Link>
                  </h3>
                  <TagList tags={tc.tags} onTagClick={filterByTag} activeTag={fTag} />
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
                    {isLead && (
                      <>
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
                      </>
                    )}
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
      ) : (
        <section className="panel">
          <div className="toolbar">
            <input
              type="search"
              placeholder="Search shared steps…"
              aria-label="Search shared steps"
              value={sharedSearch}
              onChange={(e) => setSharedSearch(e.target.value)}
            />
          </div>

          <div className="table-wrap">
            <table className="tc-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Steps count</th>
                  <th style={{ width: 100, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleSharedSteps.length === 0 ? (
                  <tr>
                    <td colSpan="4">
                      <div className="empty-table-row">No shared steps found.</div>
                    </td>
                  </tr>
                ) : (
                  visibleSharedSteps.map(g => (
                    <tr key={g.id}>
                      <td><strong>{g.name}</strong></td>
                      <td className="text-muted">{g.description || '—'}</td>
                      <td>{g.steps?.length || 0} steps</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-row-actions" style={{ justifyContent: 'flex-end' }}>
                          {isLead ? (
                            <>
                              <button type="button" className="icon-btn-action" onClick={() => openEditShared(g)} title="Edit" aria-label="Edit">
                                <PencilIcon width={14} height={14} />
                              </button>
                              <button type="button" className="icon-btn-action text-danger" onClick={() => handleDeleteShared(g)} title="Delete" aria-label="Delete">
                                <XIcon width={14} height={14} />
                              </button>
                            </>
                          ) : (
                            <span className="text-muted" style={{ fontSize: 11 }}>Read-only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mobile-card-list">
            {visibleSharedSteps.length === 0 ? (
              <div className="empty-table-row">No shared steps found.</div>
            ) : (
              visibleSharedSteps.map(g => (
                <div className="mobile-card" key={g.id}>
                  <div className="mobile-card-header">
                    <strong style={{ fontSize: 14 }}>{g.name}</strong>
                    <span className="shared-badge">Shared block</span>
                  </div>
                  <div className="mobile-card-details">
                    <div>
                      <span>Description</span>
                      <strong>{g.description || '—'}</strong>
                    </div>
                    <div>
                      <span>Steps Count</span>
                      <strong>{g.steps?.length || 0} steps</strong>
                    </div>
                  </div>
                  <div className="mobile-card-actions">
                    {isLead ? (
                      <>
                        <button className="secondary-button mobile-card-action-btn" type="button" onClick={() => openEditShared(g)}>
                          Edit
                        </button>
                        <button className="danger-button mobile-card-action-btn" type="button" onClick={() => handleDeleteShared(g)}>
                          Delete
                        </button>
                      </>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 11, padding: '8px 0' }}>Read-only</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {showSharedModal && (
        <Modal title={editSharedGroup ? 'Edit Shared Steps' : 'New Shared Steps'} onClose={() => setShowSharedModal(false)}>
          <form onSubmit={handleSaveSharedGroup} className="modal-form">
            <label>
              Group Name <span className="required">*</span>
              <input
                autoFocus
                required
                value={sharedForm.name}
                onChange={(e) => setSharedForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Standard User Login"
              />
            </label>
            <label>
              Description
              <input
                value={sharedForm.description}
                onChange={(e) => setSharedForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief summary of when to use this block"
              />
            </label>
            <label>Steps</label>
            <StepBuilder
              steps={sharedForm.steps}
              onChange={(steps) => setSharedForm((f) => ({ ...f, steps }))}
            />
            <div className="modal-footer" style={{ marginTop: 24 }}>
              <button type="button" className="secondary-button" onClick={() => setShowSharedModal(false)}>Cancel</button>
              <button type="submit" className="primary-button">{editSharedGroup ? 'Save changes' : 'Create shared steps'}</button>
            </div>
          </form>
        </Modal>
      )}

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
            <StepBuilder steps={form.steps} onChange={(steps) => setForm((f) => ({ ...f, steps }))} sharedSteps={sharedSteps} />
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
            <label>
              Tags
              <TagInput
                id="tc-tags"
                value={form.tags}
                onChange={(tags) => setForm((f) => ({ ...f, tags }))}
                suggestions={allTags}
                placeholder="e.g. smoke, regression, mobile…"
              />
            </label>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={close}>Cancel</button>
              <button type="submit" className="primary-button">{editTc ? 'Save changes' : 'Add test case'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showBugModal && bugForm && (
        <Modal title="Log bug from failed test case" onClose={handleBugCancel}>
          <form className="modal-form" onSubmit={handleBugSubmit}>
            <label>
              Title <span className="required">*</span>
              <input autoFocus value={bugForm.title} onChange={setBug('title')} />
            </label>
            <label>
              Description
              <textarea value={bugForm.description} onChange={setBug('description')} rows={3} placeholder="Steps to reproduce, environment, notes…" />
            </label>
            <div className="form-row">
              <label>
                Severity
                <select value={bugForm.severity} onChange={setBug('severity')}>
                  {SEVERITIES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label>
                Status
                <select value={bugForm.status} onChange={setBug('status')}>
                  {BUG_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <label>
              Module
              <input value={bugForm.module} onChange={setBug('module')} placeholder="e.g. Auth, Checkout" />
            </label>
            <label>
              Linked test case
              <input value={failedTcId ? testCases.find(tc => tc.id === failedTcId)?.title || 'Loading...' : ''} disabled className="input-disabled" />
            </label>
            <label>
              Tags
              <TagInput
                id="bug-from-tc-tags"
                value={bugForm.tags || []}
                onChange={(tags) => setBugForm((f) => ({ ...f, tags }))}
                suggestions={[]}
                placeholder="e.g. regression, flaky…"
              />
            </label>
            <div className="modal-footer">
              <button type="button" className="secondary-button" onClick={handleBugCancel}>Skip</button>
              <button type="submit" className="primary-button">Log bug</button>
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
