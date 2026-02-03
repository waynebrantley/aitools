#!/usr/bin/env node

/**
 * Preview what build-doctor would do on a target project
 * Usage: node preview.mjs [/path/to/target/project]
 *
 * If no path is provided, uses the Git repository root or current directory.
 */

import { execSync } from 'child_process'
import { dirname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = join(__dirname, 'scripts')

/**
 * Find the Git repository root
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} Git repository root or null if not in a git repo
 */
function findGitRoot(startDir) {
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd: startDir,
      encoding: 'utf-8'
    }).trim()
    return gitRoot
  } catch (error) {
    return null
  }
}

// Get target project from command line, or use git root, or use cwd
let targetProject = process.argv[2]

if (!targetProject) {
  const gitRoot = findGitRoot(process.cwd())
  targetProject = gitRoot || process.cwd()

  if (gitRoot) {
    console.log(`📂 Using Git repository root: ${gitRoot}`)
    console.log()
  }
}

targetProject = resolve(targetProject)

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🏗️  Build Doctor - Preview Mode')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Target: ${targetProject}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()

try {
  // Step 1: Detect build environment
  console.log('📊 Step 1: Detecting build frameworks...')
  console.log()

  const detectScript = join(SCRIPTS_DIR, 'detect-build-environment.mjs')
  const detectOutput = execSync(`node "${detectScript}" "${targetProject}"`, {
    encoding: 'utf-8'
  })

  // Parse detection output (JSON array on last line)
  const frameworks = JSON.parse(detectOutput.trim().split('\n').pop())

  if (frameworks.length === 0) {
    console.error('❌ No build frameworks detected')
    process.exit(1)
  }

  // If multiple frameworks, let user know (for now, preview all of them)
  if (frameworks.length > 1) {
    console.log(`Found ${frameworks.length} build frameworks - previewing all:`)
    frameworks.forEach((fw, index) => {
      console.log(`  ${index + 1}. ${fw.displayName}`)
    })
    console.log()
    console.log('💡 Tip: When running the full skill, you can select which frameworks to fix')
    console.log()
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()

  // Preview each framework
  for (let i = 0; i < frameworks.length; i++) {
    const framework = frameworks[i]

    if (frameworks.length > 1) {
      console.log(`\n📦 Framework ${i + 1}/${frameworks.length}: ${framework.displayName}`)
      console.log()
    } else {
      console.log(`Previewing: ${framework.displayName}`)
      console.log()
    }

    // Step 2: Run build
    console.log('🔨 Step 2: Running build + validation...')
    console.log()

    const buildScript = join(SCRIPTS_DIR, 'run-build.mjs')
    const configJson = JSON.stringify(framework)

    try {
      execSync(`node "${buildScript}" '${configJson}'`, {
        cwd: framework.projectRoot,
        stdio: 'inherit',
        encoding: 'utf-8'
      })
    } catch (error) {
      // Exit code 1 is expected when build/validation fails - that's what we're looking for
      if (error.status !== 1) {
        // Unexpected error
        console.error('⚠️  Build encountered an unexpected error')
      }
    }

    console.log()
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log()

    // Step 3: Parse and display files that would be fixed
    console.log('📋 Step 3: Files that would be fixed:')
    console.log()

    const parseScript = join(SCRIPTS_DIR, 'parse-build-output.mjs')

    try {
      execSync(`node "${parseScript}" table`, {
        cwd: framework.projectRoot,
        stdio: 'inherit',
        encoding: 'utf-8'
      })
    } catch (error) {
      console.log('✅ No errors found in this framework!')
    }

    console.log()

    if (i < frameworks.length - 1) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    }
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Preview complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()
  console.log('Next steps:')
  console.log('  1. Run the build-doctor skill to fix errors')
  console.log('  2. Review the files with the most errors first')
  console.log('  3. Use parallel subagents for faster fixing')
  console.log()

} catch (error) {
  console.error('❌ Error during preview:', error.message)
  process.exit(1)
}
