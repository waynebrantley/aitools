#!/usr/bin/env node
/**
 * Runs final validation: all tests + full validation
 * Usage: node run-final-validation.mjs
 * Requires: Must be run from frontend directory
 * Exit codes: 0 if all pass, 1 if failures remain
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runCommand(cmd, description) {
  console.error(`\n${description}...`);
  try {
    execSync(cmd, {
      encoding: 'utf-8',
      stdio: 'inherit'
    });
    return 0;
  } catch (error) {
    return error.status || 1;
  }
}

console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.error('🎯 Final Validation');
console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Step 1: Run ALL unit tests
const testExitCode = runCommand(
  'pnpm exec vitest run --config vitest.config.ts',
  'Step 1: Running ALL unit tests'
);

// Step 2: Run full validation
const validateExitCode = runCommand(
  `node ${join(__dirname, 'run-validation.mjs')}`,
  'Step 2: Running full validation (format + lint + type-check)'
);

// Summary
console.error('');
console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.error('Validation Results');
console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

if (testExitCode === 0) {
  console.error('✅ All tests passing');
} else {
  console.error('❌ Test failures detected');
}

if (validateExitCode === 0) {
  console.error('✅ Zero type errors');
  console.error('✅ Zero lint errors');
  console.error('✅ Zero format issues');
} else {
  console.error('❌ Validation errors detected');
}

console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Exit with failure if either check failed
if (testExitCode !== 0 || validateExitCode !== 0) {
  console.error('');
  console.error('⚠️  Final validation FAILED - issues remain');
  console.error('Review output above to identify regressed files');
  process.exit(1);
}

console.error('');
console.error('🎉 Final validation PASSED - all checks green!');
process.exit(0);
