#!/usr/bin/env node

/**
 * Tests for verify-fix.mjs
 * Usage: node verify-fix.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { parseValidation } from '../scripts/verify-fix.mjs'

test('parseValidation - counts test failures', () => {
  const output = `
FAIL src/components/Button.test.tsx
  ✗ Button > renders correctly
  ✗ Button > handles click
Failed src/pages/Home.test.tsx
  `

  const result = parseValidation(output)

  // FAIL + 2x ✗ + Failed = 4 matches
  assert.strictEqual(result.test, 4, 'Should count 4 test error indicators')
  assert.strictEqual(result.total, 4, 'Should count 4 total errors')
})

test('parseValidation - counts type errors', () => {
  const output = `
src/utils/helper.tsx(42,15): error TS2322: Type 'string' is not assignable to type 'number'.
src/services/api.ts(10,5): error TS2345: Argument error
  `

  const result = parseValidation(output)

  assert.strictEqual(result.type, 2, 'Should count 2 type errors')
  assert.strictEqual(result.total, 2, 'Should count 2 total errors')
})

test('parseValidation - counts lint errors', () => {
  const output = `
src/components/Button.tsx
  ✖ 'foo' is not defined
  ✖ Missing semicolon
  `

  const result = parseValidation(output)

  assert.strictEqual(result.lint, 2, 'Should count 2 lint errors')
  assert.strictEqual(result.total, 2, 'Should count 2 total errors')
})

test('parseValidation - counts mixed error types', () => {
  const output = `
FAIL src/components/Button.test.tsx
  ✗ Button > renders correctly

src/components/Button.tsx(10,5): error TS2322: Type error

src/utils/helper.ts
  ✖ 'foo' is not defined
  `

  const result = parseValidation(output)

  // FAIL + ✗ = 2 test errors
  assert.strictEqual(result.test, 2, 'Should count 2 test error indicators')
  assert.strictEqual(result.type, 1, 'Should count 1 type error')
  assert.strictEqual(result.lint, 1, 'Should count 1 lint error')
  assert.strictEqual(result.total, 4, 'Should count 4 total errors')
})

test('parseValidation - handles empty output', () => {
  const output = ''

  const result = parseValidation(output)

  assert.strictEqual(result.test, 0)
  assert.strictEqual(result.type, 0)
  assert.strictEqual(result.lint, 0)
  assert.strictEqual(result.total, 0)
})

test('parseValidation - ignores non-error output', () => {
  const output = `
All tests passed!
Build successful
No issues found
  `

  const result = parseValidation(output)

  assert.strictEqual(result.total, 0, 'Should not count non-error lines')
})

test('parseValidation - handles multiple errors of same type', () => {
  const output = `
src/file1.ts(1,1): error TS2322: Type error 1
src/file2.ts(2,2): error TS2345: Type error 2
src/file3.ts(3,3): error TS2366: Type error 3
src/file4.ts(4,4): error TS2389: Type error 4
  `

  const result = parseValidation(output)

  assert.strictEqual(result.type, 4, 'Should count 4 type errors')
  assert.strictEqual(result.total, 4)
})

test('parseValidation - aggregates all error types correctly', () => {
  const output = `
FAIL test1.test.tsx
✗ Test 1
✗ Test 2
Failed test2.test.tsx

src/file1.ts(1,1): error TS2322: Type error 1
src/file2.ts(2,2): error TS2345: Type error 2

✖ Lint error 1
✖ Lint error 2
✖ Lint error 3
  `

  const result = parseValidation(output)

  // FAIL + 2x✗ + Failed = 4 test errors
  assert.strictEqual(result.test, 4, 'Should count 4 test error indicators')
  assert.strictEqual(result.type, 2, 'Should count 2 type errors')
  assert.strictEqual(result.lint, 3, 'Should count 3 lint errors')
  assert.strictEqual(result.total, 9, 'Should count 9 total errors')
})

console.log('✅ All verify-fix tests passed')
