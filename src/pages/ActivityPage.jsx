import { useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { useActivity } from '../hooks/useActivity'
import { useProjects } from '../hooks/useProjects'
import { StatusPill } from '../components/StatusPill'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/Icons'
import { activityMatchesSearch } from '../utils/entitySearch'

const ACTIVITY_PAGE_SIZES = [25, 50, 100]

const ENTITY_TYPES = [
  { value: 'project', label: 'Projects' },
  { value: 'test_case', label: 'Test Cases' },
  { value: 'bug', label: 'Bugs' },
  { value: 'test_run', label: 'Test Runs' },
  { value: 'import', label: 'Imports' },
  { value: 'restore', label: 'Restores' },
  { value: 'backup', label: 'Backups' },
  { value: 'user', label: 'User Actions' },
  { value: 'system', label: 'System' },
]

const ACTIONS = [
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'deleted', label: 'Deleted' },
  { value: 'status_changed', label: 'Status Changed' },
  { value: 'imported', label: 'Imported' },
  { value: 'restored', label: 'Restored' },
  { value: 'exported', label: 'Exported' },
  { value: 'run_started', label: 'Run Started' },
  { value: 'run_completed', label: 'Run Completed' },
  { value: 'bug_logged', label: 'Bug Logged' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'retest_updated', label: 'Retest Updated' },
]

const badgeTones = {
  project: 'passed',
  test_case: 'pending',
  bug: 'failed',
  test_run: 'pending',
  import: 'passed',
  restore: 'passed',
  backup: 'passed',
  user: 'pending',
  system: 'failed'
}

