---
description: Diagnose and fix test failures using resource-aware parallel subagents with automatic test framework detection
---

# Test Doctor

Systematically fix test failures using parallel subagents with intelligent coordination, resource-aware execution, and iterative verification.

**Supported Test Frameworks:**
- **Unit Tests**: Vitest, Jest (JavaScript/TypeScript)
- **E2E Tests**: Playwright (browser-based)
- **Server-Side Tests**: .NET Test (NUnit, xUnit, MSTest for C#)

---

## When to Use

- ✅ Multiple test files failing simultaneously
- ✅ Type/compilation errors blocking tests
- ✅ Lint/format errors causing failures
- ✅ After major refactoring or dependency updates
- ✅ Pre-commit cleanup needed
- ✅ Monorepos with multiple test projects
- ✅ Projects with multiple test frameworks

---

## Core Workflow

**IMPORTANT**: Use the **TodoWrite** tool throughout this workflow to track progress and ensure ALL steps are completed. Create todos at the start and update them as you progress through each phase.

### Initial Task Planning

Before starting, create a comprehensive todo list:

```
TodoWrite:
1. Detect test frameworks (pending)
2. Select framework(s) to fix (pending)
3. Run test discovery (pending)
4. Calculate parallelism (pending)
5. Fix files in parallel (pending)
6. Verify all files processed (pending)
7. Run final validation (pending)
8. Check for skipped tests (pending)
```

Mark each todo as `in_progress` when starting, and `completed` when finished. Add file-specific todos during the fixing phase.

### 1. Discovery & Analysis

Auto-detect test framework and run discovery:

```bash
node scripts/detect-test-environment.mjs  # Detect framework
```

**Output**: JSON array of detected frameworks (may contain multiple entries)

### 2. Framework Selection (if multiple detected)

If multiple test frameworks are detected, prompt the user to select which to fix.

**Selection Strategy:**

**A. If 2-4 frameworks detected** - Use `AskUserQuestion` with `multiSelect: true`:

```
Which test framework(s) would you like to fix?
```

**Options:**
1. **All frameworks (Recommended)** - Fix all test projects sequentially
2. Individual framework entries with details (up to 3):
   - Display name and test type (e.g., ".NET Test (unit)")
   - Project root path
   - Framework variant (e.g., "xunit", "nunit")
   - Project file (if applicable)

**B. If >4 frameworks detected** - Show grouped, numbered list and ask for text response:

Display frameworks grouped by type:

Detected 6 test frameworks:

**.NET Test (4 projects):**
1. WebSite.Tests.E2E (xunit)
2. NTC.Data.EFCore.Tests (nunit)
3. WebSite.Tests (xunit)
4. WebSite.Tests.E2E (xunit)

**JavaScript (2 projects):**
5. Vitest (unit tests)
6. Playwright (e2e tests)

Which would you like to fix (or all)?

**Store Selection**: Keep the selected framework config(s) for the workflow.

**Processing:**
- **If "All" or all selected**: Process each framework sequentially (repeat steps 3-8 for each)
- **If multiple selected**: Process selected frameworks sequentially
- **If single selected**: Continue with that framework only

### 3. Run Discovery

Run tests and validation for the selected framework(s):

```bash
node scripts/run-discovery.mjs            # Run tests + validation
```

Parse output to identify files with errors:

```bash
node scripts/parse-validate-output.mjs table
```

**Output**: List of files sorted by error count (fix high-impact files first)

### 4. Calculate Parallelism

Determine optimal parallelism based on system resources and test framework:

```bash
# Auto-calculates based on:
# - Vitest/Jest: 2GB per agent
# - Playwright: 5GB per agent (browser instances)
# - .NET Test: 3GB per agent
node calculate-parallelism.mjs --mem-per-agent=<framework_value>
```

Uses **calculate-parallelism** skill for resource-aware execution (2-6 parallel agents).

### 5. Parallel File Fixing

**CRITICAL**: Process ALL files with errors, not just the first one!

**TodoWrite Integration**: When you receive the file list, create a todo for each file:

```
TodoWrite (add to existing list):
- Fix tests/unit/auth.test.ts (5 failures) (pending)
- Fix tests/integration/api.spec.ts (3 failures) (pending)
- Fix tests/e2e/checkout.spec.ts (2 failures) (pending)
... (one todo per file)
```

As you spawn subagents, mark files as `in_progress`. When verified, mark as `completed`.

For each file in error list:

1. **Spawn Fix Subagent** (respecting MAX_PARALLEL limit):
   ```
   Task: Fix all issues in {filename}

   Context:
   - File: {path}
   - Framework: {detected_framework}
   - Issues: {test failures, type errors, lint errors}

   Requirements:
   - Fix ALL issues in this file only
   - Do NOT modify other files
   - Follow project standards (check CLAUDE.md)
   - Maintain test coverage
   - Verify with: node scripts/verify-fix.mjs {file}
   - Do NOT run whole-project commands (eslint ., eslint src, tsc)

   Success: Zero test failures, type errors, and lint errors
   ```

2. **Verify Fix**:
   ```bash
   node scripts/verify-fix.mjs {file}
   ```

3. **Evaluate Result**:
   - ✅ **Success** (zero errors): Mark fixed, move to next
   - ⚠️ **Partial** (fewer errors): Retry with remaining issues (max 3 attempts)
   - ❌ **Failed**: Escalate to user

### 6. Progress Verification

Verify ALL files were processed:

```bash
node scripts/verify-progress.mjs initial-files.txt fixed-files.txt
```

If files remain, spawn subagents for remaining files.

### 7. Final Validation

**IMPORTANT**: Run this as a single sequential command directly in the main agent. Do NOT spawn subagents or use the Task tool for this step.

Run complete validation after ALL files processed:

```bash
node scripts/run-final-validation.mjs
```

**Expected**: All tests passing, zero type/lint errors.

If issues remain: Identify regressions, spawn fix subagents for the specific failing files, then re-run this validation step (max 2 cycles).

### 8. Skipped Tests Check

After all errors fixed, check for skipped tests:

```bash
node scripts/find-skipped-tests.mjs
```

If found, ask user if they want to fix and re-enable them.

---

## Resource Management

### Subagent Lifecycle

- **Do NOT use `run_in_background: true`** when spawning fix subagents. Always use foreground Task calls so you know exactly when each agent completes.
- **Wait for ALL subagents to complete** before proceeding to the next phase (e.g., all fix agents must finish before running Progress Verification or Final Validation).
- **Track active agents**: When spawning parallel agents, send all Task calls in a single message. The response will contain all results, confirming they are complete.
- **No orphaned agents**: Never move to Final Validation while fix subagents are still running.

### Key Constraints

- **Never exceed MAX_PARALLEL** concurrent subagents
- **Queue remaining files** if limit reached
- **Monitor resources** during execution:
  - Memory < 2GB: Pause new spawns
  - CPU load > 150%: Reduce MAX_PARALLEL by 1
  - I/O saturated: Stagger launches (10s delay)

### Framework-Specific Resources

- **Vitest/Jest**: 2GB per agent (standard unit tests)
- **Playwright**: 5GB per agent (browser instances + execution)
- **.NET Test**: 3GB per agent (compilation + execution)

---

## Test Framework Detection

Auto-detection via `detect-test-environment.mjs`:

**Vitest/Jest**:
- Detection: `vitest`, `jest`, or `vite` in package.json
- Test Command: `pnpm/npm/yarn exec vitest run`
- Validation: prettier (optional), eslint, tsc
- Patterns: `**/*.test.ts`, `**/*.spec.tsx`

**Playwright**:
- Detection: `@playwright/test` in package.json or `playwright.config.ts`
- Test Command: `npx playwright test`
- Validation: prettier (optional), eslint, tsc
- Patterns: `**/*.spec.ts`, `e2e/**/*.test.ts`
- Special: Higher resource usage, reduced parallelism

**.NET Test**:
- Detection: `Microsoft.NET.Test.Sdk`, `NUnit3`, `xunit`, `MSTest` in .csproj
- Test Command: `dotnet test <project>.csproj`
- Validation: `dotnet format`, `dotnet build`
- Patterns: `**/*Test.cs`, `**/*Tests.cs`

---

## Preview Mode

Before running the full skill, preview what would be detected and fixed:

```bash
# From skill directory
node preview.mjs [target-directory]

# Uses Git repository root if no directory specified
node preview.mjs
```

**What it does:**
1. Detects all test frameworks in the target directory
2. Runs discovery (tests + validation) - **read-only analysis**
3. Shows files that would be fixed (sorted by error count)
4. Finds skipped tests that could be re-enabled

**Perfect for:**
- Understanding what the skill will do before running it
- Checking if your project is supported
- Seeing which files have the most issues

---

## Tool Coordination

- **TodoWrite**: Track workflow progress and file-level fixes (REQUIRED - use throughout)
- **Task**: Spawn parallel fix subagents with `subagent_type="general-purpose"`
- **Bash**: Run detection, test, verification scripts
- **Read/Grep/Glob**: Gather context before fixing

### TodoWrite Examples

**Phase 1 - Initial Planning:**
```
1. Detect test frameworks (in_progress)
2. Select framework(s) to fix (pending)
3. Run test discovery (pending)
4. Calculate parallelism (pending)
5. Fix files in parallel (pending)
6. Verify all files processed (pending)
7. Run final validation (pending)
8. Check for skipped tests (pending)
```

**Phase 2 - During Parallel Fixing:**
```
1. Detect test frameworks (completed)
2. Select framework(s) to fix (completed)
3. Run test discovery (completed)
4. Calculate parallelism (completed)
5. Fix tests/unit/auth.test.ts (5 failures) (in_progress)
6. Fix tests/integration/api.spec.ts (3 failures) (in_progress)
7. Fix tests/e2e/checkout.spec.ts (2 failures) (pending)
8. Fix tests/unit/validation.test.ts (1 failure) (pending)
9. Verify all files processed (pending)
10. Run final validation (pending)
11. Check for skipped tests (pending)
```

**Phase 3 - Near Completion:**
```
1-8. [All file fixes] (completed)
9. Verify all files processed (completed)
10. Run final validation (in_progress)
11. Check for skipped tests (pending)
```

---

## Supporting Scripts

All scripts are in `scripts/` directory and work cross-platform:

### Core Scripts

**`detect-test-environment.mjs`** - Auto-detect framework and config
```bash
node scripts/detect-test-environment.mjs [directory]
# Outputs JSON with framework, projectRoot, config
```

**`run-discovery.mjs`** - Run tests + validation for discovery
```bash
node scripts/run-discovery.mjs
# Saves to test-output.txt and validate-output.txt
```

**`parse-validate-output.mjs`** - Parse and group errors by file
```bash
cat test-output.txt validate-output.txt | node scripts/parse-validate-output.mjs
```

**`verify-fix.mjs`** - Verify single file fix
```bash
node scripts/verify-fix.mjs <file> [--json]
# Exit 0: fixed, 1: errors remain
```

**`verify-progress.mjs`** - Check all files processed
```bash
node scripts/verify-progress.mjs initial.txt fixed.txt
```

**`run-final-validation.mjs`** - Final validation after all fixes
```bash
node scripts/run-final-validation.mjs
```

**`find-skipped-tests.mjs`** - Find skipped tests
```bash
node scripts/find-skipped-tests.mjs [--json]
```

---

## Subagent Requirements

Each fix subagent MUST:

1. **Read Context**: Source file, test file, related components
2. **Apply Standards**: Check CLAUDE.md, follow best practices
3. **Fix Systematically**: Test failures → Type errors → Lint errors
4. **Verify Using verify-fix.mjs**: Run `node scripts/verify-fix.mjs {file}` to validate the fix. Do NOT run `eslint .`, `eslint src`, or any whole-project validation commands. Always target the specific file being fixed.
5. **Report Status**: Issues fixed, issues remaining, blockers

---

## Best Practices

### DO

- ✅ Calculate MAX_PARALLEL based on resources
- ✅ **Process ALL files** in error list (not just first!)
- ✅ Fix files in priority order (most issues first)
- ✅ Spawn subagents in parallel (up to MAX_PARALLEL)
- ✅ Verify each file individually
- ✅ Run full validation at end

### DON'T

- ❌ **Stop after fixing ONE file** (process ALL!)
- ❌ Exceed MAX_PARALLEL limit
- ❌ Skip file-level verification
- ❌ Run whole-project commands in subagents (`eslint .`, `eslint src`, `tsc`) — always target the specific file
- ❌ Delete tests to "fix" failures
- ❌ Modify multiple files per subagent

---

## Error Handling

- **Subagent Timeout**: Kill, log, retry once at end of queue
- **Persistent Failures**: After 3 attempts, mark for manual review
- **Regression Detected**: Spawn targeted fix subagents (max 2 cycles)
- **Memory Exhaustion**: Wait for current subagents, reduce MAX_PARALLEL

---

## Success Criteria

Skill succeeds when BOTH pass (framework-specific):

**Vitest/Jest**: `vitest run` passes + `prettier + eslint + tsc` passes
**Playwright**: `playwright test` passes + `prettier + eslint + tsc` passes
**.NET Test**: `dotnet test` passes + `dotnet format + dotnet build` passes

After success, check for skipped tests and offer to fix them.

---

## Dependencies

- **calculate-parallelism** - Determines optimal parallelism based on system resources

---

**Remember**: Process ALL files with errors, not just the first one! Resource-aware execution ensures optimal performance without overwhelming the system.

**Version**: 1.0.0
**License**: MIT
**Author**: Wayne Brantley
