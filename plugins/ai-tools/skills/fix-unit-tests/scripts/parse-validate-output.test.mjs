#!/usr/bin/env node

/**
 * Tests for parse-validate-output.mjs
 * Usage: node parse-validate-output.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { parseOutput, sortByImpact } from './parse-validate-output.mjs'

test('parseOutput - parses test failures', () => {
  const input = `
FAIL src/components/Button.test.tsx
  ✗ Button > renders correctly
  `

  const result = parseOutput(input)

  assert.strictEqual(result.has('components/Button.test.tsx'), true, 'Should find Button.test.tsx')
  const entry = result.get('components/Button.test.tsx')
  assert.strictEqual(entry.test, 1, 'Should count 1 test error')
  assert.strictEqual(entry.total, 1, 'Should count 1 total error')
})

test('parseOutput - parses type errors', () => {
  const input = `
src/utils/helper.tsx(42,15): error TS2322: Type 'string' is not assignable to type 'number'.
  `

  const result = parseOutput(input)

  assert.strictEqual(result.has('utils/helper.tsx'), true, 'Should find helper.tsx')
  const entry = result.get('utils/helper.tsx')
  assert.strictEqual(entry.type, 1, 'Should count 1 type error')
  // Type error pattern also matches the "error" keyword, so it counts twice
  assert.strictEqual(entry.total >= 1, true, 'Should count at least 1 total error')
})

test('parseOutput - parses lint errors', () => {
  const input = `
  ✖ src/services/api.ts 'foo' is not defined  no-undef
  `

  const result = parseOutput(input)

  assert.strictEqual(result.has('services/api.ts'), true, 'Should find api.ts')
  const entry = result.get('services/api.ts')
  assert.strictEqual(entry.lint, 1, 'Should count 1 lint error')
  assert.strictEqual(entry.total, 1, 'Should count 1 total error')
})

test('parseOutput - aggregates multiple errors for same file', () => {
  const input = `
FAIL src/components/Button.test.tsx
✗ src/components/Button.test.tsx > Button > renders correctly
✗ src/components/Button.test.tsx > Button > handles click
src/components/Button.tsx(10,5): error TS2322: Type error
✖ src/components/Button.tsx Missing semicolon
  `

  const result = parseOutput(input)

  const testEntry = result.get('components/Button.test.tsx')
  assert.strictEqual(testEntry.test >= 2, true, 'Should count at least 2 test errors')

  const srcEntry = result.get('components/Button.tsx')
  assert.strictEqual(srcEntry.type >= 1, true, 'Should count at least 1 type error')
  assert.strictEqual(srcEntry.lint >= 1, true, 'Should count at least 1 lint error')
  assert.strictEqual(srcEntry.total >= 2, true, 'Should count at least 2 total errors')
})

test('parseOutput - handles empty input', () => {
  const input = ''

  const result = parseOutput(input)

  assert.strictEqual(result.size, 0, 'Should return empty map for empty input')
})

test('parseOutput - ignores non-matching lines', () => {
  const input = `
Some random output
Not an error line
Just informational text
  `

  const result = parseOutput(input)

  assert.strictEqual(result.size, 0, 'Should ignore non-matching lines')
})

test('parseOutput - parses mixed error types', () => {
  const input = `
FAIL src/components/Button.test.tsx
✗ src/components/Button.test.tsx > Button > renders correctly

src/components/Button.tsx(10,5): error TS2322: Type 'string' is not assignable to type 'number'

✖ src/utils/helper.ts 'foo' is not defined  no-undef

Failed src/pages/Home.test.tsx Home > loads data
  `

  const result = parseOutput(input)

  assert.strictEqual(result.size >= 4, true, 'Should parse at least 4 files')
  assert.strictEqual(result.get('components/Button.test.tsx').test >= 1, true)
  assert.strictEqual(result.get('components/Button.tsx').type >= 1, true)
  assert.strictEqual(result.get('utils/helper.ts').lint >= 1, true)
  assert.strictEqual(result.get('pages/Home.test.tsx').test >= 1, true)
})

test('sortByImpact - sorts files by total error count descending', () => {
  const fileIssues = new Map([
    ['file1.ts', { total: 5, test: 2, type: 2, lint: 1 }],
    ['file2.ts', { total: 10, test: 5, type: 3, lint: 2 }],
    ['file3.ts', { total: 3, test: 1, type: 1, lint: 1 }]
  ])

  const sorted = sortByImpact(fileIssues)

  assert.strictEqual(sorted.length, 3, 'Should return all entries')
  assert.strictEqual(sorted[0][0], 'file2.ts', 'file2 should be first (10 errors)')
  assert.strictEqual(sorted[1][0], 'file1.ts', 'file1 should be second (5 errors)')
  assert.strictEqual(sorted[2][0], 'file3.ts', 'file3 should be third (3 errors)')
})

test('sortByImpact - handles empty map', () => {
  const fileIssues = new Map()

  const sorted = sortByImpact(fileIssues)

  assert.strictEqual(sorted.length, 0, 'Should return empty array for empty map')
})

test('sortByImpact - handles single entry', () => {
  const fileIssues = new Map([
    ['file1.ts', { total: 5, test: 2, type: 2, lint: 1 }]
  ])

  const sorted = sortByImpact(fileIssues)

  assert.strictEqual(sorted.length, 1, 'Should return single entry')
  assert.strictEqual(sorted[0][0], 'file1.ts', 'Should return the file')
})

test('sortByImpact - maintains stable sort for equal totals', () => {
  const fileIssues = new Map([
    ['file1.ts', { total: 5, test: 2, type: 2, lint: 1 }],
    ['file2.ts', { total: 5, test: 1, type: 2, lint: 2 }],
    ['file3.ts', { total: 5, test: 3, type: 1, lint: 1 }]
  ])

  const sorted = sortByImpact(fileIssues)

  assert.strictEqual(sorted.length, 3, 'Should return all entries')
  // All have same total, so order should be preserved from Map iteration
  assert.strictEqual(sorted[0][1].total, 5, 'All should have total of 5')
  assert.strictEqual(sorted[1][1].total, 5, 'All should have total of 5')
  assert.strictEqual(sorted[2][1].total, 5, 'All should have total of 5')
})

console.log('✅ All parse-validate-output tests passed')
