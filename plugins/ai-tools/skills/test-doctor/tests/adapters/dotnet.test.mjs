#!/usr/bin/env node

/**
 * Tests for dotnet.mjs adapter
 * Usage: node dotnet.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { DotNetAdapter } from '../../scripts/adapters/dotnet.mjs'

const adapter = new DotNetAdapter()

test('DotNetAdapter - has correct metadata', () => {
  assert.strictEqual(adapter.name, 'dotnet')
  assert.strictEqual(adapter.displayName, '.NET Test')
  assert.strictEqual(adapter.testType, 'unit')
})

test('DotNetAdapter - getTestFilePatterns returns C# patterns', () => {
  const patterns = adapter.getTestFilePatterns()

  assert.ok(Array.isArray(patterns))
  assert.ok(patterns.includes('**/*Test.cs'))
  assert.ok(patterns.includes('**/*Tests.cs'))
  assert.ok(patterns.length >= 3)
})

test('DotNetAdapter - getSkipPatterns returns .NET skip patterns', () => {
  const patterns = adapter.getSkipPatterns()

  assert.ok(Array.isArray(patterns))
  assert.ok(patterns.includes('\\[Ignore\\]'))
  assert.ok(patterns.includes('\\[Skip\\]'))
})

test('DotNetAdapter - getResourceMultiplier returns 1.5', () => {
  assert.strictEqual(adapter.getResourceMultiplier(), 1.5)
})

test('DotNetAdapter - getParallelExecutionStrategy has stagger delay', () => {
  const strategy = adapter.getParallelExecutionStrategy(8)

  assert.ok(strategy.maxWorkers > 0)
  assert.strictEqual(strategy.staggerDelay, 1000)
  assert.strictEqual(strategy.requiresIsolation, false)
})

test('DotNetAdapter - parseTestOutput parses failed tests', () => {
  const output = `
Failed UserServiceTests.ShouldReturnUser [100ms]
Failed OrderServiceTests.ShouldCreateOrder [50ms]
  `

  const result = adapter.parseTestOutput(output)

  assert.ok(Array.isArray(result.failures))
  assert.strictEqual(result.failures.length, 2)
  assert.strictEqual(result.failures[0].testName, 'UserServiceTests.ShouldReturnUser')
  assert.strictEqual(result.failures[1].testName, 'OrderServiceTests.ShouldCreateOrder')
})

test('DotNetAdapter - parseTestOutput parses file paths', () => {
  const outputUnix = `
/path/to/UserServiceTests.cs(42,15): error
  `

  const resultUnix = adapter.parseTestOutput(outputUnix)
  assert.ok(resultUnix.failures.length > 0)
  assert.strictEqual(resultUnix.failures[0].file, '/path/to/UserServiceTests.cs')
  assert.strictEqual(resultUnix.failures[0].line, 42)
})

test('DotNetAdapter - parseValidationOutput parses build errors', () => {
  const output = `
UserService.cs(42,15): error CS1234: Missing semicolon [Project.csproj]
OrderService.cs(10,5): warning CS5678: Unused variable [Project.csproj]
  `

  const result = adapter.parseValidationOutput(output, 'dotnet-build')

  assert.ok(Array.isArray(result.errors))
  assert.strictEqual(result.errors.length, 2)
  assert.strictEqual(result.errors[0].file, 'UserService.cs')
  assert.strictEqual(result.errors[0].line, 42)
  assert.strictEqual(result.errors[0].rule, 'CS1234')
})

test('DotNetAdapter - parseValidationOutput parses format violations', () => {
  const output = `
UserService.cs(42,15): warning: Fix whitespace
OrderService.cs(10,5): warning: Remove unused using
  `

  const result = adapter.parseValidationOutput(output, 'dotnet-format')

  assert.ok(Array.isArray(result.errors))
  assert.strictEqual(result.errors.length, 2)
  assert.strictEqual(result.errors[0].file, 'UserService.cs')
  assert.strictEqual(result.errors[0].message, 'Fix whitespace')
})

test('DotNetAdapter - getTestCommand includes project and filter', () => {
  const config = { projectRoot: '/test', testProject: 'Test.csproj', testPath: 'UserServiceTests.cs' }
  const command = adapter.getTestCommand(config)

  assert.ok(command.includes('dotnet test'))
  assert.ok(command.includes('Test.csproj'))
  assert.ok(command.includes('--filter'))
  assert.ok(command.includes('UserServiceTests'))
})

test('DotNetAdapter - getValidationCommands returns dotnet commands', () => {
  const config = { projectRoot: '/test', testProject: 'Test.csproj' }
  const commands = adapter.getValidationCommands(config)

  assert.ok(Array.isArray(commands))
  assert.ok(commands.some(cmd => cmd.name === 'dotnet-format'))
  assert.ok(commands.some(cmd => cmd.name === 'dotnet-build'))
})

console.log('✅ All DotNetAdapter tests passed')
