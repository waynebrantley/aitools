#!/usr/bin/env node

/**
 * Tests for detect-test-environment.mjs
 * Usage: node detect-test-environment.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { createDetectionContext, ADAPTERS } from '../scripts/detect-test-environment.mjs'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEST_DIR = join(__dirname, '.test-tmp-detect-env')

function setup() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
  mkdirSync(TEST_DIR, { recursive: true })
}

function teardown() {
  if (existsSync(TEST_DIR)) {
    rmSync(TEST_DIR, { recursive: true, force: true })
  }
}

test('createDetectionContext - reads package.json if it exists', () => {
  setup()

  const packageJson = { name: 'test-project', dependencies: { vitest: '^1.0.0' } }
  writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify(packageJson))

  const context = createDetectionContext(TEST_DIR)

  assert.ok(context.packageJsonContent !== null)
  assert.ok(context.packageJsonContent.includes('vitest'))
  assert.strictEqual(context.projectRoot, TEST_DIR)

  teardown()
})

test('createDetectionContext - handles missing package.json', () => {
  setup()

  const context = createDetectionContext(TEST_DIR)

  assert.strictEqual(context.packageJsonContent, null)
  assert.strictEqual(context.projectRoot, TEST_DIR)

  teardown()
})

test('createDetectionContext - fileExists method works', () => {
  setup()

  writeFileSync(join(TEST_DIR, 'test.txt'), 'test')

  const context = createDetectionContext(TEST_DIR)

  assert.strictEqual(context.fileExists('test.txt'), true)
  assert.strictEqual(context.fileExists('missing.txt'), false)

  teardown()
})

test('createDetectionContext - readFile method works', () => {
  setup()

  writeFileSync(join(TEST_DIR, 'test.txt'), 'hello world')

  const context = createDetectionContext(TEST_DIR)

  const content = context.readFile('test.txt')
  assert.strictEqual(content, 'hello world')

  teardown()
})

test('createDetectionContext - glob method works', () => {
  setup()

  mkdirSync(join(TEST_DIR, 'src'), { recursive: true })
  writeFileSync(join(TEST_DIR, 'src', 'test1.ts'), 'test')
  writeFileSync(join(TEST_DIR, 'src', 'test2.ts'), 'test')
  writeFileSync(join(TEST_DIR, 'src', 'readme.md'), 'test')

  const context = createDetectionContext(TEST_DIR)

  const files = context.glob('**/*.ts')
  assert.ok(Array.isArray(files))
  assert.strictEqual(files.length, 2)
  assert.ok(files.some(f => f.includes('test1.ts')))
  assert.ok(files.some(f => f.includes('test2.ts')))

  teardown()
})

test('ADAPTERS - contains all expected adapters', () => {
  assert.ok(Array.isArray(ADAPTERS))
  assert.ok(ADAPTERS.length >= 3)

  const adapterNames = ADAPTERS.map(a => a.name)
  assert.ok(adapterNames.includes('vitest'))
  assert.ok(adapterNames.includes('playwright'))
  assert.ok(adapterNames.includes('dotnet'))
})

test('ADAPTERS - are in priority order (vitest first)', () => {
  // Vitest should be first since it's the most common
  assert.strictEqual(ADAPTERS[0].name, 'vitest')
})

test('ADAPTERS - each adapter has required interface', () => {
  for (const adapter of ADAPTERS) {
    assert.ok(adapter.name, 'Adapter should have name')
    assert.ok(adapter.displayName, 'Adapter should have displayName')
    assert.ok(adapter.testType, 'Adapter should have testType')
    assert.ok(typeof adapter.canDetect === 'function', 'Adapter should have canDetect method')
    assert.ok(typeof adapter.getTestCommand === 'function', 'Adapter should have getTestCommand method')
    assert.ok(typeof adapter.getTestFilePatterns === 'function', 'Adapter should have getTestFilePatterns method')
  }
})

console.log('✅ All detect-test-environment tests passed')
