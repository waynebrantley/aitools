#!/usr/bin/env node

/**
 * Run final build validation after all fixes
 *
 * Executes the complete build and validation process to verify that all
 * errors have been fixed. This is the final check before completing the skill.
 *
 * Usage: node run-final-build.mjs [config-json]
 *
 * The config-json should be one of the objects output by detect-build-environment.mjs
 *
 * Output:
 *   ✅ Final build passed (0 errors)
 *   or
 *   ❌ Final build failed (X errors)
 *
 * Exit codes:
 *   0 - Build passed with no errors
 *   1 - Build failed or has errors
 */

import { execSync } from 'child_process'
import { unlinkSync, existsSync } from 'fs'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

// Import adapters
import { DotNetAdapter } from './adapters/dotnet.mjs'
import { TypeScriptAdapter } from './adapters/typescript.mjs'

const ADAPTERS = {
  dotnet: new DotNetAdapter(),
  typescript: new TypeScriptAdapter()
}

/**
 * Clean up temporary build files
 * @param {string} projectRoot - Project root directory
 */
function cleanupTempFiles(projectRoot) {
  const filesToClean = [
    'build-output.txt',
    'validate-output.txt',
    'build-output-final.txt'
  ]

  for (const file of filesToClean) {
    const filePath = join(projectRoot, file)
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath)
        console.error(`🧹 Cleaned up: ${file}`)
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Execute a command and capture output
 * @param {string} command - Command to execute
 * @param {string} cwd - Working directory
 * @returns {Object} { stdout, stderr, exitCode }
 */
function executeCommand(command, cwd) {
  console.error(`⚙️  Executing: ${command}`)

  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: 'pipe'
    })

    return {
      stdout: output,
      stderr: '',
      exitCode: 0
    }
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1
    }
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('❌ Error: No configuration provided')
    console.error('Usage: node run-final-build.mjs <config-json>')
    console.error('')
    console.error('The config-json should be output from detect-build-environment.mjs')
    process.exit(1)
  }

  // Parse config
  let config
  try {
    config = JSON.parse(args[0])
  } catch (error) {
    console.error(`❌ Error parsing config: ${error.message}`)
    process.exit(1)
  }

  const { framework, projectRoot } = config

  if (!framework || !projectRoot) {
    console.error('❌ Error: Invalid config (missing framework or projectRoot)')
    process.exit(1)
  }

  // Get adapter
  const adapter = ADAPTERS[framework]
  if (!adapter) {
    console.error(`❌ Error: Unknown framework: ${framework}`)
    process.exit(1)
  }

  console.error(`🔍 Running final build validation for ${adapter.displayName}`)
  console.error(`📁 Project root: ${projectRoot}`)
  console.error('')

  let totalErrors = 0
  let allExcludedWarnings = []

  // ==================== Validation ====================

  console.error('📋 Running validation commands...')
  const validationCommands = adapter.getValidationCommands(config.config)

  for (const { name, command, optional } of validationCommands) {
    console.error(`   • ${name}`)
    const result = executeCommand(command, projectRoot)

    if (result.exitCode !== 0) {
      console.error(`   ❌ ${name} failed (exit code ${result.exitCode})`)

      // Parse errors
      const { errors } = adapter.parseValidationOutput(result.stdout + result.stderr, name)
      totalErrors += errors.length

      if (!optional) {
        console.error(`      Found ${errors.length} errors`)
      }
    } else {
      console.error(`   ✅ ${name} passed`)
    }
  }

  console.error('')

  // ==================== Build ====================

  console.error('🔨 Running build command...')
  // Use getFinalBuildCommand if available (builds all configurations),
  // otherwise fall back to getBuildCommand
  let buildCommands = adapter.getFinalBuildCommand
    ? adapter.getFinalBuildCommand(config.config)
    : adapter.getBuildCommand(config.config)

  // Normalize to array
  if (typeof buildCommands === 'string') {
    buildCommands = [buildCommands]
  }

  let buildFailed = false

  for (const command of buildCommands) {
    const result = executeCommand(command, projectRoot)

    if (result.exitCode !== 0) {
      console.error(`   ❌ Build failed (exit code ${result.exitCode})`)
      buildFailed = true

      // Parse errors and excluded warnings
      const parseResult = adapter.parseBuildOutput(result.stdout + result.stderr)
      const errors = parseResult.errors || []
      const excludedWarnings = parseResult.excludedWarnings || []

      totalErrors += errors.length
      allExcludedWarnings.push(...excludedWarnings)

      console.error(`      Found ${errors.length} errors`)
      if (excludedWarnings.length > 0) {
        console.error(`      Found ${excludedWarnings.length} excluded warnings (not blocking build)`)
      }
      break
    } else {
      console.error(`   ✅ Build step completed`)

      // Even on success, parse output to capture excluded warnings
      const parseResult = adapter.parseBuildOutput(result.stdout + result.stderr)
      const excludedWarnings = parseResult.excludedWarnings || []
      allExcludedWarnings.push(...excludedWarnings)
    }
  }

  console.error('')

  // ==================== Summary ====================

  // Clean up temporary files
  console.error('')
  cleanupTempFiles(projectRoot)
  console.error('')

  if (totalErrors === 0 && !buildFailed) {
    console.error('✅ Final build passed (0 errors)')
    console.error('')

    // Report excluded warnings if any were found
    if (allExcludedWarnings.length > 0) {
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('⚠️  EXCLUDED WARNINGS DETECTED')
      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('')
      console.error('The following warnings were detected but excluded from build failure:')
      console.error('')

      // Group by warning code
      const warningsByCode = {}
      for (const warning of allExcludedWarnings) {
        if (!warningsByCode[warning.rule]) {
          warningsByCode[warning.rule] = []
        }
        warningsByCode[warning.rule].push(warning)
      }

      // Report each warning type
      for (const [code, warnings] of Object.entries(warningsByCode)) {
        // Determine severity indicator based on warning type
        const isSecurity = code.startsWith('NU1902')
        const severityIcon = isSecurity ? '🔴' : '🟡'
        const severityLabel = isSecurity ? 'SECURITY WARNING' : 'WARNING'

        console.error(`${severityIcon} ${code} (${warnings.length} occurrence${warnings.length > 1 ? 's' : ''}) - ${severityLabel}`)

        // Show first warning message as example
        if (warnings[0].message) {
          console.error(`   ${warnings[0].message}`)
        }

        // Show affected files (up to 5)
        const uniqueFiles = [...new Set(warnings.map(w => w.file).filter(Boolean))]
        if (uniqueFiles.length > 0) {
          console.error(`   Affected files:`)
          for (const file of uniqueFiles.slice(0, 5)) {
            console.error(`     • ${file}`)
          }
          if (uniqueFiles.length > 5) {
            console.error(`     ... and ${uniqueFiles.length - 5} more`)
          }
        }
        console.error('')
      }

      console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.error('')
      console.error('NOTE: These warnings are excluded from blocking the build but should')
      console.error('      be reviewed and addressed when possible, especially security warnings.')
      console.error('')
    }

    process.exit(0)
  } else {
    console.error(`❌ Final build failed (${totalErrors} errors)`)
    console.error('')
    console.error('Next steps:')
    console.error('  1. Review the errors above')
    console.error('  2. Fix remaining issues')
    console.error('  3. Run this validation again')
    console.error('')
    process.exit(1)
  }
}

// Execute - normalize paths for cross-platform compatibility (Windows mixed slashes)
if (resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main()
}
