import { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useUser } from '../context/UserContext'
import { useProjects } from '../hooks/useProjects'
import { getBugs, getTestCases, getTestRuns } from '../utils/storage'
import { isFirebaseEnabled } from '../utils/firebase'
import { getStoragePercent, getStorageStatus } from '../utils/storageQuota'
import { useRemoteSync } from '../hooks/useRemoteSync'
import { getProjectReportMetrics } from '../utils/reportMetrics'
import { usePresence } from '../hooks/usePresence'
import { ChevronDownIcon } from './Icons'

const globalNav = [
  { label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
  { label: 'Projects', to: '/projects', icon: 'projects' },
  { label: 'Reports', to: '/reports', icon: 'reports' },
  { label: 'Activity', to: '/activity', icon: 'activity' },
  { label: 'Backup', to: '/backup', icon: 'backup' },
]

const projectNav = [
  { label: 'Test cases', path: 'test-cases', icon: 'cases' },
  { label: 'Test runs', path: 'test-runs', icon: 'runs' },
  { label: 'Bug tracker', path: 'bugs', icon: 'bug' },
  { label: 'Reports', path: 'reports', icon: 'reports' },
  { label: 'Settings', path: 'settings', icon: 'settings' },
]

function Icon({ name }) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="8" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="15" width="7" height="6" rx="1.5" /></>,
    projects: <><path d="M3 7h6l2 2h10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><path d="M3 7V5a2 2 0 0 1 2-2h4l2 2h4" /></>,
    reports: <><path d="M4 19V5" /><path d="M20 19H4" /><path d="M8 15v-4" /><path d="M13 15V8" /><path d="M18 15v-6" /></>,
    activity: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
    backup: <><path d="M12 3v10" /><path d="m8 9 4 4 4-4" /><path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" /></>,
    cases: <><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="m3 6 .8.8L5.5 5" /><path d="m3 12 .8.8 1.7-1.8" /><path d="m3 18 .8.8 1.7-1.8" /></>,
    runs: <><path d="M5 4v16" /><path d="m5 12 6-4v8Z" /><path d="M15 8h4" /><path d="M15 16h4" /></>,
    bug: <><path d="M8 8a4 4 0 0 1 8 0v8a4 4 0 0 1-8 0Z" /><path d="M3 13h5" /><path d="M16 13h5" /><path d="M4 20l4-3" /><path d="m16 17 4 3" /><path d="M9 4 7 2" /><path d="m15 4 2-2" /></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9.3 1.7 1.7 0 0 0-.8 1.6V22H9.1v-.2a1.7 1.7 0 0 0-.8-1.6 1.7 1.7 0 0 0-1.9-.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9-.3A1.7 1.7 0 0 0 9.1 2V2h5.8v.2a1.7 1.7 0 0 0 .8 1.6 1.7 1.7 0 0 0 1.9.3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function UserPill() {
  const { user, updateUser } = useUser()
  const { firebaseUser, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const isGuest = isFirebaseEnabled && firebaseUser?.isAnonymous
  const displayName = user || firebaseUser?.displayName || firebaseUser?.email || 'User'
  const initials = displayName.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const photoURL = !isGuest ? firebaseUser?.photoURL : null

  const startEdit = () => { setDraft(user); setEditing(true); setOpen(false) }
  const saveEdit = (e) => { e.preventDefault(); updateUser(draft); setEditing(false) }

  return (
    <div className="user-pill-wrap" ref={ref}>
      <button
        className="user-pill"
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        {photoURL
          ? <img className="user-pill-photo" src={photoURL} alt="" aria-hidden referrerPolicy="no-referrer" />
          : <span className="user-pill-avatar">{initials}</span>
        }
        <span className="user-pill-name">{displayName}</span>
        {isGuest && <span className="user-guest-badge">Guest</span>}
        <ChevronDownIcon width={12} height={12} />
      </button>

      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-header">
            {photoURL
              ? <img className="user-dropdown-photo" src={photoURL} alt="" aria-hidden referrerPolicy="no-referrer" />
              : <span className="avatar">{initials}</span>
            }
            <div>
              <strong>{displayName}</strong>
              <span>{isGuest ? 'Sign in to sync across devices' : (firebaseUser?.email ?? 'Local mode')}</span>
            </div>
          </div>
          <hr className="user-dropdown-divider" />
          {!isGuest && (
            <button className="user-dropdown-item" role="menuitem" onClick={startEdit}>
              Edit display name
            </button>
          )}
          {isFirebaseEnabled && firebaseUser && (
            isGuest ? (
              <button
                className="user-dropdown-item"
                role="menuitem"
                onClick={() => { setOpen(false); signOut() }}
              >
                Sign in / Create account
              </button>
            ) : (
              <button
                className="user-dropdown-item user-dropdown-item--danger"
                role="menuitem"
                onClick={() => { setOpen(false); signOut() }}
              >
                Sign out
              </button>
            )
          )}
        </div>
      )}

      {editing && (
        <div className="user-edit-popover" role="dialog" aria-label="Edit display name">
          <form onSubmit={saveEdit}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label="Display name"
              placeholder="Name shown on audit trail & assignments"
            />
            <div className="user-edit-actions">
              <button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="primary-button" disabled={!draft.trim()}>Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

function ProjectSidebar({ projectId }) {
  const { projects } = useProjects()
  const project = projects.find((p) => p.id === projectId)
  const base = `/projects/${projectId}`

  return (
    <aside className="project-sidebar" aria-label="Project navigation">
      <div className="project-context">
        <span>Project</span>
        <strong>{project?.name ?? 'Unknown'}</strong>
      </div>
      <nav>
        {projectNav.map((item) => (
          <NavLink key={item.path} to={`${base}/${item.path}`}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}

function ProjectPresence({ projectId, currentPage }) {
  const activeUsers = usePresence(projectId, currentPage)
  if (!activeUsers || activeUsers.length === 0) return null

  return (
    <div className="project-presence" title="Active viewers in this project">
      {activeUsers.map((u) => {
        const initials = u.userName
          ? u.userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
          : '?'
        return (
          <span
            key={u.id}
            className="presence-avatar"
            title={`${u.userName} (Viewing ${u.currentPage || 'Project'})`}
          >
            {initials}
          </span>
        )
      })}
    </div>
  )
}

function ProjectOverview({ projectId }) {
  const { pathname } = useLocation()
  const { projects } = useProjects()
  const project = projects.find((p) => p.id === projectId)
  if (!project) return null

  const testCases = getTestCases(projectId)
  const bugs = getBugs(projectId)
  const runs = getTestRuns(projectId)

  const metrics = getProjectReportMetrics({ project, testCases, bugs, runs })

  const {
    total,
    openBugs,
    passRate,
    latestRun,
    health
  } = metrics

  let currentPage = 'Overview'
  if (pathname.includes('/test-cases')) currentPage = 'Test Cases'
  else if (pathname.includes('/test-runs')) currentPage = 'Test Runs'
  else if (pathname.includes('/bugs')) currentPage = 'Bug Tracker'
  else if (pathname.includes('/reports')) currentPage = 'Reports'
  else if (pathname.includes('/settings')) currentPage = 'Settings'

  return (
    <section className="project-overview-bar" aria-label="Project health summary">
      <div className="project-bar-info">
        <span className={`project-health-badge health-badge--${health.tone}`}>{health.label}</span>
        <h2>{project.name}</h2>
        {project.description && <span className="project-bar-desc">— {project.description}</span>}
        <ProjectPresence projectId={projectId} currentPage={currentPage} />
      </div>
      <div className="project-bar-metrics">
        <div className="bar-metric">
          <span className="bar-metric-label">Pass rate</span>
          <strong className="bar-metric-val">{passRate}%</strong>
        </div>
        <div className="bar-metric-divider" />
        <div className="bar-metric">
          <span className="bar-metric-label">Cases</span>
          <strong className="bar-metric-val">{total}</strong>
        </div>
        <div className="bar-metric-divider" />
        <div className="bar-metric">
          <span className="bar-metric-label">Open bugs</span>
          <strong className={`bar-metric-val ${openBugs ? 'status-text--failed' : ''}`}>{openBugs}</strong>
        </div>
        <div className="bar-metric-divider" />
        <div className="bar-metric">
          <span className="bar-metric-label">Latest run</span>
          <strong className="bar-metric-val">{latestRun?.name ?? 'None'}</strong>
        </div>
      </div>
    </section>
  )
}

function StorageWarningBanner() {
  const [dismissed, setDismissed] = useState(false)
  const remoteReady = useRemoteSync()
  const status = getStorageStatus()
  if (status === 'ok' || dismissed) return null
  const pct = getStoragePercent()
  const isCritical = status === 'critical'
  // When cloud sync is active the local cache is disposable — Firestore is the
  // source of truth — so don't scare the user with "data loss"; point them to
  // the Backup page where they can free space safely.
  const message = remoteReady
    ? `Local cache ${pct}% full — your data is safe in the cloud. Free up space from Backup.`
    : isCritical
      ? `Storage critical (${pct}% full) — export a backup immediately to avoid data loss.`
      : `Storage at ${pct}% — consider exporting a backup soon.`
  return (
    <div className={`storage-banner storage-banner--${remoteReady ? 'warning' : status}`} role="alert">
      <span>{message}</span>
      <NavLink to="/backup" className="storage-banner-link">{remoteReady ? 'Free up space' : 'Export backup'}</NavLink>
      <button className="storage-banner-dismiss" type="button" onClick={() => setDismissed(true)} aria-label="Dismiss">×</button>
    </div>
  )
}

export function Layout({ children }) {
  const { pathname } = useLocation()
  const match = pathname.match(/^\/projects\/([^/]+)/)
  const projectId = match?.[1]

  return (
    <div className="app-shell">
      <StorageWarningBanner />
      <header className="topbar">
        <NavLink to="/dashboard" className="brand" aria-label="QA Lab dashboard">
          <span className="brand-mark" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.0" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 11 2 2 4-4" />
            </svg>
          </span>
          <span>QA Lab</span>
        </NavLink>

        <nav className="topnav" aria-label="Main navigation">
          {globalNav.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="topbar-actions">
          <UserPill />
        </div>
      </header>

      <div className="workspace">
        {projectId && <ProjectSidebar projectId={projectId} />}
        <main className="content">
          {projectId && <ProjectOverview projectId={projectId} />}
          {children}
        </main>
      </div>
    </div>
  )
}
