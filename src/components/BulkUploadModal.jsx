import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { Modal } from './Modal'
import { parseTestCaseFile, rowToTestCase } from '../utils/parseTestCaseFile'
import { CheckIcon, XIcon, DownloadIcon } from './Icons'
import { addActivity } from '../utils/activity'

const ACCEPT = '.xlsx,.xls,.csv'

const TEMPLATE_HEADERS = [
  'TC ID', 'Module', 'Test Scenario', 'Test Case Title',
  'Pre-conditions', 'Test Steps', 'Test Data',
  'Expected Result', 'Actual Result', 'Status', 'Dev Remarks', 'QA Remarks',
]

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ['TC_001', 'Login', 'Valid login flow', 'Verify user can login with valid credentials',
     'User is registered', '1. Go to /login\n2. Enter credentials\n3. Click Sign in',
     'valid@example.com / Pass@123', 'Redirect to dashboard', '', 'Not Executed', '', ''],
  ])
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Test Cases')
  XLSX.writeFile(wb, 'test-cases-template.xlsx')
}

function normalizeKeyPart(value) {
  return String(value ?? '').trim().toLowerCase()
}

function duplicateKey(data) {
  const sourceTcId = normalizeKeyPart(data.sourceTcId)
  if (sourceTcId) return `tc:${sourceTcId}`

  const title = normalizeKeyPart(data.title)
  const module = normalizeKeyPart(data.module)
  if (!title) return ''
  return `title:${module}:${title}`
}

function findExistingMatch(data, existingTestCases) {
  const sourceTcId = normalizeKeyPart(data.sourceTcId)
  if (sourceTcId) {
    const match = existingTestCases.find((tc) => normalizeKeyPart(tc.sourceTcId) === sourceTcId)
    if (match) return { testCase: match, reason: `TC ID ${data.sourceTcId}` }
  }

  const title = normalizeKeyPart(data.title)
  const module = normalizeKeyPart(data.module)
  if (!title) return null

  const match = existingTestCases.find((tc) =>
    normalizeKeyPart(tc.title) === title && normalizeKeyPart(tc.module) === module
  )
  return match ? { testCase: match, reason: 'same title and module' } : null
}

function prepareRows(parsedRows, existingTestCases) {
  const seen = new Map()

  return parsedRows.map((row) => {
    if (row.errors.length > 0) return { ...row, duplicate: null, action: 'skip' }

    const existing = findExistingMatch(row.data, existingTestCases)
    if (existing) {
      return {
        ...row,
        duplicate: { type: 'existing', ...existing },
        action: 'skip',
      }
    }

    const key = duplicateKey(row.data)
    if (key && seen.has(key)) {
      return {
        ...row,
        duplicate: { type: 'file', rowNum: seen.get(key), reason: `same as row ${seen.get(key)}` },
        action: 'skip',
      }
    }

    if (key) seen.set(key, row.rowNum)
    return { ...row, duplicate: null, action: 'create' }
  })
}

// ── Google Sheets URL helpers ───────────────────────────────────────────────
const SHEET_ID_RE = /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/
const GID_RE = /gid=(\d+)/

function parseGoogleSheetUrl(url) {
  const trimmed = url.trim()
  const idMatch = trimmed.match(SHEET_ID_RE)
  if (!idMatch) return null

  const sheetId = idMatch[1]
  const gidMatch = trimmed.match(GID_RE)
  const gid = gidMatch ? gidMatch[1] : '0'

  return { sheetId, gid }
}

function toCsvExportUrl(sheetId, gid) {
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
}

function textToBuffer(text) {
  return new TextEncoder().encode(text).buffer
}

// ── Stepper indicator ──────────────────────────────────────────────────────
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

// ── Drop zone (file upload) ────────────────────────────────────────────────
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
          Required columns: <em>Module, Test Case Title, Test Steps, Expected Result</em>
        </p>
        <button className="secondary-button" type="button" onClick={downloadTemplate}>
          <DownloadIcon width={14} height={14} /> Download template
        </button>
      </div>
    </div>
  )
}

