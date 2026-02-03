---
description: Track GitHub workflows, analyze failures, and automatically fix issues
args:
  - name: run_id
    description: GitHub workflow run ID to track (optional, will ask user if not provided)
    required: false
---

# GitHub Workflow Doctor

This skill tracks a GitHub workflow run, analyzes failures, and attempts to fix issues automatically.

## How to Use

This skill can be invoked in two ways:
1. **From another skill**: Pass the workflow run ID as an argument
2. **Standalone**: The skill will ask you for the workflow run ID

## Workflow

### Step 1: Get Workflow Run ID

If a `run_id` argument was provided, use it and proceed to Step 2.

Otherwise, query the repository for running workflows:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/list-running-workflows.mjs
```

This returns a JSON array of running/queued workflows with details like:
- Workflow run ID
- Workflow name
- Branch
- Status (in_progress or queued)
- How long it's been running

**If running workflows are found:**

Present the list to the user and ask them to choose:
- Format each workflow as: `[ID] Workflow Name (branch) - elapsed time`
- Example: `⏳ [12345678] CI Tests (main) - 2m 30s`

<ask-user-question>
Ask the user: "Which workflow would you like to track?"
Options: (dynamically create one option per running workflow, showing the formatted workflow info)
Plus these additional options:
- "Show all recent workflows" - Include completed workflows from the last runs
- "Enter a specific run ID" - User will provide a run ID manually
</ask-user-question>

If the user selects "Show all recent workflows", run:
```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/list-running-workflows.mjs --all
```

Then present the expanded list and ask them to choose again.

If the user selects "Enter a specific run ID", ask them to provide the run ID.

**If no running workflows are found:**

Query for recent workflows including failed ones:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/list-running-workflows.mjs --include-failed
```

If failed workflows are found, inform the user: "No running workflows, but found failed workflows you can fix."

Present the list (including failed workflows marked with ❌) and ask them to choose.

If still no workflows, ask:
<ask-user-question>
Ask the user: "What would you like to do?"
Options:
- "Show all recent workflows" - Show the last 20 workflow runs (including successful)
- "Enter a specific run ID" - Provide a run ID manually
- "Exit" - Cancel the skill
</ask-user-question>

Store the selected workflow run ID for use throughout the skill.

### Step 1.5: Check Workflow Status

Before tracking, check if the selected workflow is already completed:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/get-workflow-info.mjs <run-id>
```

Check the `status` field in the JSON output:

**If `status === "completed"`:**
- Check the `conclusion` field
- If `conclusion === "success"`:
  - Report: "✅ This workflow already completed successfully!"
  - Show duration and URL
  - **End the skill**
- If `conclusion === "failure"`:
  - Report: "❌ This workflow has already failed. Skipping to failure analysis..."
  - **Skip to Step 4** (Analyze Failure)
- If other conclusion (cancelled, skipped, etc.):
  - Report the conclusion and ask user if they still want to analyze it
  - If yes, go to Step 4; if no, end the skill

**If `status === "in_progress"` or `status === "queued"`:**
- Proceed to Step 2 (Track Workflow)

### Step 2: Track Workflow to Completion (Skip if already completed)

**Note: This step is only executed if the workflow is in_progress or queued (determined in Step 1.5)**

Run the wait-for-workflow script to poll the workflow status:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/wait-for-workflow.mjs <run-id>
```

This will output progress updates to stderr and final status as JSON to stdout.

Inform the user:
- Workflow name
- Current status
- Elapsed time updates every 30 seconds

### Step 3: Handle Workflow Result (Only if we tracked it)

**Note: This step is only executed if we tracked the workflow in Step 2**

When the workflow completes, check the `success` field in the JSON output.

#### If Successful ✅

Report to the user:
- ✅ Workflow completed successfully
- Duration: X seconds/minutes
- Workflow name and URL

**End the skill here.**

#### If Failed ❌

