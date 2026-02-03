---
name: fix-unit-tests
version: 1.0.0
description: Systematically fix test failures using resource-aware parallel subagents with automatic test framework detection
author: Wayne Brantley
category: Testing
tags: [testing, parallel, automation, quality, debugging]
recommended_skills:
  - calculate-parallelism  # For automatic resource optimization
---

# Fix Unit Tests

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

---

## Core Workflow

### 1. Discovery & Analysis

Auto-detect test framework and run discovery:

```bash
node scripts/detect-test-environment.mjs  # Detect framework
node scripts/run-discovery.mjs            # Run tests + validation
```

Parse output to identify files with errors:

```bash
node scripts/parse-validate-output.mjs table
```

**Output**: List of files sorted by error count (fix high-impact files first)

### 2. Calculate Parallelism

Determine optimal parallelism based on system resources and test framework:

```bash
# Auto-calculates based on:
# - Vitest/Jest: 2GB per agent
# - Playwright: 5GB per agent (browser instances)
# - .NET Test: 3GB per agent
node calculate-parallelism.mjs --mem-per-agent=<framework_value>
```

Uses **calculate-parallelism** skill for resource-aware execution (2-6 parallel agents).

### 3. Parallel File Fixing

**CRITICAL**: Process ALL files with errors, not just the first one!

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

### 4. Progress Verification

Verify ALL files were processed:

```bash
node scripts/verify-progress.mjs initial-files.txt fixed-files.txt
```

If files remain, spawn subagents for remaining files.

### 5. Final Validation

Run complete validation after ALL files processed:

```bash
node scripts/run-final-validation.mjs
```

**Expected**: All tests passing, zero type/lint errors.

If issues remain: Identify regressions, spawn fix subagents, repeat (max 2 cycles).

### 6. Skipped Tests Check

After all errors fixed, check for skipped tests:

```bash
node scripts/find-skipped-tests.mjs
```

If found, ask user if they want to fix and re-enable them.

---

## Resource Management

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
4. **Verify Locally**: Run validation before reporting completion
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
