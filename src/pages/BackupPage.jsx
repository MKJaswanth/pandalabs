import { useRef, useState } from 'react'
import { PageHeader } from '../components/PageHeader'
import { useConfirm } from '../context/useConfirm'
import { useToast } from '../context/useToast'
import {
  createWorkspaceBackup,
  downloadWorkspaceBackup,
  restoreWorkspaceBackup,
  summarizeBackup,
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
  const fileRef = useRef(null)
  const [parsed, setParsed] = useState(null)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('merge')
  const [restored, setRestored] = useState(false)
  const currentSummary = summarizeBackup(createWorkspaceBackup())
  const importSummary = parsed ? summarizeBackup(parsed) : null

  const readFile = (file) => {
    setError('')
    setRestored(false)
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
    reader.readAsText(file)
  }

  const restore = async () => {
    if (!parsed) return
    if (mode === 'replace') {
      const ok = await confirm({
        title: 'Replace workspace?',
        message: 'Replace the current workspace with this backup? This cannot be undone unless you already exported a backup.',
        confirmLabel: 'Replace workspace',
        danger: true,
      })
      if (!ok) return
    }
    restoreWorkspaceBackup(parsed, mode)
    setRestored(true)
    toast.success(mode === 'replace' ? 'Workspace restored' : 'Backup merged')
  }

  return (
    <>
      <PageHeader
        title="Backup"
        description="Export or restore the full local QA Lab workspace."
        action={
          <button className="primary-button" type="button" onClick={downloadWorkspaceBackup}>
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

              <div className="restore-actions">
                <button className="secondary-button" type="button" onClick={() => { setParsed(null); setError(''); setRestored(false) }}>
                  Clear file
                </button>
                <button className="primary-button" type="button" onClick={restore}>
                  Restore workspace
                </button>
              </div>
            </div>
          )}

          {restored && (
            <div className="backup-alert backup-alert--success">
              Workspace restored. Navigate to Dashboard or Projects to review the imported data.
            </div>
          )}
        </article>
      </section>
    </>
  )
}
