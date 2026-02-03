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
 *
 * Requirements:
 *   Node.js >= 22.0.0 (uses native fs.globSync)
 */

// Check Node.js version (requires v22+ for native globSync)
const nodeVersion = process.versions.node.split('.').map(Number)
if (nodeVersion[0] < 22) {
  console.error(`❌ Error: This script requires Node.js >= 22.0.0 (current: ${process.version})`)
  console.error(`   Reason: Uses native fs.globSync which was added in Node.js 22`)
  console.error(`   Please upgrade Node.js: https://nodejs.org/`)
  process.exit(1)
}

import { readFileSync, existsSync, readdirSync, globSync } from 'fs'
import { join, resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Find the Git repository root
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} Git repository root or null if not in a git repo
 */
function findGitRoot(startDir) {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: startDir,
      encoding: 'utf-8'
    }).trim()
    return gitRoot
  } catch (error) {
    return null
  }
}

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
 * Search for project root with test frameworks
 * @param {string} startDir - Directory to start searching from
 * @param {boolean} walkUp - Whether to search parent directories (default: false)
 * @returns {Array} Array of { projectRoot, adapter, context } objects (may be empty)
 */
function findProjectRoot(startDir, walkUp = false) {
  const allDetected = []
  const resolvedStartDir = resolve(startDir)

  // FIRST: Search the target directory itself and its subdirectories
  try {
    // Check the start directory
    const startContext = createDetectionContext(resolvedStartDir)
    for (const adapter of ADAPTERS) {
      if (adapter.canDetect(startContext)) {
        allDetected.push({
          projectRoot: resolvedStartDir,
          adapter,
          context: startContext
        })
      }
    }

    // Also check subdirectories (max depth 2)
    const searchDirs = []
    if (existsSync(resolvedStartDir)) {
      const entries = readdirSync(resolvedStartDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          searchDirs.push(join(resolvedStartDir, entry.name))
        }
      }
    }

    for (const dir of searchDirs) {
      if (!existsSync(dir)) continue
      const context = createDetectionContext(dir)
      for (const adapter of ADAPTERS) {
        if (adapter.canDetect(context)) {
          allDetected.push({
            projectRoot: dir,
            adapter,
            context
          })
        }
      }
    }

    // If we found frameworks in the target directory or subdirectories, return them
    if (allDetected.length > 0) {
      return allDetected
    }
  } catch (error) {
    // Error searching target directory
  }

  // SECOND: Only if nothing found AND walkUp is enabled, search upwards from start directory
  if (!walkUp) {
    return allDetected // Return empty array if not walking up
  }

  let currentDir = resolve(resolvedStartDir, '..')
  const root = resolve('/')

  while (currentDir !== root && currentDir !== resolvedStartDir) {
    const context = createDetectionContext(currentDir)

    // Try each adapter and collect ALL matches
    for (const adapter of ADAPTERS) {
      if (adapter.canDetect(context)) {
        allDetected.push({
          projectRoot: currentDir,
          adapter,
          context
        })
      }
    }

    // If we found any frameworks at this level, return them
    if (allDetected.length > 0) {
      return allDetected
    }

    // Move up one directory
    const parentDir = resolve(currentDir, '..')
    if (parentDir === currentDir) {
      break // Reached root
    }
    currentDir = parentDir
  }

  return allDetected
}

/**
 * Main detection function
 * @param {string} startDir - Directory to start searching from
 * @param {boolean} walkUp - Whether to search parent directories (default: false)
 * @returns {Array} Array of detection results
 */
function detectTestEnvironment(startDir = process.cwd(), walkUp = false) {
  const results = findProjectRoot(startDir, walkUp)

  if (results.length === 0) {
    console.error('❌ Could not detect any test frameworks')
    console.error('')
    console.error('Supported frameworks:')
    console.error('  • Vitest/Jest (JavaScript/TypeScript unit tests)')
    console.error('  • Playwright (E2E tests)')
    console.error('  • .NET Test (NUnit/xUnit/MSTest)')
    console.error('')
    console.error('Please ensure you have one of these test frameworks configured in your project.')
    process.exit(1)
  }

  const outputs = results.map(({ projectRoot, adapter, context }) => {
    // Detect framework-specific configuration
    const frameworkConfig = adapter.detectConfig(context)

    // Merge with default config
    const config = {
      ...adapter.getDefaultConfig(projectRoot),
      ...frameworkConfig
    }

    return {
      framework: adapter.name,
      displayName: adapter.displayName,
      testType: adapter.testType,
      projectRoot,
      config
    }
  })

  // Display summary
  if (outputs.length === 1) {
    console.error(`✅ Test framework detected: ${outputs[0].displayName}`)
    console.error(`📁 Project root: ${outputs[0].projectRoot}`)
    console.error(`🔬 Test type: ${outputs[0].testType}`)
    if (outputs[0].config.testFramework) {
      console.error(`⚙️  Framework variant: ${outputs[0].config.testFramework}`)
    }
    if (outputs[0].config.packageManager) {
      console.error(`📦 Package manager: ${outputs[0].config.packageManager}`)
    }
  } else {
    console.error(`✅ Detected ${outputs.length} test frameworks:`)
    console.error('')
    outputs.forEach((output, index) => {
      console.error(`${index + 1}. ${output.displayName} (${output.testType})`)
      console.error(`   📁 ${output.projectRoot}`)
      if (output.config.testFramework) {
        console.error(`   ⚙️  ${output.config.testFramework}`)
      }
    })
  }

  console.error('')

  // Output JSON array to stdout for programmatic use
  console.log(JSON.stringify(outputs))

  return outputs
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  let startDir = null
  let walkUp = false

  // Parse arguments
  for (const arg of args) {
    if (arg === '--walk-up') {
      walkUp = true
    } else if (!arg.startsWith('--')) {
      startDir = arg
    }
  }

  // If no directory specified, try to find git root, otherwise use cwd
  if (!startDir) {
    const gitRoot = findGitRoot(process.cwd())
    startDir = gitRoot || process.cwd()

    if (gitRoot) {
      console.error(`📂 Using Git repository root: ${gitRoot}`)
      console.error('')
    }
  }

  detectTestEnvironment(startDir, walkUp)
}

export { detectTestEnvironment, createDetectionContext, ADAPTERS }
