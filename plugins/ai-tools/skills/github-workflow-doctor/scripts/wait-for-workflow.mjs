#!/usr/bin/env node
/**
 * Wait for a GitHub workflow run to complete
 *
 * Usage:
 *   node wait-for-workflow.mjs <run-id> [--poll-interval 15]
 *
 * Output: JSON object with final workflow status
 *
 * Exit codes:
 *   0 - Workflow completed (success or failure)
 *   1 - Error checking workflow status
 *   2 - Invalid usage
 */

import { getWorkflowInfo } from './get-workflow-info.mjs';
import { fileURLToPath } from 'url';

const DEFAULT_POLL_INTERVAL = 15; // seconds

/**
 * Wait for workflow to complete
 * @param {string} runId - The workflow run ID
 * @param {number} pollInterval - Seconds between status checks
 * @param {function} onProgress - Optional callback for progress updates
 * @returns {object} Final workflow status
 */
export async function waitForWorkflow(runId, pollInterval = DEFAULT_POLL_INTERVAL, onProgress = null) {
  const startTime = Date.now();
  let lastStatus = null;

  while (true) {
    const info = getWorkflowInfo(runId);

    // Report progress if status changed
    if (info.status !== lastStatus && onProgress) {
      onProgress(info);
      lastStatus = info.status;
    }

    // Check if workflow is complete
    if (info.status === 'completed') {
      const duration = Math.round((Date.now() - startTime) / 1000);
      return {
        ...info,
        duration,
        success: info.conclusion === 'success'
      };
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollInterval * 1000));
  }
}

// CLI usage
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node wait-for-workflow.mjs <run-id> [--poll-interval 15]');
    process.exit(2);
  }

  const runId = args[0];
  const pollIntervalIndex = args.indexOf('--poll-interval');
  const pollInterval = pollIntervalIndex !== -1 && args[pollIntervalIndex + 1]
    ? parseInt(args[pollIntervalIndex + 1], 10)
    : DEFAULT_POLL_INTERVAL;

  // Progress callback
  const onProgress = (info) => {
    const elapsed = Math.round((Date.now() - Date.now()) / 1000);
    console.error(`⏳ Status: ${info.status} (${info.workflowName})`);
  };

  waitForWorkflow(runId, pollInterval, onProgress)
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error('❌ Error waiting for workflow:', error.message);
      process.exit(1);
    });
}
