#!/usr/bin/env node

/**
 * find-skipped-tests.mjs
 * Finds all skipped tests (.skip) in test files and groups by skip reason
 * Cross-platform (Windows, macOS, Linux)
 *
 * Usage: node find-skipped-tests.mjs [--json] [--directory <dir>]
 *
 * Exit codes:
 *   0 - Success (may have skipped tests or none)
 *   1 - Error occurred
 *   2 - No test environment detected
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

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const { globSync } = fs

// Get current directory (ES modules equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
 * Find all test files using adapter patterns
 * @param {string} projectRoot - Project root directory
 * @param {Object} adapter - Test framework adapter
 * @returns {Array} Array of test file paths
 */
function findTestFiles(projectRoot, adapter) {
	const patterns = adapter.getTestFilePatterns()
	const testFiles = []

	for (const pattern of patterns) {
		const files = globSync(pattern, {
			cwd: projectRoot,
			absolute: true,
			nodir: true,
			ignore: ['**/node_modules/**', '**/bin/**', '**/obj/**', '**/dist/**']
		})
		testFiles.push(...files)
	}

	// Remove duplicates
	return [...new Set(testFiles)]
}

/**
 * Extract skip reason from test file (looks at comments above skip)
 * @param {string} filePath - Path to test file
 * @param {number} lineNum - Line number of skip (0-indexed)
 * @param {string} line - Line content
 * @returns {string} Skip reason
 */
