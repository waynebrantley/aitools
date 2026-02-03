#!/usr/bin/env node

/**
 * Tests for typescript.mjs adapter
 * Usage: node typescript.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { TypeScriptAdapter } from '../../scripts/adapters/typescript.mjs'

const adapter = new TypeScriptAdapter()

test('TypeScriptAdapter - has correct properties', () => {
  assert.strictEqual(adapter.name, 'typescript')
  assert.strictEqual(adapter.displayName, 'TypeScript Build')
  assert.strictEqual(adapter.buildType, 'typescript')
})

test('TypeScriptAdapter - canDetect returns true when tsconfig.json exists', () => {
  const context = {
    fileExists: (path) => path === 'tsconfig.json',
    packageJsonContent: null
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('TypeScriptAdapter - canDetect returns true when typescript in package.json', () => {
  const context = {
    fileExists: () => false,
    packageJsonContent: '{"devDependencies": {"typescript": "^5.0.0"}}'
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('TypeScriptAdapter - canDetect returns false when no TypeScript detected', () => {
  const context = {
    fileExists: () => false,
    packageJsonContent: '{"dependencies": {}}'
  }

  assert.strictEqual(adapter.canDetect(context), false)
})

test('TypeScriptAdapter - getBuildCommand uses package manager and script', () => {
  const config = {
    packageManager: 'pnpm',
    buildScript: 'build'
  }

  const command = adapter.getBuildCommand(config)

  assert.strictEqual(command, 'pnpm run build')
})

test('TypeScriptAdapter - getSourceFilePatterns returns correct patterns', () => {
  const patterns = adapter.getSourceFilePatterns()

  assert.ok(Array.isArray(patterns))
  assert.ok(patterns.includes('**/*.ts'))
  assert.ok(patterns.includes('**/*.tsx'))
  assert.ok(patterns.includes('**/*.js'))
  assert.ok(patterns.includes('**/*.jsx'))
})

test('TypeScriptAdapter - getValidationCommands includes prettier when available', () => {
  const config = {
    packageManager: 'npm',
    packageJsonContent: JSON.stringify({
      devDependencies: { prettier: '^3.0.0' }
    })
  }

  const commands = adapter.getValidationCommands(config)
  const prettierCommand = commands.find(c => c.name === 'prettier')

  assert.ok(prettierCommand)
  assert.ok(prettierCommand.command.includes('prettier --check'))
  assert.strictEqual(prettierCommand.optional, true)
})

test('TypeScriptAdapter - getValidationCommands includes eslint when available', () => {
  const config = {
    packageManager: 'npm',
    packageJsonContent: JSON.stringify({
      devDependencies: { eslint: '^8.0.0' }
    })
  }

  const commands = adapter.getValidationCommands(config)
  const eslintCommand = commands.find(c => c.name === 'eslint')

  assert.ok(eslintCommand)
  assert.ok(eslintCommand.command.includes('eslint .'))
  assert.strictEqual(eslintCommand.optional, false)
})

test('TypeScriptAdapter - getValidationCommands always includes tsc', () => {
  const config = {
    packageManager: 'npm',
    packageJsonContent: '{}'
  }

  const commands = adapter.getValidationCommands(config)
  const tscCommand = commands.find(c => c.name === 'tsc')

  assert.ok(tscCommand)
  assert.ok(tscCommand.command.includes('tsc --noEmit'))
  assert.strictEqual(tscCommand.optional, false)
})

test('TypeScriptAdapter - getResourceMultiplier returns 1.5', () => {
  assert.strictEqual(adapter.getResourceMultiplier(), 1.5)
})

test('TypeScriptAdapter - getParallelExecutionStrategy returns strategy', () => {
  const strategy = adapter.getParallelExecutionStrategy(8)

  assert.strictEqual(strategy.maxWorkers, 7)
  assert.strictEqual(strategy.staggerDelay, 500)
  assert.strictEqual(strategy.requiresIsolation, false)
})

