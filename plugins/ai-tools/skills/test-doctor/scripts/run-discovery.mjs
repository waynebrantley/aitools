#!/usr/bin/env node
/**
 * Runs discovery & analysis phase: test execution + validation
 * Usage: node run-discovery.mjs [directory]
 * Outputs: test-output.txt, validate-output.txt
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Test or validation failures
 *   2 - No test environment detected
 */

import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { detectTestEnvironment } from './detect-test-environment.mjs'
import { ADAPTERS } from './detect-test-environment.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

function runCommand(cmd, description, cwd) {
  console.error(`\n${description}...`)
  try {
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['inherit', 'pipe', 'pipe'],
      cwd
    })
    return { output, exitCode: 0 }
  } catch (error) {
    return {
      output: error.stdout + error.stderr,
      exitCode: error.status || 1
    }
  }
}

// Detect test environment
const startDir = process.argv[2] || process.cwd()
const envResults = detectTestEnvironment(startDir)

// For now, use the first detected framework
// TODO: Add CLI argument to select specific framework
const envResult = envResults[0]

// Get the adapter
const adapter = ADAPTERS.find(a => a.name === envResult.framework)
if (!adapter) {
  console.error(`❌ Unsupported framework: ${envResult.framework}`)
  process.exit(2)
}

if (envResults.length > 1) {
  console.error(`⚠️  Multiple frameworks detected, using: ${envResult.displayName}`)
  console.error('')
}

console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.error('🔍 Discovery & Analysis Phase')
console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

// Step 1: Run tests
const testCommand = adapter.getTestCommand(envResult.config)
const testResult = runCommand(
  testCommand,
  `Step 1: Running ${adapter.displayName} tests`,
  envResult.projectRoot
)
writeFileSync('test-output.txt', testResult.output)

// Step 2: Run validation
console.error('\nStep 2: Running validation (format + lint + type-check)...')
const validationCommands = adapter.getValidationCommands(envResult.config)
const validateResult = { exitCode: 0, output: '' }

if (validationCommands.length > 0) {
  for (const { name, command } of validationCommands) {
    console.error(`  Running ${name}...`)
    try {
      const output = execSync(command, {
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe'],
        cwd: envResult.projectRoot
      })
      validateResult.output += `\n=== ${name} ===\n${output}`
    } catch (error) {
      validateResult.exitCode = error.status || 1
      validateResult.output += `\n=== ${name} (FAILED) ===\n${error.stdout || ''}${error.stderr || ''}`
    }
  }
} else {
  validateResult.output = 'No validation commands configured'
  console.error('  No validation commands configured')
}

writeFileSync('validate-output.txt', validateResult.output)

// Summary
console.error('')
console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.error('Discovery Complete')
console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.error(`Test results: test-output.txt (exit code: ${testResult.exitCode})`)
console.error(`Validation results: validate-output.txt (exit code: ${validateResult.exitCode})`)
console.error('')
console.error('Next step: Parse outputs to identify files with errors')
console.error('  cat test-output.txt validate-output.txt | node scripts/parse-validate-output.mjs table')

// Exit with non-zero if either check failed
if (testResult.exitCode !== 0 || validateResult.exitCode !== 0) {
  process.exit(1)
}