// ── Google Sheet import ─────────────────────────────────────────────────────
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
      const exportUrl = toCsvExportUrl(parsed.sheetId, parsed.gid)
      const res = await fetch(exportUrl)

      if (!res.ok) {
        if (res.status === 403 || res.status === 404) {
          setError('This sheet must be public or published to the web. Check sharing settings and try again.')
        } else {
          setError(`Failed to fetch sheet (HTTP ${res.status}). Please verify the link and try again.`)
        }
        setLoading(false)
        return
      }

      const csvText = await res.text()

      if (!csvText || csvText.trim().length === 0) {
        setError('The sheet appears to be empty. Please check the content and try again.')
        setLoading(false)
        return
      }

      const buffer = textToBuffer(csvText)
      onCsvParsed(buffer, 'google-sheet.csv')
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
          Paste a link to a <em>public</em> Google Sheet. The sheet must be set to
          "Anyone with the link" or published to the web.
        </p>
        <button className="secondary-button" type="button" onClick={downloadTemplate}>
          <DownloadIcon width={14} height={14} /> Download template
        </button>
      </div>
    </div>
  )
}

// ── Validation badge ───────────────────────────────────────────────────────
function ValidationBadge({ errors }) {
  if (errors.length === 0) return <span className="vbadge vbadge--valid"><CheckIcon width={12} height={12} /> Valid</span>
  return (
    <span className="vbadge vbadge--invalid" title={errors.join('\n')}>
      <XIcon width={12} height={12} /> {errors.length} error{errors.length > 1 ? 's' : ''}
    </span>
  )
}

function DuplicateBadge({ duplicate }) {
  if (!duplicate) return <span className="text-muted">-</span>
  if (duplicate.type === 'existing') {
    return <span className="vbadge vbadge--warning" title={duplicate.testCase.title}>Existing case</span>
  }
  return <span className="vbadge vbadge--warning" title={duplicate.reason}>File duplicate</span>
}

// ── Main modal ─────────────────────────────────────────────────────────────
const IMPORT_TABS = [
  { key: 'file', label: 'File upload' },
  { key: 'google', label: 'Google Sheet' },
]

