import * as XLSX from 'xlsx'
import { newId } from './id'

export const BUG_TEMPLATE_COLUMNS = [
  'Bug ID', 'Module', 'Linked TC ID', 'Bug Title', 'Description',
  'Steps to Reproduce', 'Expected Result', 'Actual Result',
  'Severity', 'Priority', 'Status', 'Environment', 'Build / Version',
  'Assigned To', 'Reported By', 'Reported Date', 'Fixed In Build',
  'Retest Status', 'Developer Remarks', 'QA Remarks',
]

// Maps spreadsheet header → internal key
export const BUG_COL_MAP = {
  'bug id':             'sourceBugId',
  'module':             'module',
  'linked tc id':       'linkedTcId',
  'bug title':          'title',
  'description':        'description',
  'steps to reproduce': 'stepsToReproduce',
  'expected result':    'expected',
  'actual result':      'actual',
  'severity':           'severity',
  'priority':           'priority',
  'status':             'statusRaw',
  'environment':        'environment',
  'build / version':    'build',
  'assigned to':        'assignedTo',
  'reported by':        'reportedBy',
  'reported date':      'reportedDate',
  'fixed in build':     'fixedInBuild',
  'retest status':      'retestStatusRaw',
  'developer remarks':  'devRemarks',
  'qa remarks':         'qaRemarks',
}

const SEVERITY_MAP = {
  critical: 'Critical', major: 'Major', minor: 'Minor',
}
const PRIORITY_MAP = {
  high: 'High', medium: 'Medium', med: 'Medium', low: 'Low',
}
const STATUS_MAP = {
  open: 'Open', 'in review': 'In review', closed: 'Closed',
}
const RETEST_MAP = {
  'not retested': 'Not Retested', passed: 'Passed', failed: 'Failed',
}

export function normalizeBugRow(raw) {
  return {
    sourceBugId:      raw.sourceBugId || '',
    module:           raw.module || '',
    linkedTcId:       raw.linkedTcId || '',
    title:            raw.title || '',
    description:      raw.description || '',
    stepsToReproduce: raw.stepsToReproduce || '',
    expected:         raw.expected || '',
    actual:           raw.actual || '',
    severity:         SEVERITY_MAP[(raw.severity || '').toLowerCase().trim()] ?? 'Major',
    priority:         PRIORITY_MAP[(raw.priority || '').toLowerCase().trim()] ?? 'Medium',
    status:           STATUS_MAP[(raw.statusRaw || '').toLowerCase().trim()] ?? 'Open',
    environment:      raw.environment || '',
    build:            raw.build || '',
    assignedTo:       raw.assignedTo || '',
    reportedBy:       raw.reportedBy || '',
    reportedDate:     raw.reportedDate || '',
    fixedInBuild:     raw.fixedInBuild || '',
    retestStatus:     RETEST_MAP[(raw.retestStatusRaw || '').toLowerCase().trim()] ?? 'Not Retested',
    devRemarks:       raw.devRemarks || '',
    qaRemarks:        raw.qaRemarks || '',
  }
}

export function validateBugRow(row) {
  const errors = []
  if (!row.title) errors.push('Missing: Bug Title')
  return errors
}

/**
 * Parse an ArrayBuffer from a .xlsx/.xls/.csv bug report file.
 * Returns { rows: [{rowNum, data, errors}] }
 */
export function parseBugFileBuffer(buffer, filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const type = ext === 'csv' ? 'string' : 'array'

  const wb = XLSX.read(type === 'string' ? new TextDecoder().decode(buffer) : buffer, {
    type,
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
  })

  const ws = wb.Sheets[wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  if (raw.length < 2) return { rows: [] }

  const headerRow = raw[0]
  const colMap = Object.create(null)
  headerRow.forEach((h, i) => {
    const key = BUG_COL_MAP[String(h ?? '').toLowerCase().trim()]
    if (key) colMap[i] = key
  })

  const rows = raw.slice(1).map((cells, rowIdx) => {
    const mapped = Object.create(null)
    Object.keys(colMap).forEach((i) => {
      mapped[colMap[i]] = String(cells[i] ?? '').trim()
    })
    const data = normalizeBugRow(mapped)
    // preserve the raw linkedTcId for resolution in the modal
    data.linkedTcId = mapped.linkedTcId || ''
    const errors = validateBugRow(data)
    return { rowNum: rowIdx + 2, data, errors }
  }).filter((r) => Object.values(r.data).some(Boolean))

  return { rows }
}

export function rowToBug(data) {
  return {
    id:               newId(),
    createdAt:        new Date().toISOString(),
    sourceBugId:      data.sourceBugId || '',
    module:           data.module || '',
    title:            data.title,
    description:      data.description || '',
    stepsToReproduce: data.stepsToReproduce || '',
    expected:         data.expected || '',
    actual:           data.actual || '',
    severity:         data.severity,
    priority:         data.priority,
    status:           data.status,
    environment:      data.environment || '',
    build:            data.build || '',
    assignedTo:       data.assignedTo || '',
    reportedBy:       data.reportedBy || '',
    reportedDate:     data.reportedDate || '',
    fixedInBuild:     data.fixedInBuild || '',
    retestStatus:     data.retestStatus,
    devRemarks:       data.devRemarks || '',
    qaRemarks:        data.qaRemarks || '',
    linkedTestCase:   '',
    history:          [],
  }
}
