#!/usr/bin/env node
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
  let pr, branch;
  if (prNumber) {
    pr = runJson(`gh pr view ${prNumber} --json number,title,state,url,headRefName,baseRefName,mergeable,reviewDecision,reviews,comments`);
    branch = pr?.headRefName;
  } else {
    branch = run('git rev-parse --abbrev-ref HEAD');
    pr = runJson(`gh pr view "${branch}" --json number,title,state,url,headRefName,baseRefName,mergeable,reviewDecision,reviews,comments`);
  }

  if (!pr) { console.error('No PR found'); process.exit(1); }

  const workflowRuns = runJson(`gh run list --branch "${pr.headRefName}" --limit 10 --json databaseId,name,status,conclusion`) || [];
  const unresolvedComments = runJson(`gh api "/repos/{owner}/{repo}/pulls/${pr.number}/comments"`) || [];

  const latestRuns = new Map();
  for (const run of workflowRuns) {
    if (!latestRuns.has(run.name)) latestRuns.set(run.name, run);
  }

  const failedCount = [...latestRuns.values()].filter(r => r.conclusion === 'failure').length;
  const runningCount = [...latestRuns.values()].filter(r => r.status === 'in_progress').length;
  let wfStatus = 'unknown';
  if (failedCount > 0) wfStatus = 'failing';
  else if (runningCount > 0) wfStatus = 'running';
  else if (latestRuns.size > 0) wfStatus = 'passing';

  const rootComments = unresolvedComments.filter(c => !c.in_reply_to_id);
  const approvals = (pr.reviews || []).filter(r => r.state === 'APPROVED').length;

  const result = {
    pr: { number: pr.number, title: pr.title, state: pr.state, url: pr.url,
      head_branch: pr.headRefName, base_branch: pr.baseRefName, mergeable: pr.mergeable },
    workflows: { status: wfStatus, failed: failedCount, running: runningCount },
    reviews: { status: pr.reviewDecision?.toLowerCase() || 'pending', approvals },
    comments: { unresolved: rootComments.length },
  };

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`PR #${result.pr.number}: ${result.pr.title}`);
    console.log(`Branch: ${result.pr.head_branch} -> ${result.pr.base_branch}`);
    console.log(`Workflows: ${wfStatus}`);
    console.log(`Reviews: ${result.reviews.status} (${approvals} approvals)`);
    console.log(`Unresolved comments: ${rootComments.length}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