export function BulkUploadModal({ existingTestCases = [], onImport, onUpdate, onClose }) {
  const { projectId } = useParams()
  const [step, setStep]       = useState(0)   // 0=upload 1=preview 2=done
  const [rows, setRows]       = useState([])
  const [filename, setFilename] = useState('')
  const [summary, setSummary] = useState(null)
  const [importTab, setImportTab] = useState('file')

  const validRows   = rows.filter((r) => r.errors.length === 0 && r.action !== 'skip')
  const invalidRows = rows.filter((r) => r.errors.length > 0)
  const duplicateRows = rows.filter((r) => r.duplicate)
  const skippedRows = rows.filter((r) => r.errors.length > 0 || r.action === 'skip')
  const createRows = validRows.filter((r) => r.action === 'create')
  const updateRows = validRows.filter((r) => r.action === 'update')

  const handleFile = (buffer, name) => {
    try {
      const { rows: parsed } = parseTestCaseFile(buffer, name)
      setFilename(name)
      setRows(prepareRows(parsed, existingTestCases))
      setStep(1)
    } catch (err) {
      console.error('[bulkUpload] Parse failed:', err)
      addActivity({
        entityType: 'import',
        projectId,
        action: 'imported',
        title: `CSV import failed: ${err.message || 'Invalid columns'}`,
        metadata: { filename: name, error: err.message }
      })
      throw err
    }
  }

  const setRowAction = (rowNum, action) => {
    setRows((current) => current.map((row) => (
      row.rowNum === rowNum ? { ...row, action } : row
    )))
  }

  const handleImport = () => {
    const now = new Date().toISOString()
    // Stagger createdAt by 1ms per row so TC_001 (i=0) is the oldest timestamp.
    // subscribeTestCases sorts ascending (oldest first), so the spreadsheet row
    // order is preserved in the list: TC_001 at top, TC_311 at bottom.
    const baseTime = Date.now()
    createRows.forEach((r, i) => {
      const tc = rowToTestCase(r.data)
      tc.createdAt = new Date(baseTime + i).toISOString()
      tc.skipActivityLog = true
      onImport(tc)
    })
    updateRows.forEach((r) => {
      const incoming = rowToTestCase(r.data)
      const existing = r.duplicate.testCase
      onUpdate({
        ...existing,
        ...incoming,
        id: existing.id,
        createdAt: existing.createdAt,
        assignee: existing.assignee,
        priority: existing.priority ?? incoming.priority,
        updatedAt: now,
        skipActivityLog: true,
      })
    })

    const totalChanges = createRows.length + updateRows.length
    if (totalChanges > 0) {
      addActivity({
        entityType: 'import',
        projectId,
        action: 'imported',
        title: `${totalChanges} test cases imported`,
        details: `${createRows.length} created, ${updateRows.length} updated from bulk upload.`,
        metadata: {
          filename,
          createdCount: createRows.length,
          updatedCount: updateRows.length,
          source: importTab === 'google' ? 'Google Sheet' : 'CSV/Excel file',
        }
      })
    }

    setSummary({
      total: rows.length,
      created: createRows.length,
      updated: updateRows.length,
      skipped: skippedRows.length,
    })
    setStep(2)
  }

  const reset = () => { setStep(0); setRows([]); setFilename(''); setSummary(null); setImportTab('file') }

  // Widen modal during preview
  const modalStyle = step === 1 ? { maxWidth: 1040 } : {}

  return (
    <Modal title="Bulk upload test cases" onClose={onClose} style={modalStyle}>
      <div className="bulk-modal-body">
        <Stepper step={step} />

        {/* ── Step 0: Upload ── */}
        {step === 0 && (
          <>
            <div className="bulk-import-tabs" role="tablist" aria-label="Import source">
              {IMPORT_TABS.map((tab) => (
                <button
                  key={tab.key}
                  id={`bulk-tab-${tab.key}`}
                  role="tab"
                  aria-selected={importTab === tab.key}
                  aria-controls={`bulk-panel-${tab.key}`}
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

            <div role="tabpanel" id={`bulk-panel-${importTab}`}>
              {importTab === 'file' && <DropZone onFile={handleFile} />}
              {importTab === 'google' && <GoogleSheetImport onCsvParsed={handleFile} />}
            </div>
          </>
        )}

        {/* ── Step 1: Preview ── */}
        {step === 1 && (
          <>
            <div className="bulk-file-bar">
              <span className="bulk-filename">📄 {filename}</span>
              <button className="link-btn" type="button" onClick={reset}>Change file</button>
            </div>

            <div className="bulk-counts">
              <span className="bulk-count-total">{rows.length} rows found</span>
              {validRows.length > 0 && (
                <span className="vbadge vbadge--valid">{validRows.length} selected</span>
              )}
              {invalidRows.length > 0 && (
                <span className="vbadge vbadge--invalid">{invalidRows.length} invalid — will be skipped</span>
              )}
              {duplicateRows.length > 0 && (
                <span className="vbadge vbadge--warning">{duplicateRows.length} duplicate</span>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="empty-table-row">No data rows found in the file.</div>
            ) : (
              <div className="table-wrap bulk-preview-table">
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>#</th>
                      <th>Title</th>
                      <th style={{ width: 120 }}>Module</th>
                      <th style={{ width: 110 }}>Status</th>
                      <th style={{ width: 130 }}>Validation</th>
                      <th style={{ width: 130 }}>Duplicate</th>
                      <th style={{ width: 140 }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNum} className={row.errors.length ? 'bulk-row--invalid' : row.duplicate ? 'bulk-row--duplicate' : ''}>
                        <td className="mono tc-id">{row.rowNum}</td>
                        <td title={row.data.title} className="bulk-cell-truncate">
                          {row.data.title || <em className="text-muted">—</em>}
                        </td>
                        <td>{row.data.module || <em className="text-muted">—</em>}</td>
                        <td>{row.data.statusRaw || <em className="text-muted">—</em>}</td>
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
                            {row.duplicate?.type === 'existing' && <option value="update">Update existing</option>}
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
                Apply {validRows.length} change{validRows.length !== 1 ? 's' : ''}
              </button>
            </div>
          </>
        )}

        {/* ── Step 2: Done ── */}
        {step === 2 && summary && (
          <div className="bulk-summary">
            <span className="bulk-summary-icon" aria-hidden>✅</span>
            <h3>Import complete</h3>
            <div className="bulk-summary-stats">
              <div><strong>{summary.total}</strong><span>Total rows</span></div>
              <div><strong className="metric-passed">{summary.created}</strong><span>Created</span></div>
              <div><strong>{summary.updated}</strong><span>Updated</span></div>
              <div>
                <strong className={summary.skipped > 0 ? 'metric-failed' : ''}>
                  {summary.skipped}
                </strong>
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
