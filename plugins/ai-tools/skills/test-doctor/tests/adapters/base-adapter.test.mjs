#!/usr/bin/env node

/**
 * Tests for base-adapter.mjs
 * Usage: node base-adapter.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { TestFrameworkAdapter } from '../../scripts/adapters/base-adapter.mjs'

const adapter = new TestFrameworkAdapter()

test('TestFrameworkAdapter - has default properties', () => {
  assert.strictEqual(adapter.name, 'base')
  assert.strictEqual(adapter.displayName, 'Base Test Framework')
  assert.strictEqual(adapter.testType, 'unit')
})

test('TestFrameworkAdapter - canDetect throws error when not implemented', () => {
  assert.throws(() => {
    adapter.canDetect({})
  }, /canDetect\(\) must be implemented/)
})

test('TestFrameworkAdapter - getTestCommand throws error when not implemented', () => {
  assert.throws(() => {
    adapter.getTestCommand({})
  }, /getTestCommand\(\) must be implemented/)
})

test('TestFrameworkAdapter - getTestFilePatterns throws error when not implemented', () => {
  assert.throws(() => {
    adapter.getTestFilePatterns()
  }, /getTestFilePatterns\(\) must be implemented/)
})

test('TestFrameworkAdapter - getSkipPatterns throws error when not implemented', () => {
  assert.throws(() => {
    adapter.getSkipPatterns()
  }, /getSkipPatterns\(\) must be implemented/)
})

test('TestFrameworkAdapter - getFocusPatterns has default implementation', () => {
  const patterns = adapter.getFocusPatterns()

  assert.ok(Array.isArray(patterns))
  assert.ok(patterns.includes('it\\.only'))
  assert.ok(patterns.includes('test\\.only'))
})

test('TestFrameworkAdapter - getValidationCommands returns empty array by default', () => {
  const commands = adapter.getValidationCommands({})

  assert.ok(Array.isArray(commands))
  assert.strictEqual(commands.length, 0)
})

test('TestFrameworkAdapter - getResourceMultiplier returns 1.0 by default', () => {
  assert.strictEqual(adapter.getResourceMultiplier(), 1.0)
})

test('TestFrameworkAdapter - getParallelExecutionStrategy returns default strategy', () => {
  const strategy = adapter.getParallelExecutionStrategy(8)

  assert.strictEqual(strategy.maxWorkers, 7)
  assert.strictEqual(strategy.staggerDelay, 0)
  assert.strictEqual(strategy.requiresIsolation, false)
})

test('TestFrameworkAdapter - parseTestOutput throws error when not implemented', () => {
  assert.throws(() => {
    adapter.parseTestOutput('')
  }, /parseTestOutput\(\) must be implemented/)
})

test('TestFrameworkAdapter - parseValidationOutput returns empty errors by default', () => {
  const result = adapter.parseValidationOutput('', 'test')

  assert.ok(result.errors)
  assert.ok(Array.isArray(result.errors))
  assert.strictEqual(result.errors.length, 0)
})

test('TestFrameworkAdapter - getVerifyCommand throws error when not implemented', () => {
  assert.throws(() => {
    adapter.getVerifyCommand({})
  }, /getVerifyCommand\(\) must be implemented/)
})

test('TestFrameworkAdapter - getDefaultConfig returns base config', () => {
  const config = adapter.getDefaultConfig('/test/path')

  assert.strictEqual(config.projectRoot, '/test/path')
  assert.strictEqual(config.framework, 'base')
  assert.strictEqual(config.testType, 'unit')
})

test('TestFrameworkAdapter - detectConfig returns empty object by default', () => {
  const config = adapter.detectConfig({})

  assert.deepStrictEqual(config, {})
})

console.log('✅ All TestFrameworkAdapter tests passed')
