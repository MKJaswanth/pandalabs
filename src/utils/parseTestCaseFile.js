import * as XLSX from 'xlsx'
import { newId } from './id'

// Column aliases — maps spreadsheet header → internal key
const COL = {
  'tc id':            'sourceTcId',
  'module':           'module',
  'test scenario':    'scenario',
  'test case title':  'title',
  'pre-conditions':   'preconditions',
  'preconditions':    'preconditions',
  'test steps':       'stepsRaw',
  'test data':        'testData',
  'expected result':  'expected',
  'actual result':    'actual',
  'status':           'statusRaw',
  'dev remarks':      'devRemarks',
  'qa remarks':       'qaRemarks',
}

const REQUIRED = ['title', 'module', 'stepsRaw', 'expected']

const STATUS_MAP = {
  pass: 'Pass', passed: 'Pass',
  fail: 'Fail', failed: 'Fail',
  skip: 'Skipped', skipped: 'Skipped',
  blocker: 'Blocker',
  'not executed': 'Not Executed', pending: 'Not Executed', 'not run': 'Not Executed', '': 'Not Executed',
}

function normaliseStatus(raw) {
  return STATUS_MAP[(raw ?? '').toLowerCase().trim()] ?? 'Not Executed'
}

function splitSteps(raw) {
  if (!raw) return []
  // Split on newline, semicolon, or numbered-line pattern "1. " / "1) "
  return String(raw)
    .split(/\r?\n|;|(?=\d+[.)]\s)/)
    .map((s) => s.replace(/^\d+[.)]\s*/, '').trim())
    .filter(Boolean)
}

function normaliseHeader(h) {
  return String(h ?? '').toLowerCase().trim()
}

/**
 * Parse an ArrayBuffer from a .xlsx/.xls/.csv file.
 * Returns { rows: ParsedRow[] } where each row has { data, errors }.
 */
export function parseTestCaseFile(buffer, filename) {
  const ext = filename.split('.').pop().toLowerCase()
  const type = ext === 'csv' ? 'string' : 'array'

  // Defensive: read with cellDates off, no formula evaluation
  const wb = XLSX.read(type === 'string' ? new TextDecoder().decode(buffer) : buffer, {
    type,
    cellDates: false,
    cellFormula: false,
    cellHTML: false,
  })

  const ws = wb.Sheets[wb.SheetNames[0]]
  // sheet_to_json with header:1 gives raw arrays — avoids prototype pollution from header row
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  if (raw.length < 2) return { rows: [] }

  // Map header row → internal keys, using Object.create(null) to avoid prototype pollution
  const headerRow = raw[0]
  const colMap = Object.create(null)
  headerRow.forEach((h, i) => {
    const key = COL[normaliseHeader(h)]
    if (key) colMap[i] = key
  })

  const rows = raw.slice(1).map((cells, rowIdx) => {
    // Build a plain object from cells using only known columns
    const data = Object.create(null)
    Object.keys(colMap).forEach((i) => {
      data[colMap[i]] = String(cells[i] ?? '').trim()
    })

    // Validate required fields
    const errors = REQUIRED
      .filter((k) => !data[k])
      .map((k) => {
        const label = Object.entries(COL).find(([, v]) => v === k)?.[0] ?? k
        return `Missing: ${label}`
      })

    return { rowNum: rowIdx + 2, data, errors }
  }).filter((r) => Object.values(r.data).some(Boolean)) // skip fully empty rows

  return { rows }
}

/** Convert a validated ParsedRow.data into the app's TestCase model */
export function rowToTestCase(data) {
  return {
    id: newId(),
    createdAt: new Date().toISOString(),
    sourceTcId: data.sourceTcId || '',
    title: data.title,
    module: data.module || '',
    scenario: data.scenario || '',
    preconditions: data.preconditions || '',
    steps: splitSteps(data.stepsRaw),
    testData: data.testData || '',
    expected: data.expected || '',
    actual: data.actual || '',
    status: normaliseStatus(data.statusRaw),
    priority: 'Med',
    assignee: '',
    devRemarks: data.devRemarks || '',
    qaRemarks: data.qaRemarks || '',
  }
}
