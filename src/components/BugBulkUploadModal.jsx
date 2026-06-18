import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Modal } from './Modal'
import { CheckIcon, XIcon, DownloadIcon } from './Icons'
import { parseBugFileBuffer, rowToBug } from '../utils/parseBugFile'
import { downloadBugTemplate } from '../utils/export'
import { addActivity } from '../utils/activity'

const ACCEPT = '.xlsx,.xls,.csv'

// ── Google Sheets helpers ─────────────────────────────────────────────────
const SHEET_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
const GID_RE = /gid=(\d+)/

function parseGoogleSheetUrl(url) {
  const idMatch = url.trim().match(SHEET_ID_RE)
  if (!idMatch) return null
  const gidMatch = url.trim().match(GID_RE)
  return { sheetId: idMatch[1], gid: gidMatch ? gidMatch[1] : '0' }
}

function toCsvExportUrl(sheetId, gid) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
}

function textToBuffer(text) {
  return new TextEncoder().encode(text).buffer
}

// ── Duplicate detection ───────────────────────────────────────────────────
function norm(v) { return String(v ?? '').trim().toLowerCase() }

function findExistingBug(data, existingBugs) {
  if (data.sourceBugId) {
    const match = existingBugs.find((b) => b.sourceBugId && norm(b.sourceBugId) === norm(data.sourceBugId))
    if (match) return { bug: match, reason: `Bug ID ${data.sourceBugId}` }
  }
  if (data.title) {
    const match = existingBugs.find((b) => norm(b.title) === norm(data.title))
    if (match) return { bug: match, reason: 'same title' }
  }
  return null
}

function bugDuplicateKey(data) {
  if (data.sourceBugId) return `id:${norm(data.sourceBugId)}`
  if (data.title) return `title:${norm(data.title)}`
  return ''
}

function prepareRows(parsedRows, existingBugs) {
  const seen = new Map()
  return parsedRows.map((row) => {
    if (row.errors.length > 0) return { ...row, duplicate: null, action: 'skip' }
    const existing = findExistingBug(row.data, existingBugs)
    if (existing) return { ...row, duplicate: { type: 'existing', ...existing }, action: 'skip' }
    const key = bugDuplicateKey(row.data)
    if (key && seen.has(key)) {
      return { ...row, duplicate: { type: 'file', rowNum: seen.get(key), reason: `same as row ${seen.get(key)}` }, action: 'skip' }
    }
    if (key) seen.set(key, row.rowNum)
    return { ...row, duplicate: null, action: 'create' }
  })
}

// ── Linked TC resolution ──────────────────────────────────────────────────
function resolveLinkedTc(linkedTcId, testCases) {
  if (!linkedTcId) return ''
  const tc = testCases.find(
    (t) => (t.sourceTcId && norm(t.sourceTcId) === norm(linkedTcId)) || norm(t.title) === norm(linkedTcId)
  )
  return tc ? tc.id : ''
}

// ── Stepper ───────────────────────────────────────────────────────────────
const STEPS = ['Upload', 'Preview', 'Done']

function Stepper({ step }) {
  return (
    <div className="bulk-stepper" aria-label="Progress">
      {STEPS.map((label, i) => (
        <div key={label} className={`bulk-step ${i < step ? 'bulk-step--done' : i === step ? 'bulk-step--active' : ''}`}>
          <span className="bulk-step-dot">{i < step ? <CheckIcon width={12} height={12} /> : i + 1}</span>
          <span className="bulk-step-label">{label}</span>
          {i < STEPS.length - 1 && <span className="bulk-step-line" />}
        </div>
      ))}
    </div>
  )
}