Proceed to Step 4 for failure analysis and fixing.

### Step 4: Analyze Failure

Run the get-workflow-logs script to fetch failure details:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/get-workflow-logs.mjs <run-id>
```

This returns:
- Failed job names
- Failed step names
- Complete workflow logs

Analyze the logs to identify:
1. What tests/steps failed
2. Error messages
3. Root cause of the failure
4. Files that likely need changes

### Step 5: Attempt to Fix (Max 3 Attempts)

**Initialize attempt counter**: Set `attempt_count = 1` and `max_attempts = 3`

#### Fix Loop

For each attempt (while `attempt_count <= max_attempts`):

1. **Analyze the failure** using the logs from Step 4
2. **Identify the fix** - determine what code changes are needed
3. **Ask user if auto-fix seems uncertain**:
   - If you're confident about the fix, proceed
   - If uncertain or complex, ask the user:
     <ask-user-question>
     "I've analyzed the failure. Should I attempt an automatic fix?"
     Options:
     - "Yes, attempt the fix" - Proceed with the fix
     - "No, show me the analysis first" - Display analysis and wait for user guidance
     - "Let me fix it manually" - End the skill
     </ask-user-question>

4. **Make the fix**: Edit the necessary files

5. **Commit the changes**:
   ```bash
   git add <changed-files>
   git commit -m "fix: address workflow failure - <brief description>"
   ```

6. **Check workflow trigger type**:
   - Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/get-workflow-info.mjs <original-run-id>`
   - Check the `event` field in the JSON output

7. **Handle based on trigger type**:

   **If `event === "push"`**:
   - Push the commit:
     ```bash
     git push
     ```
   - Wait a few seconds for GitHub to register the push
   - Get the new workflow run ID:
     ```bash
     node ${CLAUDE_PLUGIN_ROOT}/scripts/get-workflow-info.mjs --latest "<workflow-name>"
     ```
   - **Go back to Step 2** with the new run ID
   - Increment `attempt_count`

   **If `event === "workflow_dispatch"` or other**:
   - Commit and push the fix:
     ```bash
     git push
     ```
   - Inform the user:
     "✅ Fix has been committed and pushed. Since this workflow was triggered manually (workflow_dispatch), please re-run the workflow manually to test the fix."
   - Provide the workflow URL
   - **Ask user**:
       <ask-user-question>
       "Would you like to continue tracking after you re-run the workflow?"
       Options:
       - "Yes, I'll trigger it now" - Wait for user to confirm they've triggered it, then get the new run ID and go to Step 2
       - "No, I'll check it myself" - End the skill
       </ask-user-question>

8. **If fix fails again**:
   - If `attempt_count >= max_attempts`:
     - Report: "❌ Maximum fix attempts (3) reached. Here's what I found:"
     - Show detailed analysis of the latest failure
     - Suggest next steps for the user
     - **End the skill**
   - Otherwise:
     - Ask user for guidance:
       <ask-user-question>
       "The workflow failed again after my fix attempt. Would you like me to:"
       Options:
       - "Try another fix" - Get user's hint/guidance, then continue the loop
       - "Show detailed analysis" - Display detailed log analysis and ask for direction
       - "Stop, I'll fix it manually" - End the skill
       </ask-user-question>
     - If user provides guidance or asks to try again, increment `attempt_count` and continue the loop

### Step 6: Report Success

If the workflow passes after a fix:
- ✅ Workflow fixed and passing!
- Show what was changed
- Total attempts: X
- Final duration
- Workflow URL

## Notes

- The skill uses the `gh` CLI tool, which must be installed and authenticated
- When launched standalone, the skill queries and displays running workflows to choose from
- Polling interval is 15 seconds by default
- Maximum of 3 automatic fix attempts to prevent infinite loops
- For push-triggered workflows, fixes automatically trigger new runs
- For manually triggered workflows, user must re-run after fixes
