#!/usr/bin/env node
/**
 * Quick merge readiness check for a pull request.
 *
 * Usage:
 *   node check-merge-readiness.mjs [pr_number]
 *   node check-merge-readiness.mjs 142
 *   node check-merge-readiness.mjs --json
 */

import { execSync } from 'child_process';

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch { return null; }
}

function runJson(cmd) {
  const output = run(cmd);
  if (!output) return null;
  try { return JSON.parse(output); } catch { return null; }
}

const args = process.argv.slice(2);
const prNumber = args.find(a => !a.startsWith('--'));
const jsonOutput = args.includes('--json');

try {
  // Get PR info
  let pr;
  if (prNumber) {
    pr = runJson(`gh pr view ${prNumber} --json number,title,state,mergeable,reviewDecision,mergeStateStatus,headRefName,baseRefName`);
  } else {
    const branch = run('git rev-parse --abbrev-ref HEAD');
    if (!branch) { console.error('Not in a git repository'); process.exit(1); }
    pr = runJson(`gh pr view "${branch}" --json number,title,state,mergeable,reviewDecision,mergeStateStatus,headRefName,baseRefName`);
  }

  if (!pr) { console.error('No PR found'); process.exit(1); }

  // Check workflows
  const workflowRuns = runJson(`gh run list --branch "${pr.headRefName}" --limit 10 --json name,status,conclusion`) || [];
  const latestRuns = new Map();
  for (const r of workflowRuns) {
    if (!latestRuns.has(r.name)) latestRuns.set(r.name, r);
  }
  const failedRuns = [...latestRuns.values()].filter(r => r.conclusion === 'failure');
  const runningRuns = [...latestRuns.values()].filter(r => r.status === 'in_progress');
  const workflowsPassing = failedRuns.length === 0 && runningRuns.length === 0 && latestRuns.size > 0;

  // Check reviews
  const reviewApproved = pr.reviewDecision === 'APPROVED';
  const reviewStatus = pr.reviewDecision?.toLowerCase() || 'pending';

  // Check conflicts
  const noConflicts = pr.mergeable === 'MERGEABLE';

  // Check unresolved comments
  const comments = runJson(`gh api "/repos/{owner}/{repo}/pulls/${pr.number}/comments"`) || [];
  const rootComments = comments.filter(c => !c.in_reply_to_id);

  // Determine resolution heuristic: a root comment is "resolved" if a reply
  // contains a resolution keyword.
  const resolutionKeywords = ['done', 'fixed', 'resolved', 'addressed', 'will do', 'good catch', 'updated', 'changed'];
  let unresolvedCount = 0;
  for (const root of rootComments) {
    const replies = comments.filter(c => c.in_reply_to_id === root.id);
    const resolved = replies.some(r => {
      const body = (r.body || '').toLowerCase();
      return resolutionKeywords.some(kw => body.includes(kw));
    });
    if (!resolved) unresolvedCount++;
  }
  const commentsResolved = unresolvedCount === 0;

  const checks = {
    no_conflicts: noConflicts,
    reviews_approved: reviewApproved,
    workflows_passing: workflowsPassing,
    comments_resolved: commentsResolved,
  };

  const ready = Object.values(checks).every(Boolean);

  if (jsonOutput) {
    console.log(JSON.stringify({
      pr: { number: pr.number, title: pr.title, state: pr.state },
      checks,
      workflows: {
        total: latestRuns.size,
        failed: failedRuns.length,
        running: runningRuns.length,
        failed_names: failedRuns.map(r => r.name),
      },
      reviews: { status: reviewStatus },
      comments: { unresolved: unresolvedCount },
      ready,
    }, null, 2));
  } else {
    console.log(`PR #${pr.number} Merge Readiness:`);
    console.log(`- [${noConflicts ? 'x' : ' '}] No conflicts`);
    console.log(`- [${reviewApproved ? 'x' : ' '}] Reviews approved${!reviewApproved ? ` (${reviewStatus})` : ''}`);
    console.log(`- [${workflowsPassing ? 'x' : ' '}] Workflows passing${failedRuns.length ? ` (${failedRuns.length} failed)` : runningRuns.length ? ` (${runningRuns.length} running)` : latestRuns.size === 0 ? ' (none found)' : ''}`);
    console.log(`- [${commentsResolved ? 'x' : ' '}] Comments resolved${!commentsResolved ? ` (${unresolvedCount} unresolved)` : ''}`);
    console.log('');
    console.log(ready ? 'READY TO MERGE' : 'NOT READY TO MERGE');
  }

  process.exit(ready ? 0 : 1);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
