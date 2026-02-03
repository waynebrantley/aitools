#!/usr/bin/env node

/**
 * TypeScript/JavaScript Build Framework Adapter
 *
 * Supports TypeScript and JavaScript projects with:
 * - TypeScript (tsconfig.json)
 * - Build scripts (package.json scripts.build)
 * - Linting (ESLint, --max-warnings=0)
 * - Formatting (Prettier, optional)
 *
 * Build process:
 * 1. Format (prettier --check, optional)
 * 2. Lint (eslint --max-warnings=0, warnings treated as errors)
 * 3. Type check (tsc --noEmit)
 * 4. Build (npm/pnpm/yarn build)
 *
 * Warning Policy:
 * - All warnings from ESLint, TypeScript, and build tools are treated as errors
 * - Zero-warning builds are enforced for code quality
 */

import { BuildFrameworkAdapter } from './base-adapter.mjs'
import { basename, relative } from 'path'
import { execSync } from 'child_process'

export class TypeScriptAdapter extends BuildFrameworkAdapter {
  name = 'typescript'
  displayName = 'TypeScript Build'
  buildType = 'typescript'

  // ==================== Detection ====================

  canDetect(context) {
    const { fileExists, packageJsonContent } = context

    // Must have tsconfig.json or package.json with typescript
    const hasTsConfig = fileExists('tsconfig.json')
    const hasTypeScript = packageJsonContent && (
      packageJsonContent.includes('"typescript"') ||
      packageJsonContent.includes('tsconfig.json')
    )

    return hasTsConfig || hasTypeScript
  }

  // ==================== Build Commands ====================

  getBuildCommand(config) {
    const { packageManager, buildScript } = config

    // Use the build script if it exists
    const script = buildScript || 'build'

    return `${packageManager} run ${script}`
  }

  getSourceFilePatterns() {
    return ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']
  }

  // ==================== Validation ====================

  getValidationCommands(config) {
    const { projectRoot, packageManager, packageJsonContent } = config

    const commands = []
    const pkg = packageJsonContent ? JSON.parse(packageJsonContent) : {}

    // 1. Prettier (optional)
    if (pkg.devDependencies?.prettier || pkg.dependencies?.prettier) {
      commands.push({
        name: 'prettier',
        command: `${packageManager} exec prettier --check "**/*.{ts,tsx,js,jsx}"`,
        optional: true
      })
    }

    // 2. ESLint (with --max-warnings=0 to treat warnings as errors)
    if (pkg.devDependencies?.eslint || pkg.dependencies?.eslint) {
      commands.push({
        name: 'eslint',
        command: `${packageManager} exec eslint . --max-warnings=0`,
        optional: false
      })
    }

    // 3. TypeScript type checking
    commands.push({
      name: 'tsc',
      command: `${packageManager} exec tsc --noEmit`,
      optional: false
    })

    return commands
  }

  // ==================== Resource Management ====================

  getResourceMultiplier() {
    // TypeScript builds use moderate resources
    // - tsc: ~1-2GB
    // - ESLint: ~500MB
    // - Build tools (Vite/Webpack): ~1-2GB
    return 1.5
  }

  getParallelExecutionStrategy(cpuCores) {
    return {
      maxWorkers: Math.max(1, cpuCores - 1),
      staggerDelay: 500,  // Small delay to avoid npm/pnpm lock contention
      requiresIsolation: false
    }
  }

  // ==================== Output Parsing ====================

  parseBuildOutput(output) {
    const errors = []
    const lines = output.split('\n')

    for (const line of lines) {
      // Match TypeScript errors
      // Format: "src/file.ts(42,15): error TS1234: message"
      // or: "src/file.ts:42:15 - error TS1234: message"
      const tsMatch1 = line.match(/(.+\.tsx?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)/)
      const tsMatch2 = line.match(/(.+\.tsx?):(\d+):(\d+)\s+-\s+(error|warning)\s+(TS\d+):\s+(.+)/)
      const tsMatch = tsMatch1 || tsMatch2

      if (tsMatch) {
        errors.push({
          file: tsMatch[1],
          line: parseInt(tsMatch[2]),
          column: parseInt(tsMatch[3]),
          severity: tsMatch[4],
          rule: tsMatch[5],
          message: tsMatch[6],
          type: tsMatch[4] === 'error' ? 'build-error' : 'warning'
        })
      }

      // Match Vite/Webpack build errors
      // Format: "ERROR in ./src/file.ts"
      // or: "✘ [ERROR] message [src/file.ts:42:15]"
      const viteMatch = line.match(/ERROR in (.+\.(?:ts|tsx|js|jsx))/)
      if (viteMatch) {
        errors.push({
          file: viteMatch[1],
          message: 'Build error',
          type: 'build-error'
        })
      }

      const esbuildMatch = line.match(/\[ERROR\]\s+(.+?)\s+\[(.+\.(?:ts|tsx|js|jsx)):(\d+):(\d+)\]/)
      if (esbuildMatch) {
        errors.push({
          message: esbuildMatch[1],
          file: esbuildMatch[2],
          line: parseInt(esbuildMatch[3]),
          column: parseInt(esbuildMatch[4]),
          type: 'build-error'
        })
      }
    }

    return { errors }
  }

