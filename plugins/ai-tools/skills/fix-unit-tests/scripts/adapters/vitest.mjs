#!/usr/bin/env node

/**
 * Vitest Test Framework Adapter
 *
 * Supports Vitest and Jest for JavaScript/TypeScript unit testing.
 * Extracted from the original fix-unit-tests implementation.
 */

import { TestFrameworkAdapter } from './base-adapter.mjs'
import { existsSync } from 'fs'
import { join } from 'path'

export class VitestAdapter extends TestFrameworkAdapter {
  name = 'vitest'
  displayName = 'Vitest'
  testType = 'unit'

  // ==================== Detection ====================

  canDetect(context) {
    const { packageJsonContent, fileExists } = context

    if (!packageJsonContent) {
      return false
    }

    // Check for Vitest, Jest, or Vite (which often includes Vitest)
    if (packageJsonContent.match(/["']vitest["']|["']jest["']|["']vite["']/)) {
      return true
    }

    // Also check for config files
    return (
      fileExists('vitest.config.ts') ||
      fileExists('vitest.config.js') ||
      fileExists('jest.config.ts') ||
      fileExists('jest.config.js')
    )
  }

  // ==================== Test Discovery ====================

  getTestCommand(config) {
    const { projectRoot, testPath, packageManager = 'pnpm', vitestConfig } = config

    // Determine config file
    const configFile = vitestConfig || this._detectConfigFile(config)

    // Build command
    let cmd = `${packageManager} exec vitest run`

    if (configFile) {
      cmd += ` --config ${configFile}`
    }

    if (testPath) {
      cmd += ` ${testPath}`
    }

    return cmd
  }

  getTestFilePatterns() {
    return ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx', '**/*.test.js', '**/*.test.jsx', '**/*.spec.js', '**/*.spec.jsx']
  }

  getSkipPatterns() {
    return [
      'it\\.skip\\(',
      'test\\.skip\\(',
      'describe\\.skip\\(',
      'xit\\(',
      'xtest\\(',
      'xdescribe\\('
    ]
  }

  getFocusPatterns() {
    return [
      'it\\.only\\(',
      'test\\.only\\(',
      'describe\\.only\\(',
      'fit\\(',
      'fdescribe\\('
    ]
  }

  // ==================== Validation ====================

  getValidationCommands(config) {
    const { projectRoot, packageManager = 'pnpm', hasPrettier, testPath } = config

    const commands = []

    // Prettier (optional)
    if (hasPrettier) {
      const prettierTarget = testPath || '.'
      commands.push({
        name: 'prettier',
        command: `${packageManager} exec prettier --write --experimental-cli ${prettierTarget}`
      })
    }

    // ESLint (required)
    const eslintTarget = testPath || 'src e2e'
    commands.push({
      name: 'eslint',
      command: `${packageManager} exec eslint --cache --cache-location .eslintcache --max-warnings 0 ${eslintTarget}`
    })

    // TypeScript (required)
    const tscArgs = testPath ? `--noEmit ${testPath}` : '--noEmit'
    commands.push({
      name: 'tsc',
      command: `${packageManager} exec tsc ${tscArgs}`
    })

    return commands
  }

  // ==================== Resource Management ====================

  getResourceMultiplier() {
    return 1.0 // Unit tests use ~2GB per worker
  }

  getParallelExecutionStrategy(cpuCores) {
    return {
      maxWorkers: Math.max(1, cpuCores - 1),
      staggerDelay: 0, // No delay needed for unit tests
      requiresIsolation: false
    }
  }

  // ==================== Output Parsing ====================

