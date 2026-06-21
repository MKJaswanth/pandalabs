import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { Modal } from './Modal'
import { parseRequirementFile, rowToRequirement } from '../utils/parseRequirementFile'
import { CheckIcon, DownloadIcon } from './Icons'
import { addActivity } from '../utils/activity'

const ACCEPT = '.xlsx,.xls,.csv'

const TEMPLATE_HEADERS = ['Key', 'Title', 'Description', 'Priority', 'Test Case IDs']

function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    TEMPLATE_HEADERS,
    ['REQ-001', 'User can reset password', 'Password reset via email link', 'High', 'TC_001,TC_002'],
  ])
  ws['!cols'] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.max(h.length + 4, 18) }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Requirements')
  XLSX.writeFile(wb, 'requirements-template.xlsx')
}

export function RequirementBulkUploadModal({ open, onClose, testCases, onImport, projectId }) {
  const inputRef = useRef(null)
  const [step, setStep] = useState(0)
  const [rows, setRows] = useState([])
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  if (!open) return null

  const reset = () => {
    setStep(0)
    setRows([])
    setResult(null)
    setImporting(false)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = (buffer, filename) => {
    const parsed = parseRequirementFile(buffer, filename)
    const prepared = parsed.rows.map((row) => ({
      ...row,
      action: row.errors.length > 0 ? 'skip' : 'create',
    }))
    setRows(prepared)
    setStep(1)
  }

  const validRows = rows.filter((r) => r.action === 'create' && r.errors.length === 0)

  const handleImport = async () => {
    setImporting(true)
    let created = 0
    let skipped = 0

    for (const row of rows) {
      if (row.action !== 'create' || row.errors.length > 0) {
        skipped++
        continue
      }
      const data = rowToRequirement(row.data, testCases)
      onImport(data)
      created++
    }

    if (created > 0) {
      addActivity({
        projectId,
        entityType: 'requirement',
        action: 'created',
        title: `Imported ${created} requirement${created !== 1 ? 's' : ''} from spreadsheet`,
      })
    }

    setResult({ created, skipped })
    setStep(2)
    setImporting(false)
  }

  return (
    <Modal title="Import requirements" onClose={handleClose} style={{ maxWidth: 640 }}>
      {step === 0 && (
        <div className="bulk-upload-step">
          <div
            className="drop-zone"
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          >
            <span className="drop-zone-icon" aria-hidden>📂</span>
            <span className="drop-zone-text">Drop a file here or <u>browse</u></span>
            <span className="drop-zone-hint">Accepts .xlsx, .xls, .csv</span>
            <input ref={inputRef} type="file" accept={ACCEPT} style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (!file) return
                const reader = new FileReader()
                reader.onload = (ev) => handleFile(ev.target.result, file.name)
                reader.readAsArrayBuffer(file)
              }}
            />
          </div>
          <div className="bulk-template-row">
            <p className="bulk-template-hint">
              Required: <em>Title</em>. Optional: Key, Description, Priority, Test Case IDs (comma-separated TC IDs).
            </p>
            <button className="secondary-button" type="button" onClick={downloadTemplate}>
              <DownloadIcon width={14} height={14} /> Download template
            </button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="bulk-preview-step">
          <p className="bulk-preview-summary">
            {validRows.length} row{validRows.length !== 1 ? 's' : ''} ready to import
            {rows.length - validRows.length > 0 && ` · ${rows.length - validRows.length} skipped`}
          </p>
          <div className="table-wrap" style={{ maxHeight: 280, overflow: 'auto' }}>
            <table className="rpt-table">
              <thead>
                <tr>
                  <th>Row</th>
                  <th>Key</th>
                  <th>Title</th>
                  <th>Priority</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.rowNum}</td>
                    <td className="mono">{row.data.key || '—'}</td>
                    <td>{row.data.title || '—'}</td>
                    <td>{row.data.priority || 'Medium'}</td>
                    <td>
                      {row.errors.length > 0
                        ? <span className="text-danger">{row.errors.join(', ')}</span>
                        : <span className="text-success">Ready</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary-button" onClick={() => setStep(0)}>Back</button>
            <button type="button" className="primary-button" disabled={validRows.length === 0 || importing} onClick={handleImport}>
              {importing ? 'Importing…' : `Import ${validRows.length} requirement${validRows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {step === 2 && result && (
        <div className="bulk-done-step">
          <div className="bulk-done-icon"><CheckIcon width={32} height={32} /></div>
          <h3>Import complete</h3>
          <p>{result.created} requirement{result.created !== 1 ? 's' : ''} added{result.skipped > 0 ? ` · ${result.skipped} skipped` : ''}.</p>
          <button type="button" className="primary-button" onClick={handleClose}>Done</button>
        </div>
      )}
    </Modal>
  )
}
