export const TEST_STATUSES = ['Not Executed', 'Pass', 'Fail', 'Skipped', 'Blocker']

export const STATUS_TONE = {
  Pass: 'passed',
  Fail: 'failed',
  'Not Executed': 'pending',
  Skipped: 'skipped',
  Blocker: 'blocker',
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
}

export function normalizeTestStatus(status) {
  if (!status) return 'Not Executed'
  return STATUS_ALIASES[String(status).trim().toLowerCase()] ?? status
}

export function summarizeStatuses(items) {
  const counts = { passed: 0, failed: 0, skipped: 0, blocker: 0, pending: 0 }
  items.forEach((item) => {
    const status = normalizeTestStatus(item.status)
    if (status === 'Pass') counts.passed += 1
    else if (status === 'Fail') counts.failed += 1
    else if (status === 'Skipped') counts.skipped += 1
    else if (status === 'Blocker') counts.blocker += 1
    else counts.pending += 1
  })
  return { total: items.length, ...counts }
}
