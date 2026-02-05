---
description: Complete PR health check - track workflows, fix failures, and address review comments
args:
  - name: pr_number
    description: PR number to check (optional, defaults to current branch's PR)
    required: false
---

# PR Doctor

Complete pull request health check that ensures your PR is ready to merge by:
1. Tracking GitHub workflow status
2. Automatically fixing workflow failures
3. Addressing unresolved review comments
4. Verifying all checks pass

---

## When to Use

- Before requesting a review
- After receiving review feedback
- When workflows are failing on your PR
- Before merging to ensure everything is green
- As a final pre-merge checklist

---

## Prerequisites

- `gh` CLI installed and authenticated
- Current branch has an associated open PR (or provide PR number)
- Network access to GitHub API

---

## Core Workflow

**IMPORTANT**: Use **TodoWrite** throughout to track progress.

### Initial Task Planning

```
TodoWrite:
1. Get PR information (pending)
2. Check workflow status (pending)
3. Fix workflow failures if any (pending)
4. Check review comments (pending)
5. Address unresolved comments (pending)
6. Final verification (pending)
```

### Step 1: Get PR Information

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/pr-doctor/scripts/get-pr-status.mjs [pr_number]
```

This returns comprehensive PR status:
- PR metadata (number, title, URL, state)
- Workflow/check status (passing, failing, pending)
- Review status (approved, changes requested, pending)
- Unresolved comment count
- Merge readiness

**If no PR found**: Prompt user to create one with `gh pr create`.

### Step 2: Assess PR Health

Present a health summary:

```
## PR #142 Health Check

### Basic Info
- Title: Add form validation
- Branch: feature/validation → main
- URL: https://github.com/org/repo/pull/142

### Status
| Check | Status |
|-------|--------|
| Workflows | ⏳ Running (2/3 complete) |
| Reviews | ✅ Approved (2 approvals) |
| Comments | ⚠️ 3 unresolved |
| Conflicts | ✅ None |

### Recommendation
Wait for workflows, then address 3 unresolved comments.
```

### Step 3: Handle Workflows

**If workflows are running:**
<ask-user-question>
"Workflows are still running. What would you like to do?"
Options:
- "Track until complete" - Use workflow-doctor to monitor
- "Continue with comments" - Address comments while waiting
- "Wait and check later" - Exit and let user return
</ask-user-question>

**If workflows failed:**
<ask-user-question>
"Workflow failures detected. Would you like to fix them?"
Options:
- "Yes, fix automatically" - Invoke github-workflow-doctor skill
- "Show me the failures first" - Display failure details
- "Skip, I'll fix manually" - Continue to comments
</ask-user-question>

**Invoke workflow-doctor:**
```
Invoke: github-workflow-doctor
Args: run_id=<failed_run_id>
```

Wait for workflow-doctor to complete, then continue.

### Step 4: Handle Review Comments

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/address-pr-comments/scripts/fetch-pr-comments.mjs --open-only
```

**If unresolved comments exist:**
<ask-user-question>
"Found {N} unresolved review comments. Would you like to address them?"
Options:
- "Yes, address all" - Process all comments
- "Let me select which ones" - Show list and let user choose
- "Skip comments" - Continue to final check
</ask-user-question>

**Invoke address-pr-comments:**
```
Invoke: address-pr-comments
Args: selection=<user_selection>
```

### Step 5: Commit and Push Changes

If any changes were made (workflow fixes or comment fixes):

```bash
git status
```

<ask-user-question>
"Changes ready to commit. How would you like to proceed?"
Options:
- "Commit all changes together" - Single commit with summary
- "Review changes first" - Show diff before committing
- "I'll commit manually" - Leave changes staged
</ask-user-question>

If committing:
```bash
git add -A
git commit -m "fix: address PR feedback

- Fixed workflow failures
- Addressed review comments"
git push
```

### Step 6: Final Verification

Wait for new workflows to start:
```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/github-workflow-doctor/scripts/list-running-workflows.mjs
```

Present final status:

```
## Final PR Status

| Check | Before | After |
|-------|--------|-------|
| Workflows | ❌ Failed | ⏳ Running |
| Comments | ⚠️ 3 unresolved | ✅ All addressed |

Next steps:
- Workflows are running, track with `/ai-tools:github-workflow-doctor`
- Request re-review when workflows pass
```

---

## Quick Mode

For a fast check without prompts:

```bash
/ai-tools:pr-doctor --quick
```

Quick mode:
1. Shows PR status summary
2. Lists any issues found
3. Doesn't automatically fix anything

---

## Scripts

### `get-pr-status.mjs`

Gets comprehensive PR status:

```bash
node scripts/get-pr-status.mjs [pr_number]
```

**Output** (JSON):
```json
{
  "pr": {
    "number": 142,
    "title": "Add form validation",
    "state": "open",
    "mergeable": true
  },
  "workflows": {
    "status": "failing",
    "runs": [
      { "id": 123, "name": "CI", "conclusion": "failure" }
    ]
  },
  "reviews": {
    "status": "approved",
    "approvals": 2,
    "changes_requested": 0
  },
  "comments": {
    "total": 5,
    "unresolved": 3
  },
  "health": {
    "score": 60,
    "issues": ["workflow_failure", "unresolved_comments"],
    "recommendation": "Fix CI failure, then address comments"
  }
}
```

### `check-merge-readiness.mjs`

Quick merge readiness check:

```bash
node scripts/check-merge-readiness.mjs [pr_number]
```

**Output**:
```
PR #142 Merge Readiness:
- [x] No conflicts
- [x] Reviews approved
- [ ] Workflows passing (1 failed)
- [ ] Comments resolved (3 unresolved)

NOT READY TO MERGE
```

---

## Integration Flow

```
                    ┌─────────────────┐
                    │   PR Doctor     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
      ┌───────────┐  ┌───────────┐  ┌───────────┐
      │ Workflow  │  │  Address  │  │   Test    │
      │  Doctor   │  │ PR Cmts   │  │  Doctor   │
      └───────────┘  └───────────┘  └───────────┘
              │              │              │
              └──────────────┼──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  Ready to Merge │
                    └─────────────────┘
```

---

## Error Handling

**CRITICAL: Do NOT work around script failures.**

If any script in this skill produces no output, fails, or returns unexpected results:

1. **Report the problem** to the user immediately
2. **Do NOT** invent workarounds like running alternative commands directly
3. **Do NOT** silently continue with different approaches

If a script fails, ask the user how to proceed before continuing.

**Common Errors:**

| Error | Resolution |
|-------|------------|
| No PR found | Create with `gh pr create` |
| Auth failed | Run `gh auth login` |
| Merge conflicts | Resolve conflicts first |
| Required reviews missing | Request reviews |
| Protected branch rules | Check branch protection settings |

---

## Best Practices

### DO
- Run pr-doctor before requesting reviews
- Address all comments before re-requesting review
- Let workflows complete before merging
- Use quick mode for status checks

### DON'T
- Merge with failing workflows
- Ignore reviewer feedback
- Force merge without approvals
- Skip final verification

---

## Dependencies

- **github-workflow-doctor** - For tracking and fixing workflow failures
- **address-pr-comments** - For addressing review comments
- **test-doctor** - For fixing test failures locally (optional)
- **calculate-parallelism** - For optimal parallel execution

