#!/usr/bin/env node

/**
 * Tests for dotnet.mjs adapter
 * Usage: node dotnet.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { DotNetAdapter } from '../../scripts/adapters/dotnet.mjs'

const adapter = new DotNetAdapter()

test('DotNetAdapter - has correct properties', () => {
  assert.strictEqual(adapter.name, 'dotnet')
  assert.strictEqual(adapter.displayName, '.NET Build')
  assert.strictEqual(adapter.buildType, 'dotnet')
})

test('DotNetAdapter - canDetect returns true for .sln files', () => {
  const context = {
    glob: (pattern) => {
      if (pattern.includes('*.sln')) return ['MyProject.sln']
      return []
    }
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('DotNetAdapter - canDetect returns true for .slnx files', () => {
  const context = {
    glob: (pattern) => {
      if (pattern === '**/*.sln') return []
      if (pattern === '**/*.slnx') return ['MyProject.slnx']
      if (pattern === '**/*.csproj') return []
      return []
    }
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('DotNetAdapter - canDetect returns true for .csproj files', () => {
  const context = {
    glob: (pattern) => {
      if (pattern.includes('*.sln')) return []
      if (pattern.includes('*.slnx')) return []
      if (pattern.includes('*.csproj')) return ['MyProject.csproj']
      return []
    }
  }

  assert.strictEqual(adapter.canDetect(context), true)
})

test('DotNetAdapter - canDetect returns false when no .NET files found', () => {
  const context = {
    glob: () => []
  }

  assert.strictEqual(adapter.canDetect(context), false)
})

test('DotNetAdapter - getBuildCommand returns array of commands', () => {
  const config = {
    projectRoot: '/test',
    solutionFile: 'MyProject.sln'
  }

  const commands = adapter.getBuildCommand(config)

  assert.ok(Array.isArray(commands))
  assert.strictEqual(commands.length, 2)
  assert.ok(commands[0].includes('dotnet restore'))
  assert.ok(commands[1].includes('dotnet build'))
  assert.ok(commands[1].includes('--no-restore'))
})

test('DotNetAdapter - getSourceFilePatterns returns correct patterns', () => {
  const patterns = adapter.getSourceFilePatterns()

  assert.ok(Array.isArray(patterns))
  assert.ok(patterns.includes('**/*.cs'))
  assert.ok(patterns.includes('**/*.csproj'))
  assert.ok(patterns.includes('**/*.sln'))
})

test('DotNetAdapter - getValidationCommands includes dotnet format when enabled', () => {
  const config = {
    projectRoot: '/test',
    solutionFile: 'MyProject.sln',
    useDotnetFormat: true
  }

  const commands = adapter.getValidationCommands(config)

  assert.ok(Array.isArray(commands))
  assert.strictEqual(commands.length, 1)
  assert.strictEqual(commands[0].name, 'dotnet-format')
  assert.ok(commands[0].command.includes('dotnet format'))
  assert.strictEqual(commands[0].optional, false)
})

test('DotNetAdapter - getValidationCommands excludes dotnet format when disabled', () => {
  const config = {
    projectRoot: '/test',
    solutionFile: 'MyProject.sln',
    useDotnetFormat: false
  }

  const commands = adapter.getValidationCommands(config)

  assert.ok(Array.isArray(commands))
  assert.strictEqual(commands.length, 0)
})

test('DotNetAdapter - getResourceMultiplier returns 2.0', () => {
  assert.strictEqual(adapter.getResourceMultiplier(), 2.0)
})

test('DotNetAdapter - getParallelExecutionStrategy adjusts for .NET', () => {
  const strategy = adapter.getParallelExecutionStrategy(8)

  assert.strictEqual(strategy.maxWorkers, 4)  // floor(8 / 2)
  assert.strictEqual(strategy.staggerDelay, 2000)
  assert.strictEqual(strategy.requiresIsolation, false)
})

