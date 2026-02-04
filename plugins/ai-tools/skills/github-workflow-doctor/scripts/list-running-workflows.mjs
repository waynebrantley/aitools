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
    const command = `gh run list --limit 20 --json databaseId,status,conclusion,event,createdAt,displayTitle,headBranch,workflowName,url,startedAt,number,actor`;
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
      runNumber: run.number,
      workflow: run.workflowName,
      status: run.status,
      conclusion: run.conclusion,
      branch: run.headBranch,
      title: run.displayTitle,
      event: run.event,
      actor: run.actor?.login || 'unknown',
      started: run.startedAt,
      url: run.url
    }));
  } catch (error) {
    console.error('❌ Failed to list workflows:', error.message);
    process.exit(1);
  }
}

/**
 * Format event type for display
 * @param {string} event - GitHub event type (e.g., 'pull_request', 'push')
 * @returns {string} Human-readable event name
 */
function formatEventType(event) {
  const eventMap = {
    'pull_request': 'Pull request',
    'push': 'Push',
    'workflow_dispatch': 'Manual run',
    'schedule': 'Scheduled',
    'release': 'Release',
    'issues': 'Issue',
    'issue_comment': 'Issue comment',
    'merge_group': 'Merge group'
  };
  return eventMap[event] || event;
}

/**
 * Get status icon for workflow
 * @param {Object} wf - Workflow object
 * @returns {string} Status emoji
 */
function getStatusIcon(wf) {
  if (wf.status === 'in_progress') return '⏳';
  if (wf.status === 'queued') return '⏸️';
  if (wf.status === 'completed' && wf.conclusion === 'failure') return '❌';
  if (wf.status === 'completed' && wf.conclusion === 'success') return '✅';
  return '⚪';
}

/**
 * Format a timestamp for display
 * @param {string} timestamp - ISO timestamp
 * @returns {string} Human-readable time (e.g., "2:34 PM")
 */
function formatTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

/**
 * Format a single workflow for display
 * @param {Object} wf - Workflow object
 * @returns {string} Formatted workflow string (2 lines)
 */
export function formatWorkflowDisplay(wf) {
  const statusIcon = getStatusIcon(wf);
  const eventDisplay = formatEventType(wf.event);
  const elapsed = wf.started ? getElapsedTime(wf.started) : 'not started';
  const triggerTime = wf.started ? formatTime(wf.started) : '';

  // Line 1: Status icon + display title
  const line1 = `${statusIcon} ${wf.title}`;

  // Line 2: workflow name #runNumber: event by actor at time (elapsed)
  const timePart = triggerTime ? ` at ${triggerTime}` : '';
  const line2 = `   ${wf.workflow} #${wf.runNumber}: ${eventDisplay} by ${wf.actor}${timePart} (${elapsed})`;

  return `${line1}\n${line2}`;
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

  return workflows.map(wf => formatWorkflowDisplay(wf)).join('\n\n');
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
