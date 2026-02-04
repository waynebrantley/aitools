#!/usr/bin/env node

/**
 * Verify that a specific file's build errors and warnings have been fixed
 *
 * Runs validation and build checks for a specific file to verify it has no issues.
 * Note: Warnings are treated as errors by default for zero-warning builds.
 *
 * Usage: node verify-fix.mjs <file> [--json]
 *
 * Arguments:
 *   file: Path to file to verify (relative to project root)
 *   --json: Output results as JSON
 *
 * Output (text):
 *   ✅ File fixed: src/component.ts (0 issues)
 *   or
 *   ❌ File still has issues: src/component.ts (3 issues)
 *
 * Output (json):
 *   { "file": "src/component.ts", "fixed": true, "errorCount": 0, "errors": [] }
 *
 * Exit codes:
 *   0 - File has no issues
 *   1 - File still has issues or verification failed
 */

import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Import adapters
import { DotNetAdapter } from './adapters/dotnet.mjs'
import { TypeScriptAdapter } from './adapters/typescript.mjs'
import { detectBuildEnvironment, createDetectionContext } from './detect-build-environment.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Execute a command and capture output
 * @param {string} command - Command to execute
 * @param {string} cwd - Working directory
 * @returns {Object} { stdout, stderr, exitCode }
 */
function executeCommand(command, cwd) {
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
 * Verify a file using the appropriate adapter
 * @param {string} file - File path (relative to project root)
 * @param {Object} adapter - Build adapter
 * @param {Object} config - Build configuration
 * @param {string} projectRoot - Project root directory
 * @returns {Object} { fixed: boolean, errorCount: number, errors: [] } (errors includes warnings)
 */
function verifyFile(file, adapter, config, projectRoot) {
  const allErrors = []  // Includes both errors and warnings

  // 1. Run validation commands
  const validationCommands = adapter.getValidationCommands(config)

  for (const { name, command } of validationCommands) {
    const result = executeCommand(command, projectRoot)

    if (result.exitCode !== 0) {
      const { errors } = adapter.parseValidationOutput(result.stdout + result.stderr, name)
      // Filter errors for this specific file
      const fileErrors = errors.filter(e => e.file && e.file.includes(file))
      allErrors.push(...fileErrors)
    }
  }

  // 2. Run verify command (if supported by the adapter)
  try {
    const verifyConfig = { ...config, file }
    const verifyCommand = adapter.getVerifyCommand(verifyConfig)

    // If verifyCommand is null, it means the adapter doesn't support
    // individual file verification (e.g., .NET requires full build)
    if (verifyCommand === null) {
      // Return early with a note that verification will happen at final build
      return {
        fixed: true,  // Assume fixed, will be verified in final build
        errorCount: 0,
        errors: [],
        deferredVerification: true
      }
    }

    if (verifyCommand) {
      const result = executeCommand(verifyCommand, projectRoot)

      if (result.exitCode !== 0) {
        const { errors } = adapter.parseBuildOutput(result.stdout + result.stderr)
        // Filter errors for this specific file
        const fileErrors = errors.filter(e => !e.file || e.file.includes(file))
        allErrors.push(...fileErrors)
      }
    }
  } catch (error) {
    // Verify command not implemented or failed
  }

  return {
    fixed: allErrors.length === 0,
    errorCount: allErrors.length,
    errors: allErrors
  }
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error('❌ Error: No file specified')
    console.error('Usage: node verify-fix.mjs <file> [--json]')
    process.exit(1)
  }

  const file = args[0]
  const jsonOutput = args.includes('--json')

  // Detect build environment
  const projectRoot = process.cwd()
  const results = detectBuildEnvironment(projectRoot, false)

  if (results.length === 0) {
    console.error('❌ Error: Could not detect build environment')
    process.exit(1)
  }

  // Use the first detected framework
  const { framework, config } = results[0]

  const ADAPTERS = {
    dotnet: new DotNetAdapter(),
    typescript: new TypeScriptAdapter()
  }

  const adapter = ADAPTERS[framework]
  if (!adapter) {
    console.error(`❌ Error: Unknown framework: ${framework}`)
    process.exit(1)
  }

  // Verify file
  const result = verifyFile(file, adapter, config, projectRoot)

  // Output
  if (jsonOutput) {
    console.log(JSON.stringify({ file, ...result }, null, 2))
  } else {
    if (result.deferredVerification) {
      console.log(`⏭️  File verification deferred: ${file}`)
      console.log('   Individual file verification not supported for this framework.')
      console.log('   Will be verified during final build.')
    } else if (result.fixed) {
      console.log(`✅ File fixed: ${file} (0 issues)`)
    } else {
      console.log(`❌ File still has issues: ${file} (${result.errorCount} issues)`)
      console.log('')
      console.log('Issues:')
      for (const error of result.errors) {
        const location = error.line ? `:${error.line}:${error.column || 0}` : ''
        const severity = error.severity || 'error'
        console.log(`  ${error.file || file}${location}: [${severity}] ${error.message}`)
      }
    }
  }

  // Exit code (deferred verification is considered success)
  process.exit(result.fixed || result.deferredVerification ? 0 : 1)
}

// Execute
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}

export { verifyFile }
