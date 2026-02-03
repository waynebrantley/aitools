#!/usr/bin/env node

/**
 * .NET Build Framework Adapter
 *
 * Supports .NET projects and solutions:
 * - Solution files (*.sln)
 * - Project files (*.csproj)
 * - All project types (Web, Class Library, Console, etc.)
 *
 * Build process:
 * 1. Restore NuGet packages (dotnet restore)
 * 2. Build solution/project (dotnet build)
 * 3. Optional: Format code (dotnet format)
 *
 * Warning Policy:
 * - All warnings are treated as errors, except excluded warning codes
 * - Excluded by default: NU1902 (NuGet package vulnerabilities)
 * - These warnings often cannot be immediately fixed due to upstream dependencies
 */

import { BuildFrameworkAdapter } from './base-adapter.mjs'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'

export class DotNetAdapter extends BuildFrameworkAdapter {
  name = 'dotnet'
  displayName = '.NET Build'
  buildType = 'dotnet'

  // Excluded warning codes (warnings that should be ignored)
  // NU1902 = NuGet package vulnerabilities (cannot always be fixed immediately)
  // DX1000 = DevExpress evaluation license warning (requires commercial license)
  excludedWarnings = ['NU1902', 'DX1000']

  // ==================== Detection ====================

  canDetect(context) {
    const { glob } = context

    // Look for .sln, .slnx, or .csproj files
    const slnFiles = glob('**/*.sln')
    const slnxFiles = glob('**/*.slnx')
    const csprojFiles = glob('**/*.csproj')

    return slnFiles.length > 0 || slnxFiles.length > 0 || csprojFiles.length > 0
  }

  // ==================== Build Commands ====================

  getBuildCommand(config) {
    const { projectRoot, buildPath, solutionFile, projectFile } = config

    // Prefer solution file, then project file, then auto-detect
    const target = solutionFile || projectFile || buildPath || this._findBuildTarget(projectRoot)

    if (!target) {
      throw new Error('No .NET solution or project found')
    }

    // Return array of commands for sequential execution
    // Build Debug configuration first (most warnings appear here)
    // Release will be verified in final validation
    return [
      `dotnet restore "${target}"`,
      `dotnet build "${target}" --no-restore --configuration Debug`
    ]
  }

  getFinalBuildCommand(config) {
    const { projectRoot, buildPath, solutionFile, projectFile } = config

    // Prefer solution file, then project file, then auto-detect
    const target = solutionFile || projectFile || buildPath || this._findBuildTarget(projectRoot)

    if (!target) {
      throw new Error('No .NET solution or project found')
    }

    // For final validation, build both Debug and Release to ensure
    // all configurations are clean after fixing Debug warnings
    return [
      `dotnet restore "${target}"`,
      `dotnet build "${target}" --no-restore --configuration Debug`,
      `dotnet build "${target}" --no-restore --configuration Release`
    ]
  }

  getSourceFilePatterns() {
    return ['**/*.cs', '**/*.csproj', '**/*.sln']
  }

  // ==================== Validation ====================

  getValidationCommands(config) {
    const { projectRoot, solutionFile, projectFile, useDotnetFormat } = config

    const target = solutionFile || projectFile || this._findBuildTarget(projectRoot)

    if (!target) {
      return []
    }

    const commands = []

    // Only include dotnet format if it's used in GitHub workflows
    // or if explicitly configured
    if (useDotnetFormat) {
      commands.push({
        name: 'dotnet-format',
        command: `dotnet format "${target}" --verify-no-changes`,
        optional: false  // If we detected it's used, it should pass
      })
    }

    return commands
  }

  // ==================== Resource Management ====================

  getResourceMultiplier() {
    // .NET builds use significant resources
    // - Roslyn compiler: ~1-2GB
    // - NuGet restore: ~500MB
    // - Large solutions: 3-4GB
    return 2.0
  }

  getParallelExecutionStrategy(cpuCores) {
    return {
      maxWorkers: Math.max(1, Math.floor(cpuCores / 2)),  // .NET builds are CPU-intensive
      staggerDelay: 2000,  // Delay to avoid file lock contention
      requiresIsolation: false
    }
  }

  // ==================== Output Parsing ====================

