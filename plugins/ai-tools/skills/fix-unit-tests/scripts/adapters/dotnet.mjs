#!/usr/bin/env node

/**
 * .NET Test Framework Adapter
 *
 * Supports .NET testing frameworks:
 * - NUnit
 * - xUnit
 * - MSTest
 *
 * Server-side tests in C# have different characteristics:
 * - Tests in separate projects (*.Tests.csproj, *.Test.csproj)
 * - Use dotnet test command
 * - Validation via dotnet format and dotnet build
 * - Test files use *Test.cs or *Tests.cs naming
 */

import { TestFrameworkAdapter } from './base-adapter.mjs'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

export class DotNetAdapter extends TestFrameworkAdapter {
  name = 'dotnet'
  displayName = '.NET Test'
  testType = 'unit'

  // ==================== Detection ====================

  canDetect(context) {
    const { glob, readFile } = context

    // Look for .NET test project files
    const csprojFiles = glob('**/*.csproj')

    for (const csprojFile of csprojFiles) {
      // Skip files in node_modules or other irrelevant directories
      if (csprojFile.includes('node_modules') || csprojFile.includes('bin') || csprojFile.includes('obj')) {
        continue
      }

      try {
        const content = readFile(csprojFile)

        // Check for .NET test framework packages
        if (
          content.includes('Microsoft.NET.Test.Sdk') ||
          content.includes('NUnit3') ||
          content.includes('xunit') ||
          content.includes('MSTest')
        ) {
          return true
        }
      } catch (error) {
        // Skip files that can't be read
        continue
      }
    }

    return false
  }

  // ==================== Test Discovery ====================

  getTestCommand(config) {
    const { projectRoot, testPath, testProject } = config

    // Find test project if not specified
    const project = testProject || this._findTestProject(projectRoot)

    if (!project) {
      throw new Error('No .NET test project found')
    }

    let cmd = `dotnet test "${project}"`

    // Add common options
    cmd += ' --no-build --verbosity normal'

    // Filter to specific test if provided
    if (testPath) {
      // Extract test name from path (e.g., UserServiceTests from UserServiceTests.cs)
      const testName = testPath.replace(/\.cs$/, '').split(/[/\\]/).pop()
      cmd += ` --filter "FullyQualifiedName~${testName}"`
    }

    return cmd
  }

  getTestFilePatterns() {
    return ['**/*Test.cs', '**/*Tests.cs', '**/*_Test.cs', '**/*_Tests.cs']
  }

  getSkipPatterns() {
    return [
      '\\[Ignore\\]',           // NUnit
      '\\[Ignore\\(.+\\)\\]',   // NUnit with reason
      '\\[Skip\\]',             // xUnit
      '\\[Skip\\(.+\\)\\]'      // xUnit with reason
    ]
  }

  getFocusPatterns() {
    return [
      '\\[Test\\].*\\[Explicit\\]'  // NUnit explicit tests
    ]
  }

  // ==================== Validation ====================

  getValidationCommands(config) {
    const { projectRoot, testProject } = config

    const project = testProject || this._findTestProject(projectRoot)

    if (!project) {
      return []
    }

    const commands = []

    // dotnet format for code style
    commands.push({
      name: 'dotnet-format',
      command: `dotnet format "${project}" --verify-no-changes`
    })

    // dotnet build for compilation errors
    commands.push({
      name: 'dotnet-build',
      command: `dotnet build "${project}" --no-restore`
    })

    return commands
  }

  // ==================== Resource Management ====================

  getResourceMultiplier() {
    // .NET tests use moderate resources
    // - Test project loading: ~500MB
    // - Test execution: ~1-2GB
    // Total: ~2-3GB per worker
    return 1.5
  }

  getParallelExecutionStrategy(cpuCores) {
    return {
      maxWorkers: Math.max(1, cpuCores - 1),
      staggerDelay: 1000, // Small delay to avoid project file lock contention
      requiresIsolation: false
    }
  }

  // ==================== Output Parsing ====================

