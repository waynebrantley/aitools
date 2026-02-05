---
version: 1.0.0
description: Address unresolved review comments on GitHub pull requests
author: Wayne Brantley
category: Code Review
tags: [github, pull-request, code-review, automation]
args:
  - name: selection
    description: Comment selection (e.g., "1,3", "1-5", "all") - optional, will prompt if not provided
    required: false
---

# Address PR Comments

Systematically address unresolved review comments on GitHub pull requests for the current branch.

---

## When to Use

- After receiving code review feedback on a PR
- Before requesting re-review
- To batch-process multiple review comments efficiently
- When preparing to merge a PR with pending feedback

---

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth status`)
- Current branch has an associated open pull request
- Network access to GitHub API

---

## Core Workflow

### Step 1: Detect PR for Current Branch

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/address-pr-comments/scripts/fetch-pr-comments.mjs
```

This returns JSON with:
- Pull request metadata (number, title, URL, branches)
- All review comments grouped by file
- Open (unresolved) discussions
- General PR comments

**If no PR found**: Prompt user to push branch or create PR first.

### Step 2: Present Unresolved Comments

Display comments in a numbered summary format, grouped by file:

```
## Unresolved Review Comments for PR #142

### src/components/Form.tsx
1. [C-1001] @alice (line 23): "Add aria-label for accessibility"
2. [C-1002] @bob (line 45): "Validation should happen on blur"

### src/utils/validate.ts
3. [C-1003] @alice (line 12): "Email regex is too permissive"

---
Total: 3 unresolved comments across 2 files
```

**Sorting Priority:**
1. Unresolved comments first
2. Grouped by file path
3. Sorted by line number within file

### Step 3: Get User Selection

If `selection` argument was provided, use it. Otherwise:

<ask-user-question>
"Which comments would you like to address?"
Options:
- "All comments" - Address all unresolved comments
- "Let me specify" - User enters selection like "1,3" or "1-5"
- "Show me details first" - Display full comment threads before selecting
</ask-user-question>

**Selection Syntax:**
- `1,3,5` - Select specific items
- `1-5` - Select range
- `all` - Select all unresolved
- `skip` - Skip and end skill

### Step 4: Show Full Context for Selected

For each selected comment, display:

```markdown
## Comment #1 - src/components/Form.tsx:23

### Code Context (lines 20-26):
```tsx
20: export function Form({ onSubmit }) {
21:   const [email, setEmail] = useState('');
22:
23:   return <input type="email" value={email} />  // <-- Comment here
24:
25:   // ...
26: }
```

### Comment Thread:
**@alice** (2 days ago):
> Add aria-label for accessibility. Screen readers need this to identify the input.

**@you** (1 day ago):
> Good catch, will fix.
```

### Step 5: Implement Fixes

For each selected comment, spawn a fix subagent:

```
Task: Address review comment on {filename}:{line}

Context:
- File: {path}
- Line: {line_number}
- Comment: {comment_body}
- Author: {reviewer}
- Thread: {full_thread}

Requirements:
- Fix the specific issue mentioned in the comment
- Maintain existing functionality
- Follow project coding standards (check CLAUDE.md)
- Only modify what's necessary to address the feedback

Success: Comment feedback addressed appropriately
```

**Parallel Execution:**
- Use calculate-parallelism to determine MAX_PARALLEL
- Process multiple files concurrently when comments are in different files
- Process sequentially when multiple comments affect the same file

### Step 6: Verify Changes

After fixing each comment:

1. **Run related tests** (if any):
   ```bash
   # Detect test framework and run tests for modified files
   node ${CLAUDE_PLUGIN_ROOT}/skills/test-doctor/scripts/detect-test-environment.mjs
   ```

2. **Run linting/formatting**:
   ```bash
   # Based on detected environment
   pnpm exec prettier --check {files}
   pnpm exec eslint {files}
   pnpm exec tsc --noEmit
   ```

### Step 7: Report Summary

```
## Summary

✅ Addressed 3 comments:
- src/components/Form.tsx:23 - Added aria-label
- src/components/Form.tsx:45 - Changed validation to onBlur
- src/utils/validate.ts:12 - Improved email regex

Tests: PASS
Linting: PASS

Ready to commit? (y/n)
```

---

## Scripts

### `fetch-pr-comments.mjs`

Fetches PR comments for the current branch:

```bash
node scripts/fetch-pr-comments.mjs [--open-only]
```

**Output** (JSON):
```json
{
  "pull_request": {
    "number": 142,
    "title": "Add form validation",
    "html_url": "https://github.com/org/repo/pull/142",
    "head_branch": "feature/validation",
    "base_branch": "main"
  },
  "discussions": [...],
  "open_discussions": [...]
}
```

### `parse-comments.mjs`

Parses and formats comments for display:

```bash
node scripts/parse-comments.mjs < comments.json
```

**Output**: Formatted markdown summary

### `get-code-context.mjs`

Gets code context around a specific line:

```bash
node scripts/get-code-context.mjs <file> <line> [--context=3]
```

**Output**: Code snippet with line numbers

---

## Error Handling

| Error | Resolution |
|-------|------------|
| No PR found | `gh pr create` or push branch first |
| Auth failed | Run `gh auth login` |
| Rate limited | Wait and retry with backoff |
| File not found | Comment may be on deleted/renamed file - skip |

---

## Integration with PR Doctor

This skill is used by **pr-doctor** as part of the complete PR health workflow:
1. Track workflow status
2. Fix workflow failures
3. **Address review comments** (this skill)
4. Verify PR is ready to merge

---

## Best Practices

### DO
- Address comments in logical groups (same file together)
- Preserve the intent of the reviewer's feedback
- Run tests after making changes
- Keep fixes minimal and focused

### DON'T
- Dismiss comments without addressing them
- Make unrelated changes while fixing comments
- Skip verification steps
- Argue with reviewers in code comments

---

## Dependencies

- **calculate-parallelism** - For optimal parallel execution
- **test-doctor** - For running tests on modified files (optional)

---

**Version**: 1.0.0
**License**: MIT
**Author**: Wayne Brantley
