#!/usr/bin/env node
/**
 * Parse and format PR review comments for display.
 *
 * Reads JSON output from fetch-pr-comments.mjs on stdin and produces
 * a numbered markdown summary grouped by file.
 *
 * Usage:
 *   node fetch-pr-comments.mjs --open-only | node parse-comments.mjs
 *   node parse-comments.mjs < comments.json
 *   node parse-comments.mjs --resolved < comments.json   # include resolved
 */

import { readFileSync } from 'fs';

function readStdin() {
  try {
    return readFileSync(0, 'utf-8');
  } catch {
    return '';
  }
}

function relativeTime(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

function formatDiscussions(discussions, prMeta) {
  if (!discussions.length) {
    return `## No review comments found for PR #${prMeta.number}\n`;
  }

  const grouped = new Map();
  for (const d of discussions) {
    const path = d.path || '(general)';
    if (!grouped.has(path)) grouped.set(path, []);
    grouped.get(path).push(d);
  }

  // Sort files alphabetically; within each file sort by line number
  const sortedPaths = [...grouped.keys()].sort();
  for (const path of sortedPaths) {
    grouped.get(path).sort((a, b) => (a.line || 0) - (b.line || 0));
  }

  const lines = [];
  lines.push(`## Unresolved Review Comments for PR #${prMeta.number}\n`);

  let index = 1;
  for (const path of sortedPaths) {
    lines.push(`### ${path}`);
    for (const d of grouped.get(path)) {
      const author = d.author?.login || 'unknown';
      const line = d.line ? ` (line ${d.line})` : '';
      const replyCount = d.replies?.length || 0;
      const replySuffix = replyCount > 0 ? ` [${replyCount} repl${replyCount === 1 ? 'y' : 'ies'}]` : '';
      const snippet = (d.body || '').split('\n')[0].slice(0, 80);
      lines.push(`${index}. [C-${d.id}] @${author}${line}: "${snippet}"${replySuffix}`);
      index++;
    }
    lines.push('');
  }

  const fileCount = sortedPaths.length;
  const total = index - 1;
  lines.push('---');
  lines.push(`Total: ${total} comment${total !== 1 ? 's' : ''} across ${fileCount} file${fileCount !== 1 ? 's' : ''}`);

  return lines.join('\n');
}

function formatDetailed(discussions) {
  const lines = [];
  let index = 1;

  for (const d of discussions) {
    const path = d.path || '(general)';
    const line = d.line || '?';
    const author = d.author?.login || 'unknown';
    const time = d.created_at ? relativeTime(d.created_at) : '';

    lines.push(`## Comment #${index} - ${path}:${line}\n`);

    if (d.diff_hunk) {
      lines.push('### Diff Context:');
      lines.push('```');
      lines.push(d.diff_hunk);
      lines.push('```\n');
    }

    lines.push('### Comment Thread:');
    lines.push(`**@${author}** (${time}):`);
    lines.push(`> ${(d.body || '').split('\n').join('\n> ')}\n`);

    if (d.replies?.length) {
      for (const r of d.replies) {
        const rAuthor = r.author?.login || 'unknown';
        const rTime = r.created_at ? relativeTime(r.created_at) : '';
        lines.push(`**@${rAuthor}** (${rTime}):`);
        lines.push(`> ${(r.body || '').split('\n').join('\n> ')}\n`);
      }
    }

    lines.push('---\n');
    index++;
  }

  return lines.join('\n');
}

const args = process.argv.slice(2);
const showResolved = args.includes('--resolved');
const detailed = args.includes('--detailed');

try {
  const raw = readStdin();
  if (!raw.trim()) {
    console.error('No input received. Pipe JSON from fetch-pr-comments.mjs.');
    process.exit(1);
  }

  const data = JSON.parse(raw);
  const prMeta = data.pull_request || { number: '?' };

  // Use open_discussions if available and not showing resolved, else all discussions
  let discussions;
  if (showResolved) {
    discussions = data.discussions || data.open_discussions || [];
  } else {
    discussions = data.open_discussions || data.discussions || [];
  }

  if (detailed) {
    console.log(formatDetailed(discussions));
  } else {
    console.log(formatDiscussions(discussions, prMeta));
  }
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
