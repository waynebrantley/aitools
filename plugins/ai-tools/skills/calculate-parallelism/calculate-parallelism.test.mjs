#!/usr/bin/env node

/**
 * Tests for calculate-parallelism.mjs
 * Run with: node calculate-parallelism.test.mjs
 */

import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import os from 'os'
import { calculateOptimalParallel, parseMemReserve } from './calculate-parallelism.mjs'

describe('calculateOptimalParallel', () => {
	it('should calculate parallelism based on memory constraint', () => {
		const resources = {
			totalMemGB: 32,
			availableMemGB: 24,
			cpuCores: 16,
			cpuLoad: 2,
		}

		const result = calculateOptimalParallel(resources, 3) // 3GB per subagent

		// 24GB / 3GB = 8, but capped at MAX_PARALLEL_CAP (6)
		assert.equal(result.maxParallel, 6)
		assert.equal(result.limitingFactor, 'coordination overhead (capped at 6)')
	})

	it('should calculate parallelism based on CPU constraint', () => {
		const resources = {
			totalMemGB: 64,
			availableMemGB: 60,
			cpuCores: 4,
			cpuLoad: 1,
		}

		const result = calculateOptimalParallel(resources, 3)

		// CPU is limiting: 4 cores
		assert.equal(result.maxParallel, 4)
		assert.equal(result.limitingFactor, 'CPU')
	})

	it('should reduce parallelism when system is saturated', () => {
		const resources = {
			totalMemGB: 32,
			availableMemGB: 24,
			cpuCores: 8,
			cpuLoad: 8, // Load equals cores = saturated
		}

		const result = calculateOptimalParallel(resources, 3)

		// 24GB / 3GB = 8, but reduced by 50% due to saturation = 4
		assert.equal(result.maxParallel, 4)
		assert.equal(result.loadStatus, 'saturated')
	})

	it('should enforce minimum parallel of 2', () => {
		const resources = {
			totalMemGB: 8,
			availableMemGB: 2,
			cpuCores: 2,
			cpuLoad: 0,
		}

		const result = calculateOptimalParallel(resources, 3)

		// 2GB / 3GB = 0, but enforced minimum is 2
		assert.equal(result.maxParallel, 2)
		assert.equal(result.limitingFactor, 'minimum enforced')
	})

	it('should cap at maximum of 6 for coordination overhead', () => {
		const resources = {
			totalMemGB: 128,
			availableMemGB: 100,
			cpuCores: 32,
			cpuLoad: 2,
		}

		const result = calculateOptimalParallel(resources, 3)

		// Would be 33, but capped at 6
		assert.equal(result.maxParallel, 6)
		assert.equal(result.limitingFactor, 'coordination overhead (capped at 6)')
	})

	it('should handle custom memory per subagent', () => {
		const resources = {
			totalMemGB: 16,
			availableMemGB: 12,
			cpuCores: 8,
			cpuLoad: 1,
		}

		const result = calculateOptimalParallel(resources, 6) // 6GB per subagent

		// 12GB / 6GB = 2
		assert.equal(result.maxParallel, 2)
		assert.equal(result.limitingFactor, 'memory')
	})

	it('should return correct resource information', () => {
		const resources = {
			totalMemGB: 32,
			availableMemGB: 24,
			cpuCores: 8,
			cpuLoad: 3,
		}

		const result = calculateOptimalParallel(resources, 3)

		assert.equal(result.totalMemGB, 32)
		assert.equal(result.availableMemGB, 24)
		assert.equal(result.cpuCores, 8)
		assert.equal(result.cpuLoad, 3)
		assert.equal(result.loadStatus, 'normal')
	})

	it('should prioritize memory when memory is more limiting than CPU', () => {
		const resources = {
			totalMemGB: 16,
			availableMemGB: 9,
			cpuCores: 16,
			cpuLoad: 2,
		}

		const result = calculateOptimalParallel(resources, 3)

		// 9GB / 3GB = 3 (memory limit)
		// CPU limit = 16
		// Memory is more limiting
		assert.equal(result.maxParallel, 3)
		assert.equal(result.limitingFactor, 'memory')
	})

	it('should handle exactly saturated CPU load', () => {
		const resources = {
			totalMemGB: 32,
			availableMemGB: 24,
			cpuCores: 10,
			cpuLoad: 10,
		}

		const result = calculateOptimalParallel(resources, 3)

		// Memory limit = 24/3 = 8, CPU limit = 10, min = 8
		// Reduced by 50% due to saturation = 4
		assert.equal(result.maxParallel, 4)
		assert.equal(result.loadStatus, 'saturated')
	})

	it('should handle over-saturated CPU load', () => {
		const resources = {
			totalMemGB: 32,
			availableMemGB: 24,
			cpuCores: 8,
			cpuLoad: 12, // Load exceeds cores
		}

		const result = calculateOptimalParallel(resources, 3)

		// CPU limit = 8, reduced by 50% = 4
		assert.equal(result.maxParallel, 4)
		assert.equal(result.loadStatus, 'saturated')
	})

	it('should use default memory per subagent when not specified', () => {
		const resources = {
			totalMemGB: 16,
			availableMemGB: 12,
			cpuCores: 8,
			cpuLoad: 1,
		}

		const result = calculateOptimalParallel(resources) // No memPerSubagentGB specified

		// 12GB / 3GB (default) = 4
		assert.equal(result.maxParallel, 4)
	})

	it('should handle edge case with very low memory', () => {
		const resources = {
			totalMemGB: 4,
			availableMemGB: 1,
			cpuCores: 4,
			cpuLoad: 1,
		}

		const result = calculateOptimalParallel(resources, 3)

		// 1GB / 3GB = 0, enforced to minimum 2
		assert.equal(result.maxParallel, 2)
		assert.equal(result.limitingFactor, 'minimum enforced')
	})

	it('should handle fractional division correctly', () => {
		const resources = {
			totalMemGB: 16,
			availableMemGB: 11,
			cpuCores: 8,
			cpuLoad: 1,
		}

		const result = calculateOptimalParallel(resources, 3)

		// 11GB / 3GB = 3.666... = floor(3.666) = 3
		assert.equal(result.maxParallel, 3)
	})
})