test('DotNetAdapter - parseBuildOutput parses C# compiler errors', () => {
  const output = `
    /path/to/File.cs(42,15): error CS1001: Identifier expected [MyProject.csproj]
    /path/to/Other.cs(10,5): warning CS0168: Variable unused [MyProject.csproj]
  `

  const result = adapter.parseBuildOutput(output)

  assert.ok(result.errors)
  assert.ok(Array.isArray(result.errors))
  assert.strictEqual(result.errors.length, 2)

  const error = result.errors[0]
  assert.ok(error.file.includes('File.cs'))
  assert.strictEqual(error.line, 42)
  assert.strictEqual(error.column, 15)
  assert.strictEqual(error.rule, 'CS1001')
})

test('DotNetAdapter - parseBuildOutput parses Windows paths', () => {
  const output = 'C:\\Projects\\File.cs(42,15): error CS1001: message [Project.csproj]'

  const result = adapter.parseBuildOutput(output)

  assert.strictEqual(result.errors.length, 1)
  assert.ok(result.errors[0].file.includes('File.cs'))
})

test('DotNetAdapter - parseValidationOutput parses dotnet format errors', () => {
  const output = `
    File.cs(42,15): warning: Fix whitespace formatting
    Other.cs(10,5): warning: Remove unnecessary using
  `

  const result = adapter.parseValidationOutput(output, 'dotnet-format')

  assert.ok(result.errors)
  assert.strictEqual(result.errors.length, 2)

  const error = result.errors[0]
  assert.ok(error.file.includes('File.cs'))
  assert.strictEqual(error.line, 42)
  assert.strictEqual(error.type, 'format-error')
})

test('DotNetAdapter - getVerifyCommand returns null (deferred verification)', () => {
  const config = {
    projectRoot: '/test',
    file: 'MyClass.cs',
    solutionFile: 'MyProject.sln'
  }

  const command = adapter.getVerifyCommand(config)

  assert.strictEqual(command, null)
})

test('DotNetAdapter - detectConfig prefers .sln over .slnx and .csproj', () => {
  const context = {
    glob: (pattern) => {
      if (pattern.includes('*.sln')) return ['MyProject.sln']
      if (pattern.includes('*.slnx')) return ['Other.slnx']
      if (pattern.includes('*.csproj')) return ['Project.csproj']
      return []
    },
    fileExists: () => false,
    readFile: () => ''
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.solutionFile, 'MyProject.sln')
  assert.strictEqual(config.projectFile, null)
})

test('DotNetAdapter - detectConfig uses .slnx when no .sln', () => {
  const context = {
    glob: (pattern) => {
      if (pattern === '**/*.sln') return []
      if (pattern === '**/*.slnx') return ['MyProject.slnx']
      if (pattern === '**/*.csproj') return ['Project.csproj']
      if (pattern.includes('.github/workflows')) return []
      return []
    },
    fileExists: () => false,
    readFile: () => ''
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.solutionFile, 'MyProject.slnx')
  assert.strictEqual(config.projectFile, null)
})

test('DotNetAdapter - detectConfig uses .csproj when no solution files', () => {
  const context = {
    glob: (pattern) => {
      if (pattern.includes('*.sln')) return []
      if (pattern.includes('*.slnx')) return []
      if (pattern.includes('*.csproj')) return ['Project.csproj']
      return []
    },
    fileExists: () => false,
    readFile: () => ''
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.solutionFile, null)
  assert.strictEqual(config.projectFile, 'Project.csproj')
})

test('DotNetAdapter - detectConfig detects dotnet format in workflows', () => {
  const context = {
    glob: (pattern) => {
      if (pattern.includes('*.sln')) return ['MyProject.sln']
      if (pattern.includes('.github/workflows')) return ['ci.yml']
      return []
    },
    fileExists: () => false,
    readFile: (path) => {
      if (path.includes('ci.yml')) {
        return 'run: dotnet format --verify-no-changes'
      }
      return ''
    }
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.useDotnetFormat, true)
})

test('DotNetAdapter - detectConfig does not detect dotnet format when not in workflows', () => {
  const context = {
    glob: (pattern) => {
      if (pattern.includes('*.sln')) return ['MyProject.sln']
      if (pattern.includes('.github/workflows')) return ['ci.yml']
      return []
    },
    fileExists: () => false,
    readFile: () => 'run: dotnet build'
  }

  const config = adapter.detectConfig(context)

  assert.strictEqual(config.useDotnetFormat, false)
})

console.log('✅ All DotNetAdapter tests passed')
