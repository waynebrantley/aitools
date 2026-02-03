#!/usr/bin/env node

/**
 * parse-validate-output.mjs
 * Parses test output (vitest) AND validation output (prettier/eslint/tsc) and groups issues by filename
 * Cross-platform (Windows, macOS, Linux)
 */

import fs from 'fs'
import readline from 'readline'

// ANSI colors for output
const colors = {
	red: '\x1b[0;31m',
	green: '\x1b[0;32m',
	yellow: '\x1b[1;33m',
	blue: '\x1b[0;34m',
	reset: '\x1b[0m',
}

/**
 * Parse input line by line and extract file-level issue counts
 * @param {string} input - Input text (combined test + validate output)
 * @returns {Map} Map of filename -> {total, test, type, lint}
 */
export function parseOutput(input) {
	const lines = input.split('\n')
	const fileIssues = new Map()

	for (const line of lines) {
		// Test failures (vitest output)
		// Look for: FAIL, ✗, Failed, Error: in test files
		if (/FAIL|✗|Failed|Error:/.test(line)) {
			const match = line.match(/src\/(.+\.(test|spec)\.(tsx?|jsx?))/)
			if (match) {
				const filename = match[1]
				const entry = fileIssues.get(filename) || { total: 0, test: 0, type: 0, lint: 0 }
				entry.test++
				entry.total++
				fileIssues.set(filename, entry)
			}
		}

		// Type errors (tsc output)
		// Look for: error TS[number]:
		if (/error TS\d+:/.test(line)) {
			const match = line.match(/src\/(.+\.(tsx?|jsx?))\(\d+,\d+\)/)
			if (match) {
				const filename = match[1]
				const entry = fileIssues.get(filename) || { total: 0, test: 0, type: 0, lint: 0 }
				entry.type++
				entry.total++
				fileIssues.set(filename, entry)
			}
		}

		// Lint errors (eslint output)
		// Look for: ✖, error, warning (but not "problems" summary line)
		if (/(✖|error|warning)/.test(line) && !/problems/.test(line)) {
			const match = line.match(/src\/(.+\.(tsx?|jsx?))/)
			if (match) {
				const filename = match[1]
				const entry = fileIssues.get(filename) || { total: 0, test: 0, type: 0, lint: 0 }
				entry.lint++
				entry.total++
				fileIssues.set(filename, entry)
			}
		}
	}

	return fileIssues
}

/**
 * Sort files by total issue count (descending)
 * @param {Map} fileIssues - Map of filename -> issue counts
 * @returns {Array} Sorted array of [filename, counts]
 */
export function sortByImpact(fileIssues) {
	return Array.from(fileIssues.entries()).sort((a, b) => b[1].total - a[1].total)
}

/**
 * Format output as table
 * @param {Array} sortedFiles - Sorted array of [filename, counts]
 */
function formatTable(sortedFiles) {
	console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
	console.log(`${colors.blue}📋 Issues by File (sorted by impact)${colors.reset}`)
	console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)

	for (const [filename, counts] of sortedFiles) {
		const filenameDisplay = filename.padEnd(50)
		console.log(
			`${filenameDisplay} ${counts.total.toString().padStart(3)} issues (${counts.test} test, ${counts.type} type, ${counts.lint} lint)`
		)
	}

	console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
}

/**
 * Format output as JSON
 * @param {Array} sortedFiles - Sorted array of [filename, counts]
 */
function formatJSON(sortedFiles) {
	const result = sortedFiles.map(([filename, counts]) => ({
		file: filename,
		total: counts.total,
		test: counts.test,
		type: counts.type,
		lint: counts.lint,
	}))

	console.log(JSON.stringify(result, null, 2))
}

/**
 * Read input from file or stdin
 * @param {string} inputPath - Path to input file, or '-' for stdin
 * @returns {Promise<string>} Input text
 */
async function readInput(inputPath) {
	if (!inputPath || inputPath === '-') {
		// Read from stdin
		const lines = []
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: false,
		})

		return new Promise((resolve, reject) => {
			rl.on('line', (line) => lines.push(line))
			rl.on('close', () => resolve(lines.join('\n')))
			rl.on('error', reject)
		})
	} else {
		// Read from file
		return fs.promises.readFile(inputPath, 'utf8')
	}
}

/**
 * Main execution
 */
export async function main() {
	const args = process.argv.slice(2)
	const format = args[0] || 'table'
	const inputPath = args[1] || '-'

	try {
		// Read input
		const input = await readInput(inputPath)

		// Parse output
		const fileIssues = parseOutput(input)

		// Sort by impact
		const sortedFiles = sortByImpact(fileIssues)

		// Format output
		if (format === 'json') {
			formatJSON(sortedFiles)
		} else {
			formatTable(sortedFiles)
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
