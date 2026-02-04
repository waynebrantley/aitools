#!/usr/bin/env node
/**
 * Verifies progress by comparing initial file count with fixed file count
 * Usage: node verify-progress.mjs <initial-files-list> <fixed-files-list>
 * Arguments:
 *   initial-files-list - Path to file containing list of initial files with errors
 *   fixed-files-list - Path to file containing list of fixed files
 * Outputs: Progress report and remaining files
 * Exit codes: 0 if all files processed, 1 if files remain
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

export function readFileList(filePath) {
  try {
    return readFileSync(filePath, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  } catch (error) {
    console.error(`❌ Error reading ${filePath}:`, error.message);
    process.exit(2);
  }
}

export function calculateProgress(initialFiles, fixedFiles) {
  const initialCount = initialFiles.length;
  const fixedCount = fixedFiles.size;
  const remaining = initialFiles.filter(file => !fixedFiles.has(file));
  const percentage = initialCount > 0 ? Math.round(fixedCount / initialCount * 100) : 0;

  return {
    initialCount,
    fixedCount,
    remaining,
    percentage,
    allProcessed: fixedCount >= initialCount
  };
}

// Main execution
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length < 4) {
    console.error('Usage: node verify-progress.mjs <initial-files-list> <fixed-files-list>');
    process.exit(2);
  }

  const initialFilesPath = process.argv[2];
  const fixedFilesPath = process.argv[3];

  const initialFiles = readFileList(initialFilesPath);
  const fixedFiles = new Set(readFileList(fixedFilesPath));

  const progress = calculateProgress(initialFiles, fixedFiles);

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Progress Verification');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Initial files with errors: ${progress.initialCount}`);
  console.log(`Files fixed: ${progress.fixedCount}`);
  console.log(`Progress: ${progress.fixedCount}/${progress.initialCount} (${progress.percentage}%)`);

  if (!progress.allProcessed) {
    console.log('');
    console.log('⚠️  WARNING: Not all files have been processed!');
    console.log('');
    console.log('Remaining files:');

    progress.remaining.forEach(file => {
      console.log(`  • ${file}`);
    });

    console.log('');
    console.log(`Total remaining: ${progress.remaining.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    process.exit(1);
  } else {
    console.log('');
    console.log('✅ All files have been processed!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(0);
  }
}
