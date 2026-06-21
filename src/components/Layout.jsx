import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useUser } from '../context/UserContext'
import { useProjects } from '../hooks/useProjects'
import { getBugs, getTestCases, getTestRuns } from '../utils/storage'
import { isFirebaseEnabled } from '../utils/firebase'
import { getStoragePercent, getStorageStatus } from '../utils/storageQuota'
import { useRemoteSync } from '../hooks/useRemoteSync'
import { getProjectReportMetrics } from '../utils/reportMetrics'
import { usePresence } from '../hooks/usePresence'
import { ChevronDownIcon, EyeIcon, BugIcon, CheckCircleIcon } from './Icons'
import { useToast } from '../context/useToast'
import { useNotifications } from '../hooks/useNotifications'
import { useUserRole } from '../hooks/useUserRole'


const globalNav = [
  { label: 'Dashboard', to: '/dashboard', icon: 'dashboard' },
  { label: 'Projects', to: '/projects', icon: 'projects' },
  { label: 'Reports', to: '/reports', icon: 'reports' },
  { label: 'Activity', to: '/activity', icon: 'activity' },
  { label: 'Backup', to: '/backup', icon: 'backup' },
]

const projectNav = [
  { label: 'Test cases', path: 'test-cases', icon: 'cases' },
  { label: 'Requirements', path: 'requirements', icon: 'requirements' },
  { label: 'Test runs', path: 'test-runs', icon: 'runs' },
  { label: 'Test plans', path: 'test-plans', icon: 'plans' },
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
    requirements: <><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /><path d="m9 11 3 3L22 4" /></>,
    runs: <><path d="M5 4v16" /><path d="m5 12 6-4v8Z" /><path d="M15 8h4" /><path d="M15 16h4" /></>,
    plans: <><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6" /><path d="M9 16h6" /></>,
    bug: <><path d="M8 8a4 4 0 0 1 8 0v8a4 4 0 0 1-8 0Z" /><path d="M3 13h5" /><path d="M16 13h5" /><path d="M4 20l4-3" /><path d="m16 17 4 3" /><path d="M9 4 7 2" /><path d="m15 4 2-2" /></>,
    settings: <><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9.3 1.7 1.7 0 0 0-.8 1.6V22H9.1v-.2a1.7 1.7 0 0 0-.8-1.6 1.7 1.7 0 0 0-1.9-.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9-.3A1.7 1.7 0 0 0 9.1 2V2h5.8v.2a1.7 1.7 0 0 0 .8 1.6 1.7 1.7 0 0 0 1.9.3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z" /></>,
  }
  return <svg {...common}>{paths[name]}</svg>
}

