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
  const rows = testCases.map((tc) => ({
    'TC ID':           tc.sourceTcId || tc.id.slice(0, 8).toUpperCase(),
    'Title':           tc.title,
    'Module':          tc.module,
    'Scenario':        tc.scenario,
    'Priority':        tc.priority,
    'Status':          tc.status,
    'Assignee':        tc.assignee,
    'Pre-conditions':  tc.preconditions,
    'Steps':           (tc.steps || []).filter(Boolean).join(' | '),
    'Test Data':       tc.testData,
    'Expected Result': tc.expected,
    'Actual Result':   tc.actual,
    'Dev Remarks':     tc.devRemarks,
    'QA Remarks':      tc.qaRemarks,
    'Created At':      tc.createdAt,
    'Created By':      getReporterName(tc.createdBy, tc.createdByName),
    'Updated At':      tc.updatedAt,
    'Updated By':      getReporterName(tc.updatedBy || tc.createdBy, tc.updatedByName || tc.createdByName),
  }))
  const headers = Object.keys(rows[0] ?? {})
  download(toCSV(rows, headers), `${projectName}-test-cases.csv`)
}

export function getReporterName(reportedBy, reportedByName) {
  if (!reportedBy) return reportedByName || ''
  const isUid = /^[a-zA-Z0-9]{20,36}$/.test(reportedBy)
  if (isUid && reportedByName) {
    return reportedByName
  }
  return reportedBy
}

export function exportBugs(bugs, projectName) {
  const rows = bugs.map((b) => ({
    'Bug ID':             b.sourceBugId || b.id.slice(0, 8).toUpperCase(),
    'Title':              b.title,
    'Description':        b.description,
    'Module':             b.module,
    'Severity':           b.severity,
    'Priority':           b.priority,
    'Status':             b.status,
    'Environment':        b.environment,
    'Build':              b.build,
    'Steps to Reproduce': b.stepsToReproduce,
    'Expected Result':    b.expected,
    'Actual Result':      b.actual,
    'Assigned To':        b.assignedTo,
    'Reported By':        getReporterName(b.reportedBy, b.reportedByName),
    'Reported Date':      b.reportedDate,
    'Fixed In Build':     b.fixedInBuild,
    'Retest Status':      b.retestStatus,
    'Dev Remarks':        b.devRemarks,
    'QA Remarks':         b.qaRemarks,
  }))
  const headers = Object.keys(rows[0] ?? {})
  download(toCSV(rows, headers), `${projectName}-bugs.csv`)
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
