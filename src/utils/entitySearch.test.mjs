import assert from 'node:assert/strict'
import {
  activityMatchesSearch,
  bugMatchesSearch,
  memberMatchesSearch,
  requirementMatchesSearch,
  sharedStepMatchesSearch,
  testRunMatchesSearch,
} from './entitySearch.js'

assert.equal(
  sharedStepMatchesSearch({ name: 'Checkout payment', description: 'Reusable card flow', steps: ['Enter CVV'] }, 'cvv'),
  true,
)

assert.equal(
  bugMatchesSearch({
    sourceBugId: 'BUG-17',
    title: 'Save button disabled',
    module: 'Profile',
    stepsToReproduce: 'Open account settings',
    expected: 'Button enables',
    actual: 'Button stays disabled',
    environment: 'Staging',
    build: '2.4.0',
    assignedTo: 'Ravi',
    tags: ['regression'],
  }, 'staging'),
  true,
)

assert.equal(
  requirementMatchesSearch({
    key: 'REQ-5',
    title: 'Two factor login',
    description: 'Users verify by OTP',
    priority: 'High',
    testCaseIds: ['tc-1'],
  }, 'otp'),
  true,
)

assert.equal(
  testRunMatchesSearch({
    name: 'Release smoke run',
    build: '3.1.0',
    executedBy: 'Nisha',
    environment: 'UAT',
    notes: 'Retry failed checkout cases',
    cases: [{ title: 'Guest checkout', status: 'Fail', actual: 'Payment timeout' }],
  }, 'guest checkout'),
  true,
)

assert.equal(
  activityMatchesSearch({
    title: 'Updated test case',
    actorName: 'Sam',
    entityType: 'test_case',
    action: 'updated',
    projectName: 'Mobile App',
    details: 'Priority changed',
    metadata: { after: { module: 'Payments' } },
  }, 'payments'),
  true,
)

assert.equal(
  memberMatchesSearch({
    name: 'Priya Shah',
    email: 'priya@example.com',
    role: 'QA Lead',
    status: 'Active',
  }, 'lead'),
  true,
)

assert.equal(memberMatchesSearch({ name: 'Priya Shah' }, 'missing'), false)
