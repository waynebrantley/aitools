# AI Tools Plugin - Changelog

## 2025-02-04

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
