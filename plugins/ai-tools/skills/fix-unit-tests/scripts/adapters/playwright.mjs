#!/usr/bin/env node

/**
 * Playwright Test Framework Adapter
 *
 * Supports Playwright for E2E testing.
 * E2E tests have special characteristics:
 * - Higher resource usage (browser instances ~200-500MB per worker)
 * - Need isolation to avoid state conflicts (database, ports, etc.)
 * - More prone to flakiness (network, timing, animations)
 * - Generate artifacts (screenshots, videos, traces)
 */

import { TestFrameworkAdapter } from './base-adapter.mjs'
import { existsSync } from 'fs'
import { join } from 'path'

export class PlaywrightAdapter extends TestFrameworkAdapter {
  name = 'playwright'
  displayName = 'Playwright'
  testType = 'e2e'

  // ==================== Detection ====================

  canDetect(context) {
    const { packageJsonContent, fileExists } = context

    // Check for @playwright/test in package.json
    if (packageJsonContent && packageJsonContent.includes('"@playwright/test"')) {
      return true
    }

    // Check for playwright config files
    return (
      fileExists('playwright.config.ts') ||
      fileExists('playwright.config.js') ||
      fileExists('e2e/playwright.config.ts') ||
      fileExists('e2e/playwright.config.js')
    )
  }

  // ==================== Test Discovery ====================

  getTestCommand(config) {
    const { testPath, playwrightConfig } = config

    // Determine config file
    const configFile = playwrightConfig || this._detectConfigFile(config)

    // Build command - Playwright uses npx, not package manager
    let cmd = 'npx playwright test'

    if (configFile) {
      cmd += ` --config ${configFile}`
    }

    if (testPath) {
      cmd += ` ${testPath}`
    }

    // Add reporter for better output parsing
    cmd += ' --reporter=list'

    return cmd
  }

  getTestFilePatterns() {
    // Playwright convention uses .spec.ts
    return ['**/*.spec.ts', '**/*.spec.js', 'e2e/**/*.test.ts', 'e2e/**/*.test.js', 'tests/**/*.spec.ts', 'tests/**/*.spec.js']
  }

  getSkipPatterns() {
    return [
      'test\\.skip\\(',
      'test\\.fixme\\('
    ]
  }

  getFocusPatterns() {
    return [
      'test\\.only\\('
    ]
  }

  // ==================== Validation ====================

  getValidationCommands(config) {
    const { packageManager = 'npm', hasPrettier, testPath } = config

    const commands = []

    // Prettier (optional)
    if (hasPrettier) {
      const prettierTarget = testPath || 'e2e tests'
      commands.push({
        name: 'prettier',
        command: `${packageManager} exec prettier --write ${prettierTarget}`
      })
    }

    // ESLint (if available)
    const eslintTarget = testPath || 'e2e tests'
    commands.push({
      name: 'eslint',
      command: `${packageManager} exec eslint --max-warnings 0 ${eslintTarget}`
    })

    // TypeScript (if available)
    const tscArgs = testPath ? `--noEmit ${testPath}` : '--noEmit'
    commands.push({
      name: 'tsc',
      command: `${packageManager} exec tsc ${tscArgs}`
    })

    return commands
  }

  // ==================== Resource Management ====================

  getResourceMultiplier() {
    // E2E tests use significantly more memory:
    // - Browser instance: ~200-300MB
    // - Test execution context: ~200MB
    // - Artifacts (screenshots, videos): variable
    // Total: ~500MB-1GB per worker
    return 2.5 // 2.5 * 2GB = 5GB per worker
  }

  getParallelExecutionStrategy(cpuCores) {
    // E2E tests need more conservative parallelism:
    // - Browser instances are resource-heavy
    // - Tests may have shared state (database, API, ports)
    // - Stagger launches to avoid port conflicts
    return {
      maxWorkers: Math.min(4, Math.floor(cpuCores / 2)), // Max 4 workers, use half of cores
      staggerDelay: 5000, // 5 second delay between spawns to avoid port conflicts
      requiresIsolation: true,
      isolationNote: 'E2E tests may share state. Use unique test data (UUIDs, timestamps) to avoid conflicts. Playwright provides browser context isolation automatically.'
    }
  }

  // ==================== Output Parsing ====================

