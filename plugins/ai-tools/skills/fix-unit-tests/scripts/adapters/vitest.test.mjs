#!/usr/bin/env node

/**
 * Tests for vitest.mjs adapter
 * Usage: node vitest.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { VitestAdapter } from './vitest.mjs'

const adapter = new VitestAdapter()

test('VitestAdapter - has correct metadata', () => {
  assert.strictEqual(adapter.name, 'vitest')
  assert.strictEqual(adapter.displayName, 'Vitest')
  assert.strictEqual(adapter.testType, 'unit')
})

test('VitestAdapter - canDetect returns true for vitest in package.json', () => {
  const context = {
    packageJsonContent: '{"dependencies": {"vitest": "^1.0.0"}}',
    fileExists: () => false
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('VitestAdapter - canDetect returns true for jest in package.json', () => {
  const context = {
    packageJsonContent: '{"devDependencies": {"jest": "^29.0.0"}}',
    fileExists: () => false
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('VitestAdapter - canDetect returns true for vite in package.json', () => {
  const context = {
    packageJsonContent: '{"dependencies": {"vite": "^5.0.0"}}',
    fileExists: () => false
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('VitestAdapter - canDetect returns true for vitest config file', () => {
  const context = {
    packageJsonContent: '{}',
    fileExists: (path) => path === 'vitest.config.ts'
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('VitestAdapter - canDetect returns false when nothing matches', () => {
  const context = {
    packageJsonContent: '{"dependencies": {}}',
    fileExists: () => false
  }

  assert.strictEqual(adapter.canDetect(context), false)
})

test('VitestAdapter - getTestFilePatterns returns correct patterns', () => {
  const patterns = adapter.getTestFilePatterns()

  assert.ok(Array.isArray(patterns))
  assert.ok(patterns.includes('**/*.test.ts'))
  assert.ok(patterns.includes('**/*.spec.tsx'))
  assert.ok(patterns.length >= 6)
})

test('VitestAdapter - getSkipPatterns returns skip patterns', () => {
  const patterns = adapter.getSkipPatterns()

  assert.ok(Array.isArray(patterns))
  assert.ok(patterns.includes('it\\.skip\\('))
  assert.ok(patterns.includes('test\\.skip\\('))
  assert.ok(patterns.includes('xtest\\('))
})

test('VitestAdapter - getFocusPatterns returns focus patterns', () => {
  const patterns = adapter.getFocusPatterns()

  assert.ok(Array.isArray(patterns))
  assert.ok(patterns.includes('it\\.only\\('))
  assert.ok(patterns.includes('test\\.only\\('))
})

test('VitestAdapter - getResourceMultiplier returns 1.0 for unit tests', () => {
  assert.strictEqual(adapter.getResourceMultiplier(), 1.0)
})

test('VitestAdapter - getParallelExecutionStrategy returns appropriate strategy', () => {
  const strategy = adapter.getParallelExecutionStrategy(8)

  assert.ok(strategy.maxWorkers > 0)
  assert.strictEqual(strategy.staggerDelay, 0)
  assert.strictEqual(strategy.requiresIsolation, false)
})

test('VitestAdapter - parseTestOutput parses vitest failures', () => {
  const output = `
  ❌ src/components/Button.test.tsx > Button > renders correctly
  ❌ src/utils/helper.test.ts > Helper > works
  `

  const result = adapter.parseTestOutput(output)

  assert.ok(Array.isArray(result.failures))
  assert.strictEqual(result.failures.length, 2)
  assert.strictEqual(result.failures[0].file, 'src/components/Button.test.tsx')
  assert.strictEqual(result.failures[0].testName, 'Button > renders correctly')
})

test('VitestAdapter - parseValidationOutput parses TypeScript errors', () => {
  const output = `
src/components/Button.tsx(42,15): error TS2322: Type 'string' is not assignable to type 'number'.
src/utils/helper.ts(10,5): error TS2345: Argument error
  `

  const result = adapter.parseValidationOutput(output, 'tsc')

  assert.ok(Array.isArray(result.errors))
  assert.strictEqual(result.errors.length, 2)
  assert.strictEqual(result.errors[0].file, 'src/components/Button.tsx')
  assert.strictEqual(result.errors[0].line, 42)
  assert.strictEqual(result.errors[0].column, 15)
  assert.strictEqual(result.errors[0].rule, 'TS2322')
})

test('VitestAdapter - detectConfig detects package manager', () => {
  const context = {
    packageJsonContent: '{"dependencies": {"vitest": "^1.0.0"}}',
    fileExists: (path) => path === 'pnpm-lock.yaml'
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.packageManager, 'pnpm')
})

test('VitestAdapter - detectConfig detects prettier', () => {
  const context = {
    packageJsonContent: '{"devDependencies": {"prettier": "^2.8.0"}}',
    fileExists: () => false
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.hasPrettier, true)
})

test('VitestAdapter - getValidationCommands includes eslint and tsc', () => {
  const config = { projectRoot: '/test', packageManager: 'pnpm', hasPrettier: false }
  const commands = adapter.getValidationCommands(config)

  assert.ok(Array.isArray(commands))
  assert.ok(commands.some(cmd => cmd.name === 'eslint'))
  assert.ok(commands.some(cmd => cmd.name === 'tsc'))
})

console.log('✅ All VitestAdapter tests passed')
