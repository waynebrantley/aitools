#!/usr/bin/env node

/**
 * Tests for parse-build-output.mjs
 * Usage: node parse-build-output.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { parseValidationOutput, groupErrorsByFile } from '../scripts/parse-build-output.mjs'
import { DotNetAdapter } from '../scripts/adapters/dotnet.mjs'
import { TypeScriptAdapter } from '../scripts/adapters/typescript.mjs'

test('parseValidationOutput - parses .NET validation output', () => {
  const output = `
========== dotnet-format ==========
File.cs(42,15): warning: Fix whitespace
Other.cs(10,5): warning: Remove using

========== dotnet-build ==========
Build succeeded
  `

  const adapter = new DotNetAdapter()
  const errors = parseValidationOutput(output, adapter)

  assert.ok(Array.isArray(errors))
  assert.ok(errors.length >= 2)
  assert.ok(errors.some(e => e.file && e.file.includes('File.cs')))
})

test('parseValidationOutput - parses TypeScript validation output', () => {
  const output = `
========== eslint ==========
  /path/to/file.ts
  42:15  error  'foo' is not defined  no-undef

========== tsc ==========
src/file.ts(42,15): error TS2304: Cannot find name
  `

  const adapter = new TypeScriptAdapter()
  const errors = parseValidationOutput(output, adapter)

  assert.ok(Array.isArray(errors))
  assert.ok(errors.length >= 2)
})

test('parseValidationOutput - handles empty output', () => {
  const output = ''
  const adapter = new DotNetAdapter()
  const errors = parseValidationOutput(output, adapter)

  assert.ok(Array.isArray(errors))
  assert.strictEqual(errors.length, 0)
})

test('groupErrorsByFile - groups errors by file path', () => {
  const errors = [
    { file: 'src/a.ts', message: 'error 1' },
    { file: 'src/a.ts', message: 'error 2' },
    { file: 'src/b.ts', message: 'error 3' }
  ]

  const fileMap = groupErrorsByFile(errors)

  assert.ok(fileMap instanceof Map)
  assert.strictEqual(fileMap.size, 2)
  assert.strictEqual(fileMap.get('src/a.ts').length, 2)
  assert.strictEqual(fileMap.get('src/b.ts').length, 1)
})

test('groupErrorsByFile - ignores errors without file property', () => {
  const errors = [
    { file: 'src/a.ts', message: 'error 1' },
    { message: 'error without file' },
    { file: 'src/b.ts', message: 'error 2' }
  ]

  const fileMap = groupErrorsByFile(errors)

  assert.strictEqual(fileMap.size, 2)
})

test('groupErrorsByFile - handles empty array', () => {
  const errors = []
  const fileMap = groupErrorsByFile(errors)

  assert.ok(fileMap instanceof Map)
  assert.strictEqual(fileMap.size, 0)
})

console.log('✅ All parse-build-output tests passed')
