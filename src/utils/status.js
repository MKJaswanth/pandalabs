export const TEST_STATUSES = [
  'Not Executed',
  'Pass',
  'Fail',
  'Blocker',
  'Skipped',
  'Reported',
  'Need Clarification',
  'Testing in Progress',
  'Hold',
]

export const STATUS_TONE = {
  Pass: 'passed',
  Fail: 'failed',
  'Not Executed': 'pending',
  Skipped: 'skipped',
  Blocker: 'blocker',
  Reported: 'reported',
  'Need Clarification': 'clarification',
  'Testing in Progress': 'inprogress',
  Hold: 'hold',
}

const STATUS_ALIASES = {
  pass: 'Pass',
  passed: 'Pass',
  fail: 'Fail',
  failed: 'Fail',
  pending: 'Not Executed',
  'not executed': 'Not Executed',
  skipped: 'Skipped',
  skip: 'Skipped',
  blocker: 'Blocker',
  blocked: 'Blocker',
  reported: 'Reported',
  'need clarification': 'Need Clarification',
  clarification: 'Need Clarification',
  'testing in progress': 'Testing in Progress',
  'in progress': 'Testing in Progress',
  inprogress: 'Testing in Progress',
  hold: 'Hold',
  'on hold': 'Hold',
}

export function normalizeTestStatus(status) {
  if (!status) return 'Not Executed'
  return STATUS_ALIASES[String(status).trim().toLowerCase()] ?? status
}

export function summarizeStatuses(items) {
  const counts = {
    passed: 0, failed: 0, skipped: 0, blocker: 0,
    reported: 0, needClarification: 0, testingInProgress: 0, hold: 0,
    pending: 0,
  }
  items.forEach((item) => {
    const status = normalizeTestStatus(item.status)
    if (status === 'Pass') counts.passed += 1
    else if (status === 'Fail') counts.failed += 1
    else if (status === 'Skipped') counts.skipped += 1
    else if (status === 'Blocker') counts.blocker += 1
    else if (status === 'Reported') counts.reported += 1
    else if (status === 'Need Clarification') counts.needClarification += 1
    else if (status === 'Testing in Progress') counts.testingInProgress += 1
    else if (status === 'Hold') counts.hold += 1
    else counts.pending += 1
  })
  return { total: items.length, ...counts }
}
