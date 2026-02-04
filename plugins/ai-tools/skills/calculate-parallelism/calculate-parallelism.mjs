#!/usr/bin/env node

/**
 * calculate-parallelism.mjs
 * Analyzes available system resources and calculates optimal parallelism for test fixing
 * Cross-platform (Windows, macOS, Linux)
 */

import os from 'os'
import { execSync } from 'child_process'

// Resource allocation constants (can be overridden via CLI args)
const DEFAULT_MEM_PER_SUBAGENT_GB = 3 // Default GB of memory per subagent
const DEFAULT_MEM_RESERVE_PERCENT = 10 // Default % of total memory to keep free
const MIN_PARALLEL = 2 // Minimum parallel subagents
const MAX_PARALLEL_CAP = 6 // Maximum parallel subagents (coordination overhead)
const LOAD_REDUCTION_FACTOR = 50 // Reduce by 50% if system is saturated

// ANSI colors for output
const colors = {
	red: '\x1b[0;31m',
	green: '\x1b[0;32m',
	yellow: '\x1b[1;33m',
	blue: '\x1b[0;34m',
	reset: '\x1b[0m',
}

/**
 * Get available memory on different platforms
 * @returns {number} Available memory in GB
 */
export function getAvailableMemoryGB() {
	const platform = os.platform()
	const totalMemGB = Math.floor(os.totalmem() / 1024 / 1024 / 1024)
	const freeMemGB = Math.floor(os.freemem() / 1024 / 1024 / 1024)

	// For more accurate "available" memory (not just free), we can use platform-specific commands
	// But os.freemem() is a good cross-platform approximation
	return freeMemGB
}

/**
 * Get CPU load average
 * @returns {number} CPU load (1-minute average, rounded to nearest integer)
 */
export function getCPULoad() {
	const loadAvg = os.loadavg()
	return Math.round(loadAvg[0]) // 1-minute load average
}

/**
 * Detect system resources
 * @returns {Object} System resources
 */
export function detectResources() {
	const totalMemGB = Math.floor(os.totalmem() / 1024 / 1024 / 1024)
	const availableMemGB = getAvailableMemoryGB()
	const cpuCores = os.cpus().length
	const cpuLoad = getCPULoad()

	return {
		totalMemGB,
		availableMemGB,
		cpuCores,
		cpuLoad,
	}
}

/**
 * Parse a memory reserve value into GB.
 * Accepts: "10%" (percentage of total), "500MB", "2GB", or a plain number (treated as GB).
 * @param {string|number} value - The reserve value to parse
 * @param {number} totalMemGB - Total system memory in GB (needed for percentage calculation)
 * @returns {number} Reserved memory in GB
 */
export function parseMemReserve(value, totalMemGB) {
	const str = String(value).trim()

	if (str.endsWith('%')) {
		const pct = parseFloat(str)
		if (isNaN(pct) || pct < 0 || pct >= 100) {
			throw new Error(`Invalid memory reserve percentage: ${str}`)
		}
		return (totalMemGB * pct) / 100
	}

	if (str.toLowerCase().endsWith('mb')) {
		const mb = parseFloat(str)
		if (isNaN(mb) || mb < 0) {
			throw new Error(`Invalid memory reserve value: ${str}`)
		}
		return mb / 1024
	}

	if (str.toLowerCase().endsWith('gb')) {
		const gb = parseFloat(str)
		if (isNaN(gb) || gb < 0) {
			throw new Error(`Invalid memory reserve value: ${str}`)
		}
		return gb
	}

	const gb = parseFloat(str)
	if (isNaN(gb) || gb < 0) {
		throw new Error(`Invalid memory reserve value: ${str}`)
	}
	return gb
}

/**
 * Calculate optimal parallelism based on resources
 * @param {Object} resources - System resources
 * @param {number} memPerSubagentGB - Memory per subagent in GB
 * @param {number} memReserveGB - Memory to keep free in GB
 * @returns {Object} Calculation results
 */
export function calculateOptimalParallel(resources, memPerSubagentGB = DEFAULT_MEM_PER_SUBAGENT_GB, memReserveGB = 0) {
	const { totalMemGB, availableMemGB, cpuCores, cpuLoad } = resources

	// 1. Memory constraint: (Available GB - reserved) / Memory per subagent
	const effectiveMemGB = Math.max(0, availableMemGB - memReserveGB)
	const memLimit = Math.floor(effectiveMemGB / memPerSubagentGB)

	// 2. CPU constraint: Don't exceed physical cores
	const cpuLimit = cpuCores

	// 3. Load constraint: Reduce if system is saturated
	let loadFactor = 100
	let loadStatus = 'normal'
	if (cpuLoad >= cpuCores) {
		loadFactor = LOAD_REDUCTION_FACTOR
		loadStatus = 'saturated'
	}

	// Take minimum of memory and CPU constraints
	let maxParallel = Math.min(memLimit, cpuLimit)
	let limitingFactor = memLimit < cpuLimit ? 'memory' : 'CPU'

	// Apply load factor
	maxParallel = Math.floor((maxParallel * loadFactor) / 100)

	// Apply hard limits
	if (maxParallel > MAX_PARALLEL_CAP) {
		maxParallel = MAX_PARALLEL_CAP
		limitingFactor = `coordination overhead (capped at ${MAX_PARALLEL_CAP})`
	}

	if (maxParallel < MIN_PARALLEL) {
		maxParallel = MIN_PARALLEL
		limitingFactor = 'minimum enforced'
	}

	return {
		maxParallel,
		totalMemGB,
		availableMemGB,
		memReserveGB,
		effectiveMemGB,
		cpuCores,
		cpuLoad,
		loadStatus,
		limitingFactor,
	}
}