  parseBuildOutput(output) {
    const errors = []
    const excludedWarnings = []
    const lines = output.split('\n')

    for (const line of lines) {
      // Match build errors/warnings
      // Format: "File.cs(42,15): error CS1234: message [Project.csproj]"
      // or: "/path/to/File.cs(42,15): error CS1234: message [Project.csproj]"
      const matchWin = line.match(/([A-Z]:\\[^(]+\.cs)\((\d+),(\d+)\):\s+(error|warning)\s+(CS\d+):\s+(.+?)\s+\[/)
      const matchUnix = line.match(/([/][^(]+\.cs)\((\d+),(\d+)\):\s+(error|warning)\s+(CS\d+):\s+(.+?)\s+\[/)
      const match = matchWin || matchUnix

      if (match) {
        const severity = match[4]
        const rule = match[5]

        // Track excluded warnings separately instead of skipping them
        if (severity === 'warning' && this.excludedWarnings.includes(rule)) {
          excludedWarnings.push({
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            severity: severity,
            rule: rule,
            message: match[6],
            type: 'excluded-warning'
          })
          continue
        }

        errors.push({
          file: match[1],
          line: parseInt(match[2]),
          column: parseInt(match[3]),
          severity: severity,
          rule: rule,
          message: match[6],
          type: severity === 'error' ? 'build-error' : 'warning'
        })
      }

      // Match NuGet warnings
      // Format: "Project.csproj : warning NU1234: message [Solution.sln]"
      const nugetMatchWin = line.match(/([A-Z]:\\[^:]+\.csproj)\s*:\s*warning\s+(NU\d+):\s+(.+?)\s+\[/)
      const nugetMatchUnix = line.match(/([/][^:]+\.csproj)\s*:\s*warning\s+(NU\d+):\s+(.+?)\s+\[/)
      const nugetMatch = nugetMatchWin || nugetMatchUnix

      if (nugetMatch) {
        const rule = nugetMatch[2]

        // Track excluded warnings separately instead of skipping them
        if (this.excludedWarnings.includes(rule)) {
          excludedWarnings.push({
            file: nugetMatch[1],
            severity: 'warning',
            rule: rule,
            message: nugetMatch[3],
            type: 'excluded-warning'
          })
          continue
        }

        errors.push({
          file: nugetMatch[1],
          severity: 'warning',
          rule: rule,
          message: nugetMatch[3],
          type: 'warning'
        })
      }

      // Match MSBuild errors (no line number)
      // Format: "error MSB1234: message"
      const msbuildMatch = line.match(/error\s+(MSB\d+):\s+(.+)/)
      if (msbuildMatch) {
        errors.push({
          rule: msbuildMatch[1],
          message: msbuildMatch[2],
          type: 'build-error'
        })
      }

      // Match CSC/build tool warnings
      // Format: "CSC : warning DX1000: message [Project.csproj]"
      const cscMatchWin = line.match(/CSC\s*:\s*warning\s+([A-Z]+\d+):\s+(.+?)\s+\[([A-Z]:\\[^\]]+\.csproj)\]/)
      const cscMatchUnix = line.match(/CSC\s*:\s*warning\s+([A-Z]+\d+):\s+(.+?)\s+\[([/][^\]]+\.csproj)\]/)
      const cscMatch = cscMatchWin || cscMatchUnix

      if (cscMatch) {
        const rule = cscMatch[1]

        // Track excluded warnings separately instead of skipping them
        if (this.excludedWarnings.includes(rule)) {
          excludedWarnings.push({
            file: cscMatch[3],
            severity: 'warning',
            rule: rule,
            message: cscMatch[2],
            type: 'excluded-warning'
          })
          continue
        }

        errors.push({
          file: cscMatch[3],
          severity: 'warning',
          rule: rule,
          message: cscMatch[2],
          type: 'warning'
        })
      }
    }

    return { errors, excludedWarnings }
  }

  parseValidationOutput(output, validatorName) {
    const errors = []

    if (validatorName === 'dotnet-format') {
      // Parse format violations
      // Example: "  File.cs(42,15): warning: Fix whitespace formatting"
      const lines = output.split('\n')

      for (const line of lines) {
        const match = line.match(/(.+\.cs)\((\d+),(\d+)\):\s+warning:\s+(.+)/)
        if (match) {
          errors.push({
            file: match[1],
            line: parseInt(match[2]),
            column: parseInt(match[3]),
            message: match[4],
            type: 'format-error'
          })
        }
      }
    }

    return { errors }
  }

  // ==================== Verification ====================

  getVerifyCommand(config) {
    const { projectRoot, file, solutionFile, projectFile } = config

    // .NET cannot compile individual files - must build entire solution/project
    // Return null to indicate verification should be deferred until final build
    return null
  }

  // ==================== Configuration ====================

  getDisplayName(config, projectRoot) {
    const { solutionFile, projectFile } = config

    // For .NET, show the solution or project file name
    if (solutionFile) {
      // Extract just the filename (e.g., "MyProject.sln")
      const fileName = solutionFile.split('/').pop().split('\\').pop()
      return `${fileName} (dotnet)`
    } else if (projectFile) {
      // Extract just the filename (e.g., "MyProject.csproj")
      const fileName = projectFile.split('/').pop().split('\\').pop()
      return `${fileName} (dotnet)`
    }

    // Fallback to generic name
    return this.displayName
  }

  detectConfig(context) {
    const { glob, fileExists, readFile } = context

    // Find solution files (prefer .sln/.slnx over .csproj)
    const slnFiles = glob('**/*.sln')
    const slnxFiles = glob('**/*.slnx')
    let solutionFile = null
    let projectFile = null
    let projectCount = 0

    // Prefer .sln, then .slnx
    if (slnFiles.length > 0) {
      solutionFile = slnFiles[0]
    } else if (slnxFiles.length > 0) {
      solutionFile = slnxFiles[0]
    }

    // If no solution file, look for project files
    if (!solutionFile) {
      const csprojFiles = glob('**/*.csproj').filter(file =>
        !file.includes('node_modules') && !file.includes('bin') && !file.includes('obj')
      )
      projectFile = csprojFiles.length > 0 ? csprojFiles[0] : null
      projectCount = csprojFiles.length
    }

    // Check GitHub workflows to see if dotnet format is used
    const useDotnetFormat = this._detectDotnetFormatUsage(context)

    return {
      solutionFile,
      projectFile,
      projectCount,
      useDotnetFormat
    }
  }

  getDefaultConfig(projectRoot) {
    return {
      ...super.getDefaultConfig(projectRoot),
      solutionFile: null,
      projectFile: null,
      useDotnetFormat: false
    }
  }

  // ==================== Private Helpers ====================

  /**
   * Check if dotnet format is used in GitHub workflows
   * @param {Object} context - Detection context
   * @returns {boolean} True if dotnet format is found in workflows
   */
  _detectDotnetFormatUsage(context) {
    const { glob, readFile } = context

    try {
      // Look for GitHub workflow files
      const workflowFiles = glob('.github/workflows/**/*.yml').concat(
        glob('.github/workflows/**/*.yaml')
      )

      for (const workflowFile of workflowFiles) {
        try {
          const content = readFile(workflowFile)
          // Check if the workflow runs dotnet format
          if (content.includes('dotnet format') || content.includes('dotnet-format')) {
            return true
          }
        } catch (error) {
          // Skip files we can't read
        }
      }
    } catch (error) {
      // Glob or read error
    }

    return false
  }

  _findBuildTarget(projectRoot) {
    try {
      // First, look for .sln or .slnx files (prefer solution files)
      const files = readdirSync(projectRoot)

      const slnFile = files.find(f => f.endsWith('.sln'))
      if (slnFile) {
        return join(projectRoot, slnFile)
      }

      const slnxFile = files.find(f => f.endsWith('.slnx'))
      if (slnxFile) {
        return join(projectRoot, slnxFile)
      }

      // Then, look for .csproj files (only if no solution file found)
      const csprojFile = files.find(f => f.endsWith('.csproj'))
      if (csprojFile) {
        return join(projectRoot, csprojFile)
      }

      // Search subdirectories (one level deep)
      for (const file of files) {
        const fullPath = join(projectRoot, file)
        try {
          const stat = readdirSync(fullPath, { withFileTypes: true })

          const subSln = stat.find(f => f.isFile() && f.name.endsWith('.sln'))
          if (subSln) {
            return join(fullPath, subSln.name)
          }

          const subSlnx = stat.find(f => f.isFile() && f.name.endsWith('.slnx'))
          if (subSlnx) {
            return join(fullPath, subSlnx.name)
          }

          const subCsproj = stat.find(f => f.isFile() && f.name.endsWith('.csproj'))
          if (subCsproj) {
            return join(fullPath, subCsproj.name)
          }
        } catch (error) {
          // Skip subdirectories we can't read
        }
      }
    } catch (error) {
      // Error reading directory
    }

    return null
  }
}