  parseTestOutput(output) {
    const failures = []
    const lines = output.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Match Vitest/Jest failure patterns
      // Example: "❌ src/components/Button.test.tsx > Button > renders correctly"
      const vitestFailMatch = line.match(/❌\s+(.+?)\s+>\s+(.+)/)
      if (vitestFailMatch) {
        failures.push({
          file: vitestFailMatch[1],
          testName: vitestFailMatch[2],
          type: 'test-failure'
        })
        continue
      }

      // Match Jest failure patterns
      // Example: "  ● Button › renders correctly"
      const jestFailMatch = line.match(/●\s+(.+?)\s+›\s+(.+)/)
      if (jestFailMatch) {
        failures.push({
          testName: `${jestFailMatch[1]} > ${jestFailMatch[2]}`,
          type: 'test-failure'
        })
        continue
      }

      // Match generic FAIL markers
      if (line.includes('FAIL')) {
        const fileMatch = line.match(/FAIL\s+(.+\.(test|spec)\.(ts|tsx|js|jsx))/)
        if (fileMatch) {
          failures.push({
            file: fileMatch[1],
            type: 'test-failure'
          })
        }
      }

      // Match file paths with line numbers from stack traces
      // Example: "  at Object.<anonymous> (src/utils/helper.ts:42:15)"
      const stackMatch = line.match(/at\s+.+?\((.+?):(\d+):(\d+)\)/)
      if (stackMatch) {
        failures.push({
          file: stackMatch[1],
          line: parseInt(stackMatch[2]),
          column: parseInt(stackMatch[3]),
          type: 'stack-trace'
        })
      }
    }

    return { failures }
  }

  parseValidationOutput(output, validatorName) {
    const errors = []

    if (validatorName === 'tsc') {
      // Parse TypeScript errors
      // Example: "src/components/Button.tsx(42,15): error TS2322: Type 'string' is not assignable to type 'number'."
      const lines = output.split('\n')
      for (const line of lines) {
        const match = line.match(/(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)/)
        if (match) {
          errors.push({
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            rule: match[4],
            message: match[5]
          })
        }
      }
    } else if (validatorName === 'eslint') {
      // Parse ESLint errors
      // Example: "  42:15  error  'foo' is not defined  no-undef"
      const lines = output.split('\n')
      let currentFile = null

      for (const line of lines) {
        // Match file path
        const fileMatch = line.match(/^(.+\.(ts|tsx|js|jsx))$/)
        if (fileMatch && !line.includes(':')) {
          currentFile = fileMatch[1]
          continue
        }

        // Match error line
        const errorMatch = line.match(/\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+(.+)/)
        if (errorMatch && currentFile) {
          errors.push({
            file: currentFile,
            line: parseInt(errorMatch[1]),
            column: parseInt(errorMatch[2]),
            message: errorMatch[4],
            rule: errorMatch[5]
          })
        }
      }
    }

    return { errors }
  }

  // ==================== Verification ====================

  getVerifyCommand(config) {
    const { testFile, packageManager = 'pnpm' } = config

    return `${packageManager} exec vitest ${testFile} --run`
  }

  // ==================== Configuration ====================

  detectConfig(context) {
    const { packageJsonContent, fileExists } = context

    // Detect config file
    let vitestConfig = null
    if (fileExists('vitest.config.ts')) {
      vitestConfig = 'vitest.config.ts'
    } else if (fileExists('vitest.config.js')) {
      vitestConfig = 'vitest.config.js'
    } else if (fileExists('jest.config.ts')) {
      vitestConfig = 'jest.config.ts'
    } else if (fileExists('jest.config.js')) {
      vitestConfig = 'jest.config.js'
    }

    // Detect package manager
    let packageManager = 'pnpm'
    if (fileExists('pnpm-lock.yaml')) {
      packageManager = 'pnpm'
    } else if (fileExists('yarn.lock')) {
      packageManager = 'yarn'
    } else if (fileExists('package-lock.json')) {
      packageManager = 'npm'
    } else if (fileExists('bun.lockb')) {
      packageManager = 'bun'
    }

    // Detect prettier
    const hasPrettier = packageJsonContent && packageJsonContent.includes('"prettier"')

    return {
      vitestConfig,
      packageManager,
      hasPrettier
    }
  }

  getDefaultConfig(projectRoot) {
    return {
      ...super.getDefaultConfig(projectRoot),
      packageManager: 'pnpm',
      hasPrettier: false
    }
  }

  // ==================== Private Helpers ====================

  _detectConfigFile(config) {
    const { projectRoot } = config

    const candidates = [
      'vitest.config.ts',
      'vitest.config.js',
      'jest.config.ts',
      'jest.config.js'
    ]

    for (const candidate of candidates) {
      if (existsSync(join(projectRoot, candidate))) {
        return candidate
      }
    }

    return null
  }
}
