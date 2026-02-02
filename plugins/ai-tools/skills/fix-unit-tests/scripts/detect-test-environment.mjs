#!/usr/bin/env node

/**
 * Detects the test environment and framework
 *
 * Automatically detects which test framework is being used (Vitest, Playwright, .NET, etc.)
 * and returns configuration for running tests.
 *
 * Usage: node detect-test-environment.mjs [directory]
 *
 * Outputs JSON with:
 * {
 *   framework: "vitest" | "playwright" | "dotnet",
 *   testType: "unit" | "e2e" | "integration",
 *   projectRoot: "/absolute/path/to/project",
 *   config: { ...framework-specific config... }
 * }
 *
 * Exit codes:
 *   0 - Test environment detected successfully
 *   1 - No test environment found
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { globSync } from 'glob'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Import adapters
import { VitestAdapter } from './adapters/vitest.mjs'
import { PlaywrightAdapter } from './adapters/playwright.mjs'
import { DotNetAdapter } from './adapters/dotnet.mjs'

// All available adapters, in priority order
const ADAPTERS = [
  new VitestAdapter(),
  new PlaywrightAdapter(),
  new DotNetAdapter()
]

/**
 * Create a detection context for adapters
 * @param {string} projectRoot - Project root directory
 * @returns {Object} Detection context
 */
function createDetectionContext(projectRoot) {
  // Read package.json if it exists
  let packageJsonContent = null
  const packageJsonPath = join(projectRoot, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      packageJsonContent = readFileSync(packageJsonPath, 'utf-8')
    } catch (error) {
      // Can't read package.json
    }
  }

  return {
    packageJsonContent,
    projectRoot,
    fileExists: (relativePath) => {
      return existsSync(join(projectRoot, relativePath))
    },
    readFile: (relativePath) => {
      return readFileSync(join(projectRoot, relativePath), 'utf-8')
    },
    glob: (pattern) => {
      return globSync(pattern, {
        cwd: projectRoot,
        nodir: true,
        ignore: ['**/node_modules/**', '**/bin/**', '**/obj/**']
      })
    }
  }
}

/**
 * Search for project root with test framework
 * @param {string} startDir - Directory to start searching from
 * @returns {Object|null} { projectRoot, adapter, context } or null
 */
function findProjectRoot(startDir) {
  let currentDir = resolve(startDir)
  const root = resolve('/')

  // Search upwards from start directory
  while (currentDir !== root) {
    const context = createDetectionContext(currentDir)

    // Try each adapter
    for (const adapter of ADAPTERS) {
      if (adapter.canDetect(context)) {
        return {
          projectRoot: currentDir,
          adapter,
          context
        }
      }
    }

    // Move up one directory
    const parentDir = resolve(currentDir, '..')
    if (parentDir === currentDir) {
      break // Reached root
    }
    currentDir = parentDir
  }

  // Also search subdirectories (max depth 2) from start directory
  try {
    const searchDirs = [startDir]
    const entries = readdirSync(startDir, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        searchDirs.push(join(startDir, entry.name))
      }
    }

    for (const dir of searchDirs) {
      if (!existsSync(dir)) continue

      const context = createDetectionContext(dir)

      for (const adapter of ADAPTERS) {
        if (adapter.canDetect(context)) {
          return {
            projectRoot: dir,
            adapter,
            context
          }
        }
      }
    }
  } catch (error) {
    // Error searching subdirectories
  }

  return null
}

/**
 * Main detection function
 * @param {string} startDir - Directory to start searching from
 * @returns {Object} Detection result
 */
function detectTestEnvironment(startDir = process.cwd()) {
  const result = findProjectRoot(startDir)

  if (!result) {
    console.error('❌ Could not detect test framework')
    console.error('')
    console.error('Supported frameworks:')
    console.error('  • Vitest/Jest (JavaScript/TypeScript unit tests)')
    console.error('  • Playwright (E2E tests)')
    console.error('  • .NET Test (NUnit/xUnit/MSTest)')
    console.error('')
    console.error('Please ensure you have one of these test frameworks configured in your project.')
    process.exit(1)
  }

  const { projectRoot, adapter, context } = result

  // Detect framework-specific configuration
  const frameworkConfig = adapter.detectConfig(context)

  // Merge with default config
  const config = {
    ...adapter.getDefaultConfig(projectRoot),
    ...frameworkConfig
  }

  console.error(`✅ Test framework detected: ${adapter.displayName}`)
  console.error(`📁 Project root: ${projectRoot}`)
  console.error(`🔬 Test type: ${adapter.testType}`)

  if (config.testFramework) {
    console.error(`⚙️  Framework variant: ${config.testFramework}`)
  }

  if (config.packageManager) {
    console.error(`📦 Package manager: ${config.packageManager}`)
  }

  console.error('')

  // Output JSON to stdout for programmatic use
  const output = {
    framework: adapter.name,
    displayName: adapter.displayName,
    testType: adapter.testType,
    projectRoot,
    config
  }

  console.log(JSON.stringify(output))

  return output
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const startDir = process.argv[2] || process.cwd()
  detectTestEnvironment(startDir)
}

export { detectTestEnvironment, createDetectionContext, ADAPTERS }
