import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Layout } from './components/Layout'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import { ConfirmProvider } from './context/ConfirmContext'
import { ToastProvider } from './context/ToastContext'
import { UserContext } from './context/UserContext'
import { useCurrentUser } from './hooks/useCurrentUser'
import { isFirebaseEnabled } from './utils/firebase'
import { AuthPage } from './pages/AuthPage'
import { BackupPage } from './pages/BackupPage'
import { BugTrackerPage } from './pages/BugTrackerPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProjectReportsPage } from './pages/ProjectReportsPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { ReportsPage } from './pages/ReportsPage'
import { SettingsPage } from './pages/SettingsPage'
import { TestCaseDetailPage } from './pages/TestCaseDetailPage'
import { TestCasesPage } from './pages/TestCasesPage'
import { TestRunDetailPage } from './pages/TestRunDetailPage'
import { TestRunsPage } from './pages/TestRunsPage'
import { UpdatesPage } from './pages/UpdatesPage'
import './App.css'

function NamePicker({ onDone }) {
  const [name, setName] = useState('')
  return (
    <div className="name-picker-backdrop">
      <div className="name-picker">
        <div className="name-picker-brand">
          <span className="brand-mark" aria-hidden="true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.0" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 11 2 2 4-4" />
            </svg>
          </span>
          <span>QA Lab</span>
        </div>
        <h1>Welcome</h1>
        <p>Manage testing without the enterprise clutter.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) onDone(name.trim())
          }}
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            aria-label="Your name"
          />
          <button type="submit" className="primary-button" disabled={!name.trim()}>
            Get started
          </button>
        </form>
      </div>
    </div>
  )
}

const appRoutes = (
  <Routes>
    <Route path="/" element={<Navigate to="/dashboard" replace />} />
    <Route path="/dashboard" element={<DashboardPage />} />
    <Route path="/projects" element={<ProjectsPage />} />
    <Route path="/updates" element={<UpdatesPage />} />
    <Route path="/reports" element={<ReportsPage />} />
    <Route path="/backup" element={<BackupPage />} />
    <Route path="/projects/:projectId/test-cases" element={<TestCasesPage />} />
    <Route path="/projects/:projectId/test-cases/:testCaseId" element={<TestCaseDetailPage />} />
    <Route path="/projects/:projectId/test-runs" element={<TestRunsPage />} />
    <Route path="/projects/:projectId/test-runs/:runId" element={<TestRunDetailPage />} />
    <Route path="/projects/:projectId/bugs" element={<BugTrackerPage />} />
    <Route path="/projects/:projectId/reports" element={<ProjectReportsPage />} />
    <Route path="/projects/:projectId/settings" element={<SettingsPage />} />
  </Routes>
)

function AppShell() {
  const { user, updateUser } = useCurrentUser()
  const { firebaseUser, loading } = useAuth()

  // Auto-populate display name from Firebase profile on first sign-in
  useEffect(() => {
    if (isFirebaseEnabled && firebaseUser && !user) {
      const name = firebaseUser.isAnonymous
        ? 'Guest'
        : (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User')
      updateUser(name)
    }
  }, [firebaseUser, user, updateUser])

  // Firebase auth still resolving
  if (isFirebaseEnabled && loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-spinner" aria-label="Loading" />
      </div>
    )
  }

  // Firebase enabled but not signed in → show auth page
  if (isFirebaseEnabled && !firebaseUser) {
    return <AuthPage />
  }

  // localStorage mode: no name set → show name picker
  if (!user) {
    return (
      <UserContext.Provider value={{ user, updateUser }}>
        <NamePicker onDone={updateUser} />
      </UserContext.Provider>
    )
  }

  return (
    <UserContext.Provider value={{ user, updateUser }}>
      <HashRouter>
        <ErrorBoundary>
          <Layout>
            {appRoutes}
          </Layout>
        </ErrorBoundary>
      </HashRouter>
    </UserContext.Provider>
  )
}

export function App() {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <AppShell />
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  )
}

export default App
