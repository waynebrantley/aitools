#!/usr/bin/env node

/**
 * Run all tests across all skills
 *
 * Usage: node run-all-tests.mjs
 *
 * Exit codes:
 *   0 - All tests passed
 *   1 - One or more tests failed
 */

import { execSync } from 'child_process';
import { readdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = __dirname;

function findTestFiles(dir) {
  const testFiles = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        testFiles.push(...findTestFiles(fullPath));
      } else if (entry.endsWith('.test.mjs') || entry.endsWith('.test.js')) {
        testFiles.push(fullPath);
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return testFiles;
}

function runTests() {
  console.error('🔍 Discovering test files...\n');

  const skills = readdirSync(SKILLS_DIR)
    .filter(entry => {
      const fullPath = join(SKILLS_DIR, entry);
      return statSync(fullPath).isDirectory() && !entry.startsWith('.');
    });

  const allTestFiles = [];
  const skillTestCounts = new Map();

  for (const skill of skills) {
    const skillPath = join(SKILLS_DIR, skill);
    const testFiles = findTestFiles(skillPath);

    if (testFiles.length > 0) {
      allTestFiles.push(...testFiles);
      skillTestCounts.set(skill, testFiles.length);
    }
  }

  if (allTestFiles.length === 0) {
    console.error('⚠️  No test files found');
    process.exit(0);
  }

  console.error(`📋 Found ${allTestFiles.length} test files across ${skillTestCounts.size} skills:\n`);
  for (const [skill, count] of skillTestCounts) {
    console.error(`   ${skill}: ${count} test file${count === 1 ? '' : 's'}`);
  }
  console.error('');

  let failedTests = [];
  let passedTests = 0;

  for (const testFile of allTestFiles) {
    const relativePath = testFile.replace(SKILLS_DIR + '/', '');

    try {
      console.error(`▶ Running ${relativePath}...`);
      execSync(`node "${testFile}"`, {
        stdio: ['inherit', 'inherit', 'inherit'],
        encoding: 'utf-8'
      });
      passedTests++;
      console.error('');
    } catch (error) {
      failedTests.push(relativePath);
      console.error(`❌ Failed: ${relativePath}\n`);
    }
  }

  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error(`📊 Test Summary`);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.error(`✅ Passed: ${passedTests}/${allTestFiles.length}`);

  if (failedTests.length > 0) {
    console.error(`❌ Failed: ${failedTests.length}/${allTestFiles.length}`);
    console.error('\nFailed tests:');
    failedTests.forEach(test => console.error(`  - ${test}`));
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    process.exit(1);
  }

  console.error(`\n🎉 All tests passed!`);
  console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

runTests();
