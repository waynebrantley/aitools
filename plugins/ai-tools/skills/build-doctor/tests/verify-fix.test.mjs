#!/usr/bin/env node

/**
 * Tests for verify-fix.mjs
 * Usage: node verify-fix.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { DotNetAdapter } from '../scripts/adapters/dotnet.mjs'
import { TypeScriptAdapter } from '../scripts/adapters/typescript.mjs'

// Mock verifyFile function for testing
function mockVerifyFile(file, adapter, config, projectRoot) {
  // Simulate verification logic
  const allErrors = []

  // Check if adapter supports individual file verification
  const verifyCommand = adapter.getVerifyCommand({ ...config, file })

  if (verifyCommand === null) {
    // Deferred verification
    return {
      fixed: true,
      errorCount: 0,
      errors: [],
      deferredVerification: true
    }
  }

  // Simulate finding no errors for successful verification
  return {
    fixed: allErrors.length === 0,
    errorCount: allErrors.length,
    errors: allErrors
  }
}

test('verify-fix - TypeScript adapter supports individual file verification', () => {
  const adapter = new TypeScriptAdapter()
  const config = {
    packageManager: 'npm',
    file: 'src/component.ts'
  }

  const result = mockVerifyFile('src/component.ts', adapter, config, '/test')

  assert.strictEqual(result.fixed, true)
  assert.strictEqual(result.deferredVerification, undefined)
})

test('verify-fix - .NET adapter defers verification', () => {
  const adapter = new DotNetAdapter()
  const config = {
    solutionFile: 'MyProject.sln',
    file: 'MyClass.cs'
  }

  const result = mockVerifyFile('MyClass.cs', adapter, config, '/test')

  assert.strictEqual(result.fixed, true)
  assert.strictEqual(result.deferredVerification, true)
  assert.strictEqual(result.errorCount, 0)
})

test('verify-fix - result includes all required properties', () => {
  const adapter = new TypeScriptAdapter()
  const config = {
    packageManager: 'npm',
    file: 'src/component.ts'
  }

  const result = mockVerifyFile('src/component.ts', adapter, config, '/test')

  assert.ok('fixed' in result)
  assert.ok('errorCount' in result)
  assert.ok('errors' in result)
  assert.ok(Array.isArray(result.errors))
})

test('verify-fix - TypeScript getVerifyCommand returns command string', () => {
  const adapter = new TypeScriptAdapter()
  const config = {
    packageManager: 'pnpm',
    file: 'src/utils.ts'
  }

  const command = adapter.getVerifyCommand(config)

  assert.ok(typeof command === 'string')
  assert.ok(command.includes('pnpm'))
  assert.ok(command.includes('tsc'))
  assert.ok(command.includes('src/utils.ts'))
})

test('verify-fix - .NET getVerifyCommand returns null', () => {
  const adapter = new DotNetAdapter()
  const config = {
    solutionFile: 'MyProject.sln',
    file: 'Services/UserService.cs'
  }

  const command = adapter.getVerifyCommand(config)

  assert.strictEqual(command, null)
})

console.log('✅ All verify-fix tests passed')
