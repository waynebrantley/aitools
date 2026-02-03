#!/usr/bin/env node

/**
 * Base Test Framework Adapter
 *
 * Defines the interface that all test framework adapters must implement.
 * This allows the fix-unit-tests skill to support multiple testing frameworks
 * (unit tests, E2E tests, server-side tests) through a unified interface.
 *
 * @abstract
 */
export class TestFrameworkAdapter {
  /**
   * @type {string} Unique identifier for this adapter (e.g., 'vitest', 'playwright', 'dotnet')
   */
  name = 'base'

  /**
   * @type {string} Display name for user-facing messages (e.g., 'Vitest', 'Playwright', '.NET Test')
   */
  displayName = 'Base Test Framework'

  /**
   * @type {string} Test type: 'unit', 'e2e', or 'integration'
   */
  testType = 'unit'

  // ==================== Detection ====================

  /**
   * Determine if this adapter can handle the current project.
   *
   * @param {Object} context - Detection context
   * @param {string} context.packageJsonContent - Content of package.json (if exists)
   * @param {string} context.projectRoot - Absolute path to project root
   * @param {Function} context.fileExists - Function to check if file exists: (relativePath) => boolean
   * @param {Function} context.readFile - Function to read file: (relativePath) => string
   * @param {Function} context.glob - Function to find files: (pattern) => string[]
   * @returns {boolean} True if this adapter can handle the project
   */
  canDetect(context) {
    throw new Error('canDetect() must be implemented by subclass')
  }

  // ==================== Test Discovery ====================

  /**
   * Get the command to run tests.
   *
   * @param {Object} config - Configuration object
   * @param {string} config.projectRoot - Absolute path to project root
   * @param {string} [config.testPath] - Optional specific test file/directory to run
   * @returns {string} Command to execute tests
   */
  getTestCommand(config) {
    throw new Error('getTestCommand() must be implemented by subclass')
  }

  /**
   * Get glob patterns to find test files.
   *
   * @returns {string[]} Array of glob patterns (e.g., 'glob/*.test.ts', 'glob/*.spec.ts')
   */
  getTestFilePatterns() {
    throw new Error('getTestFilePatterns() must be implemented by subclass')
  }

  /**
   * Get regex patterns that indicate skipped tests in source code.
   *
   * @returns {string[]} Array of regex patterns (e.g., ['it\\.skip', 'test\\.skip'])
   */
  getSkipPatterns() {
    throw new Error('getSkipPatterns() must be implemented by subclass')
  }

  /**
   * Get regex patterns that indicate focused tests (test.only, it.only).
   *
   * @returns {string[]} Array of regex patterns
   */
  getFocusPatterns() {
    return ['it\\.only', 'test\\.only', 'describe\\.only']
  }

  // ==================== Validation ====================

  /**
   * Get commands to validate code quality (linting, type checking, formatting).
   *
   * @param {Object} config - Configuration object
   * @param {string} config.projectRoot - Absolute path to project root
   * @returns {Array<{name: string, command: string}>} Array of validation commands
   */
  getValidationCommands(config) {
    return []
  }

  // ==================== Resource Management ====================

  /**
   * Get resource multiplier for this test type.
   * Base memory per worker is ~2GB. This multiplier adjusts for different test types:
   * - Unit tests: 1.0 (2GB)
   * - E2E tests: 1.5-2.5 (3-5GB due to browser instances)
   * - Server tests: 1.0-1.5 (2-3GB)
   *
   * @returns {number} Multiplier (e.g., 1.0 for unit tests, 2.5 for E2E)
   */
  getResourceMultiplier() {
    return 1.0  // Default: unit tests
  }

  /**
   * Get parallel execution strategy for this test type.
   *
   * @param {number} cpuCores - Available CPU cores
   * @returns {Object} Execution strategy
   * @returns {number} return.maxWorkers - Maximum parallel workers
   * @returns {number} return.staggerDelay - Delay between spawning workers (ms)
   * @returns {boolean} return.requiresIsolation - Whether tests need isolation
   * @returns {string} [return.isolationNote] - Note about isolation requirements
   */
  getParallelExecutionStrategy(cpuCores) {
    return {
      maxWorkers: Math.max(1, cpuCores - 1),
      staggerDelay: 0,
      requiresIsolation: false
    }
  }

  // ==================== Output Parsing ====================

  /**
   * Parse test execution output to extract failures.
   *
   * @param {string} output - Raw stdout/stderr from test execution
   * @returns {Object} Parsed result
   * @returns {Array<Object>} return.failures - Array of test failures
   * @returns {string} return.failures[].testName - Name of failed test
   * @returns {string} [return.failures[].file] - File path (if available)
   * @returns {number} [return.failures[].line] - Line number (if available)
   * @returns {string} [return.failures[].message] - Error message
   * @returns {string} return.failures[].type - Type: 'test-failure', 'build-error', etc.
   */
  parseTestOutput(output) {
    throw new Error('parseTestOutput() must be implemented by subclass')
  }

  /**
   * Parse validation output (linting, type errors, etc.).
   *
   * @param {string} output - Raw stdout/stderr from validation command
   * @param {string} validatorName - Name of validator that produced output ('prettier', 'eslint', etc.)
   * @returns {Object} Parsed result
   * @returns {Array<Object>} return.errors - Array of validation errors
   * @returns {string} return.errors[].file - File path
   * @returns {number} [return.errors[].line] - Line number
   * @returns {number} [return.errors[].column] - Column number
   * @returns {string} return.errors[].message - Error message
   * @returns {string} return.errors[].rule - Rule ID (if available)
   */
  parseValidationOutput(output, validatorName) {
    return { errors: [] }  // Default: no validation
  }

  // ==================== Verification ====================

  /**
   * Get command to verify a specific test file passes.
   *
   * @param {Object} config - Configuration object
   * @param {string} config.projectRoot - Absolute path to project root
   * @param {string} config.testFile - Relative path to test file
   * @returns {string} Command to execute single test file
   */
  getVerifyCommand(config) {
    throw new Error('getVerifyCommand() must be implemented by subclass')
  }

  // ==================== Configuration ====================

  /**
   * Get default configuration for this adapter.
   *
   * @param {string} projectRoot - Absolute path to project root
   * @returns {Object} Default configuration
   */
  getDefaultConfig(projectRoot) {
    return {
      projectRoot,
      framework: this.name,
      testType: this.testType
    }
  }

  /**
   * Detect and return framework-specific configuration.
   * For example, Vitest adapter might detect vitest.config.ts location.
   *
   * @param {Object} context - Detection context (same as canDetect)
   * @returns {Object} Framework-specific configuration
   */
  detectConfig(context) {
    return {}
  }
}
