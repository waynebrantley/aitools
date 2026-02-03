#!/usr/bin/env node
/**
 * List currently running GitHub workflows in the repository
 *
 * Usage:
 *   node list-running-workflows.mjs [--all] [--include-failed]
 *
 * Output: JSON array of workflows
 *
 * Exit codes:
 *   0 - Success
 *   1 - Failed to get workflows
 *   2 - Invalid usage
 */

import { execSync } from 'child_process';

/**
 * List workflows in the repository
 * @param {Object} options - Filter options
 * @param {boolean} options.includeAll - Include all recent workflows
 * @param {boolean} options.includeFailed - Include failed workflows
 * @returns {Array} Array of workflow runs
 */
export function listRunningWorkflows(options = {}) {
  const { includeAll = false, includeFailed = false } = options;

  try {
    const command = `gh run list --limit 20 --json databaseId,status,conclusion,event,createdAt,displayTitle,headBranch,workflowName,url,startedAt`;
    const output = execSync(command, { encoding: 'utf-8' });
    const runs = JSON.parse(output);

    let filtered;
    if (includeAll) {
      // All recent workflows
      filtered = runs;
    } else if (includeFailed) {
      // Running, queued, or failed workflows
      filtered = runs.filter(run =>
        run.status === 'in_progress' ||
        run.status === 'queued' ||
        (run.status === 'completed' && run.conclusion === 'failure')
      );
    } else {
      // Only running/queued workflows
      filtered = runs.filter(run => run.status === 'in_progress' || run.status === 'queued');
    }

    return filtered.map(run => ({
      id: run.databaseId,
      workflow: run.workflowName,
      status: run.status,
      conclusion: run.conclusion,
      branch: run.headBranch,
      title: run.displayTitle,
      event: run.event,
      started: run.startedAt,
      url: run.url
    }));
  } catch (error) {
    console.error('❌ Failed to list workflows:', error.message);
    process.exit(1);
  }
}

/**
 * Format workflow list for display
 * @param {Array} workflows - Array of workflow runs
 * @returns {string} Formatted text
 */
export function formatWorkflowList(workflows) {
  if (workflows.length === 0) {
    return 'No workflows found.';
  }

  const lines = workflows.map(wf => {
    let statusIcon;
    if (wf.status === 'in_progress') {
      statusIcon = '⏳';
    } else if (wf.status === 'queued') {
      statusIcon = '⏸️';
    } else if (wf.status === 'completed' && wf.conclusion === 'failure') {
      statusIcon = '❌';
    } else if (wf.status === 'completed' && wf.conclusion === 'success') {
      statusIcon = '✅';
    } else {
      statusIcon = '⚪';
    }

    const elapsed = wf.started ? getElapsedTime(wf.started) : 'not started';
    const statusText = wf.status === 'completed' ? `${wf.conclusion}` : wf.status;
    return `${statusIcon} [${wf.id}] ${wf.workflow} (${wf.branch}) - ${statusText} - ${elapsed}`;
  });

  return lines.join('\n');
}

/**
 * Calculate elapsed time from start
 * @param {string} startedAt - ISO timestamp
 * @returns {string} Human-readable elapsed time
 */
function getElapsedTime(startedAt) {
  const start = new Date(startedAt);
  const now = new Date();
  const seconds = Math.floor((now - start) / 1000);

  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

// CLI usage
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const options = {
    includeAll: process.argv.includes('--all'),
    includeFailed: process.argv.includes('--include-failed')
  };
  const workflows = listRunningWorkflows(options);

  // Output user-friendly message to stderr
  console.error(formatWorkflowList(workflows));

  // Output JSON to stdout for programmatic use
  console.log(JSON.stringify(workflows, null, 2));
}
