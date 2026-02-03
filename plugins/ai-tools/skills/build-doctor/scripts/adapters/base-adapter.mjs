#!/usr/bin/env node

/**
 * Base Build Framework Adapter
 *
 * Defines the interface that all build framework adapters must implement.
 * This allows the build-doctor skill to support multiple build systems
 * (.NET, TypeScript/JavaScript, etc.) through a unified interface.
 *
 * @abstract
 */
export class BuildFrameworkAdapter {
  /**
   * @type {string} Unique identifier for this adapter (e.g., 'dotnet', 'typescript')
   */
  name = 'base'

  /**
   * @type {string} Display name for user-facing messages (e.g., '.NET Build', 'TypeScript Build')
   */
  displayName = 'Base Build Framework'

  /**
   * @type {string} Build type: 'dotnet', 'typescript', 'javascript', etc.
   */
  buildType = 'unknown'

  /**
   * Get a context-specific display name for this build framework.
   * Override this method to provide more specific names based on config.
   *
   * @param {Object} config - Configuration object from detectConfig()
   * @param {string} projectRoot - Project root directory
   * @returns {string} Display name with context (e.g., "MyProject.sln (dotnet)" or "frontend (typescript)")
   */
  getDisplayName(config, projectRoot) {
    return this.displayName
  }

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

  // ==================== Build Commands ====================

  /**
   * Get the command to build the project.
   *
   * @param {Object} config - Configuration object
   * @param {string} config.projectRoot - Absolute path to project root
   * @param {string} [config.buildPath] - Optional specific path to build
   * @returns {string|string[]} Command(s) to execute build (string or array of strings)
   */
  getBuildCommand(config) {
    throw new Error('getBuildCommand() must be implemented by subclass')
  }

  /**
   * Get glob patterns to find buildable source files.
   *
   * @returns {string[]} Array of glob patterns
   */
  getSourceFilePatterns() {
    throw new Error('getSourceFilePatterns() must be implemented by subclass')
  }

  // ==================== Validation ====================

  /**
   * Get commands to validate code quality (linting, formatting, type checking).
   * These run BEFORE the actual build to catch common issues early.
   *
   * @param {Object} config - Configuration object
   * @param {string} config.projectRoot - Absolute path to project root
   * @returns {Array<{name: string, command: string, optional: boolean}>} Array of validation commands
   */
  getValidationCommands(config) {
    return []
  }

  // ==================== Resource Management ====================

  /**
   * Get resource multiplier for this build type.
   * Base memory per worker is ~2GB. This multiplier adjusts for different build types:
   * - TypeScript: 1.0-1.5 (2-3GB)
   * - .NET: 1.5-2.0 (3-4GB due to compilation)
   * - Large projects: 2.0+ (4GB+)
   *
   * @returns {number} Multiplier (e.g., 1.0 for TS, 2.0 for .NET)
   */
  getResourceMultiplier() {
    return 1.0  // Default: standard builds
  }

  /**
   * Get parallel execution strategy for this build type.
   *
   * @param {number} cpuCores - Available CPU cores
   * @returns {Object} Execution strategy
   * @returns {number} return.maxWorkers - Maximum parallel workers
   * @returns {number} return.staggerDelay - Delay between spawning workers (ms)
   * @returns {boolean} return.requiresIsolation - Whether builds need isolation
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
   * Parse build execution output to extract errors and warnings.
   *
   * @param {string} output - Raw stdout/stderr from build execution
   * @returns {Object} Parsed result
   * @returns {Array<Object>} return.errors - Array of build errors
   * @returns {string} return.errors[].file - File path
   * @returns {number} [return.errors[].line] - Line number (if available)
   * @returns {number} [return.errors[].column] - Column number (if available)
   * @returns {string} return.errors[].message - Error message
   * @returns {string} return.errors[].type - Type: 'build-error', 'warning', etc.
   */
  parseBuildOutput(output) {
    throw new Error('parseBuildOutput() must be implemented by subclass')
  }

  /**
   * Parse validation output (linting, type errors, formatting, etc.).
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
   * Get command to verify a specific file builds successfully.
   *
   * @param {Object} config - Configuration object
   * @param {string} config.projectRoot - Absolute path to project root
   * @param {string} config.file - Relative path to file
   * @returns {string|string[]} Command(s) to execute single file verification
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
      buildType: this.buildType
    }
  }

  /**
   * Detect and return framework-specific configuration.
   * For example, TypeScript adapter might detect tsconfig.json location.
   *
   * @param {Object} context - Detection context (same as canDetect)
   * @returns {Object} Framework-specific configuration
   */
  detectConfig(context) {
    return {}
  }
}
