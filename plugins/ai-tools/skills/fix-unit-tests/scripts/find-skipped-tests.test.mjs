#!/usr/bin/env node

/**
 * Tests for find-skipped-tests.mjs
 * Usage: node find-skipped-tests.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { categorizeReason, groupTests } from './find-skipped-tests.mjs'

test('categorizeReason - categorizes E2E tests', () => {
  assert.strictEqual(categorizeReason('should be e2e test'), 'Should be E2E tests')
  assert.strictEqual(categorizeReason('end to end test needed'), 'Should be E2E tests')
  assert.strictEqual(categorizeReason('integration test required'), 'Should be E2E tests')
  assert.strictEqual(categorizeReason('functional test'), 'Should be E2E tests')
  assert.strictEqual(categorizeReason('should be covered by E2E'), 'Should be E2E tests')
})

test('categorizeReason - categorizes test environment limitations', () => {
  assert.strictEqual(categorizeReason('test environment not working'), 'Test environment limitations')
  assert.strictEqual(categorizeReason('difficult to test'), 'Test environment limitations')
  assert.strictEqual(categorizeReason('mocking is hard'), 'Test environment limitations')
  assert.strictEqual(categorizeReason('mock setup complex'), 'Test environment limitations')
})

test('categorizeReason - categorizes component logic issues', () => {
  assert.strictEqual(categorizeReason('component returns null'), 'Component logic issues')
  assert.strictEqual(categorizeReason('early return in component'), 'Component logic issues')
  assert.strictEqual(categorizeReason('conditional rendering'), 'Component logic issues')
  assert.strictEqual(categorizeReason('component logic too complex'), 'Component logic issues')
})

test('categorizeReason - categorizes implementation details', () => {
  assert.strictEqual(categorizeReason('CSS class testing'), 'Implementation details')
  assert.strictEqual(categorizeReason('styling issue'), 'Implementation details')
  assert.strictEqual(categorizeReason('style not testable'), 'Implementation details')
})

test('categorizeReason - categorizes validation display issues', () => {
  assert.strictEqual(categorizeReason('validation display'), 'Validation display issues')
  assert.strictEqual(categorizeReason('error display not working'), 'Validation display issues')
  assert.strictEqual(categorizeReason('form validation UI'), 'Validation display issues')
})

test('categorizeReason - categorizes third-party library issues', () => {
  assert.strictEqual(categorizeReason('library not compatible'), 'Third-party library issues')
  assert.strictEqual(categorizeReason('third party dependency'), 'Third-party library issues')
  assert.strictEqual(categorizeReason('external service'), 'Third-party library issues')
})

test('categorizeReason - categorizes uncategorized reasons', () => {
  assert.strictEqual(categorizeReason('random reason'), 'Other/Uncategorized')
  assert.strictEqual(categorizeReason('unknown issue'), 'Other/Uncategorized')
  assert.strictEqual(categorizeReason('needs investigation'), 'Other/Uncategorized')
})

test('categorizeReason - is case insensitive', () => {
  assert.strictEqual(categorizeReason('E2E TEST NEEDED'), 'Should be E2E tests')
  assert.strictEqual(categorizeReason('MOCKING IS HARD'), 'Test environment limitations')
  assert.strictEqual(categorizeReason('CSS CLASS'), 'Implementation details')
})

test('groupTests - groups tests by category and reason', () => {
  const skippedTests = [
    {
      file: 'test1.ts',
      line: 10,
      skipType: 'test.skip',
      reason: 'Should be E2E test',
      category: 'Should be E2E tests',
      reasonKey: 'should be e2e test'
    },
    {
      file: 'test2.ts',
      line: 20,
      skipType: 'test.skip',
      reason: 'Should be E2E test',
      category: 'Should be E2E tests',
      reasonKey: 'should be e2e test'
    },
    {
      file: 'test3.ts',
      line: 30,
      skipType: 'it.skip',
      reason: 'Mocking is hard',
      category: 'Test environment limitations',
      reasonKey: 'mocking is hard'
    }
  ]

  const grouped = groupTests(skippedTests)

  assert.ok(grouped['Should be E2E tests'], 'Should have E2E category')
  assert.ok(grouped['Test environment limitations'], 'Should have test environment category')

  const e2eGroup = grouped['Should be E2E tests']['should be e2e test']
  assert.strictEqual(e2eGroup.reason, 'Should be E2E test')
  assert.strictEqual(e2eGroup.tests.length, 2, 'Should group 2 tests with same reason')

  const mockGroup = grouped['Test environment limitations']['mocking is hard']
  assert.strictEqual(mockGroup.reason, 'Mocking is hard')
  assert.strictEqual(mockGroup.tests.length, 1, 'Should have 1 test')
})

test('groupTests - handles empty array', () => {
  const grouped = groupTests([])

  assert.deepStrictEqual(grouped, {}, 'Should return empty object for empty array')
})

test('groupTests - preserves test details', () => {
  const skippedTests = [
    {
      file: 'test1.ts',
      line: 10,
      skipType: 'test.skip',
      reason: 'Test reason',
      category: 'Other/Uncategorized',
      reasonKey: 'test reason'
    }
  ]

  const grouped = groupTests(skippedTests)

  const test = grouped['Other/Uncategorized']['test reason'].tests[0]
  assert.strictEqual(test.file, 'test1.ts')
  assert.strictEqual(test.line, 10)
  assert.strictEqual(test.skipType, 'test.skip')
})

test('groupTests - handles multiple categories', () => {
  const skippedTests = [
    {
      file: 'test1.ts',
      line: 10,
      skipType: 'test.skip',
      reason: 'E2E test',
      category: 'Should be E2E tests',
      reasonKey: 'e2e test'
    },
    {
      file: 'test2.ts',
      line: 20,
      skipType: 'test.skip',
      reason: 'Mocking hard',
      category: 'Test environment limitations',
      reasonKey: 'mocking hard'
    },
    {
      file: 'test3.ts',
      line: 30,
      skipType: 'it.skip',
      reason: 'CSS test',
      category: 'Implementation details',
      reasonKey: 'css test'
    }
  ]

  const grouped = groupTests(skippedTests)

  assert.strictEqual(Object.keys(grouped).length, 3, 'Should have 3 categories')
  assert.ok(grouped['Should be E2E tests'])
  assert.ok(grouped['Test environment limitations'])
  assert.ok(grouped['Implementation details'])
})

console.log('✅ All find-skipped-tests tests passed')
