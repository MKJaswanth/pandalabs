import { useWorkspaceSync } from '../context/useWorkspaceSync'
import { useUserRole } from '../hooks/useUserRole'
import { useAuth } from '../context/useAuth'

// Gates the signed-in app on the authoritative workspace load:
//   deleted  → Access Denied blocking screen
//   syncing  → professional app loading screen
//   error    → reachability error with retry
//   conflict → blocking recovery dialog (cloud empty + local data)
//   else     → render the app
export function WorkspaceGate({ children }) {
  const { status, retry, uploadLocalToCloud, clearLocalAndContinue, downloadBackup } = useWorkspaceSync()
  const { isDeleted } = useUserRole()
  const { signOut } = useAuth()

  if (isDeleted) {
    return (
      <div className="app-loading">
        <div className="app-loading-card" style={{ maxWidth: 420, textAlign: 'center', padding: '32px 24px' }}>
          <span className="app-loading-mark" aria-hidden="true" style={{ background: '#fee2e2', color: '#dc2626', marginBottom: '16px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </span>
          <div style={{ marginBottom: '24px' }}>
            <strong style={{ color: '#dc2626', fontSize: '18px', display: 'block', marginBottom: '8px' }}>Access Denied</strong>
            <p className="app-loading-text" style={{ margin: 0, color: '#475569', fontSize: '14px', lineHeight: '1.5' }}>
              Your access to this workspace has been terminated by an administrator. Please contact your QA Lead if you believe this is an error.
            </p>
          </div>
          <button 
            className="primary-button" 
            type="button" 
            onClick={() => signOut()}
            style={{ width: '100%', background: '#dc2626', borderColor: '#dc2626' }}
          >
            Sign out
          </button>
        </div>
      </div>
    )
  }

  if (status === 'syncing') {
    return (
      <div className="app-loading">
        <div className="app-loading-card" role="status" aria-live="polite">
          <span className="app-loading-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="m9 11 2 2 4-4" />
            </svg>
          </span>
          <div className="app-loading-spinner" aria-label="Loading" />
          <div>
            <strong>QA Lab</strong>
            <p className="app-loading-text">Preparing your workspace</p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="app-loading">
        <div className="app-loading-card">
          <span className="app-loading-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M12 8v5" />
              <path d="M12 17h.01" />
            </svg>
          </span>
          <div>
            <strong>QA Lab</strong>
            <p className="app-loading-text">Couldn’t reach the cloud workspace.</p>
          </div>
          <button className="primary-button" type="button" onClick={retry}>Retry</button>
        </div>
      </div>
    )
  }

  if (status === 'conflict') {
    // Rendered without a close affordance — the user must pick an action.
    return (
      <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Workspace conflict">
        <div className="modal" style={{ maxWidth: 480 }}>
          <div className="modal-header">
            <h2>Cloud workspace is empty</h2>
          </div>
          <p className="confirm-message">
            The cloud workspace has no projects yet, but this browser has local data that hasn’t been
            uploaded. Choose what to do so nothing is lost.
          </p>
          <div className="modal-footer modal-footer--stacked">
            <button type="button" className="primary-button" onClick={uploadLocalToCloud}>
              Upload local data to cloud
            </button>
            <button type="button" className="secondary-button" onClick={downloadBackup}>
              Download backup first
            </button>
            <button type="button" className="danger-button" onClick={clearLocalAndContinue}>
              Clear local cache
            </button>
          </div>
        </div>
      </div>
    )
  }

  return children
}