  parseTestOutput(output) {
    const failures = []
    const lines = output.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Match "Failed TestName [duration]"
      const failMatch = line.match(/Failed\s+(.+?)\s+\[/)
      if (failMatch) {
        failures.push({
          testName: failMatch[1],
          type: 'test-failure'
        })
      }

      // Match file paths in error messages with Windows or Unix paths
      // Windows: "C:\path\to\file.cs(42,15): error CS1234: message"
      // Unix: "/path/to/file.cs(42,15): error CS1234: message"
      const fileMatchWin = line.match(/([A-Z]:\\[^(]+\.cs)\((\d+),(\d+)\)/)
      const fileMatchUnix = line.match(/([/][^(]+\.cs)\((\d+),(\d+)\)/)
      const fileMatch = fileMatchWin || fileMatchUnix

      if (fileMatch) {
        failures.push({
          file: fileMatch[1],
          line: parseInt(fileMatch[2]),
          column: parseInt(fileMatch[3]),
          type: 'build-error'
        })
      }

      // Match assertion failures
      // Example: "  Expected: True"
      if (line.includes('Expected:') || line.includes('Actual:')) {
        failures.push({
          message: line.trim(),
          type: 'assertion'
        })
      }
    }

    return { failures }
  }

  parseValidationOutput(output, validatorName) {
    const errors = []

    if (validatorName === 'dotnet-build') {
      // Parse build errors
      // Example: "File.cs(42,15): error CS1234: message [Project.csproj]"
      const lines = output.split('\n')

      for (const line of lines) {
        const match = line.match(/(.+\.cs)\((\d+),(\d+)\):\s+(error|warning)\s+(CS\d+):\s+(.+?)\s+\[/)
        if (match) {
          errors.push({
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            severity: match[4],
            rule: match[5],
            message: match[6]
          })
        }
      }
    } else if (validatorName === 'dotnet-format') {
      // Parse format violations
      // Example: "  File.cs(42,15): warning: Fix whitespace"
      const lines = output.split('\n')

      for (const line of lines) {
        const match = line.match(/(.+\.cs)\((\d+),(\d+)\):\s+warning:\s+(.+)/)
        if (match) {
          errors.push({
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            message: match[4]
          })
        }
      }
    }

    return { errors }
  }

  // ==================== Verification ====================

  getVerifyCommand(config) {
    const { testFile, testProject, projectRoot } = config

    const project = testProject || this._findTestProject(projectRoot)

    if (!project) {
      throw new Error('No .NET test project found')
    }

    // Extract test class name from file path
    const testClassName = testFile.replace(/\.cs$/, '').split(/[/\\]/).pop()

    return `dotnet test "${project}" --no-build --filter "FullyQualifiedName~${testClassName}"`
  }

  // ==================== Configuration ====================

  detectConfig(context) {
    const { glob } = context

    // Find test project
    const testProject = this._findTestProjectFromContext(context)

    // Detect test framework
    let testFramework = 'unknown'
    if (testProject) {
      try {
        const content = context.readFile(testProject)
        testFramework = this._detectFramework(content)
      } catch (error) {
        // Can't read project file
      }
    }

    return {
      testProject,
      testFramework
    }
  }

  getDefaultConfig(projectRoot) {
    return {
      ...super.getDefaultConfig(projectRoot),
      testFramework: 'unknown'
    }
  }

  // ==================== Private Helpers ====================

  _findTestProject(projectRoot) {
    try {
      const files = this._findCsprojFiles(projectRoot)

      for (const file of files) {
        const content = readFileSync(file, 'utf-8')

        if (
          content.includes('Microsoft.NET.Test.Sdk') ||
          content.includes('NUnit3') ||
          content.includes('xunit') ||
          content.includes('MSTest')
        ) {
          return file
        }
      }
    } catch (error) {
      // Error finding files
    }

    return null
  }

  _findTestProjectFromContext(context) {
    const { glob, readFile } = context

    const csprojFiles = glob('**/*.csproj')

    for (const file of csprojFiles) {
      // Skip irrelevant directories
      if (file.includes('node_modules') || file.includes('bin') || file.includes('obj')) {
        continue
      }

      try {
        const content = readFile(file)

        if (
          content.includes('Microsoft.NET.Test.Sdk') ||
          content.includes('NUnit3') ||
          content.includes('xunit') ||
          content.includes('MSTest')
        ) {
          return file
        }
      } catch (error) {
        continue
      }
    }

    return null
  }

  _findCsprojFiles(directory) {
    const results = []

    const scan = (dir) => {
      try {
        const entries = readdirSync(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = join(dir, entry.name)

          // Skip irrelevant directories
          if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'bin' || entry.name === 'obj') {
              continue
            }
            scan(fullPath)
          } else if (entry.isFile() && entry.name.endsWith('.csproj')) {
            results.push(fullPath)
          }
        }
      } catch (error) {
        // Can't read directory
      }
    }

    scan(directory)
    return results
  }

  _detectFramework(csprojContent) {
    if (csprojContent.includes('NUnit3')) return 'nunit'
    if (csprojContent.includes('xunit')) return 'xunit'
    if (csprojContent.includes('MSTest')) return 'mstest'
    return 'unknown'
  }
}