function UserPill() {
  const { user, updateUser } = useUser()
  const { firebaseUser, signOut } = useAuth()
  const { role } = useUserRole()
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
        {isGuest ? (
          <span className="user-guest-badge">Guest</span>
        ) : (
          <span className={`role-badge role-badge--${role === 'QA Lead' ? 'lead' : role === 'Tester' ? 'tester' : 'viewer'}`} style={{ marginLeft: '6px', marginRight: '4px', flexShrink: 0 }}>
            {role}
          </span>
        )}
        <ChevronDownIcon
          width={12}
          height={12}
          style={{
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease',
            marginRight: '4px',
          }}
        />
      </button>

      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-header">
            {photoURL
              ? <img className="user-dropdown-photo" src={photoURL} alt="" aria-hidden referrerPolicy="no-referrer" />
              : <span className="avatar">{initials}</span>
            }
            <div style={{ display: 'grid', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <strong style={{ margin: 0 }}>{displayName}</strong>
                {!isGuest && (
                  <span className={`role-badge role-badge--${role === 'QA Lead' ? 'lead' : role === 'Tester' ? 'tester' : 'viewer'}`}>
                    {role}
                  </span>
                )}
              </div>
              <span>{isGuest ? 'Sign in to sync across devices' : (firebaseUser?.email ?? 'Local mode')}</span>
            </div>
          </div>
          <hr className="user-dropdown-divider" />
          <Link className="user-dropdown-item" to="/workspace/settings" onClick={() => setOpen(false)} style={{ textDecoration: 'none' }}>
            Workspace Settings
          </Link>
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
  const { isLead } = useUserRole()
  const project = projects.find((p) => p.id === projectId)
  const base = `/projects/${projectId}`

  const visibleNav = isLead
    ? projectNav
    : projectNav.filter((item) => item.path !== 'settings')

  return (
    <aside className="project-sidebar" aria-label="Project navigation">
      <div className="project-context">
        <span>Project</span>
        <strong>{project?.name ?? 'Unknown'}</strong>
      </div>
      <nav>
        {visibleNav.map((item) => (
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
  const toast = useToast()

  if (!activeUsers || activeUsers.length === 0) return null

  const handleAvatarClick = (userName) => {
    navigator.clipboard.writeText(userName)
      .then(() => {
        toast.success(`Copied ${userName} to clipboard`)
      })
      .catch((err) => {
        console.error('Failed to copy username: ', err)
      })
  }

  return (
    <div className="project-presence">
      {activeUsers.map((u) => {
        const initials = u.userName
          ? u.userName.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
          : '?'
        return (
          <div key={u.id} className="presence-avatar-wrap">
            <button
              type="button"
              className="presence-avatar"
              onClick={() => handleAvatarClick(u.userName)}
              aria-label={`Copy ${u.userName} to clipboard`}
            >
              {initials}
            </button>
            <div className="presence-tooltip">
              <div className="presence-tooltip-name">
                <span className="presence-tooltip-status-dot"></span>
                {u.userName}
              </div>
              <div className="presence-tooltip-page">
                <EyeIcon width={12} height={12} style={{ opacity: 0.7 }} />
                <span>{u.currentPage || 'Project'}</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BellIcon(props) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.0" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return undefined
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  const handleNotificationClick = (n) => {
    markAsRead(n.id)
    setOpen(false)
    if (n.type === 'bug_assigned') {
      navigate(`/projects/${n.projectId}/bugs`)
    } else if (n.type === 'test_case_assigned') {
      navigate(`/projects/${n.projectId}/test-cases/${n.entityId}`)
    }
  }

  return (
    <div className="notification-center-wrap" ref={dropdownRef}>
      <button
        type="button"
        className={`notification-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setOpen(!open)}
        aria-label={`Notifications, ${unreadCount} unread`}
      >
        <BellIcon />
        {unreadCount > 0 && <span className="notification-badge-dot" />}
      </button>

      {open && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            <div className="notification-actions">
              {unreadCount > 0 && (
                <button type="button" className="btn-link" onClick={markAllAsRead}>
                  Mark all as read
                </button>
              )}
              {notifications.length > 0 && (
                <button type="button" className="btn-link text-danger" onClick={clearAll}>
                  Clear all
                </button>
              )}
            </div>
          </div>

          <div className="notification-list">
            {notifications.length === 0 ? (
              <div className="notification-empty">
                No new notifications
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`notification-item ${!n.read ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(n)}
                >
                  <div className="notification-item-icon">
                    {n.type === 'bug_assigned' ? (
                      <BugIcon width={14} height={14} className="icon-bug" />
                    ) : (
                      <CheckCircleIcon width={14} height={14} className="icon-test-case" />
                    )}
                  </div>
                  <div className="notification-item-content">
                    <div className="notification-message">{n.message}</div>
                    <div className="notification-time">
                      {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!n.read && <div className="unread-bullet" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
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

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    const html = document.documentElement
    const originalScrollBehavior = html.style.scrollBehavior
    html.style.scrollBehavior = 'auto'
    window.scrollTo(0, 0)
    // Force a reflow to ensure the instant scroll is painted immediately before re-enabling smooth scroll
    html.offsetHeight
    html.style.scrollBehavior = originalScrollBehavior
  }, [pathname])
  return null
}

export function Layout({ children }) {
  const { pathname } = useLocation()
  const match = pathname.match(/^\/projects\/([^/]+)/)
  const projectId = match?.[1]

  return (
    <>
    <ScrollToTop />
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
          <NotificationCenter />
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
    </>
  )
}
