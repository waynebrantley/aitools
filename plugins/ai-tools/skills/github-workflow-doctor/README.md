# GitHub Workflow Doctor

A Claude Code skill that tracks GitHub workflow runs, analyzes failures, and automatically attempts to fix issues.

## Features

- 🔍 **Track workflows** - Monitor GitHub workflow runs until completion
- 📋 **Smart selection** - When running standalone, shows running and failed workflows to choose from
- ⚡ **Quick fix** - Pick a failed workflow to skip tracking and go straight to fixing
- 📊 **Report results** - Show success/failure status with timing information
- 🔧 **Auto-fix failures** - Analyze logs and attempt automatic fixes
- 🔄 **Auto-retry** - For push-triggered workflows, automatically track new runs after fixes
- 🎯 **Smart limits** - Maximum 3 fix attempts to prevent infinite loops
- 💬 **User guidance** - Ask for help when auto-fix is uncertain

## Requirements

- `gh` CLI installed and authenticated ([GitHub CLI](https://cli.github.com/))
- Git repository with GitHub Actions workflows
- Write access to the repository

## Usage

### From Another Skill

```bash
/github-workflow-doctor --run_id 12345678
```

### Standalone

```bash
/github-workflow-doctor
```

The skill will ask you for the workflow run ID or offer to track the latest run.

## How It Works

1. **Get Workflow Run ID**:
   - If provided as argument, use it
   - Otherwise, query running/failed workflows and let user choose from the list
   - Falls back to showing all recent workflows if none are running or failed
2. **Check Status**: Determine if workflow is running, completed, or failed
3. **Track to Completion** (if running): Poll the workflow status every 15 seconds
   - If already failed: Skip tracking and go straight to failure analysis
3. **Handle Success**: Report duration and details
4. **Handle Failure**:
   - Fetch and analyze workflow logs
   - Identify the root cause
   - Attempt automatic fix (up to 3 times)
   - For push-triggered workflows: commit, push, and track the new run
   - For manual workflows: commit, push, and ask user to re-trigger
   - Ask for user guidance if uncertain about the fix

## Workflow Trigger Types

### Push-Triggered Workflows

When the workflow was triggered by a push:
- Fixes are committed and pushed automatically
- The new workflow run is tracked automatically
- Process repeats until success or max attempts reached

### Manually Triggered Workflows (workflow_dispatch)

When the workflow was triggered manually:
- Fixes are committed and pushed
- User is asked to manually re-trigger the workflow
- Option to continue tracking after re-triggering

## Fix Attempt Limits

The skill limits automatic fix attempts to 3 to prevent infinite loops:
- Each fix attempt is tracked
- After 3 failed attempts, the skill reports detailed analysis and stops
- User can provide guidance between attempts for better fixes

## Scripts

The skill includes these supporting scripts in `scripts/`:

- `list-running-workflows.mjs` - List running/queued workflows in the repository
- `get-workflow-info.mjs` - Get workflow run information
- `wait-for-workflow.mjs` - Poll and wait for workflow completion (15s interval)
- `get-workflow-logs.mjs` - Fetch logs for failed jobs

All scripts are cross-platform Node.js modules.

## Testing

Run tests with:

```bash
node tests/get-workflow-info.test.mjs
node tests/wait-for-workflow.test.mjs
node tests/get-workflow-logs.test.mjs
```

Or use the skill test runner:

```bash
node ../run-all-tests.mjs
```

## Example Session

```
User: /github-workflow-doctor

Claude: Found workflows:
        ⏳ [12345678] CI Tests (main) - in_progress - 2m 30s
        ❌ [12345677] CI Tests (main) - failure - 5m ago
        ⏳ [12345679] Build (feature-branch) - in_progress - 45s

        Which workflow would you like to work with?

User: [12345677] CI Tests (main) - failure - 5m ago

Claude: ❌ This workflow has already failed. Skipping to failure analysis...
        Status: in_progress

[30 seconds later]

Claude: ❌ Workflow failed after 45 seconds
        Analyzing logs...

        Found issue: Test "user authentication" failed
        Error: Expected status 200, got 401

        Root cause: Missing JWT secret in test environment

        I can fix this by adding the JWT_SECRET to .env.test

        Attempting fix (attempt 1/3)...

        ✅ Fixed: Added JWT_SECRET to .env.test
        📝 Committed: "fix: add missing JWT_SECRET to test environment"
        🚀 Pushed changes

        ⏳ Tracking new workflow run #43...
        Status: in_progress

[60 seconds later]

Claude: ✅ Workflow fixed and passing!

        Changes made:
        - Added JWT_SECRET to .env.test

        Total attempts: 1
        Final duration: 52 seconds
        URL: https://github.com/user/repo/actions/runs/43
```

## Tips

- The skill works best with push-triggered workflows (automatic retry)
- For complex failures, the skill may ask for your guidance
- You can stop at any time if you prefer to fix manually
- The skill analyzes full logs, not just error summaries
- All commits are descriptive and reference the workflow failure