  parseValidationOutput(output, validatorName) {
    const errors = []
    const lines = output.split('\n')

    if (validatorName === 'eslint') {
      // Parse ESLint errors
      // Format: "  /path/to/file.ts"
      //         "  42:15  error  message  rule-name"
      let currentFile = null

      for (const line of lines) {
        // Match file path
        const fileMatch = line.match(/^\s+(.+\.(?:ts|tsx|js|jsx))$/)
        if (fileMatch) {
          currentFile = fileMatch[1]
          continue
        }

        // Match error/warning
        const errorMatch = line.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([\w-]+)$/)
        if (errorMatch && currentFile) {
          errors.push({
            file: currentFile,
            line: parseInt(errorMatch[1]),
            column: parseInt(errorMatch[2]),
            severity: errorMatch[3],
            message: errorMatch[4],
            rule: errorMatch[5],
            type: errorMatch[3] === 'error' ? 'lint-error' : 'warning'
          })
        }
      }
    } else if (validatorName === 'prettier') {
      // Parse Prettier errors
      // Format: "src/file.ts"
      for (const line of lines) {
        const match = line.match(/^(.+\.(?:ts|tsx|js|jsx))$/)
        if (match) {
          errors.push({
            file: match[1],
            message: 'Code style issues',
            type: 'format-error'
          })
        }
      }
    } else if (validatorName === 'tsc') {
      // Parse TypeScript compiler errors
      // Format: "src/file.ts(42,15): error TS1234: message"
      for (const line of lines) {
        const match = line.match(/(.+\.tsx?)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)/)
        if (match) {
          errors.push({
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            severity: match[4],
            rule: match[5],
            message: match[6],
            type: match[4] === 'error' ? 'type-error' : 'warning'
          })
        }
      }
    }

    return { errors }
  }

  // ==================== Verification ====================

  getVerifyCommand(config) {
    const { packageManager, file } = config

    // For TypeScript, run tsc on the specific file
    return `${packageManager} exec tsc --noEmit "${file}"`
  }

  // ==================== Configuration ====================

  getDisplayName(config, projectRoot) {
    // Try to find git root to show relative path from repo root
    let gitRoot = null
    try {
      gitRoot = execSync('git rev-parse --show-toplevel', {
        cwd: projectRoot,
        encoding: 'utf-8'
      }).trim()
    } catch (error) {
      // Not in a git repo
    }

    // Calculate relative path from git root (or use basename if not in git)
    let displayPath
    if (gitRoot && projectRoot !== gitRoot) {
      displayPath = relative(gitRoot, projectRoot)
    } else {
      // Just use the folder name if at git root or not in git
      displayPath = basename(projectRoot)
    }

    return `${displayPath} (typescript)`
  }

  detectConfig(context) {
    const { packageJsonContent, fileExists } = context

    // Detect package manager
    let packageManager = 'npm'
    if (fileExists('pnpm-lock.yaml')) {
      packageManager = 'pnpm'
    } else if (fileExists('yarn.lock')) {
      packageManager = 'yarn'
    } else if (fileExists('bun.lockb')) {
      packageManager = 'bun'
    }

    // Detect build script
    let buildScript = 'build'
    if (packageJsonContent) {
      try {
        const pkg = JSON.parse(packageJsonContent)
        if (pkg.scripts) {
          // Check for common build script names
          if (pkg.scripts.build) {
            buildScript = 'build'
          } else if (pkg.scripts.compile) {
            buildScript = 'compile'
          } else if (pkg.scripts.dist) {
            buildScript = 'dist'
          }
        }
      } catch (error) {
        // Can't parse package.json
      }
    }

    return {
      packageManager,
      buildScript,
      packageJsonContent
    }
  }

  getDefaultConfig(projectRoot) {
    return {
      ...super.getDefaultConfig(projectRoot),
      packageManager: 'npm',
      buildScript: 'build'
    }
  }
}
