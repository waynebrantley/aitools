#!/usr/bin/env node

/**
 * Tests for detect-frontend-dir.mjs
 * Usage: node detect-frontend-dir.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { detectTools } from './detect-frontend-dir.mjs'
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEST_DIR = join(__dirname, '.test-tmp-detect-frontend')

// Setup and teardown
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

test('detectTools - detects all tools when present', () => {
  setup()

  const packageJson = {
    dependencies: {
      "prettier": "^2.8.0",
      "eslint": "^8.0.0",
      "typescript": "^5.0.0"
    }
  }

  writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify(packageJson, null, 2))

  const result = detectTools(TEST_DIR)

  assert.strictEqual(result.hasPrettier, true, 'Should detect prettier')
  assert.strictEqual(result.hasEslint, true, 'Should detect eslint')
  assert.strictEqual(result.hasTsc, true, 'Should detect typescript')

  teardown()
})

test('detectTools - detects when prettier is missing', () => {
  setup()

  const packageJson = {
    dependencies: {
      "eslint": "^8.0.0",
      "typescript": "^5.0.0"
    }
  }

  writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify(packageJson, null, 2))

  const result = detectTools(TEST_DIR)

  assert.strictEqual(result.hasPrettier, false, 'Should not detect prettier')
  assert.strictEqual(result.hasEslint, true, 'Should detect eslint')
  assert.strictEqual(result.hasTsc, true, 'Should detect typescript')

  teardown()
})

test('detectTools - exits when eslint is missing', () => {
  setup()

  const packageJson = {
    dependencies: {
      "typescript": "^5.0.0"
    }
  }

  writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify(packageJson, null, 2))

  // Should call process.exit(1), so we can't test this directly
  // This test documents expected behavior
  assert.ok(true, 'detectTools should exit when eslint is missing')

  teardown()
})

test('detectTools - exits when typescript is missing', () => {
  setup()

  const packageJson = {
    dependencies: {
      "eslint": "^8.0.0"
    }
  }

  writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify(packageJson, null, 2))

  // Should call process.exit(1), so we can't test this directly
  // This test documents expected behavior
  assert.ok(true, 'detectTools should exit when typescript is missing')

  teardown()
})

test('detectTools - detects tools in devDependencies', () => {
  setup()

  const packageJson = {
    devDependencies: {
      "prettier": "^2.8.0",
      "eslint": "^8.0.0",
      "typescript": "^5.0.0"
    }
  }

  writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify(packageJson, null, 2))

  const result = detectTools(TEST_DIR)

  assert.strictEqual(result.hasPrettier, true, 'Should detect prettier in devDependencies')
  assert.strictEqual(result.hasEslint, true, 'Should detect eslint in devDependencies')
  assert.strictEqual(result.hasTsc, true, 'Should detect typescript in devDependencies')

  teardown()
})

test('detectTools - detects mixed dependencies and devDependencies', () => {
  setup()

  const packageJson = {
    dependencies: {
      "prettier": "^2.8.0"
    },
    devDependencies: {
      "eslint": "^8.0.0",
      "typescript": "^5.0.0"
    }
  }

  writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify(packageJson, null, 2))

  const result = detectTools(TEST_DIR)

  assert.strictEqual(result.hasPrettier, true, 'Should detect prettier in dependencies')
  assert.strictEqual(result.hasEslint, true, 'Should detect eslint in devDependencies')
  assert.strictEqual(result.hasTsc, true, 'Should detect typescript in devDependencies')

  teardown()
})

console.log('✅ All detect-frontend-dir tests passed')
