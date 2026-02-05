#!/usr/bin/env node
/**
 * Detects the frontend directory and available tools
 * Usage: node detect-frontend-dir.mjs
 * Outputs JSON with: { frontendDir, hasPrettier, hasEslint, hasTsc }
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function detectFrontendDir() {
  // First check if current directory has frontend tests
  if (existsSync('package.json')) {
    const packageJson = readFileSync('package.json', 'utf-8');
    if (packageJson.match(/vitest|jest|vite/)) {
      return '.';
    }
  }

  // Search for subdirectories with package.json containing test frameworks
  try {
    const result = execSync(
      'find . -maxdepth 2 -name "package.json" -type f',
      { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }
    );

    const packageFiles = result.trim().split('\n');
    for (const pkgFile of packageFiles) {
      if (!pkgFile) continue;
      const content = readFileSync(pkgFile, 'utf-8');
      if (content.match(/vitest|jest|vite/)) {
        return dirname(pkgFile);
      }
    }
  } catch (error) {
    // find command failed or no files found
  }

  console.error('❌ Could not detect frontend directory with vitest/jest/vite');
  console.error('Please run this skill from the frontend directory');
  process.exit(1);
}

export function detectTools(frontendDir) {
  const packageJsonPath = join(frontendDir, 'package.json');

  if (!existsSync(packageJsonPath)) {
    console.error('❌ package.json not found in frontend directory');
    process.exit(1);
  }

  const packageJson = readFileSync(packageJsonPath, 'utf-8');

  const hasPrettier = packageJson.includes('"prettier"');
  const hasEslint = packageJson.includes('"eslint"');
  const hasTsc = packageJson.includes('"typescript"');

  // Verify required tools
  if (!hasEslint) {
    console.error('❌ eslint is required but not found in package.json');
    process.exit(1);
  }

  if (!hasTsc) {
    console.error('❌ typescript is required but not found in package.json');
    process.exit(1);
  }

  return { hasPrettier, hasEslint, hasTsc };
}

// Main execution (only when run directly) - normalize paths for cross-platform compatibility (Windows mixed slashes)
if (resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const frontendDir = detectFrontendDir();
  const tools = detectTools(frontendDir);

  console.error('✅ Frontend directory:', frontendDir);
  console.error('📦 Tools detected:');
  console.error('  ✓ eslint (required)');
  console.error('  ✓ typescript (required)');
  if (tools.hasPrettier) {
    console.error('  ✓ prettier (optional)');
  } else {
    console.error('  ✗ prettier (skipped - optional)');
  }

  // Output JSON to stdout for programmatic use
  console.log(JSON.stringify({
    frontendDir,
    hasPrettier: tools.hasPrettier,
    hasEslint: tools.hasEslint,
    hasTsc: tools.hasTsc
  }));
}
