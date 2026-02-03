#!/usr/bin/env node

/**
 * Tests for base-adapter.mjs
 * Usage: node base-adapter.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { BuildFrameworkAdapter } from '../../scripts/adapters/base-adapter.mjs'

const adapter = new BuildFrameworkAdapter()

test('BuildFrameworkAdapter - has default properties', () => {
  assert.strictEqual(adapter.name, 'base')
  assert.strictEqual(adapter.displayName, 'Base Build Framework')
  assert.strictEqual(adapter.buildType, 'unknown')
})

test('BuildFrameworkAdapter - canDetect throws error when not implemented', () => {
  assert.throws(() => {
    adapter.canDetect({})
  }, /canDetect\(\) must be implemented/)
})

test('BuildFrameworkAdapter - getBuildCommand throws error when not implemented', () => {
  assert.throws(() => {
    adapter.getBuildCommand({})
  }, /getBuildCommand\(\) must be implemented/)
})

test('BuildFrameworkAdapter - getSourceFilePatterns throws error when not implemented', () => {
  assert.throws(() => {
    adapter.getSourceFilePatterns()
  }, /getSourceFilePatterns\(\) must be implemented/)
})

test('BuildFrameworkAdapter - getValidationCommands returns empty array by default', () => {
  const commands = adapter.getValidationCommands({})

  assert.ok(Array.isArray(commands))
  assert.strictEqual(commands.length, 0)
})

test('BuildFrameworkAdapter - getResourceMultiplier returns 1.0 by default', () => {
  assert.strictEqual(adapter.getResourceMultiplier(), 1.0)
})

test('BuildFrameworkAdapter - getParallelExecutionStrategy returns default strategy', () => {
  const strategy = adapter.getParallelExecutionStrategy(8)

  assert.strictEqual(strategy.maxWorkers, 7)
  assert.strictEqual(strategy.staggerDelay, 0)
  assert.strictEqual(strategy.requiresIsolation, false)
})

test('BuildFrameworkAdapter - parseBuildOutput throws error when not implemented', () => {
  assert.throws(() => {
    adapter.parseBuildOutput('')
  }, /parseBuildOutput\(\) must be implemented/)
})

test('BuildFrameworkAdapter - parseValidationOutput returns empty errors by default', () => {
  const result = adapter.parseValidationOutput('', 'test')

  assert.ok(result.errors)
  assert.ok(Array.isArray(result.errors))
  assert.strictEqual(result.errors.length, 0)
})

test('BuildFrameworkAdapter - getVerifyCommand throws error when not implemented', () => {
  assert.throws(() => {
    adapter.getVerifyCommand({})
  }, /getVerifyCommand\(\) must be implemented/)
})

test('BuildFrameworkAdapter - getDefaultConfig returns base config', () => {
  const config = adapter.getDefaultConfig('/test/path')

  assert.strictEqual(config.projectRoot, '/test/path')
  assert.strictEqual(config.framework, 'base')
  assert.strictEqual(config.buildType, 'unknown')
})

test('BuildFrameworkAdapter - detectConfig returns empty object by default', () => {
  const config = adapter.detectConfig({})

  assert.deepStrictEqual(config, {})
})

console.log('✅ All BuildFrameworkAdapter tests passed')
