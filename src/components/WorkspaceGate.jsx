import { useWorkspaceSync } from '../context/useWorkspaceSync'

// Gates the signed-in app on the authoritative workspace load:
//   syncing  → full-screen "Syncing workspace…"
//   error    → reachability error with retry
//   conflict → blocking recovery dialog (cloud empty + local data)
//   else     → render the app
export function WorkspaceGate({ children }) {
  const { status, retry, uploadLocalToCloud, clearLocalAndContinue, downloadBackup } = useWorkspaceSync()

  if (status === 'syncing') {
    return (
      <div className="app-loading">
        <div className="app-loading-stack">
          <div className="app-loading-spinner" aria-label="Syncing workspace" />
          <p className="app-loading-text">Syncing workspace…</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="app-loading">
        <div className="app-loading-stack">
          <p className="app-loading-text">Couldn’t reach the cloud workspace.</p>
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
