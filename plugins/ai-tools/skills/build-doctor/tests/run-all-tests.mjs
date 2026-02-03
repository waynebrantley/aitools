#!/usr/bin/env node

/**
 * Run all build-doctor tests
 *
 * Usage: node run-all-tests.mjs
 *
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
 */

import { execSync } from 'child_process'
import { readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

console.log('🧪 Running all build-doctor tests...')
console.log('')

let failedTests = []
let passedTests = []

// Find all test files
function findTestFiles(dir) {
  const files = []
  const entries = readdirSync(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      files.push(...findTestFiles(fullPath))
    } else if (entry.isFile() && entry.name.endsWith('.test.mjs')) {
      files.push(fullPath)
    }
  }

  return files
}

const testFiles = findTestFiles(__dirname)

console.log(`Found ${testFiles.length} test files`)
console.log('')

// Run each test file
for (const testFile of testFiles) {
  const testName = testFile.replace(__dirname + '/', '')

  try {
    console.log(`Running: ${testName}`)
    execSync(`node "${testFile}"`, {
      cwd: __dirname,
      encoding: 'utf-8',
      stdio: 'inherit'
    })
    passedTests.push(testName)
  } catch (error) {
    console.error(`❌ Failed: ${testName}`)
    failedTests.push(testName)
  }

  console.log('')
}

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('Test Summary')
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
console.log('')
console.log(`✅ Passed: ${passedTests.length}`)
console.log(`❌ Failed: ${failedTests.length}`)
console.log('')

if (failedTests.length > 0) {
  console.log('Failed tests:')
  for (const test of failedTests) {
    console.log(`  - ${test}`)
  }
  console.log('')
  process.exit(1)
} else {
  console.log('🎉 All tests passed!')
  console.log('')
  process.exit(0)
}
