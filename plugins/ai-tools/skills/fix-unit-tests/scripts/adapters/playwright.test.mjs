#!/usr/bin/env node

/**
 * Tests for playwright.mjs adapter
 * Usage: node playwright.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { PlaywrightAdapter } from './playwright.mjs'

const adapter = new PlaywrightAdapter()

test('PlaywrightAdapter - has correct metadata', () => {
  assert.strictEqual(adapter.name, 'playwright')
  assert.strictEqual(adapter.displayName, 'Playwright')
  assert.strictEqual(adapter.testType, 'e2e')
})

test('PlaywrightAdapter - canDetect returns true for playwright in package.json', () => {
  const context = {
    packageJsonContent: '{"devDependencies": {"@playwright/test": "^1.0.0"}}',
    fileExists: () => false
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('PlaywrightAdapter - canDetect returns true for playwright config', () => {
  const context = {
    packageJsonContent: '{}',
    fileExists: (path) => path === 'playwright.config.ts'
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('PlaywrightAdapter - canDetect returns false when nothing matches', () => {
  const context = {
    packageJsonContent: '{"dependencies": {}}',
    fileExists: () => false
  }

  assert.strictEqual(adapter.canDetect(context), false)
})

test('PlaywrightAdapter - getTestFilePatterns returns e2e patterns', () => {
  const patterns = adapter.getTestFilePatterns()

  assert.ok(Array.isArray(patterns))
  assert.ok(patterns.includes('**/*.spec.ts'))
  assert.ok(patterns.some(p => p.includes('e2e')))
})

test('PlaywrightAdapter - getSkipPatterns returns playwright skip patterns', () => {
  const patterns = adapter.getSkipPatterns()

  assert.ok(Array.isArray(patterns))
  assert.ok(patterns.includes('test\\.skip\\('))
  assert.ok(patterns.includes('test\\.fixme\\('))
})

test('PlaywrightAdapter - getResourceMultiplier returns 2.5 for E2E', () => {
  assert.strictEqual(adapter.getResourceMultiplier(), 2.5)
})

test('PlaywrightAdapter - getParallelExecutionStrategy returns conservative strategy', () => {
  const strategy = adapter.getParallelExecutionStrategy(8)

  assert.ok(strategy.maxWorkers <= 4, 'Should cap at 4 workers')
  assert.strictEqual(strategy.staggerDelay, 5000, 'Should have 5s stagger delay')
  assert.strictEqual(strategy.requiresIsolation, true, 'Should require isolation')
})

test('PlaywrightAdapter - parseTestOutput parses playwright failures', () => {
  const output = `
  ✘  [chromium] › login.spec.ts:15:5 › Login flow › should login successfully
  ✘  home.spec.ts:20:3 › Home page › loads correctly
  `

  const result = adapter.parseTestOutput(output)

  assert.ok(Array.isArray(result.failures))
  assert.ok(result.failures.length > 0)
})

test('PlaywrightAdapter - parseTestOutput detects timeout errors', () => {
  const output = `
  Error: Timeout 30000ms exceeded
  Test timeout of 30000ms exceeded
  `

  const result = adapter.parseTestOutput(output)

  const timeoutErrors = result.failures.filter(f => f.type === 'timeout')
  assert.ok(timeoutErrors.length > 0, 'Should detect timeout errors')
})

test('PlaywrightAdapter - detectConfig detects config file', () => {
  const context = {
    packageJsonContent: '{"dependencies": {"@playwright/test": "^1.0.0"}}',
    fileExists: (path) => path === 'playwright.config.ts'
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.playwrightConfig, 'playwright.config.ts')
})

test('PlaywrightAdapter - getTestCommand includes config and reporter', () => {
  const config = { playwrightConfig: 'playwright.config.ts' }
  const command = adapter.getTestCommand(config)

  assert.ok(command.includes('playwright test'))
  assert.ok(command.includes('--config'))
  assert.ok(command.includes('--reporter=list'))
})

test('PlaywrightAdapter - getVerifyCommand uses single worker', () => {
  const config = { testFile: 'login.spec.ts' }
  const command = adapter.getVerifyCommand(config)

  assert.ok(command.includes('--workers=1'))
  assert.ok(command.includes('login.spec.ts'))
})

console.log('✅ All PlaywrightAdapter tests passed')
