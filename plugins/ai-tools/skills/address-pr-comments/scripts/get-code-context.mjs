#!/usr/bin/env node
/**
 * Get code context around a specific line in a file.
 *
 * Usage:
 *   node get-code-context.mjs <file> <line> [--context=3]
 *   node get-code-context.mjs src/index.ts 42
 *   node get-code-context.mjs src/index.ts 42 --context=5
 */

import { readFileSync, existsSync } from 'fs';

function parseArgs(argv) {
  const args = argv.slice(2);
  let file = null;
  let line = null;
  let context = 3;

  for (const arg of args) {
    if (arg.startsWith('--context=')) {
      const val = parseInt(arg.split('=')[1], 10);
      if (!isNaN(val) && val >= 0) context = val;
    } else if (!file) {
      file = arg;
    } else if (!line) {
      line = parseInt(arg, 10);
    }
  }

  return { file, line, context };
}

function getContext(filePath, targetLine, contextLines) {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const totalLines = lines.length;

  if (targetLine < 1 || targetLine > totalLines) {
    throw new Error(`Line ${targetLine} is out of range (file has ${totalLines} lines)`);
  }

  const startLine = Math.max(1, targetLine - contextLines);
  const endLine = Math.min(totalLines, targetLine + contextLines);
  const gutterWidth = String(endLine).length;

  const output = [];
  for (let i = startLine; i <= endLine; i++) {
    const lineNum = String(i).padStart(gutterWidth, ' ');
    const marker = i === targetLine ? ' >> ' : '    ';
    output.push(`${lineNum}${marker}${lines[i - 1]}`);
  }

  return {
    file: filePath,
    target_line: targetLine,
    start_line: startLine,
    end_line: endLine,
    total_lines: totalLines,
    snippet: output.join('\n'),
  };
}

const { file, line, context } = parseArgs(process.argv);

if (!file || !line || isNaN(line)) {
  console.error('Usage: node get-code-context.mjs <file> <line> [--context=N]');
  process.exit(1);
}

try {
  const result = getContext(file, line, context);
  console.log(result.snippet);
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exit(1);
}
