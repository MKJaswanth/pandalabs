import assert from 'node:assert/strict'
import { testCaseMatchesSearch } from './testCaseSearch.js'

const caseRecord = {
  id: 'abcdef123456',
  sourceTcId: 'TC-AUTH-042',
  title: 'Login accepts valid credentials',
  module: 'Authentication',
  scenario: 'Existing user signs in',
  preconditions: 'User account exists',
  priority: 'High',
  assignee: 'Maya',
  steps: ['Open the login page', 'Enter credentials'],
  testData: 'maya@example.com',
  expected: 'Dashboard is displayed',
  actual: 'Redirected to dashboard',
  status: 'Pass',
  devRemarks: 'Covered by auth service',
  qaRemarks: 'Regression candidate',
  tags: ['smoke', 'release'],
}

assert.equal(testCaseMatchesSearch(caseRecord, ''), true)
assert.equal(testCaseMatchesSearch(caseRecord, 'TC-AUTH-042'), true)
assert.equal(testCaseMatchesSearch(caseRecord, 'authentication'), true)
assert.equal(testCaseMatchesSearch(caseRecord, 'dashboard'), true)
assert.equal(testCaseMatchesSearch(caseRecord, 'regression'), true)
assert.equal(testCaseMatchesSearch(caseRecord, 'not-present'), false)
