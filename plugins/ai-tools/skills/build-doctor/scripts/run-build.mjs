#!/usr/bin/env node

/**
 * Run build and validation for discovered build environment
 *
 * Executes the build commands and validation commands for the detected framework,
 * saving output to files for analysis.
 *
 * Usage: node run-build.mjs [config-json]
 *
 * The config-json should be one of the objects output by detect-build-environment.mjs
 *
 * Outputs:
 *   - build-output.txt: Build command output
 *   - validate-output.txt: Validation command output (combined)
 *
 * Exit codes:
 *   0 - Build and validation completed (may have errors)
 *   1 - Failed to execute commands
 */

import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

// Import adapters
import { DotNetAdapter } from './adapters/dotnet.mjs'
import { TypeScriptAdapter } from './adapters/typescript.mjs'

const ADAPTERS = {
  dotnet: new DotNetAdapter(),
  typescript: new TypeScriptAdapter()
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
    console.error('Usage: node run-build.mjs <config-json>')
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

  console.error(`🔨 Running build for ${adapter.displayName}`)
  console.error(`📁 Project root: ${projectRoot}`)
  console.error('')

  // ==================== Validation ====================

  console.error('📋 Running validation commands...')
  const validationCommands = adapter.getValidationCommands(config.config)
  let validateOutput = ''

  for (const { name, command, optional } of validationCommands) {
    console.error(`   • ${name}`)
    const result = executeCommand(command, projectRoot)

    validateOutput += `\n========== ${name} ==========\n`
    validateOutput += result.stdout
    validateOutput += result.stderr

    if (result.exitCode !== 0 && !optional) {
      console.error(`   ⚠️  ${name} failed (exit code ${result.exitCode})`)
    } else if (result.exitCode === 0) {
      console.error(`   ✅ ${name} passed`)
    } else {
      console.error(`   ⚠️  ${name} failed (optional)`)
    }
  }

  // Save validation output
  const validateOutputPath = resolve(projectRoot, 'validate-output.txt')
  writeFileSync(validateOutputPath, validateOutput, 'utf-8')
  console.error(`💾 Validation output saved to: ${validateOutputPath}`)
  console.error('')

  // ==================== Build ====================

  console.error('🔨 Running build command...')
  let buildCommands = adapter.getBuildCommand(config.config)

  // Normalize to array
  if (typeof buildCommands === 'string') {
    buildCommands = [buildCommands]
  }

  let buildOutput = ''
  let buildFailed = false

  for (const command of buildCommands) {
    const result = executeCommand(command, projectRoot)

    buildOutput += `\n========== ${command} ==========\n`
    buildOutput += result.stdout
    buildOutput += result.stderr

    if (result.exitCode !== 0) {
      console.error(`   ❌ Build failed (exit code ${result.exitCode})`)
      buildFailed = true
      break
    } else {
      console.error(`   ✅ Build step completed`)
    }
  }

  // Save build output
  const buildOutputPath = resolve(projectRoot, 'build-output.txt')
  writeFileSync(buildOutputPath, buildOutput, 'utf-8')
  console.error(`💾 Build output saved to: ${buildOutputPath}`)
  console.error('')

  // Summary
  if (buildFailed) {
    console.error('❌ Build failed')
  } else {
    console.error('✅ Build completed')
  }

  console.error('')
  console.error('Next steps:')
  console.error('  1. Parse output: node scripts/parse-build-output.mjs')
  console.error('  2. Fix errors in files with issues')
  console.error('  3. Run final validation')
}

// Execute
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
