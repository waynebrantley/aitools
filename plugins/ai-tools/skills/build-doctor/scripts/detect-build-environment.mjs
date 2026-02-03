#!/usr/bin/env node

/**
 * Detects the build environment and framework
 *
 * Automatically detects which build framework is being used (.NET, TypeScript, etc.)
 * and returns configuration for building projects.
 *
 * Usage: node detect-build-environment.mjs [directory]
 *
 * Outputs JSON with:
 * {
 *   framework: "dotnet" | "typescript",
 *   buildType: "dotnet" | "typescript" | "javascript",
 *   projectRoot: "/absolute/path/to/project",
 *   config: { ...framework-specific config... }
 * }
 *
 * Exit codes:
 *   0 - Build environment detected successfully
 *   1 - No build environment found
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
import { DotNetAdapter } from './adapters/dotnet.mjs'
import { TypeScriptAdapter } from './adapters/typescript.mjs'

// All available adapters, in priority order
const ADAPTERS = [
  new TypeScriptAdapter(),
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
        ignore: ['**/node_modules/**', '**/bin/**', '**/obj/**', '**/dist/**', '**/build/**']
      })
    }
  }
}

/**
 * Filter out duplicate .NET projects when solution files exist
 * If a solution file (.sln/.slnx) is found, remove any .csproj-only projects
 * from subdirectories since the solution already includes them.
 *
 * @param {Array} detected - Array of detected frameworks
 * @returns {Array} Filtered array
 */
function filterDuplicateDotNetProjects(detected) {
  // Find all .NET projects with solution files
  const dotnetWithSolution = detected.filter(d =>
    d.adapter.name === 'dotnet' &&
    d.context.glob &&
    (d.context.glob('**/*.sln').length > 0 || d.context.glob('**/*.slnx').length > 0)
  )

  // If no solution files found, return as-is
  if (dotnetWithSolution.length === 0) {
    return detected
  }

  // Filter out .NET projects that are subdirectories of a solution project
  return detected.filter(project => {
    // Keep non-.NET projects
    if (project.adapter.name !== 'dotnet') {
      return true
    }

    // Keep projects with solution files
    const hasSolution = project.context.glob &&
      (project.context.glob('**/*.sln').length > 0 || project.context.glob('**/*.slnx').length > 0)

    if (hasSolution) {
      return true
    }

    // Check if this project is a subdirectory of any solution project
    const isSubdirectory = dotnetWithSolution.some(solutionProject => {
      const isChild = project.projectRoot.startsWith(solutionProject.projectRoot + '/') ||
                      project.projectRoot.startsWith(solutionProject.projectRoot + '\\')
      return isChild
    })

    // Keep only if NOT a subdirectory of a solution project
    return !isSubdirectory
  })
}

/**
 * Search for project root with build frameworks
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
      // Depth 1: immediate subdirectories
      const entries = readdirSync(resolvedStartDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          searchDirs.push(join(resolvedStartDir, entry.name))
        }
      }

      // Depth 2: subdirectories of subdirectories
      for (const subDir of [...searchDirs]) {
        if (!existsSync(subDir)) continue
        try {
          const subEntries = readdirSync(subDir, { withFileTypes: true })
          for (const entry of subEntries) {
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
              searchDirs.push(join(subDir, entry.name))
            }
          }
        } catch (error) {
          // Skip directories we can't read
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

    // If we found frameworks in the target directory or subdirectories, filter and return them
    if (allDetected.length > 0) {
      return filterDuplicateDotNetProjects(allDetected)
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

    // If we found any frameworks at this level, filter and return them
    if (allDetected.length > 0) {
      return filterDuplicateDotNetProjects(allDetected)
    }

    // Move up one directory
    const parentDir = resolve(currentDir, '..')
    if (parentDir === currentDir) {
      break // Reached root
    }
    currentDir = parentDir
  }

  return filterDuplicateDotNetProjects(allDetected)
}

/**
 * Main detection function
 * @param {string} startDir - Directory to start searching from
 * @param {boolean} walkUp - Whether to search parent directories (default: false)
 * @returns {Array} Array of detection results
 */
function detectBuildEnvironment(startDir = process.cwd(), walkUp = false) {
  const results = findProjectRoot(startDir, walkUp)

  if (results.length === 0) {
    console.error('❌ Could not detect any build frameworks')
    console.error('')
    console.error('Supported frameworks:')
    console.error('  • TypeScript/JavaScript (tsconfig.json, package.json)')
    console.error('  • .NET (*.sln, *.csproj)')
    console.error('')
    console.error('Please ensure you have one of these build frameworks configured in your project.')
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

    // Get context-specific display name
    const displayName = adapter.getDisplayName(config, projectRoot)

    return {
      framework: adapter.name,
      displayName,
      buildType: adapter.buildType,
      projectRoot,
      config
    }
  })

  // Display summary
  if (outputs.length === 1) {
    console.error(`✅ Build framework detected: ${outputs[0].displayName}`)
    console.error(`📁 Project root: ${outputs[0].projectRoot}`)
    if (outputs[0].config.packageManager) {
      console.error(`📦 Package manager: ${outputs[0].config.packageManager}`)
    }
    if (outputs[0].config.solutionFile) {
      console.error(`📄 Solution: ${outputs[0].config.solutionFile}`)
    }
  } else {
    console.error(`✅ Detected ${outputs.length} build frameworks:`)
    console.error('')
    outputs.forEach((output, index) => {
      console.error(`${index + 1}. ${output.displayName}`)
      console.error(`   📁 ${output.projectRoot}`)
      if (output.config.packageManager) {
        console.error(`   📦 ${output.config.packageManager}`)
      }
      if (output.config.solutionFile) {
        console.error(`   📄 ${output.config.solutionFile}`)
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

  detectBuildEnvironment(startDir, walkUp)
}

export { detectBuildEnvironment, createDetectionContext, ADAPTERS }