  parseTestOutput(output) {
    const failures = []
    const lines = output.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Match Playwright failure patterns with list reporter
      // Example: "  ✘  [chromium] › login.spec.ts:15:5 › Login flow › should login successfully"
      const failMatch = line.match(/✘\s+\[(.+?)\]\s+›\s+(.+?):(\d+):(\d+)\s+›\s+(.+)/)
      if (failMatch) {
        failures.push({
          browser: failMatch[1],
          file: failMatch[2],
          line: parseInt(failMatch[3]),
          column: parseInt(failMatch[4]),
          testName: failMatch[5],
          type: 'test-failure'
        })
        continue
      }

      // Match simpler failure pattern
      // Example: "  ✘  login.spec.ts:15:5 › Login flow › should login successfully"
      const simpleFailMatch = line.match(/✘\s+(.+?):(\d+):(\d+)\s+›\s+(.+)/)
      if (simpleFailMatch) {
        failures.push({
          file: simpleFailMatch[1],
          line: parseInt(simpleFailMatch[2]),
          column: parseInt(simpleFailMatch[3]),
          testName: simpleFailMatch[4],
          type: 'test-failure'
        })
        continue
      }

      // Match error location in stack traces
      // Example: "    at /path/to/test.spec.ts:42:15"
      const stackMatch = line.match(/at\s+(.+\.spec\.(ts|js)):(\d+):(\d+)/)
      if (stackMatch) {
        failures.push({
          file: stackMatch[1],
          line: parseInt(stackMatch[3]),
          column: parseInt(stackMatch[4]),
          type: 'stack-trace'
        })
      }

      // Check for timeout errors (common in E2E tests)
      if (line.includes('Timeout') || line.includes('timeout')) {
        failures.push({
          message: line.trim(),
          type: 'timeout'
        })
      }
    }

    return { failures }
  }

  parseValidationOutput(output, validatorName) {
    // Reuse similar logic to Vitest for TypeScript/ESLint
    const errors = []

    if (validatorName === 'tsc') {
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
      const lines = output.split('\n')
      let currentFile = null

      for (const line of lines) {
        const fileMatch = line.match(/^(.+\.(ts|js))$/)
        if (fileMatch && !line.includes(':')) {
          currentFile = fileMatch[1]
          continue
        }

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
    const { testFile, playwrightConfig } = config

    let cmd = `npx playwright test ${testFile}`

    if (playwrightConfig) {
      cmd += ` --config ${playwrightConfig}`
    }

    // Use single worker for verification to avoid conflicts
    cmd += ' --workers=1'

    return cmd
  }

  // ==================== Configuration ====================

  detectConfig(context) {
    const { packageJsonContent, fileExists } = context

    // Detect config file
    let playwrightConfig = null
    if (fileExists('playwright.config.ts')) {
      playwrightConfig = 'playwright.config.ts'
    } else if (fileExists('playwright.config.js')) {
      playwrightConfig = 'playwright.config.js'
    } else if (fileExists('e2e/playwright.config.ts')) {
      playwrightConfig = 'e2e/playwright.config.ts'
    } else if (fileExists('e2e/playwright.config.js')) {
      playwrightConfig = 'e2e/playwright.config.js'
    }

    // Detect package manager
    let packageManager = 'npm'
    if (fileExists('pnpm-lock.yaml')) {
      packageManager = 'pnpm'
    } else if (fileExists('yarn.lock')) {
      packageManager = 'yarn'
    } else if (fileExists('bun.lockb')) {
      packageManager = 'bun'
    }

    // Detect prettier
    const hasPrettier = packageJsonContent && packageJsonContent.includes('"prettier"')

    return {
      playwrightConfig,
      packageManager,
      hasPrettier
    }
  }

  getDefaultConfig(projectRoot) {
    return {
      ...super.getDefaultConfig(projectRoot),
      packageManager: 'npm',
      hasPrettier: false
    }
  }

  // ==================== Private Helpers ====================

  _detectConfigFile(config) {
    const { projectRoot } = config

    const candidates = [
      'playwright.config.ts',
      'playwright.config.js',
      'e2e/playwright.config.ts',
      'e2e/playwright.config.js'
    ]

    for (const candidate of candidates) {
      if (existsSync(join(projectRoot, candidate))) {
        return candidate
      }
    }

    return null
  }
}