export function ActivityPage() {
  const { activities, loading } = useActivity()
  const { projects } = useProjects()
  const [searchParams, setSearchParams] = useSearchParams()

  const filterProject = searchParams.get('projectId') || ''
  const filterEntity = searchParams.get('entityType') || ''
  const filterAction = searchParams.get('action') || ''
  const filterSearch = searchParams.get('q') || ''
  const filterActor = searchParams.get('actor') || ''
  const filterFrom = searchParams.get('from') || ''
  const filterTo = searchParams.get('to') || ''
  const [pageSize, setPageSize] = useState(25)
  const [page, setPage] = useState(1)

  const projectMap = useMemo(() => {
    return new Map(projects.map((p) => [p.id, p.name]))
  }, [projects])

  const actorOptions = useMemo(() => {
    const seen = new Map()
    activities.forEach((act) => {
      const actor = act.actorName || act.userName || 'System'
      if (!seen.has(actor)) seen.set(actor, actor)
    })
    return [...seen.values()].sort((a, b) => a.localeCompare(b))
  }, [activities])

  const getProjectName = (act) => {
    if (!act.projectId) return 'Global'
    if (projectMap.has(act.projectId)) {
      return projectMap.get(act.projectId)
    }
    if (act.metadata?.projectName) return act.metadata.projectName
    if (act.metadata?.project?.name) return act.metadata.project.name
    if (act.metadata?.before?.name) return act.metadata.before.name
    if (act.metadata?.after?.name) return act.metadata.after.name
    if (act.metadata?.runName) return act.metadata.runName
    return 'Deleted Project'
  }

  const setFilter = (key, val) => {
    const next = new URLSearchParams(searchParams)
    if (val) next.set(key, val)
    else next.delete(key)
    setPage(1)
    setSearchParams(next)
  }

  const filteredActivities = useMemo(() => {
    const fromTime = filterFrom ? new Date(`${filterFrom}T00:00:00`).getTime() : null
    const toTime = filterTo ? new Date(`${filterTo}T23:59:59.999`).getTime() : null

    return activities.filter((act) => {
      if (filterProject && act.projectId !== filterProject) return false
      if (filterEntity && act.entityType !== filterEntity) return false
      if (filterAction && act.action !== filterAction) return false
      if (filterActor && (act.actorName || act.userName || 'System') !== filterActor) return false
      if (fromTime || toTime) {
        const createdTime = new Date(act.createdAt).getTime()
        if (Number.isNaN(createdTime)) return false
        if (fromTime && createdTime < fromTime) return false
        if (toTime && createdTime > toTime) return false
      }
      if (!activityMatchesSearch(act, filterSearch)) return false
      return true
    })
  }, [activities, filterProject, filterEntity, filterAction, filterActor, filterFrom, filterTo, filterSearch])

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = (currentPage - 1) * pageSize
  const paginatedActivities = filteredActivities.slice(startIndex, startIndex + pageSize)
  const startItem = filteredActivities.length === 0 ? 0 : startIndex + 1
  const endItem = Math.min(startIndex + pageSize, filteredActivities.length)

  const hasActiveFilters = filterProject || filterEntity || filterAction || filterActor || filterFrom || filterTo || filterSearch

  return (
    <>
      <PageHeader
        title="Activity History"
        description="Audit log of actions across projects, test cases, bugs, runs, and exports."
      />

      <section className="panel mb-md">
        <div className="toolbar">
          <input
            type="search"
            value={filterSearch}
            onChange={(e) => setFilter('q', e.target.value)}
            placeholder="Search activity…"
            aria-label="Search text"
          />
          <select
            value={filterProject}
            onChange={(e) => setFilter('projectId', e.target.value)}
            aria-label="Filter by project"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={filterEntity}
            onChange={(e) => setFilter('entityType', e.target.value)}
            aria-label="Filter by entity type"
            className={filterEntity ? 'filter-active' : ''}
          >
            <option value="">All Types</option>
            {ENTITY_TYPES.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
          <select
            value={filterAction}
            onChange={(e) => setFilter('action', e.target.value)}
            aria-label="Filter by action"
            className={filterAction ? 'filter-active' : ''}
          >
            <option value="">All Actions</option>
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          <select
            value={filterActor}
            onChange={(e) => setFilter('actor', e.target.value)}
            aria-label="Filter by actor"
            className={filterActor ? 'filter-active' : ''}
          >
            <option value="">All Users</option>
            {actorOptions.map((actor) => (
              <option key={actor} value={actor}>{actor}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilter('from', e.target.value)}
            aria-label="Filter from date"
            className={filterFrom ? 'filter-active' : ''}
          />
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilter('to', e.target.value)}
            aria-label="Filter to date"
            className={filterTo ? 'filter-active' : ''}
          />
          <div className="toolbar-info">
            {hasActiveFilters && (
              <button
                className="filter-clear-btn"
                type="button"
                onClick={() => {
                  setPage(1)
                  setSearchParams({})
                }}
              >
                Clear filters
              </button>
            )}
            <span>{startItem}-{endItem} of {filteredActivities.length} filtered</span>
          </div>
        </div>
      </section>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
          <div className="app-loading-spinner" aria-label="Loading activity history" />
        </div>
      ) : filteredActivities.length === 0 ? (
        <section className="empty-state">
          <h2>No activities found</h2>
          <p>Try resetting filters or perform some actions to see logs here.</p>
        </section>
      ) : (
        <section className="panel" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="activities-table">
              <thead>
                <tr>
                  <th style={{ width: 200 }}>Time</th>
                  <th style={{ width: 120 }}>Entity Type</th>
                  <th>Action Detail</th>
                  <th style={{ width: 150 }}>Project</th>
                  <th style={{ width: 150 }}>Actor</th>
                </tr>
              </thead>
              <tbody>
                {paginatedActivities.map((act) => {
                  const projName = getProjectName(act)
                  const displayTime = new Date(act.createdAt).toLocaleString()

                  return (
                    <tr key={act.id}>
                      <td className="mono text-muted" style={{ fontSize: '12px' }}>
                        {displayTime}
                      </td>
                      <td>
                        <StatusPill tone={badgeTones[act.entityType] || 'pending'}>
                          {act.entityType.toUpperCase().replace('_', ' ')}
                        </StatusPill>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          <strong>{act.actorName || 'System'}</strong>: {act.title}
                        </div>
                        {act.details && (
                          <div className="text-muted mt-xs">
                            {act.details}
                          </div>
                        )}
                      </td>
                      <td>
                        {act.projectId ? (
                          <Link to={`/projects/${act.projectId}/test-cases`} className="text-link">
                            {projName}
                          </Link>
                        ) : (
                          <span className="text-muted">{projName}</span>
                        )}
                      </td>
                      <td>
                        <strong>{act.actorName}</strong>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="mobile-card-list">
            {paginatedActivities.map((act) => {
              const projName = getProjectName(act)
              const displayTime = new Date(act.createdAt).toLocaleString()

              return (
                <div className="mobile-card" key={act.id}>
                  <div className="mobile-card-header">
                    <span className="mono text-muted" style={{ fontSize: '11px' }}>
                      {displayTime}
                    </span>
                    <div className="mobile-card-header-badges">
                      <StatusPill tone={badgeTones[act.entityType] || 'pending'}>
                        {act.entityType.toUpperCase().replace('_', ' ')}
                      </StatusPill>
                    </div>
                  </div>
                  <h3 className="mobile-card-title" style={{ fontSize: '14px', fontWeight: 600, margin: '6px 0' }}>
                    <strong>{act.actorName || 'System'}</strong>: {act.title}
                  </h3>
                  <div className="mobile-card-details">
                    <div>
                      <span>Action:</span>
                      <strong>{act.action ? act.action.replace('_', ' ') : 'updated'}</strong>
                    </div>
                    <div>
                      <span>Actor:</span>
                      <strong>{act.actorName}</strong>
                    </div>
                    <div>
                      <span>Project:</span>
                      <strong>
                        {act.projectId ? (
                          <Link to={`/projects/${act.projectId}/test-cases`} className="text-link">
                            {projName}
                          </Link>
                        ) : (
                          projName
                        )}
                      </strong>
                    </div>
                    {act.details && (
                      <div style={{ display: 'block', width: '100%' }} className="mt-sm">
                        <span>Details:</span>
                        <div className="text-muted" style={{ fontSize: '12px', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                          {act.details}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="table-pagination" aria-label="Activity pagination">
            <div className="rows-per-page">
              <span>Rows</span>
              <select
                aria-label="Activity rows per page"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
              >
                {ACTIVITY_PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <span className="pagination-summary">
              {startItem}-{endItem} of {filteredActivities.length}
            </span>
            <div className="pagination-actions">
              <button
                className="secondary-button icon-button"
                type="button"
                aria-label="Previous activity page"
                disabled={currentPage === 1}
                onClick={() => setPage(Math.max(1, currentPage - 1))}
              >
                <ChevronLeftIcon width={14} height={14} />
              </button>
              <span className="page-indicator">{currentPage} / {totalPages}</span>
              <button
                className="secondary-button icon-button"
                type="button"
                aria-label="Next activity page"
                disabled={currentPage === totalPages}
                onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              >
                <ChevronRightIcon width={14} height={14} />
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  )
}
