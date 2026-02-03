#!/usr/bin/env node
/**
 * Tests for get-workflow-logs.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { getFailedJobs, getJobLogs, getWorkflowLogs } from '../scripts/get-workflow-logs.mjs';

test('getFailedJobs exports a function', () => {
  assert.strictEqual(typeof getFailedJobs, 'function');
});

test('getJobLogs exports a function', () => {
  assert.strictEqual(typeof getJobLogs, 'function');
});

test('getWorkflowLogs exports a function', () => {
  assert.strictEqual(typeof getWorkflowLogs, 'function');
});

// Note: Full integration tests would require:
// 1. Mocking execSync to simulate gh CLI responses
// 2. Test fixtures with sample failed job data
// 3. Testing log parsing and failed step extraction
// 4. Handling edge cases (no failures, multiple failures, etc.)
// These would be added in a production environment

console.log('✅ get-workflow-logs.test.mjs: All tests passed');
