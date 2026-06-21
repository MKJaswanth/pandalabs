const compactText = (value) => {
  if (Array.isArray(value)) return value.map(compactText).filter(Boolean).join(' ')
  if (value === undefined || value === null) return ''
  return String(value).trim()
}

export function getTestCaseDisplayId(testCase) {
  if (!testCase) return ''
  return testCase.sourceTcId || (testCase.id ? testCase.id.slice(0, 8).toUpperCase() : '')
}

export function getTestCaseSearchText(testCase) {
  return [
    getTestCaseDisplayId(testCase),
    testCase?.title,
    testCase?.module,
    testCase?.scenario,
    testCase?.preconditions,
    testCase?.priority,
    testCase?.assignee,
    testCase?.steps,
    testCase?.testData,
    testCase?.expected,
    testCase?.actual,
    testCase?.status,
    testCase?.devRemarks,
    testCase?.qaRemarks,
    testCase?.tags,
  ].map(compactText).filter(Boolean).join(' ').toLowerCase()
}

export function testCaseMatchesSearch(testCase, query) {
  const normalizedQuery = compactText(query).toLowerCase()
  if (!normalizedQuery) return true
  return getTestCaseSearchText(testCase).includes(normalizedQuery)
}
