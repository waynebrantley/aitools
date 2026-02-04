---
description: Create pull requests with automated validation and smart title/description generation
disable-model-invocation: true
---

# Create Pull Request

Create a pull request for the current branch with automated validation and smart title/description generation.

## Usage

```
/create-pr
```

## Your Task

The user wants to create a pull request targeting master.

1. **Run build doctor** - Execute the global `ai-tools build-doctor` skill:

   ```
   /ai-tools:build-doctor
   ```

   This skill automatically detects the project type, runs the appropriate build/lint/test commands, and fixes any issues it finds.

   **If build-doctor reports "no frameworks detected"**: Do NOT silently skip this step. Ask the user whether the project has a build system that should be validated before creating the PR. The project may have build frameworks that detection missed.

2. **Check git status** - Verify the current branch and ensure changes are committed:
   ```bash
   git status
   git rev-parse --abbrev-ref HEAD
   ```
   If there are uncommitted changes, warn the user and ask if they want to commit first.

3. **Verify remote is up to date** - Check if local branch is ahead of remote:
   ```bash
   git fetch origin && git status -sb
   ```
   If there are unpushed commits, push them:
   ```bash
   git push -u origin HEAD
   ```

4. **Create the pull request** - Create an initial PR with a placeholder title:
   ```bash
   gh pr create --base master --title "WIP: <branch-name>" --body "Creating PR..."
   ```
   Capture the PR number from the output.

5. **Analyze the changes** - Gather information about what changed:

   a. Get the list of commits on this branch:
   ```bash
   gh pr view --json commits --jq '.commits[].messageHeadline'
   ```

   b. Get the diff summary:
   ```bash
   gh pr diff --stat
   ```

   c. Get the full diff for context:
   ```bash
   gh pr diff
   ```

6. **Generate title and description** - Based on the analysis, write both as a human developer would:

   - **Title**: Create a concise, descriptive title (max 72 characters) that:
     - Starts with the ticket number if present in the branch name (e.g., `MIN-1234`)
     - Summarizes the main purpose of the changes
     - Uses imperative mood (e.g., "Add", "Fix", "Update", "Refactor")
     - Sounds like something a developer would actually type — short, specific, lowercase after the verb (e.g., "Fix null ref in order processing", not "Fix Null Reference Exception in Order Processing Pipeline")

   - **Description**: Write a description the way a developer would in a real team:
     - Lead with *why* the change was made, not a mechanical list of what changed
     - Keep it short — a sentence or two of context, then a few bullets only for non-obvious changes
     - Skip anything the reviewer can see from the diff (renamed files, trivial formatting, etc.)
     - Use plain, casual language — no marketing-speak, no filler phrases like "This PR introduces" or "In order to improve"
     - Don't over-explain. If the change is straightforward, a one-liner description is fine
     - Only mention testing if there's something the reviewer needs to know (e.g., "needs manual QA on Safari" or "added integration tests for the new endpoint")

7. **Update the pull request** - Update the PR with the generated title and description:
   ```bash
   gh pr edit <PR-NUMBER> --title "<generated-title>" --body "<generated-description>"
   ```

8. **Report success** - Show the user:
   - The PR URL
   - The generated title
   - A summary of what was included in the description

9. **Run workflow doctor** - Monitor the GitHub Actions workflow triggered by the PR:

   Get the head commit SHA from the PR, then find the workflow run for that commit:
   ```bash
   gh pr view <PR-NUMBER> --json headRefOid --jq '.headRefOid'
   gh run list --commit <head-sha> --limit 1 --json databaseId --jq '.[0].databaseId'
   ```

   Then pass the run ID directly to the workflow doctor:
   ```
   /ai-tools:github-workflow-doctor <run-id>
   ```

## Writing Style

Write the PR title and description the way a busy senior developer would — someone who respects the reviewer's time.

**Principles:**
- **No rigid template.** Structure should follow naturally from the content. A one-line fix gets a one-line description. A multi-part feature might use a few bullets.
- **No emoji checkboxes.** Don't use ✅ or ❌ in descriptions.
- **No headers unless they help.** A `## Context` header for two sentences is noise. Just write the sentences. Use headers only when the PR is large enough that they aid scanning.
- **No filler.** Avoid "This PR...", "These changes...", "In this pull request...", "This commit introduces...". Just state what happened and why.
- **Be specific.** "Fixed the race condition in checkout when two tabs submit simultaneously" beats "Fixed a bug in the checkout flow".
- **Match the team's voice.** Look at recent PR descriptions in the repo and mirror their level of formality and detail.

**Avoid these AI tells:**
- Title Case On Every Word in the title (write naturally: "Fix null ref in order processing")
- Overly comprehensive bullet lists that restate the diff
- Phrases like "enhance", "streamline", "leverage", "utilize", "robust", "comprehensive", "ensure"
- Explaining obvious things ("Updated the import statement to import the new module")
- A perfectly symmetrical structure with exactly 3 bullets in every section

### Examples

Small fix:
```
Order total was wrong when discount codes were applied after tax calculation. Moved the discount step before tax.
```

Medium feature:
```
Adds webhook retry logic with exponential backoff.

- Failed webhooks retry up to 3 times (1s, 5s, 30s delays)
- Dead-lettered after final failure for manual review
- New `webhook_deliveries` table tracks attempt history

Needed for Acme integration — they have intermittent 502s that resolve within seconds.
```

Large change:
```
Migrates auth from session cookies to JWT tokens.

## Why
Session store was the bottleneck under load — 40% of Redis ops were session lookups.
JWTs let us validate stateless and drop that dependency for read-heavy paths.

## What changed
- New `/auth/token` endpoint issues short-lived JWTs (15 min) + refresh tokens (7 days)
- Middleware validates JWT signature instead of hitting Redis
- Session endpoints still work but are deprecated (remove in v3.2)

## Migration
Existing sessions remain valid until natural expiry. No user-facing disruption.
```

## Important Notes

- All PRs target `master`
- Build doctor runs first to detect, build, and auto-fix any issues
- The branch must be pushed to the remote before creating a PR
- If the branch name contains a ticket number (e.g., `MIN-1234-feature-name`), include it in the PR title
- Keep the PR title under 72 characters for better display in GitHub
- Use the imperative mood in titles: "Add feature" not "Added feature" or "Adds feature"
- **NEVER mention Claude, AI, or include AI attribution** in commit messages, PR titles, or PR descriptions (no "Co-Authored-By: Claude", no "Generated with Claude", etc.)
