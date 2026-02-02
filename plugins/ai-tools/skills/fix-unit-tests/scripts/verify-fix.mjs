#!/usr/bin/env node

/**
 * verify-fix.mjs
 * Runs file-level validation (tests + prettier + eslint + tsc) and reports results
 * Cross-platform (Windows, macOS, Linux)
 *
 * Usage: verify-fix.mjs <file> [--json] [--directory <dir>]
 *
 * Exit codes:
 *   0 - All checks passed
 *   1 - Errors remain
 *   2 - Invalid usage or no test environment
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Import detection system
import { detectTestEnvironment } from './detect-test-environment.mjs'
import { ADAPTERS } from './detect-test-environment.mjs'

// ANSI colors for output
const colors = {
	red: '\x1b[0;31m',
	green: '\x1b[0;32m',
	yellow: '\x1b[1;33m',
	blue: '\x1b[0;34m',
	reset: '\x1b[0m',
}

/**
 * Run validation and tests for a file
 * @param {string} file - Relative path to file
 * @param {Object} envResult - Test environment detection result
 * @param {Object} adapter - Test framework adapter
 * @returns {Object} Results with output, testExit, validateExit
 */
function runValidation(file, envResult, adapter) {
	const isTestFile = adapter.getTestFilePatterns().some(pattern => {
		const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'))
		return regex.test(file)
	})

	let testOutput = ''
	let validateOutput = ''
	let testExit = 0
	let validateExit = 0

	// Run tests for this file (if it's a test file)
	if (isTestFile) {
		try {
			const testConfig = { ...envResult.config, testFile: file }
			const testCommand = adapter.getVerifyCommand(testConfig)

			testOutput = execSync(testCommand, {
				encoding: 'utf8',
				stdio: 'pipe',
				cwd: envResult.projectRoot
			})
		} catch (error) {
			testExit = 1
			testOutput = error.stdout || error.stderr || ''
		}
	}

	// Run validation commands
	const validationConfig = { ...envResult.config, testPath: file }
	const validationCommands = adapter.getValidationCommands(validationConfig)

	for (const { name, command } of validationCommands) {
		try {
			const output = execSync(command, {
				encoding: 'utf8',
				stdio: 'pipe',
				cwd: envResult.projectRoot
			})
			validateOutput += `\n=== ${name} ===\n${output}`
		} catch (error) {
			validateExit = 1
			validateOutput += `\n=== ${name} (FAILED) ===\n${error.stdout || ''}${error.stderr || ''}`
		}
	}

	return {
		output: testOutput + '\n' + validateOutput,
		testExit,
		validateExit,
	}
}

/**
 * Parse validation output and count errors
 * @param {string} output - Combined validation output
 * @returns {Object} Error counts
 */
export function parseValidation(output) {
	// Count test failures (vitest output)
	const testErrors = (output.match(/FAIL|Failed|✗/g) || []).length

	// Count type errors (tsc output)
	const typeErrors = (output.match(/error TS\d+:/g) || []).length

	// Count lint errors (eslint output)
	const lintErrors = (output.match(/✖/g) || []).length

	const totalErrors = testErrors + typeErrors + lintErrors

	return {
		total: totalErrors,
		test: testErrors,
		type: typeErrors,
		lint: lintErrors,
	}
}

/**
 * Format result as table
 * @param {string} file - File path
 * @param {Object} errors - Error counts
 */
function formatTable(file, errors) {
	if (errors.total === 0) {
		console.log(`${colors.green}✅ FIXED${colors.reset}: ${file} (0 issues remaining)`)
	} else {
		console.log(
			`${colors.yellow}⚠️  PARTIAL${colors.reset}: ${file} (${errors.total} issues remain - ${errors.test} test, ${errors.type} type, ${errors.lint} lint)`
		)
	}
}

/**
 * Format result as JSON
 * @param {string} file - File path
 * @param {Object} errors - Error counts
 */
function formatJSON(file, errors) {
	const result = {
		file,
		status: errors.total === 0 ? 'fixed' : 'partial',
		total_errors: errors.total,
		test_errors: errors.test,
		type_errors: errors.type,
		lint_errors: errors.lint,
	}

	console.log(JSON.stringify(result, null, 2))
}

/**
 * Print usage
 */
function printUsage() {
	console.log(`
Usage: verify-fix.mjs <file> [--json] [--directory <dir>]

Runs file-level validation (tests + validation tools) and reports results.

Arguments:
  file                Relative path to file (e.g., src/components/Button.tsx)
  --json              Output results as JSON
  --directory <dir>   Project directory (defaults to current directory)

Exit codes:
  0  - All checks passed (zero errors)
  1  - Errors remain
  2  - Invalid usage or no test environment detected
`)
}

/**
 * Main execution
 */
export function main() {
	const args = process.argv.slice(2)

	if (args.length === 0) {
		printUsage()
		process.exit(2)
	}

	let file = null
	let directory = process.cwd()
	let format = 'table'

	// Parse arguments
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--json') {
			format = 'json'
		} else if (args[i] === '--directory' && i + 1 < args.length) {
			directory = args[i + 1]
			i++
		} else if (!file) {
			file = args[i]
		}
	}

	if (!file) {
		printUsage()
		process.exit(2)
	}

	try {
		// Detect test environment
		const envResult = detectTestEnvironment(directory)

		// Get adapter
		const adapter = ADAPTERS.find(a => a.name === envResult.framework)
		if (!adapter) {
			console.error(`${colors.red}❌ Unsupported framework: ${envResult.framework}${colors.reset}`)
			process.exit(2)
		}

		// Validate file exists
		const filePath = path.join(envResult.projectRoot, file)
		if (!fs.existsSync(filePath)) {
			console.error(`${colors.red}❌ File not found: ${file}${colors.reset}`)
			console.error(`  Looked in: ${filePath}`)
			process.exit(2)
		}

		// Run validation
		const result = runValidation(file, envResult, adapter)

		// Parse results
		const errors = parseValidation(result.output)

		// Format output
		if (format === 'json') {
			formatJSON(file, errors)
		} else {
			formatTable(file, errors)
		}

		// Exit with appropriate code
		process.exit(errors.total === 0 ? 0 : 1)
	} catch (error) {
		console.error(`${colors.red}Error: ${error.message}${colors.reset}`)
		process.exit(1)
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
