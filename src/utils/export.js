function toCSV(rows, headers) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))]
  return lines.join('\r\n')
}

function download(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportTestCases(testCases, projectName) {
  const headers = ['title', 'module', 'priority', 'status', 'assignee', 'expected', 'actual', 'createdAt']
  download(toCSV(testCases, headers), `${projectName}-test-cases.csv`)
}

export function exportBugs(bugs, projectName) {
  const headers = ['title', 'description', 'severity', 'status', 'linkedTestCase', 'createdAt']
  download(toCSV(bugs, headers), `${projectName}-bugs.csv`)
}

export function downloadBugTemplate() {
  const headers = [
    'Bug ID', 'Module', 'Linked TC ID', 'Bug Title', 'Description',
    'Steps to Reproduce', 'Expected Result', 'Actual Result',
    'Severity', 'Priority', 'Status', 'Environment', 'Build / Version',
    'Assigned To', 'Reported By', 'Reported Date', 'Fixed In Build',
    'Retest Status', 'Developer Remarks', 'QA Remarks',
  ]
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const csv = headers.map(escape).join(',') + '\r\n'
  download(csv, 'qa-lab-bug-report-template.csv')
}

export function exportTestRuns(runs, projectName) {
  const headers = ['date', 'name', 'build', 'executedBy', 'total', 'passed', 'failed', 'blocker', 'skipped', 'pending']
  download(toCSV(runs, headers), `${projectName}-test-runs.csv`)
}