test('TypeScriptAdapter - parseBuildOutput parses TypeScript errors (format 1)', () => {
  const output = `
    src/file.ts(42,15): error TS2304: Cannot find name 'foo'
    src/other.tsx(10,5): warning TS6133: 'bar' is declared but never used
  `

  const result = adapter.parseBuildOutput(output)

  assert.ok(result.errors)
  assert.strictEqual(result.errors.length, 2)

  const error = result.errors[0]
  assert.ok(error.file.includes('file.ts'))
  assert.strictEqual(error.line, 42)
  assert.strictEqual(error.column, 15)
  assert.strictEqual(error.rule, 'TS2304')
})

test('TypeScriptAdapter - parseBuildOutput parses TypeScript errors (format 2)', () => {
  const output = 'src/file.ts:42:15 - error TS2304: Cannot find name'

  const result = adapter.parseBuildOutput(output)

  assert.strictEqual(result.errors.length, 1)
  assert.ok(result.errors[0].file.includes('file.ts'))
  assert.strictEqual(result.errors[0].line, 42)
})

test('TypeScriptAdapter - parseValidationOutput parses ESLint errors', () => {
  const output = `
  /path/to/file.ts
  42:15  error  'foo' is not defined  no-undef
  `

  const result = adapter.parseValidationOutput(output, 'eslint')

  assert.ok(result.errors)
  assert.strictEqual(result.errors.length, 1)

  const error = result.errors[0]
  assert.ok(error.file.includes('file.ts'))
  assert.strictEqual(error.line, 42)
  assert.strictEqual(error.column, 15)
  assert.strictEqual(error.rule, 'no-undef')
})

test('TypeScriptAdapter - parseValidationOutput parses Prettier errors', () => {
  const output = `
src/file.ts
src/other.tsx
  `

  const result = adapter.parseValidationOutput(output, 'prettier')

  assert.ok(result.errors)
  assert.strictEqual(result.errors.length, 2)
  assert.ok(result.errors[0].file.includes('file.ts'))
  assert.strictEqual(result.errors[0].type, 'format-error')
})

test('TypeScriptAdapter - parseValidationOutput parses tsc errors', () => {
  const output = 'src/file.ts(42,15): error TS2304: Cannot find name'

  const result = adapter.parseValidationOutput(output, 'tsc')

  assert.strictEqual(result.errors.length, 1)
  assert.ok(result.errors[0].file.includes('file.ts'))
  assert.strictEqual(result.errors[0].type, 'type-error')
})

test('TypeScriptAdapter - getVerifyCommand uses tsc with file', () => {
  const config = {
    packageManager: 'npm',
    file: 'src/component.ts'
  }

  const command = adapter.getVerifyCommand(config)

  assert.ok(command.includes('npm exec tsc --noEmit'))
  assert.ok(command.includes('src/component.ts'))
})

test('TypeScriptAdapter - detectConfig detects pnpm', () => {
  const context = {
    fileExists: (path) => path === 'pnpm-lock.yaml',
    packageJsonContent: '{}'
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.packageManager, 'pnpm')
})

test('TypeScriptAdapter - detectConfig detects yarn', () => {
  const context = {
    fileExists: (path) => path === 'yarn.lock',
    packageJsonContent: '{}'
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.packageManager, 'yarn')
})

test('TypeScriptAdapter - detectConfig defaults to npm', () => {
  const context = {
    fileExists: () => false,
    packageJsonContent: '{}'
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.packageManager, 'npm')
})

test('TypeScriptAdapter - detectConfig detects build script', () => {
  const context = {
    fileExists: () => false,
    packageJsonContent: JSON.stringify({
      scripts: {
        build: 'tsc && vite build'
      }
    })
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.buildScript, 'build')
})

console.log('✅ All TypeScriptAdapter tests passed')