// ── Drop zone ─────────────────────────────────────────────────────────────
function DropZone({ onFile }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  const handle = (file) => {
    if (!file) return
    const ext = file.name.split('.').pop().toLowerCase()
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      setError('Invalid file type. Please upload a .xlsx, .xls, or .csv file.')
      return
    }
    setError('')
    const reader = new FileReader()
    reader.onload = (e) => onFile(e.target.result, file.name)
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="bulk-upload-step">
      <div
        className={`drop-zone${dragging ? ' drop-zone--active' : ''}`}
        onClick={() => inputRef.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
        role="button"
        tabIndex={0}
        aria-label="Upload file"
        onKeyDown={(e) => e.key === 'Enter' && inputRef.current.click()}
      >
        <span className="drop-zone-icon" aria-hidden>📂</span>
        <span className="drop-zone-text">Drop a file here or <u>browse</u></span>
        <span className="drop-zone-hint">Accepts .xlsx, .xls, .csv</span>
        <input ref={inputRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
          onChange={(e) => handle(e.target.files[0])} />
      </div>
      {error && <p className="bulk-file-error">{error}</p>}
      <div className="bulk-template-row">
        <p className="bulk-template-hint">
          Required column: <em>Bug Title</em>. Download the template for all 20 fields.
        </p>
        <button className="secondary-button" type="button" onClick={downloadBugTemplate}>
          <DownloadIcon width={14} height={14} /> Download template
        </button>
      </div>
    </div>
  )
}

// ── Google Sheet import ───────────────────────────────────────────────────
function GoogleSheetImport({ onCsvParsed }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleImport = async () => {
    const parsed = parseGoogleSheetUrl(url)
    if (!parsed) {
      setError('Invalid Google Sheets URL. Please paste a link that contains /spreadsheets/d/.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(toCsvExportUrl(parsed.sheetId, parsed.gid))
      if (!res.ok) {
        setError(res.status === 403 || res.status === 404
          ? 'This sheet must be public or published to the web. Check sharing settings and try again.'
          : `Failed to fetch sheet (HTTP ${res.status}). Please verify the link and try again.`)
        return
      }
      const csvText = await res.text()
      if (!csvText || csvText.trim().length === 0) {
        setError('The sheet appears to be empty. Please check the content and try again.')
        return
      }
      onCsvParsed(textToBuffer(csvText), 'google-sheet.csv')
    } catch {
      setError(
        'Could not fetch the sheet. This sheet must be public or published to the web. ' +
        'Private sheets cannot be imported without authentication.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bulk-upload-step">
      <div className="gs-import">
        <label className="gs-label">
          Google Sheets URL
          <input
            type="url"
            className="gs-input"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={url}
            onChange={(e) => { setUrl(e.target.value); setError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter' && url.trim()) handleImport() }}
            disabled={loading}
            aria-label="Google Sheets URL"
          />
        </label>
        <button
          className="primary-button"
          type="button"
          disabled={!url.trim() || loading}
          onClick={handleImport}
        >
          {loading ? 'Fetching…' : 'Import from link'}
        </button>
      </div>
      {loading && (
        <div className="gs-loading" aria-live="polite">
          <span className="gs-spinner" />
          <span>Fetching sheet data…</span>
        </div>
      )}
      {error && <p className="bulk-file-error">{error}</p>}
      <div className="bulk-template-row">
        <p className="bulk-template-hint">
          Paste a link to a <em>public</em> Google Sheet with the bug template columns.
        </p>
        <button className="secondary-button" type="button" onClick={downloadBugTemplate}>
          <DownloadIcon width={14} height={14} /> Download template
        </button>
      </div>
    </div>
  )
}

// ── Badges ────────────────────────────────────────────────────────────────
function ValidationBadge({ errors }) {
  if (errors.length === 0) return <span className="vbadge vbadge--valid"><CheckIcon width={12} height={12} /> Valid</span>
  return (
    <span className="vbadge vbadge--invalid" title={errors.join('\n')}>
      <XIcon width={12} height={12} /> {errors.length} error{errors.length > 1 ? 's' : ''}
    </span>
  )
}

function DuplicateBadge({ duplicate }) {
  if (!duplicate) return <span className="text-muted">—</span>
  if (duplicate.type === 'existing') return <span className="vbadge vbadge--warning" title={duplicate.bug?.title}>Existing bug</span>
  return <span className="vbadge vbadge--warning" title={duplicate.reason}>File duplicate</span>
}

// ── Main modal ────────────────────────────────────────────────────────────
const IMPORT_TABS = [
  { key: 'file', label: 'File upload' },
  { key: 'google', label: 'Google Sheet' },
]

export function BugBulkUploadModal({ existingBugs = [], testCases = [], onImport, onClose }) {
  const { projectId } = useParams()
  const [step, setStep]           = useState(0)
  const [rows, setRows]           = useState([])
  const [filename, setFilename]   = useState('')
  const [summary, setSummary]     = useState(null)
  const [importTab, setImportTab] = useState('file')

  const validRows     = rows.filter((r) => r.errors.length === 0 && r.action !== 'skip')
  const invalidRows   = rows.filter((r) => r.errors.length > 0)
  const duplicateRows = rows.filter((r) => r.duplicate)

  const handleFile = (buffer, name) => {
    try {
      const { rows: parsed } = parseBugFileBuffer(buffer, name)
      setFilename(name)
      setRows(prepareRows(parsed, existingBugs))
      setStep(1)
    } catch (err) {
      console.error('[bugBulkUpload] Parse failed:', err)
      addActivity({
        entityType: 'import',
        projectId,
        action: 'imported',
        title: `Bug CSV import failed: ${err.message || 'Invalid format'}`,
        metadata: { filename: name, error: err.message }
      })
    }
  }

  const setRowAction = (rowNum, action) => {
    setRows((cur) => cur.map((r) => r.rowNum === rowNum ? { ...r, action } : r))
  }

  const handleImport = () => {
    validRows.forEach((r) => {
      const bug = rowToBug(r.data)
      bug.linkedTestCase = resolveLinkedTc(r.data.linkedTcId, testCases)
      bug.skipActivityLog = true
      onImport(bug)
    })

    if (validRows.length > 0) {
      addActivity({
        entityType: 'import',
        projectId,
        action: 'imported',
        title: `${validRows.length} bugs imported`,
        details: `${validRows.length} bugs created from bulk upload.`,
        metadata: {
          filename,
          count: validRows.length,
          source: importTab === 'google' ? 'Google Sheet' : 'CSV/Excel file',
        }
      })
    }

    setSummary({ total: rows.length, created: validRows.length, skipped: rows.length - validRows.length })
    setStep(2)
  }

  const reset = () => { setStep(0); setRows([]); setFilename(''); setSummary(null); setImportTab('file') }

  const modalStyle = step === 1 ? { maxWidth: 1020 } : {}

  return (
    <Modal title="Import bugs" onClose={onClose} style={modalStyle}>
      <div className="bulk-modal-body">
        <Stepper step={step} />

        {/* Step 0: Upload */}
        {step === 0 && (
          <>
            <div className="bulk-import-tabs" role="tablist" aria-label="Import source">
              {IMPORT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={importTab === tab.key}
                  className={`bulk-import-tab${importTab === tab.key ? ' bulk-import-tab--active' : ''}`}
                  type="button"
                  onClick={() => setImportTab(tab.key)}
                >
                  {tab.key === 'file' && <span className="bulk-import-tab-icon" aria-hidden>📁</span>}
                  {tab.key === 'google' && <span className="bulk-import-tab-icon" aria-hidden>📊</span>}
                  {tab.label}
                </button>
              ))}
            </div>
            <div role="tabpanel">
              {importTab === 'file' && <DropZone onFile={handleFile} />}
              {importTab === 'google' && <GoogleSheetImport onCsvParsed={handleFile} />}
            </div>
          </>
        )}

        {/* Step 1: Preview */}
        {step === 1 && (
          <>
            <div className="bulk-file-bar">
              <span className="bulk-filename">📄 {filename}</span>
              <button className="link-btn" type="button" onClick={reset}>Change file</button>
            </div>

            <div className="bulk-counts">
              <span className="bulk-count-total">{rows.length} rows found</span>
              {validRows.length > 0 && <span className="vbadge vbadge--valid">{validRows.length} selected</span>}
              {invalidRows.length > 0 && <span className="vbadge vbadge--invalid">{invalidRows.length} invalid — will be skipped</span>}
              {duplicateRows.length > 0 && <span className="vbadge vbadge--warning">{duplicateRows.length} duplicate</span>}
            </div>

            {rows.length === 0 ? (
              <div className="empty-table-row">No data rows found in the file.</div>
            ) : (
              <div className="table-wrap bulk-preview-table">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th style={{ width: 90 }}>Bug ID</th>
                      <th>Title</th>
                      <th style={{ width: 90 }}>Severity</th>
                      <th style={{ width: 90 }}>Priority</th>
                      <th style={{ width: 110 }}>Validation</th>
                      <th style={{ width: 120 }}>Duplicate</th>
                      <th style={{ width: 130 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNum} className={row.errors.length ? 'bulk-row--invalid' : row.duplicate ? 'bulk-row--duplicate' : ''}>
                        <td className="mono tc-id">{row.rowNum}</td>
                        <td className="mono tc-id">{row.data.sourceBugId || '—'}</td>
                        <td title={row.data.title} className="bulk-cell-truncate">
                          {row.data.title || <em className="text-muted">—</em>}
                        </td>
                        <td>{row.data.severity || '—'}</td>
                        <td>{row.data.priority || '—'}</td>
                        <td><ValidationBadge errors={row.errors} /></td>
                        <td><DuplicateBadge duplicate={row.duplicate} /></td>
                        <td>
                          <select
                            className="inline-select bulk-action-select"
                            value={row.action}
                            aria-label={`Import action for row ${row.rowNum}`}
                            disabled={row.errors.length > 0}
                            onChange={(e) => setRowAction(row.rowNum, e.target.value)}
                          >
                            {row.duplicate && <option value="skip">Skip</option>}
                            <option value="create">Import as new</option>
                            {!row.duplicate && <option value="skip">Skip</option>}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-footer">
              <button className="secondary-button" type="button" onClick={reset}>Back</button>
              <button className="primary-button" type="button"
                disabled={validRows.length === 0} onClick={handleImport}>
                Import {validRows.length} bug{validRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {/* Step 2: Done */}
        {step === 2 && summary && (
          <div className="bulk-summary">
            <span className="bulk-summary-icon" aria-hidden>✅</span>
            <h3>Import complete</h3>
            <div className="bulk-summary-stats">
              <div><strong>{summary.total}</strong><span>Total rows</span></div>
              <div><strong className="metric-passed">{summary.created}</strong><span>Imported</span></div>
              <div>
                <strong className={summary.skipped > 0 ? 'metric-failed' : ''}>{summary.skipped}</strong>
                <span>Skipped</span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="secondary-button" type="button" onClick={reset}>Upload another</button>
              <button className="primary-button" type="button" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