/**
 * Print resource analysis report
 * @param {Object} result - Calculation results
 */
function printReport(result) {
	const { maxParallel, totalMemGB, availableMemGB, memReserveGB, effectiveMemGB, cpuCores, cpuLoad, loadStatus, limitingFactor } = result

	const reserveLabel = memReserveGB > 0 ? ` (${memReserveGB.toFixed(1)}GB reserved, ${effectiveMemGB.toFixed(1)}GB usable)` : ''

	console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
	console.log(`${colors.blue}📊 Resource Analysis${colors.reset}`)
	console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
	console.log(
		`Memory:  ${colors.green}${availableMemGB}GB${colors.reset} available / ${totalMemGB}GB total${reserveLabel}`
	)
	console.log(`CPU:     ${colors.green}${cpuCores}${colors.reset} cores, load average: ${cpuLoad} (${loadStatus})`)
	console.log(`Limit:   ${colors.yellow}${limitingFactor}${colors.reset}`)
	console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
	console.log(`${colors.green}✅ Running up to ${maxParallel} parallel fix subagents${colors.reset}`)
	console.log(`${colors.blue}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`)
}

/**
 * Parse command line arguments
 * @returns {Object} Parsed arguments
 */
function parseArgs() {
	const args = process.argv.slice(2)
	const jsonOutput = args.includes('--json')

	// Parse --mem-per-agent argument
	let memPerSubagentGB = DEFAULT_MEM_PER_SUBAGENT_GB
	const memArgIndex = args.findIndex(arg => arg.startsWith('--mem-per-agent'))
	if (memArgIndex !== -1) {
		const memArg = args[memArgIndex]
		if (memArg.includes('=')) {
			memPerSubagentGB = parseFloat(memArg.split('=')[1])
		} else if (args[memArgIndex + 1]) {
			memPerSubagentGB = parseFloat(args[memArgIndex + 1])
		}

		if (isNaN(memPerSubagentGB) || memPerSubagentGB <= 0) {
			console.error(`${colors.red}Error: --mem-per-agent must be a positive number${colors.reset}`)
			process.exit(1)
		}
	}

	// Parse --mem-reserve argument (default: 10%)
	let memReserve = `${DEFAULT_MEM_RESERVE_PERCENT}%`
	const reserveArgIndex = args.findIndex(arg => arg.startsWith('--mem-reserve'))
	if (reserveArgIndex !== -1) {
		const reserveArg = args[reserveArgIndex]
		if (reserveArg.includes('=')) {
			memReserve = reserveArg.split('=')[1]
		} else if (args[reserveArgIndex + 1]) {
			memReserve = args[reserveArgIndex + 1]
		}
	}

	return { jsonOutput, memPerSubagentGB, memReserve }
}

/**
 * Main execution
 */
function main() {
	const { jsonOutput, memPerSubagentGB, memReserve } = parseArgs()

	const resources = detectResources()

	let memReserveGB
	try {
		memReserveGB = parseMemReserve(memReserve, resources.totalMemGB)
	} catch (err) {
		console.error(`${colors.red}Error: ${err.message}${colors.reset}`)
		process.exit(1)
	}

	const result = calculateOptimalParallel(resources, memPerSubagentGB, memReserveGB)

	if (jsonOutput) {
		// Output JSON for programmatic use
		console.log(
			JSON.stringify(
				{
					max_parallel: result.maxParallel,
					total_memory_gb: result.totalMemGB,
					available_memory_gb: result.availableMemGB,
					mem_reserve_gb: Math.round(result.memReserveGB * 100) / 100,
					effective_memory_gb: Math.round(result.effectiveMemGB * 100) / 100,
					cpu_cores: result.cpuCores,
					cpu_load: result.cpuLoad,
					limiting_factor: result.limitingFactor,
				},
				null,
				2
			)
		)
	} else {
		// Print formatted report and return the value
		printReport(result)
		console.log(result.maxParallel) // For easy capture in shell: MAX_PARALLEL=$(node calculate-parallelism.mjs)
	}
}

// Run if executed directly
main()
