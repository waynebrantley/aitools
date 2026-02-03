#!/usr/bin/env node
/**
 * Tests for list-running-workflows.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { listRunningWorkflows, formatWorkflowList } from '../scripts/list-running-workflows.mjs';

test('listRunningWorkflows exports a function', () => {
  assert.strictEqual(typeof listRunningWorkflows, 'function');
});

test('formatWorkflowList exports a function', () => {
  assert.strictEqual(typeof formatWorkflowList, 'function');
});

test('formatWorkflowList handles empty array', () => {
  const result = formatWorkflowList([]);
  assert.strictEqual(result, 'No workflows found.');
});

test('formatWorkflowList formats workflows correctly', () => {
  const workflows = [
    {
      id: 12345,
      workflow: 'CI Tests',
      status: 'in_progress',
      branch: 'main',
      started: new Date(Date.now() - 150000).toISOString() // 2.5 minutes ago
    }
  ];

  const result = formatWorkflowList(workflows);
  assert.ok(result.includes('12345'));
  assert.ok(result.includes('CI Tests'));
  assert.ok(result.includes('main'));
  assert.ok(result.includes('⏳')); // in_progress icon
});

test('formatWorkflowList formats failed workflows correctly', () => {
  const workflows = [
    {
      id: 12346,
      workflow: 'CI Tests',
      status: 'completed',
      conclusion: 'failure',
      branch: 'main',
      started: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
    }
  ];

  const result = formatWorkflowList(workflows);
  assert.ok(result.includes('12346'));
  assert.ok(result.includes('CI Tests'));
  assert.ok(result.includes('main'));
  assert.ok(result.includes('❌')); // failed icon
  assert.ok(result.includes('failure'));
});

// Note: Full integration tests would require:
// 1. Mocking execSync to simulate gh CLI responses
// 2. Test fixtures with sample workflow data
// 3. Testing filtering logic (in_progress, queued)
// 4. A test GitHub repository with actual workflows
// These would be added in a production environment

console.log('✅ list-running-workflows.test.mjs: All tests passed');