export function extractSkipReason(filePath, lineNum, line) {
	const fileContent = fs.readFileSync(filePath, 'utf8').split('\n')

	// Look back up to 3 lines for comments
	for (let i = 1; i <= 3; i++) {
		const prevLine = fileContent[lineNum - i]
		if (prevLine) {
			const trimmed = prevLine.trim()
			if (trimmed.startsWith('//')) {
				// Extract comment text
				const comment = trimmed
					.replace(/^\/\/\s*/, '')
					.replace(/^TODO:\s*/i, '')
					.replace(/^FIXME:\s*/i, '')
					.trim()

				if (comment.length > 5) {
					return comment
				}
			}
		}
	}

	// Fall back to test description if available
	const descMatch = line.match(/['"`]([^'"`]+)['"`]/)
	if (descMatch && descMatch[1].length > 3) {
		return descMatch[1]
	}

	return 'No reason specified'
}

/**
 * Categorize a skip reason into broader category
 * @param {string} reason - Skip reason
 * @returns {string} Category name
 */
export function categorizeReason(reason) {
	const reasonLower = reason.toLowerCase()

	if (/e2e|end.to.end|integration|functional|should be covered/.test(reasonLower)) {
		return 'Should be E2E tests'
	}

	if (/test environment|not working.*environment|difficult to test|mocking|mock/.test(reasonLower)) {
		return 'Test environment limitations'
	}

	if (/component.*null|early return|conditional render|component logic|returns null/.test(reasonLower)) {
		return 'Component logic issues'
	}

	if (/css|class|styling|style/.test(reasonLower)) {
		return 'Implementation details'
	}

	if (/validation|error display|form validation/.test(reasonLower)) {
		return 'Validation display issues'
	}

	if (/library|third.party|dependency|external/.test(reasonLower)) {
		return 'Third-party library issues'
	}

	return 'Other/Uncategorized'
}

/**
 * Find all skipped tests in project
 * @param {string} projectRoot - Project root directory
 * @param {Object} adapter - Test framework adapter
 * @returns {Array} Array of skipped test objects
 */
function findSkippedTests(projectRoot, adapter) {
	const testFiles = findTestFiles(projectRoot, adapter)
	const skippedTests = []

	// Get skip patterns from adapter
	const skipPatterns = adapter.getSkipPatterns()

	for (const testFile of testFiles) {
		const content = fs.readFileSync(testFile, 'utf8')
		const lines = content.split('\n')

		lines.forEach((line, index) => {
			// Check each skip pattern from adapter
			for (const pattern of skipPatterns) {
				const regex = new RegExp(pattern)
				const skipMatch = line.match(regex)

				if (skipMatch) {
					const skipType = skipMatch[0]
					const reason = extractSkipReason(testFile, index, line)
					const category = categorizeReason(reason)
					const relativePath = path.relative(projectRoot, testFile)

					skippedTests.push({
						file: relativePath,
						line: index + 1, // Convert to 1-indexed
						skipType,
						reason,
						category,
						reasonKey: reason.toLowerCase().trim(),
					})

					break // Only match once per line
				}
			}
		})
	}

	return skippedTests
}

/**
 * Group tests by category and reason
 * @param {Array} skippedTests - Array of skipped test objects
 * @returns {Object} Grouped tests
 */
export function groupTests(skippedTests) {
	const groups = {}

	for (const test of skippedTests) {
		if (!groups[test.category]) {
			groups[test.category] = {}
		}

		if (!groups[test.category][test.reasonKey]) {
			groups[test.category][test.reasonKey] = {
				reason: test.reason,
				tests: [],
			}
		}

		groups[test.category][test.reasonKey].tests.push({
			file: test.file,
			line: test.line,
			skipType: test.skipType,
		})
	}

	return groups
}

/**
 * Format output as JSON
 * @param {Array} skippedTests - Array of skipped test objects
 */
function formatJSON(skippedTests) {
	const grouped = groupTests(skippedTests)

	const result = {
		total: skippedTests.length,
		categories: Object.entries(grouped).map(([category, reasons]) => ({
			category,
			count: Object.values(reasons).reduce((sum, r) => sum + r.tests.length, 0),
			reasons: Object.entries(reasons).map(([reasonKey, data]) => ({
				reason: data.reason,
				count: data.tests.length,
				tests: data.tests,
			})),
		})),
	}

	console.log(JSON.stringify(result, null, 2))
}

/**
 * Format output as table (human-readable)
 * @param {Array} skippedTests - Array of skipped test objects
 */
function formatTable(skippedTests) {
	const grouped = groupTests(skippedTests)

	console.log('Skipped Tests Analysis')
	console.log(`Found ${skippedTests.length} total skipped tests across the codebase:`)
	console.log('')

	// Category stats
	const categoryStats = Object.entries(grouped)
		.map(([category, reasons]) => ({
			category,
			count: Object.values(reasons).reduce((sum, r) => sum + r.tests.length, 0),
		}))
		.sort((a, b) => b.count - a.count)

	for (const { count, category } of categoryStats) {
		console.log(`${count} - ${category}`)
	}

	console.log('')
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
	console.log('Detailed Breakdown')
	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

	// Sort categories by count (descending)
	for (const { category, count } of categoryStats) {
		console.log('')
		console.log(`📂 Category: ${category} (${count} tests)`)
		console.log('')

		// Get reasons within this category, sorted by count
		const categoryReasons = Object.entries(grouped[category])
			.map(([reasonKey, data]) => ({
				reasonKey,
				reason: data.reason,
				count: data.tests.length,
				tests: data.tests,
			}))
			.sort((a, b) => b.count - a.count)

		for (const { reason, count, tests } of categoryReasons) {
			console.log(`   📌 Reason: "${reason}" (${count} tests)`)
			console.log('      ──────────────────────────────────────────')

			for (const test of tests) {
				const location = `${test.file}:${test.line}`.padEnd(60)
				console.log(`      ${location} ${test.skipType}`)
			}

			console.log('')
		}
	}

	console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

/**
 * Main execution
 */
export function main() {
	const args = process.argv.slice(2)
	let format = 'table'
	let directory = process.cwd()

	// Parse arguments
	for (let i = 0; i < args.length; i++) {
		if (args[i] === '--json') {
			format = 'json'
		} else if (args[i] === '--directory' && i + 1 < args.length) {
			directory = args[i + 1]
			i++
		}
	}

	try {
		// Detect test environment
		const envResults = detectTestEnvironment(directory)

		// For now, use the first detected framework
		// TODO: Add CLI argument to select specific framework or process all
		const envResult = envResults[0]

		// Get adapter
		const adapter = ADAPTERS.find(a => a.name === envResult.framework)
		if (!adapter) {
			console.error(`${colors.red}❌ Unsupported framework: ${envResult.framework}${colors.reset}`)
			process.exit(2)
		}

		if (envResults.length > 1) {
			console.error(`${colors.yellow}⚠️  Multiple frameworks detected, analyzing: ${envResult.displayName}${colors.reset}`)
			console.error('')
		}

		// Find all skipped tests
		const skippedTests = findSkippedTests(envResult.projectRoot, adapter)

		if (skippedTests.length === 0) {
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
			console.log('🔍 Skipped Tests Summary')
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
			console.log('✅ No skipped tests found')
			console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
			process.exit(0)
		}

		// Format output
		if (format === 'json') {
			formatJSON(skippedTests)
		} else {
			formatTable(skippedTests)
		}
	} catch (error) {
		console.error(`${colors.red}Error: ${error.message}${colors.reset}`)
		process.exit(1)
	}
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
