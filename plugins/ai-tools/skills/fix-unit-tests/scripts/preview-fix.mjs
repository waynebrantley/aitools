#!/usr/bin/env node

/**
 * Preview what fix-unit-tests would do on a target project
 * Usage: node preview-fix.mjs /path/to/target/project
 */

import { execSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SCRIPTS_DIR = __dirname

// Get target project from command line
const targetProject = process.argv[2] || process.cwd()

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('🔍 Fix Unit Tests - Preview Mode')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log(`Target: ${targetProject}`)
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log()

try {
  // Step 1: Detect test environment
  console.log('📊 Step 1: Detecting test frameworks...')
  console.log()

  const detectScript = join(SCRIPTS_DIR, 'detect-test-environment.mjs')
  const detectOutput = execSync(`node "${detectScript}" "${targetProject}"`, {
    encoding: 'utf-8'
  })

  // Parse detection output (JSON array on last line before stderr)
  const frameworks = JSON.parse(detectOutput.trim().split('\n').find(line => line.startsWith('[')))

  if (frameworks.length === 0) {
    console.error('❌ No test frameworks detected')
    process.exit(1)
  }

  // If multiple frameworks, let user know (for now, preview all of them)
  if (frameworks.length > 1) {
    console.log(`Found ${frameworks.length} test frameworks - previewing all:`)
    frameworks.forEach((fw, index) => {
      console.log(`  ${index + 1}. ${fw.displayName} (${fw.testType})`)
    })
    console.log()
    console.log('💡 Tip: In the future, you can specify --framework=<name> to preview just one')
    console.log()
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()

  // For now, preview the first framework (TODO: support multiple or let user choose)
  const selectedFramework = frameworks[0]
  console.log(`Previewing: ${selectedFramework.displayName}`)
  console.log()

  // Step 2: Run discovery
  console.log('📊 Step 2: Running discovery (tests + validation)...')
  console.log()

  const discoveryScript = join(SCRIPTS_DIR, 'run-discovery.mjs')
  try {
    execSync(`node "${discoveryScript}"`, {
      cwd: targetProject,
      stdio: 'inherit',
      encoding: 'utf-8'
    })
  } catch (error) {
    // Exit code 1 is expected when tests/validation fail - that's what we're looking for
    if (error.status !== 1) {
      throw error
    }
  }

  console.log()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()

  // Step 3: Parse and display files that would be fixed
  console.log('📋 Step 3: Files that would be fixed:')
  console.log()

  const parseScript = join(SCRIPTS_DIR, 'parse-validate-output.mjs')
  const testOutputPath = join(targetProject, 'test-output.txt')
  const validateOutputPath = join(targetProject, 'validate-output.txt')

  execSync(`cat "${testOutputPath}" "${validateOutputPath}" | node "${parseScript}" table`, {
    cwd: targetProject,
    stdio: 'inherit',
    encoding: 'utf-8',
    shell: '/bin/bash'
  })

  console.log()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log()

  // Step 4: Find skipped tests
  console.log('⏭️  Step 4: Skipped tests:')
  console.log()

  const skippedScript = join(SCRIPTS_DIR, 'find-skipped-tests.mjs')
  execSync(`node "${skippedScript}"`, {
    cwd: targetProject,
    stdio: 'inherit',
    encoding: 'utf-8'
  })

  console.log()
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ Preview complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

} catch (error) {
  console.error('❌ Error during preview:', error.message)
  process.exit(1)
}
