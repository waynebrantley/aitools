# AI Tools Plugin - Changelog

## 0.6.0 — 2026-02-04

### Fix globSync API usage on Windows (build-doctor, test-doctor)

- Replaced invalid `nodir`/`ignore` options with clean `fs.globSync` calls — these npm `glob` options were silently ignored by the Node.js built-in
- Normalize `cwd` paths to forward slashes for Windows compatibility
- Removed unsupported frontmatter fields (`version`, `author`, `category`, `tags`, `recommended_skills`) from all skill files — only `description` and other [documented fields](https://code.claude.com/docs/en/skills#frontmatter-reference) are valid

### create-pr: handle missing build frameworks (create-pr)

- create-pr now asks the user instead of silently skipping when build-doctor reports "no frameworks detected"

## 0.5.0 — 2026-02-04

### Subagent lifecycle and resource management (test-doctor, build-doctor, parallel-coding-workflow)

- Added **Subagent Lifecycle** section to Resource Management in all three skills:
  - Prohibit `run_in_background: true` for fix subagents — use foreground Task calls only
  - Require all subagents to complete before advancing to the next workflow phase
  - Enforce single-message parallel spawning so completion is tracked deterministically
  - Prevent orphaned agents from running past phase boundaries

### Final validation must not be parallelized (test-doctor, build-doctor)

- Added explicit guidance: run final validation as a single sequential command in the main agent
- Prevents duplicate browser instances or redundant validation runs caused by the agent spawning multiple subagents for validation

### Subagents must use file-targeted commands (test-doctor, build-doctor)

- Changed subagent verification requirement from generic "Verify Locally" to explicit `verify-fix.mjs {file}` usage
- Added `eslint .`, `eslint src`, `tsc` (whole-project) to the DON'T list for subagents
- Updated the subagent prompt template in test-doctor to include verification command and prohibition
- Prevents subagents from running expensive whole-project linting when only one file needs checking
