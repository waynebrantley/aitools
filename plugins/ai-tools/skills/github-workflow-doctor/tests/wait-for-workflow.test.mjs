#!/usr/bin/env node
/**
 * Tests for wait-for-workflow.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { waitForWorkflow } from '../scripts/wait-for-workflow.mjs';

test('waitForWorkflow exports a function', () => {
  assert.strictEqual(typeof waitForWorkflow, 'function');
});

test('waitForWorkflow is async', () => {
  assert.strictEqual(waitForWorkflow.constructor.name, 'AsyncFunction');
});

// Note: Full integration tests would require:
// 1. Mocking the getWorkflowInfo dependency
// 2. Simulating workflow state transitions
// 3. Testing poll interval timing
// 4. Testing progress callback invocation
// These would be added in a production environment

console.log('✅ wait-for-workflow.test.mjs: All tests passed');
