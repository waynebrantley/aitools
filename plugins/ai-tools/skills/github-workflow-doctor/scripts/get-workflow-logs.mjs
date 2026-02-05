#!/usr/bin/env node
/**
 * Get GitHub workflow run logs for failed jobs
 *
 * Usage:
 *   node get-workflow-logs.mjs <run-id>
 *
 * Output: JSON object with failed job logs
 *
 * Exit codes:
 *   0 - Success
 *   1 - Failed to get logs
 *   2 - Invalid usage
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { resolve } from 'path';

/**
 * Get failed job information from a workflow run
 * @param {string} runId - The workflow run ID
 * @returns {Array} Array of failed jobs with their details
 */
export function getFailedJobs(runId) {
  try {
    const command = `gh run view ${runId} --json jobs`;
    const output = execSync(command, { encoding: 'utf-8' });
    const data = JSON.parse(output);

    // Filter for failed jobs
    const failedJobs = data.jobs.filter(job =>
      job.conclusion === 'failure' || job.conclusion === 'timed_out' || job.conclusion === 'cancelled'
    );

    return failedJobs.map(job => ({
      id: job.databaseId,
      name: job.name,
      conclusion: job.conclusion,
      url: job.url,
      steps: job.steps
    }));
  } catch (error) {
    console.error('❌ Failed to get job information:', error.message);
    process.exit(1);
  }
}

/**
 * Get logs for a specific job
 * @param {string} runId - The workflow run ID
 * @param {string} jobId - The job ID
 * @returns {string} Job logs
 */
export function getJobLogs(runId, jobId) {
  try {
    // Get the full log for the run and extract the specific job
    const command = `gh run view ${runId} --log`;
    const output = execSync(command, { encoding: 'utf-8' });
    return output;
  } catch (error) {
    console.error('❌ Failed to get job logs:', error.message);
    process.exit(1);
  }
}

/**
 * Get workflow failure information with logs
 * @param {string} runId - The workflow run ID
 * @returns {object} Failure details with logs
 */
export function getWorkflowLogs(runId) {
  const failedJobs = getFailedJobs(runId);

  if (failedJobs.length === 0) {
    return {
      runId,
      failedJobs: [],
      logs: null,
      message: 'No failed jobs found'
    };
  }

  // Get logs for the workflow run
  const logs = getJobLogs(runId, failedJobs[0].id);

  // Extract failed steps from each job
  const failureDetails = failedJobs.map(job => {
    const failedSteps = job.steps.filter(step =>
      step.conclusion === 'failure' || step.conclusion === 'timed_out'
    );

    return {
      jobName: job.name,
      jobId: job.id,
      conclusion: job.conclusion,
      url: job.url,
      failedSteps: failedSteps.map(step => ({
        name: step.name,
        conclusion: step.conclusion,
        number: step.number
      }))
    };
  });

  return {
    runId,
    failedJobs: failureDetails,
    logs,
    summary: `${failedJobs.length} job(s) failed`
  };
}

// CLI usage - normalize paths for cross-platform compatibility (Windows mixed slashes)
if (resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: node get-workflow-logs.mjs <run-id>');
    process.exit(2);
  }

  const runId = args[0];
  const result = getWorkflowLogs(runId);
  console.log(JSON.stringify(result, null, 2));
}
