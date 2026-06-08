export function historyEntry(type, user, details, from, to) {
  return {
    id: crypto.randomUUID(),
    type,
    user,
    timestamp: new Date().toISOString(),
    details,
    from,
    to,
  }
}

export function withHistory(item, entry) {
  return { ...item, history: [...(item.history || []), entry] }
}

export function describeTestCaseChanges(before, after) {
  const labels = {
    title: 'Title',
    module: 'Module',
    scenario: 'Scenario',
    preconditions: 'Pre-conditions',
    priority: 'Priority',
    assignee: 'Assignee',
    testData: 'Test data',
    expected: 'Expected result',
    actual: 'Actual result',
    status: 'Status',
    devRemarks: 'Dev remarks',
    qaRemarks: 'QA remarks',
  }

  return Object.entries(labels)
    .filter(([key]) => (before[key] ?? '') !== (after[key] ?? ''))
    .map(([, label]) => `${label} changed`)
}
