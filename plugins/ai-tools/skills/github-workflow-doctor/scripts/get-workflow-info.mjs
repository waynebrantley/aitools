#!/usr/bin/env node
/**
 * Get GitHub workflow run information
 *
 * Usage:
 *   node get-workflow-info.mjs <run-id>
 *   node get-workflow-info.mjs --latest [workflow-name]
 *
 * Output: JSON object with workflow run details
 *
 * Exit codes:
 *   0 - Success
 *   1 - Workflow not found or gh command failed
 *   2 - Invalid usage
 */

import { execSync } from 'child_process';

/**
 * Get workflow run information from GitHub
 * @param {string} runId - The workflow run ID or 'latest'
 * @param {string} [workflowName] - Optional workflow name when using 'latest'
 * @returns {object} Workflow run information
 */
export function getWorkflowInfo(runId, workflowName = null) {
  try {
    let command;

    if (runId === 'latest' || runId === '--latest') {
      // Get the latest workflow run
      if (workflowName) {
        command = `gh run list --workflow "${workflowName}" --limit 1 --json databaseId,status,conclusion,event,createdAt,displayTitle,headBranch,workflowName,url`;
      } else {
        command = `gh run list --limit 1 --json databaseId,status,conclusion,event,createdAt,displayTitle,headBranch,workflowName,url`;
      }

      const output = execSync(command, { encoding: 'utf-8' });
      const runs = JSON.parse(output);

      if (!runs || runs.length === 0) {
        throw new Error('No workflow runs found');
      }

      return runs[0];
    } else {
      // Get specific workflow run by ID
      command = `gh run view ${runId} --json databaseId,status,conclusion,event,createdAt,displayTitle,headBranch,workflowName,url,startedAt,updatedAt`;
      const output = execSync(command, { encoding: 'utf-8' });
      return JSON.parse(output);
    }
  } catch (error) {
    console.error('❌ Failed to get workflow info:', error.message);
    process.exit(1);
  }
}

// CLI usage
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node get-workflow-info.mjs <run-id|--latest> [workflow-name]');
    process.exit(2);
  }

  const runId = args[0];
  const workflowName = args[1] || null;

  const info = getWorkflowInfo(runId, workflowName);
  console.log(JSON.stringify(info, null, 2));
}
