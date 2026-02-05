#!/usr/bin/env node
/**
 * Fetch GitHub pull request review comments for the PR associated with the
 * current git branch.
 *
 * Requires:
 *   - `gh auth status` succeeds
 *   - current branch has an associated open PR
 *
 * Usage:
 *   node fetch-pr-comments.mjs > pr_comments.json
 *   node fetch-pr-comments.mjs --open-only > open_threads.json
 *   node fetch-pr-comments.mjs --output /tmp/pr_comments.json
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    throw new Error(`Command failed: ${cmd}\n${error.stderr || error.message}`);
  }
}

function runJson(cmd) {
  const output = run(cmd);
  try {
    return JSON.parse(output);
  } catch (e) {
    throw new Error(`Failed to parse JSON: ${e.message}\nRaw: ${output}`);
  }
}

function ensureGhAuthenticated() {
  try {
    run('gh auth status');
  } catch (e) {
    throw new Error('gh auth status failed; run `gh auth login` or set GH_TOKEN');
  }
}

function gitCurrentBranch() {
  return run('git rev-parse --abbrev-ref HEAD');
}

function gitOriginUrl() {
  return run('git remote get-url origin');
}

function stripDotGit(path) {
  return path.endsWith('.git') ? path.slice(0, -4) : path;
}

function parseRepoPath(remoteUrl) {
  let match = remoteUrl.match(/^https?:\/\/[^/]+\/(.+)$/);
  if (match) return stripDotGit(match[1]);

  match = remoteUrl.match(/^(?:ssh:\/\/)?git@[^:/]+[:/](.+)$/);
  if (match) return stripDotGit(match[1]);

  throw new Error(`Unable to parse GitHub repo path from: ${remoteUrl}`);
}

function findOpenPrForBranch(owner, repo, branch) {
  let prs = runJson(`gh api "/repos/${owner}/${repo}/pulls?state=open&head=${owner}:${branch}"`);

  if (!prs.length) {
    const allPrs = runJson(`gh api "/repos/${owner}/${repo}/pulls?state=open"`);
    prs = allPrs.filter(pr => pr.head?.ref === branch);
  }

  if (!prs.length) {
    throw new Error(`No open pull request found for branch: ${branch}`);
  }

  return prs.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
}

function getReviewComments(owner, repo, prNumber) {
  return runJson(`gh api "/repos/${owner}/${repo}/pulls/${prNumber}/comments"`);
}

function getReviews(owner, repo, prNumber) {
  return runJson(`gh api "/repos/${owner}/${repo}/pulls/${prNumber}/reviews"`);
}

function getIssueComments(owner, repo, prNumber) {
  return runJson(`gh api "/repos/${owner}/${repo}/issues/${prNumber}/comments"`);
}

function isBotComment(comment) {
  const user = comment.user || {};
  const userType = (user.type || '').toLowerCase();
  const login = (user.login || '').toLowerCase();

  return userType === 'bot' ||
    login.endsWith('[bot]') ||
    login.endsWith('-bot');
}

function isResolved(comment, allComments) {
  if (comment.in_reply_to_id) return true;

  const commentId = comment.id;
  const replies = allComments.filter(c => c.in_reply_to_id === commentId);

  const resolutionKeywords = ['done', 'fixed', 'resolved', 'addressed', 'will do', 'good catch', 'updated', 'changed'];

  for (const reply of replies) {
    const body = (reply.body || '').toLowerCase();
    if (resolutionKeywords.some(kw => body.includes(kw))) {
      return true;
    }
  }

  return false;
}

function groupCommentsByThread(comments) {
  const threads = new Map();

  for (const comment of comments) {
    const replyTo = comment.in_reply_to_id;
    const commentId = comment.id;

    if (replyTo) {
      if (!threads.has(replyTo)) {
        threads.set(replyTo, []);
      }
      threads.get(replyTo).push(comment);
    } else {
      if (!threads.has(commentId)) {
        threads.set(commentId, []);
      }
      threads.get(commentId).unshift(comment);
    }
  }

  return threads;
}

function formatDiscussion(comment, replies) {
  const user = comment.user || {};

  return {
    id: comment.id,
    path: comment.path,
    line: comment.line || comment.original_line,
    start_line: comment.start_line,
    diff_hunk: comment.diff_hunk,
    body: comment.body,
    author: {
      login: user.login,
      type: user.type,
    },
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    html_url: comment.html_url,
    replies: replies.map(r => ({
      id: r.id,
      body: r.body,
      author: { login: r.user?.login },
      created_at: r.created_at,
    })),
  };
}

function fetchAll(owner, repo, branch) {
  const pr = findOpenPrForBranch(owner, repo, branch);
  const prNumber = pr.number;

  let reviewComments = getReviewComments(owner, repo, prNumber);
  const reviews = getReviews(owner, repo, prNumber);
  let issueComments = getIssueComments(owner, repo, prNumber);

  reviewComments = reviewComments.filter(c => !isBotComment(c));
  issueComments = issueComments.filter(c => !isBotComment(c));

  const threads = groupCommentsByThread(reviewComments);

  const discussions = [];
  const openDiscussions = [];

  for (const [rootId, threadComments] of threads) {
    if (!threadComments.length) continue;

    const rootComment = threadComments[0];
    const replies = threadComments.slice(1);

    const discussion = formatDiscussion(rootComment, replies);
    discussions.push(discussion);

    if (!isResolved(rootComment, reviewComments)) {
      openDiscussions.push(discussion);
    }
  }

  const sortFn = (a, b) => {
    const pathCmp = (a.path || '').localeCompare(b.path || '');
    if (pathCmp !== 0) return pathCmp;
    return (a.line || 0) - (b.line || 0);
  };

  discussions.sort(sortFn);
  openDiscussions.sort(sortFn);

  return {
    pull_request: {
      number: pr.number,
      html_url: pr.html_url,
      title: pr.title,
      state: pr.state,
      head_branch: pr.head?.ref,
      base_branch: pr.base?.ref,
      updated_at: pr.updated_at,
    },
    repo: { owner, repo, branch },
    discussions,
    open_discussions: openDiscussions,
    reviews: reviews
      .filter(r => r.body)
      .map(r => ({
        id: r.id,
        state: r.state,
        body: r.body,
        author: r.user?.login,
        submitted_at: r.submitted_at,
      })),
    general_comments: issueComments.map(c => ({
      id: c.id,
      body: c.body,
      author: c.user?.login,
      created_at: c.created_at,
      html_url: c.html_url,
    })),
  };
}

const args = process.argv.slice(2);
const openOnly = args.includes('--open-only');
const outputIndex = args.indexOf('--output');
const outputPath = outputIndex !== -1 ? args[outputIndex + 1] : null;

try {
  ensureGhAuthenticated();

  const branch = gitCurrentBranch();
  const origin = gitOriginUrl();
  const repoPath = parseRepoPath(origin);

  const parts = repoPath.split('/');
  if (parts.length < 2) {
    throw new Error(`Invalid repo path: ${repoPath}`);
  }
  const [owner, repo] = parts;

  const result = fetchAll(owner, repo, branch);

  let payload;
  if (openOnly) {
    payload = {
      pull_request: result.pull_request,
      repo: result.repo,
      open_discussions: result.open_discussions,
    };
  } else {
    payload = result;
  }

  const output = JSON.stringify(payload, null, 2);

  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, output + '\n');
    console.error(`Written to ${outputPath}`);
  } else {
    console.log(output);
  }
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