describe('parseMemReserve', () => {
	it('should parse percentage values', () => {
		assert.equal(parseMemReserve('10%', 32), 3.2)
		assert.equal(parseMemReserve('25%', 16), 4)
		assert.equal(parseMemReserve('0%', 32), 0)
	})

	it('should parse MB values', () => {
		const result = parseMemReserve('512MB', 32)
		assert.equal(result, 0.5)
	})

	it('should parse GB values', () => {
		assert.equal(parseMemReserve('2GB', 32), 2)
		assert.equal(parseMemReserve('1.5gb', 16), 1.5)
	})

	it('should parse plain numbers as GB', () => {
		assert.equal(parseMemReserve('3', 32), 3)
		assert.equal(parseMemReserve(2, 16), 2)
	})

	it('should throw on invalid percentage', () => {
		assert.throws(() => parseMemReserve('100%', 32), /Invalid/)
		assert.throws(() => parseMemReserve('-5%', 32), /Invalid/)
		assert.throws(() => parseMemReserve('abc%', 32), /Invalid/)
	})

	it('should throw on negative values', () => {
		assert.throws(() => parseMemReserve('-2GB', 32), /Invalid/)
		assert.throws(() => parseMemReserve('-1', 32), /Invalid/)
	})
})

describe('calculateOptimalParallel with memory reserve', () => {
	it('should subtract reserved memory from available', () => {
		const resources = {
			totalMemGB: 32,
			availableMemGB: 24,
			cpuCores: 16,
			cpuLoad: 2,
		}

		const result = calculateOptimalParallel(resources, 3, 3) // reserve 3GB

		// (24 - 3) / 3 = 7, capped at 6
		assert.equal(result.maxParallel, 6)
		assert.equal(result.memReserveGB, 3)
		assert.equal(result.effectiveMemGB, 21)
	})

	it('should reduce parallelism when reserve eats into available memory', () => {
		const resources = {
			totalMemGB: 16,
			availableMemGB: 12,
			cpuCores: 8,
			cpuLoad: 1,
		}

		const result = calculateOptimalParallel(resources, 3, 3) // reserve 3GB

		// (12 - 3) / 3 = 3
		assert.equal(result.maxParallel, 3)
		assert.equal(result.limitingFactor, 'memory')
	})

	it('should floor effective memory at zero when reserve exceeds available', () => {
		const resources = {
			totalMemGB: 8,
			availableMemGB: 2,
			cpuCores: 4,
			cpuLoad: 0,
		}

		const result = calculateOptimalParallel(resources, 3, 5) // reserve more than available

		// max(0, 2 - 5) = 0, 0 / 3 = 0, enforced minimum = 2
		assert.equal(result.maxParallel, 2)
		assert.equal(result.effectiveMemGB, 0)
		assert.equal(result.limitingFactor, 'minimum enforced')
	})

	it('should default to zero reserve when not specified', () => {
		const resources = {
			totalMemGB: 16,
			availableMemGB: 12,
			cpuCores: 8,
			cpuLoad: 1,
		}

		const result = calculateOptimalParallel(resources, 3)

		assert.equal(result.memReserveGB, 0)
		assert.equal(result.effectiveMemGB, 12)
		assert.equal(result.maxParallel, 4)
	})
})

describe('Integration tests', () => {
	it('should handle typical developer laptop scenario', () => {
		const resources = {
			totalMemGB: 16,
			availableMemGB: 8,
			cpuCores: 8,
			cpuLoad: 2,
		}

		const result = calculateOptimalParallel(resources, 3)

		// 8GB / 3GB = 2 (memory limited)
		assert.equal(result.maxParallel, 2)
		assert.equal(result.limitingFactor, 'memory')
		assert.equal(result.loadStatus, 'normal')
	})

	it('should handle high-end workstation scenario', () => {
		const resources = {
			totalMemGB: 64,
			availableMemGB: 48,
			cpuCores: 16,
			cpuLoad: 3,
		}

		const result = calculateOptimalParallel(resources, 3)

		// 48GB / 3GB = 16, but capped at 6
		assert.equal(result.maxParallel, 6)
		assert.equal(result.limitingFactor, 'coordination overhead (capped at 6)')
	})

	it('should handle busy system scenario', () => {
		const resources = {
			totalMemGB: 32,
			availableMemGB: 12,
			cpuCores: 8,
			cpuLoad: 8,
		}

		const result = calculateOptimalParallel(resources, 3)

		// min(12/3=4, 8) = 4, reduced by 50% = 2
		assert.equal(result.maxParallel, 2)
		assert.equal(result.loadStatus, 'saturated')
	})
})
