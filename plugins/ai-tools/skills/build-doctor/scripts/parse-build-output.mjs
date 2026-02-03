#!/usr/bin/env node

/**
 * Parse build and validation output to extract errors and warnings grouped by file
 *
 * Reads build-output.txt and validate-output.txt, parses errors/warnings using the
 * appropriate adapter, and outputs a summary of files with issues.
 *
 * Note: Warnings are treated as errors by default for zero-warning builds.
 *
 * Usage: node parse-build-output.mjs [format]
 *
 * Arguments:
 *   format: 'json' | 'table' (default: 'table')
 *
 * Output (table format):
 *   File                    Issues
 *   src/component.ts        5
 *   src/utils.ts            3
 *   ...
 *
 * Output (json format):
 *   [{ file: "src/component.ts", errorCount: 5, errors: [...] }, ...]
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error parsing output
 */

import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Import adapters
import { DotNetAdapter } from './adapters/dotnet.mjs'
import { TypeScriptAdapter } from './adapters/typescript.mjs'

const ADAPTERS = {
  dotnet: new DotNetAdapter(),
  typescript: new TypeScriptAdapter()
}

/**
 * Parse validation output
 * @param {string} output - Validation output content
 * @param {Object} adapter - Build adapter
 * @returns {Array} Array of errors and warnings (warnings treated as errors)
 */
function parseValidationOutput(output, adapter) {
  const allErrors = []

  // Split by validator sections (========== validator-name ==========)
  const sections = output.split(/\n=+ (.+?) =+\n/)

  for (let i = 1; i < sections.length; i += 2) {
    const validatorName = sections[i].trim()
    const validatorOutput = sections[i + 1]

    if (validatorOutput) {
      const { errors } = adapter.parseValidationOutput(validatorOutput, validatorName)
      allErrors.push(...errors)
    }
  }

  return allErrors
}

/**
 * Group errors by file
 * @param {Array} errors - Array of error objects
 * @returns {Map} Map of file -> errors
 */
function groupErrorsByFile(errors) {
  const fileMap = new Map()

  for (const error of errors) {
    if (!error.file) continue

    if (!fileMap.has(error.file)) {
      fileMap.set(error.file, [])
    }

    fileMap.get(error.file).push(error)
  }

  return fileMap
}

/**
 * Format output as table
 * @param {Map} fileMap - Map of file -> errors/warnings
 */
function formatAsTable(fileMap) {
  // Sort files by issue count (descending)
  const sortedFiles = Array.from(fileMap.entries())
    .sort((a, b) => b[1].length - a[1].length)

  console.log('')
  console.log('Files with issues (sorted by issue count):')
  console.log('')
  console.log('File'.padEnd(60) + 'Issues')
  console.log('─'.repeat(60) + '─'.repeat(10))

  for (const [file, errors] of sortedFiles) {
    const displayFile = file.length > 58 ? '...' + file.slice(-55) : file
    console.log(displayFile.padEnd(60) + errors.length.toString())
  }

  console.log('')
  console.log(`Total: ${sortedFiles.length} files with ${Array.from(fileMap.values()).flat().length} issues`)
}

/**
 * Format output as JSON
 * @param {Map} fileMap - Map of file -> errors
 */
function formatAsJson(fileMap) {
  // Sort files by error count (descending)
  const sortedFiles = Array.from(fileMap.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .map(([file, errors]) => ({
      file,
      errorCount: errors.length,
      errors
    }))

  console.log(JSON.stringify(sortedFiles, null, 2))
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)
  const format = args[0] || 'table'

  if (!['json', 'table'].includes(format)) {
    console.error('❌ Error: Invalid format (must be "json" or "table")')
    process.exit(1)
  }

  // Determine project root (current directory)
  const projectRoot = process.cwd()

  // Read output files
  const buildOutputPath = resolve(projectRoot, 'build-output.txt')
  const validateOutputPath = resolve(projectRoot, 'validate-output.txt')

  if (!existsSync(buildOutputPath) && !existsSync(validateOutputPath)) {
    console.error('❌ Error: No output files found (build-output.txt or validate-output.txt)')
    console.error('   Run "node scripts/run-build.mjs" first')
    process.exit(1)
  }

  const buildOutput = existsSync(buildOutputPath) ? readFileSync(buildOutputPath, 'utf-8') : ''
  const validateOutput = existsSync(validateOutputPath) ? readFileSync(validateOutputPath, 'utf-8') : ''

  // Detect framework from output (heuristic)
  // Look for TypeScript errors (TS####) or .NET errors (CS####)
  let adapter
  if (buildOutput.includes('TS') || validateOutput.includes('TS')) {
    adapter = ADAPTERS.typescript
  } else if (buildOutput.includes('CS') || validateOutput.includes('CS') || buildOutput.includes('.csproj')) {
    adapter = ADAPTERS.dotnet
  } else {
    // Default to TypeScript
    adapter = ADAPTERS.typescript
  }

  console.error(`🔍 Using ${adapter.displayName} parser`)

  // Parse outputs
  const buildParseResult = buildOutput ? adapter.parseBuildOutput(buildOutput) : { errors: [], excludedWarnings: [] }
  const buildErrors = buildParseResult.errors || []
  const excludedWarnings = buildParseResult.excludedWarnings || []
  const validationErrors = validateOutput ? parseValidationOutput(validateOutput, adapter) : []

  const allErrors = [...buildErrors, ...validationErrors]

  if (allErrors.length === 0 && excludedWarnings.length === 0) {
    console.error('✅ No issues found!')
    if (format === 'json') {
      console.log('[]')
    }
    return
  }

  // Group by file
  const fileMap = groupErrorsByFile(allErrors)

  // Output
  if (format === 'table') {
    formatAsTable(fileMap)

    // Report excluded warnings if any
    if (excludedWarnings.length > 0) {
      console.log('')
      console.log('⚠️  Excluded warnings (not blocking build):')
      console.log('')

      // Group excluded warnings by code
      const warningsByCode = {}
      for (const warning of excludedWarnings) {
        if (!warningsByCode[warning.rule]) {
          warningsByCode[warning.rule] = []
        }
        warningsByCode[warning.rule].push(warning)
      }

      for (const [code, warnings] of Object.entries(warningsByCode)) {
        const isSecurity = code.startsWith('NU1902')
        const icon = isSecurity ? '🔴' : '🟡'
        console.log(`${icon} ${code}: ${warnings.length} occurrence${warnings.length > 1 ? 's' : ''}`)
      }

      console.log('')
      console.log('Note: These warnings should be reviewed, especially security warnings.')
    }
  } else {
    formatAsJson(fileMap)
  }
}

// Execute
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { parseValidationOutput, groupErrorsByFile }
