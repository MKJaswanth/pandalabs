import { useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import { isFirebaseEnabled } from '../utils/firebase'
import { suppressSubscriptions } from '../utils/remoteStorage'
import { addActivity } from '../utils/activity'
import { clearWorkspaceCache } from '../utils/storage'
import { getStoragePercent } from '../utils/storageQuota'
import { useRemoteSync } from '../hooks/useRemoteSync'
import {
  createWorkspaceBackup,
  downloadWorkspaceBackup,
  restoreWorkspaceBackup,
  summarizeBackup,
  uploadWorkspaceToCloud,
  validateWorkspaceBackup,
} from '../utils/backup'

function SummaryGrid({ summary }) {
  return (
    <div className="backup-summary-grid">
      <article><span>Projects</span><strong>{summary.projects}</strong></article>
      <article><span>Test cases</span><strong>{summary.testCases}</strong></article>
      <article><span>Bugs</span><strong>{summary.bugs}</strong></article>
      <article><span>Runs</span><strong>{summary.runs}</strong></article>
      <article><span>Members</span><strong>{summary.teamMembers}</strong></article>
    </div>
  )
}

export function BackupPage() {
  const confirm = useConfirm()
  const toast = useToast()
  const remoteReady = useRemoteSync()
  const storagePct = getStoragePercent()
  const fileRef = useRef(null)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('merge')
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const currentSummary = summarizeBackup(createWorkspaceBackup())
  const importSummary = parsed ? summarizeBackup(parsed) : null

  const readFile = (file) => {
    setError('')
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        setParsed(validateWorkspaceBackup(String(reader.result)))
      } catch (err) {
        setParsed(null)
        setError(err.message)
      }
    }
    reader.onerror = () => setError('Could not read the selected file.')
    reader.readAsText(file)
  }

  const runCloudSync = async () => {
    setSyncing(true)
    setSyncError('')
    try {
      await uploadWorkspaceToCloud(parsed, mode)
      toast.success('Workspace restored and synced to cloud.')
      setTimeout(() => window.location.reload(), 900)
    } catch (err) {
      setSyncError(err.message ?? 'Unknown error')
      toast.error(`Cloud sync failed: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleExport = () => {
    downloadWorkspaceBackup()
    addActivity({
      entityType: 'backup',
      action: 'exported',
      title: 'Backup exported',
      details: 'JSON backup file exported/downloaded'
    })
  }

  const handleClearCache = async () => {
    const ok = await confirm({
      title: 'Clear local cache?',
      message: remoteReady
        ? 'This clears QA Lab\'s local browser cache to free up space, then reloads and re-syncs everything from the cloud. Your cloud data is not affected. Exporting a backup first is recommended, just in case.'
        : 'You are NOT connected to cloud sync, so this local cache is your only copy. Export a backup FIRST — clearing will permanently remove local data.',
      confirmLabel: remoteReady ? 'Clear & re-sync' : 'Clear local data',
      danger: !remoteReady,
    })
    if (!ok) return
    addActivity({
      entityType: 'backup',
      action: 'cache_cleared',
      title: 'Local cache cleared',
      details: 'Local browser cache cleared to free space; reloaded from cloud',
    })
    clearWorkspaceCache()
    window.location.reload()
  }

  const doRestore = async () => {
    if (!parsed) return
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Replace workspace?',
        message: 'This will permanently overwrite the current workspace with the backup. Make sure you have exported a copy first.',
        confirmLabel: 'Replace workspace',
        danger: true,
      })
      if (!ok) return
    }

    try {
      // Block Firestore snapshots from overwriting localStorage while we restore.
      // This flag resets on page reload, so subscriptions work normally afterward.
      if (isFirebaseEnabled) suppressSubscriptions()

      restoreWorkspaceBackup(parsed, mode)

      if (isFirebaseEnabled) {
        // Cloud sync must succeed before we reload — if we reload with Firestore
        // still holding stale data, subscriptions will wipe the restored localStorage.
        await runCloudSync()
      }

      await addActivity({
        entityType: 'backup',
        action: 'restored',
        title: 'Backup restored',
        details: `Workspace backup restored (${mode === 'replace' ? 'replaced workspace' : 'merged backup'})`,
        metadata: { mode, exportedAt: parsed.exportedAt }
      })

      toast.success(mode === 'replace' ? 'Workspace restored from backup.' : 'Backup merged into workspace.')
      setTimeout(() => window.location.reload(), 900)
    } catch (err) {
      console.error('[backup] Restore failed:', err)
      addActivity({
        entityType: 'backup',
        action: 'restored',
        title: `Backup restore failed: ${err.message || 'Unknown error'}`,
        metadata: { mode, error: err.message }
      })
      toast.error(`Restore failed: ${err.message}`)
    }
  }

  return (
    <>
      <PageHeader
        title="Backup"
        description="Export or restore the full local QA Lab workspace."
        action={
          <button className="primary-button" type="button" onClick={handleExport}>
            Export JSON
          </button>
        }
      />

      <section className="backup-layout">
        <article className="panel backup-panel">
          <div className="section-header">
            <h2>Current workspace</h2>
          </div>
          <SummaryGrid summary={currentSummary} />
          <p className="backup-note">
            Export creates one JSON file containing projects, test cases, bugs, test runs, team members, and user data.
          </p>
        </article>

        <article className="panel backup-panel">
          <div className="section-header">
            <h2>Restore backup</h2>
          </div>

          <button className="backup-dropzone" type="button" onClick={() => fileRef.current?.click()}>
            <strong>Choose backup file</strong>
            <span>Only QA Lab JSON backups are accepted.</span>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              onChange={(e) => readFile(e.target.files[0])}
            />
          </button>

          {error && <div className="backup-alert backup-alert--danger">{error}</div>}

          {parsed && (
            <div className="restore-preview">
              <div className="restore-preview-header">
                <div>
                  <span>Backup date</span>
                  <strong>{new Date(parsed.exportedAt).toLocaleString()}</strong>
                </div>
                <span className="status-pill status-pill--passed">Valid file</span>
              </div>
              <SummaryGrid summary={importSummary} />

              <div className="restore-mode">
                <label>
                  <input
                    type="radio"
                    name="restore-mode"
                    checked={mode === 'merge'}
                    onChange={() => setMode('merge')}
                  />
                  <span>
                    <strong>Merge</strong>
                    Add new records and update matching IDs.
                  </span>
                </label>
                <label>
                  <input
                    type="radio"
                    name="restore-mode"
                    checked={mode === 'replace'}
                    onChange={() => setMode('replace')}
                  />
                  <span>
                    <strong>Replace</strong>
                    Clear current workspace, then restore this file.
                  </span>
                </label>
              </div>

              {isFirebaseEnabled && !syncError && (
                <p className="backup-sync-note">
                  {syncing
                    ? 'Syncing to cloud — writing all records in parallel, this will complete shortly…'
                    : 'Firebase is active — restore updates both this browser and the cloud so Firestore subscriptions don\'t overwrite your data.'}
                </p>
              )}
              {syncError && (
                <div className="backup-alert backup-alert--danger">
                  <strong>Cloud sync failed:</strong> {syncError}
                  <br />Your data is restored in this browser but <strong>do not refresh</strong> until you retry the sync — a page reload will overwrite it with the old Firestore data.
                </div>
              )}
              <div className="restore-actions">
                {!syncError && (
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => { setParsed(null); setError(''); setSyncError('') }}
                  >
                    Clear file
                  </button>
                )}
                {syncError ? (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={syncing}
                    onClick={runCloudSync}
                  >
                    {syncing ? 'Retrying…' : 'Retry cloud sync'}
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={syncing}
                    onClick={doRestore}
                  >
                    {syncing ? 'Restoring…' : isFirebaseEnabled ? 'Restore workspace' : 'Restore locally'}
                  </button>
                )}
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="panel backup-panel" style={{ marginTop: 18 }}>
        <div className="section-header">
          <h2>Free up space</h2>
        </div>
        <p className="backup-note">
          Local cache is {storagePct}% full. QA Lab keeps a copy of your workspace in this browser for speed.
          {remoteReady
            ? ' Your data also lives in the cloud, so clearing the local cache is safe — it re-syncs from the cloud on reload.'
            : ' You are not connected to cloud sync, so export a backup before clearing or you will lose local data.'}
        </p>
        <div className="restore-actions">
          <button className="secondary-button" type="button" onClick={handleExport}>Export backup</button>
          <button
            className={remoteReady ? 'secondary-button' : 'danger-button'}
            type="button"
            onClick={handleClearCache}
          >
            Clear local cache &amp; re-sync
          </button>
        </div>
      </section>
    </>
  )
}
