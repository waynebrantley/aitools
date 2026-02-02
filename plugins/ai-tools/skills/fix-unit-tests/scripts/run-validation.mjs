#!/usr/bin/env node
/**
 * Runs validation based on available tools
 * Usage: node run-validation.mjs [FILE] [DIRECTORY]
 * Arguments:
 *   FILE (optional) - Specific file to validate. If omitted, validates entire project
 *   DIRECTORY (optional) - Project directory. If omitted, uses current directory
 * Exit codes:
 *   0 - All validation passed
 *   1 - Validation failed
 *   2 - No test environment detected
 */

import { execSync } from 'child_process'
import { detectTestEnvironment } from './detect-test-environment.mjs'
import { ADAPTERS } from './detect-test-environment.mjs'

function runValidation(file = null, directory = process.cwd()) {
  // Detect test environment
  const envResult = detectTestEnvironment(directory)

  // Get the adapter
  const adapter = ADAPTERS.find(a => a.name === envResult.framework)
  if (!adapter) {
    console.error(`❌ Unsupported framework: ${envResult.framework}`)
    return 2
  }

  // Update config with specific file if provided
  const config = { ...envResult.config }
  if (file) {
    config.testPath = file
  }

  // Get validation commands from adapter
  const validationCommands = adapter.getValidationCommands(config)

  if (validationCommands.length === 0) {
    console.error('No validation commands configured')
    return 0
  }

  try {
    // Run each validation command
    for (const { name, command } of validationCommands) {
      console.error(`Running ${name}...`)
      execSync(command, {
        stdio: 'inherit',
        cwd: envResult.projectRoot
      })
    }

    return 0
  } catch (error) {
    return error.status || 1
  }
}

// Main execution
const file = process.argv[2] || null
const directory = process.argv[3] || process.cwd()
const exitCode = runValidation(file, directory)
process.exit(exitCode)
