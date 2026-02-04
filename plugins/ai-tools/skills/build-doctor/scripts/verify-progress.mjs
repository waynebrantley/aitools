#!/usr/bin/env node

/**
 * Verify that all files with errors have been processed
 *
 * Compares the initial list of files with errors against the list of files
 * that have been fixed, and reports any files that still need attention.
 *
 * Usage: node verify-progress.mjs <initial-files.txt> <fixed-files.txt>
 *
 * File formats:
 *   - initial-files.txt: One file path per line (files that had errors)
 *   - fixed-files.txt: One file path per line (files that were fixed)
 *
 * Output:
 *   ✅ All files processed (X/X fixed)
 *   or
 *   ⚠️  Files still need attention (X/Y fixed):
 *      - src/component.ts
 *      - src/utils.ts
 *
 * Exit codes:
 *   0 - All files processed
 *   1 - Files still need attention or error
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'

/**
 * Read file list from text file (one path per line)
 * @param {string} filePath - Path to file
 * @returns {Set} Set of file paths
 */
function readFileList(filePath) {
  if (!existsSync(filePath)) {
    return new Set()
  }

  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)

  return new Set(lines)
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2)

  if (args.length < 2) {
    console.error('❌ Error: Missing arguments')
    console.error('Usage: node verify-progress.mjs <initial-files.txt> <fixed-files.txt>')
    process.exit(1)
  }

  const initialFilesPath = args[0]
  const fixedFilesPath = args[1]

  // Read file lists
  const initialFiles = readFileList(initialFilesPath)
  const fixedFiles = readFileList(fixedFilesPath)

  if (initialFiles.size === 0) {
    console.error('⚠️  Warning: No initial files found')
    console.error('   This might indicate that no files had errors, or the file list is missing.')
    process.exit(0)
  }

  // Find files that still need attention
  const remainingFiles = new Set([...initialFiles].filter(file => !fixedFiles.has(file)))

  // Output results
  console.log('')
  if (remainingFiles.size === 0) {
    console.log(`✅ All files processed (${fixedFiles.size}/${initialFiles.size} fixed)`)
    console.log('')
    process.exit(0)
  } else {
    console.log(`⚠️  Files still need attention (${fixedFiles.size}/${initialFiles.size} fixed):`)
    console.log('')

    const sortedRemaining = Array.from(remainingFiles).sort()
    for (const file of sortedRemaining) {
      console.log(`   - ${file}`)
    }

    console.log('')
    console.log(`Remaining: ${remainingFiles.size} files`)
    console.log('')

    process.exit(1)
  }
}

// Execute
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main()
}

export { readFileList }
