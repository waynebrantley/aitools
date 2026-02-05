# AI Tools Plugin - Changelog

## 0.7.3 — 2026-02-05

### Fix new skills to match project standards (address-pr-comments, pr-doctor)

- Removed unsupported frontmatter fields (`version`, `author`, `category`, `tags`, `recommended_skills`) — same fix as 0.6.0
- Added "do NOT work around script failures" error handling guidance — same fix as 0.7.2
- Removed trailing version/author footer blocks

## 0.7.2 — 2026-02-05

### Add script failure error handling guidance (all doctor skills)

- All three doctor skills (build-doctor, test-doctor, github-workflow-doctor) now explicitly instruct agents NOT to work around script failures
- When scripts produce no output or fail, agents must report the issue and ask the user — not silently invent workarounds like running raw CLI commands

## 0.7.1 — 2026-02-05

### Fix entry point guards for mixed-slash paths (all skills)

- The 0.7.0 fix was insufficient: when skills are invoked from SKILL.md with paths containing mixed slashes (e.g., `C:\...\0.5.0/skills/...`), `process.argv[1]` preserves the mixed slashes but `fileURLToPath()` normalizes to all backslashes on Windows
- All 16 scripts now use `resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))` to normalize both paths before comparison
- Added `resolve` import from 'path' where needed

## 0.7.0 — 2026-02-04

### Fix main entry point guards on Windows (all skills)

- All 16 `.mjs` scripts used entry point guards that silently failed on Windows, causing scripts to produce no output when run directly
- Two broken patterns replaced with cross-platform `process.argv[1] === fileURLToPath(import.meta.url)`:
  - `process.argv[1] === new URL(import.meta.url).pathname` — pathname has leading `/` and forward slashes on Windows
  - `` import.meta.url === `file://${process.argv[1]}` `` — argv uses backslashes, import.meta.url uses forward slashes
- This was the root cause of workflow-doctor scripts producing no output during create-pr, causing the agent to bypass the scripts and run raw `gh` commands

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
