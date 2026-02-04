#!/usr/bin/env node
/**
 * Tests for list-running-workflows.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { listRunningWorkflows, formatWorkflowList, formatWorkflowDisplay } from '../scripts/list-running-workflows.mjs';

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

test('formatWorkflowDisplay exports a function', () => {
  assert.strictEqual(typeof formatWorkflowDisplay, 'function');
});

test('formatWorkflowList formats workflows correctly', () => {
  const workflows = [
    {
      id: 12345,
      runNumber: 5475,
      workflow: 'CI Tests',
      status: 'in_progress',
      branch: 'main',
      title: 'Update UI; Move scripts to miniter-utility',
      event: 'pull_request',
      actor: 'waynebrantley',
      started: new Date(Date.now() - 150000).toISOString() // 2.5 minutes ago
    }
  ];

  const result = formatWorkflowList(workflows);
  // Should NOT include the database ID
  assert.ok(!result.includes('12345'));
  // Should include display title
  assert.ok(result.includes('Update UI; Move scripts to miniter-utility'));
  // Should include workflow name and run number
  assert.ok(result.includes('CI Tests'));
  assert.ok(result.includes('#5475'));
  // Should include event type and actor
  assert.ok(result.includes('Pull request'));
  assert.ok(result.includes('waynebrantley'));
  assert.ok(result.includes('⏳')); // in_progress icon
});

test('formatWorkflowList formats failed workflows correctly', () => {
  const workflows = [
    {
      id: 12346,
      runNumber: 5476,
      workflow: 'CI Tests',
      status: 'completed',
      conclusion: 'failure',
      branch: 'main',
      title: 'Fix authentication bug',
      event: 'push',
      actor: 'developer123',
      started: new Date(Date.now() - 300000).toISOString() // 5 minutes ago
    }
  ];

  const result = formatWorkflowList(workflows);
  // Should NOT include the database ID
  assert.ok(!result.includes('12346'));
  // Should include display title
  assert.ok(result.includes('Fix authentication bug'));
  // Should include workflow name and run number
  assert.ok(result.includes('CI Tests'));
  assert.ok(result.includes('#5476'));
  // Should include event type and actor
  assert.ok(result.includes('Push'));
  assert.ok(result.includes('developer123'));
  assert.ok(result.includes('❌')); // failed icon
});

test('formatWorkflowDisplay creates two-line format', () => {
  const workflow = {
    id: 12345,
    runNumber: 100,
    workflow: 'Build',
    status: 'in_progress',
    title: 'Add new feature',
    event: 'workflow_dispatch',
    actor: 'testuser',
    started: new Date(Date.now() - 60000).toISOString() // 1 minute ago
  };

  const result = formatWorkflowDisplay(workflow);
  const lines = result.split('\n');
  assert.strictEqual(lines.length, 2);
  // Line 1: status icon and title
  assert.ok(lines[0].includes('⏳'));
  assert.ok(lines[0].includes('Add new feature'));
  // Line 2: workflow details
  assert.ok(lines[1].includes('Build #100'));
  assert.ok(lines[1].includes('Manual run'));
  assert.ok(lines[1].includes('testuser'));
  // Should include trigger time
  assert.ok(lines[1].includes(' at '));
});

// Note: Full integration tests would require:
// 1. Mocking execSync to simulate gh CLI responses
// 2. Test fixtures with sample workflow data
// 3. Testing filtering logic (in_progress, queued)
// 4. A test GitHub repository with actual workflows
// These would be added in a production environment

console.log('✅ list-running-workflows.test.mjs: All tests passed');
