#!/usr/bin/env node
/**
 * Preview/demo for the github-workflow-doctor skill
 *
 * Demonstrates the skill by finding and watching actual workflows (read-only, no fixes)
 *
 * Usage:
 *   node preview.mjs [repo_path] [run_id]
 *   node preview.mjs [run_id]  (if in repo directory)
 *
 * Exit codes:
 *   0 - Success
 *   1 - Error occurred
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';

// Parse arguments - first arg could be repo path or run_id
let repoPath = process.cwd();
let runIdArg = null;

if (process.argv[2]) {
  // Check if first arg is a directory path
  const potentialPath = resolve(process.argv[2]);
  if (existsSync(potentialPath)) {
    repoPath = potentialPath;
    runIdArg = process.argv[3]; // run_id would be 3rd arg
  } else if (!isNaN(process.argv[2])) {
    runIdArg = process.argv[2]; // First arg is run_id
  } else {
    console.error(`❌ Invalid argument: ${process.argv[2]} is neither a valid directory nor a run_id`);
    process.exit(1);
  }
}

console.log('🏥 GitHub Workflow Doctor - Preview Mode\n');
console.log(`📂 Repository: ${repoPath}\n`);

// Helper to run commands in the repo directory
function runInRepo(command) {
  return execSync(command, { cwd: repoPath, encoding: 'utf-8' });
}

// Step 1: Find workflows
console.log('📋 Step 1: Finding workflows...\n');

let workflows = [];
try {
  const output = runInRepo('gh run list --limit 20 --json databaseId,status,conclusion,event,createdAt,displayTitle,headBranch,workflowName,url,startedAt');
  const runs = JSON.parse(output);
  // Include running, queued, AND failed workflows
  workflows = runs.filter(run =>
    run.status === 'in_progress' ||
    run.status === 'queued' ||
    (run.status === 'completed' && run.conclusion === 'failure')
  ).map(run => ({
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

if (workflows.length > 0) {
  workflows.forEach(wf => {
    let statusIcon;
    if (wf.status === 'in_progress') {
      statusIcon = '⏳';
    } else if (wf.status === 'queued') {
      statusIcon = '⏸️';
    } else if (wf.conclusion === 'failure') {
      statusIcon = '❌';
    } else {
      statusIcon = '⚪';
    }
    const elapsed = wf.started ? getElapsedTime(wf.started) : 'not started';
    const statusText = wf.status === 'completed' ? wf.conclusion : wf.status;
    console.log(`${statusIcon} [${wf.id}] ${wf.workflow} (${wf.branch}) - ${statusText} - ${elapsed}`);
  });
} else {
  console.log('No running or failed workflows found.');
}

if (workflows.length === 0) {
  console.log('\nℹ️  No running workflows. Checking recent workflows...\n');

  try {
    const output = runInRepo('gh run list --limit 20 --json databaseId,status,conclusion,event,createdAt,displayTitle,headBranch,workflowName,url,startedAt');
    const runs = JSON.parse(output);
    workflows = runs.map(run => ({
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

  if (workflows.length === 0) {
    console.log('❌ No workflows found in this repository.');
    console.log('\n💡 This repository needs GitHub Actions workflows to demonstrate the skill.');
    console.log('   The skill would normally:');
    console.log('   1. Show running AND failed workflows for you to choose');
    console.log('   2. If failed workflow selected: Skip to fix loop');
    console.log('   3. If running workflow selected: Track to completion');
    console.log('   4. Analyze failures and suggest/apply fixes');
    console.log('   5. Re-track after fixes (up to 3 attempts)\n');
    process.exit(0);
  }

  console.log(`Found ${workflows.length} recent workflow(s):`);
  workflows.slice(0, 5).forEach(wf => {
    const statusIcon = wf.conclusion === 'success' ? '✅' : wf.conclusion === 'failure' ? '❌' : '⏳';
    console.log(`${statusIcon} [${wf.id}] ${wf.workflow} (${wf.branch}) - ${wf.status}`);
  });
  console.log();
}

// Step 2: Pick first workflow (or use provided run_id)
const runId = runIdArg || workflows[0].id;
const workflow = workflows.find(w => w.id == runId) || workflows[0];

console.log(`\n🔍 Step 2: Checking workflow "${workflow.workflow}" (run #${workflow.id})...`);
console.log(`   Branch: ${workflow.branch}`);
console.log(`   Status: ${workflow.status}`);
console.log(`   URL: ${workflow.url}\n`);

// Step 3: Get current status
console.log('📊 Step 3: Determining workflow state...\n');

try {
  const statusOutput = runInRepo(
    `gh run view ${workflow.id} --json status,conclusion,displayTitle,startedAt,updatedAt`
  );
  const status = JSON.parse(statusOutput);

  if (status.conclusion === 'success') {
    console.log('✅ Workflow completed successfully!');
    console.log(`   Title: ${status.displayTitle}`);
    const duration = Math.floor((new Date(status.updatedAt) - new Date(status.startedAt)) / 1000);
    console.log(`   Duration: ${duration}s\n`);
    console.log('💡 Since this workflow passed, the skill would just report success and exit.\n');
  } else if (status.conclusion === 'failure') {
    console.log('❌ Workflow has already failed!');
    console.log(`   Title: ${status.displayTitle}`);
    console.log('\n⚡ Skipping tracking - going straight to fix loop...\n');

    console.log('🔍 Step 4: Analyzing failure (preview - not fetching actual logs)...\n');
    console.log('💡 In normal mode, the skill would:');
    console.log('   1. Fetch full workflow logs');
    console.log('   2. Identify failed jobs and steps');
    console.log('   3. Analyze error messages to find root cause');
    console.log('   4. Determine what files need changes');
    console.log('   5. Ask for confirmation if fix seems uncertain');
    console.log('   6. Make the fix and commit changes');
    console.log('   7. Push and track new workflow run (for push-triggered)');
    console.log('   8. Repeat up to 3 times if needed\n');
  } else if (status.status === 'in_progress' || status.status === 'queued') {
    console.log(`⏳ Workflow is currently ${status.status}`);
    console.log(`   Title: ${status.displayTitle}\n`);
    console.log('💡 In normal mode, the skill would:');
    console.log('   1. Poll every 15 seconds until completion');
    console.log('   2. Show progress updates');
    console.log('   3. Then proceed based on success/failure\n');
  } else {
    console.log(`ℹ️  Workflow status: ${status.status}, conclusion: ${status.conclusion || 'none'}\n`);
  }

} catch (error) {
  console.error('❌ Error checking workflow status:', error.message);
  console.log('\n💡 Make sure the gh CLI is installed and authenticated.\n');
  process.exit(1);
}

console.log('✨ Preview complete!\n');
console.log('📚 To use the actual skill:');
console.log(`   /github-workflow-doctor --run_id ${workflow.id}`);
console.log('   or');
console.log('   /github-workflow-doctor (to choose interactively)\n');

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
