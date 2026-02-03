---
name: build-doctor
version: 1.0.0
description: Diagnose and fix build errors using resource-aware parallel subagents with automatic framework detection
author: Wayne Brantley
category: Build
tags: [build, parallel, automation, quality, debugging, compilation]
recommended_skills:
  - calculate-parallelism  # For automatic resource optimization
---

# Build Doctor

Systematically fix build errors using parallel subagents with intelligent coordination, resource-aware execution, and iterative verification.

**Supported Build Frameworks:**
- **TypeScript/JavaScript**: tsconfig.json, ESLint, Prettier, tsc, npm/pnpm/yarn build
- **.NET**: Solution files (*.sln), Project files (*.csproj), dotnet build, dotnet format

---

## Warning Handling

**⚠️ Warnings are treated as errors by default.** This skill enforces zero-warning builds to maintain code quality.

**Framework-Specific Behavior:**

- **TypeScript/JavaScript**: All warnings from ESLint, TypeScript compiler, and build tools must be fixed
- **.NET**: All warnings must be fixed, **except** for excluded warning codes (see below)

**Excluded .NET Warnings:**
- `NU1902`: NuGet package vulnerability warnings (often cannot be immediately fixed due to upstream dependencies)
- `DX1000`: DevExpress evaluation license warnings (requires commercial license purchase)

To exclude additional warning codes, modify the `.NET adapter` configuration.

---

## When to Use

- ✅ Build failures with multiple errors across files
- ✅ Type/compilation errors blocking builds
- ✅ Lint/format errors preventing successful builds
- ✅ Build warnings that must be fixed
- ✅ After major refactoring or dependency updates
- ✅ Pre-commit cleanup needed
- ✅ Monorepos with multiple projects
- ✅ Projects with multiple build targets

---

## Core Workflow

**IMPORTANT**: Use the **TodoWrite** tool throughout this workflow to track progress and ensure ALL steps are completed. Create todos at the start and update them as you progress through each phase.

### Initial Task Planning

Before starting, create a comprehensive todo list:

**Single Framework:**
```
TodoWrite:
1. Detect build frameworks (pending)
2. Select framework(s) to fix (pending)
3. Run build discovery (pending)
4. Calculate parallelism (pending)
5. Fix files in parallel (pending)
6. Verify all files processed (pending)
7. Run final validation (pending)
```

**Multiple Frameworks** (use framework labels):
```
TodoWrite:
1. Detect build frameworks (pending)
2. Select framework(s) to fix (pending)
3. Run build discovery - ALL frameworks (pending)
4. Calculate parallelism (pending)
5. [.NET] Fix files in parallel (pending)
6. [TypeScript] Fix files in parallel (pending)
7. [.NET] Verify all files processed (pending)
8. [TypeScript] Verify all files processed (pending)
9. [.NET] Run final validation (pending)
10. [TypeScript] Run final validation (pending)
```

Mark each todo as `in_progress` when starting, and `completed` when finished. Add file-specific todos during the fixing phase.

### 1. Discovery & Analysis

Auto-detect build framework and run discovery:

```bash
node scripts/detect-build-environment.mjs  # Detect framework
```

**Output**: JSON array of detection objects (stderr shows summary, stdout contains JSON)

Each detection object has this structure:
```json
{
  "framework": "typescript",
  "displayName": "frontend (typescript)",
  "buildType": "typescript",
  "projectRoot": "/absolute/path/to/project",
  "config": {
    "packageManager": "pnpm",
    ...
  }
}
```

**IMPORTANT**: Use these **complete detection objects** throughout the workflow - do NOT extract just the `config` property!

### 2. Framework Selection (if multiple detected)

If multiple build frameworks are detected, prompt the user to select which to fix.

**Selection Strategy:**

**A. If 2-4 frameworks detected** - Use `AskUserQuestion` with `multiSelect: true`:

```
Which build frameworks would you like the doctor to look at?
```

**Options:**
1. **All frameworks (Recommended)** - Fix all build projects sequentially
2. Individual framework entries with details (up to 3):
   - Context-specific display name:
     - .NET: Solution/project name (e.g., "MyApp.sln (dotnet)" or "Backend.csproj (dotnet)")
     - TypeScript: Relative folder path (e.g., "frontend (typescript)" or "packages/ui (typescript)")
   - Project root path
   - Package manager or solution file (if applicable)

**B. If >4 frameworks detected** - Show grouped, numbered list and ask for text response:

Display frameworks grouped by type:

```
Detected 6 build frameworks:

**TypeScript (3 projects):**
1. frontend (typescript) - pnpm
2. packages/ui (typescript) - pnpm
3. packages/utils (typescript) - pnpm

**.NET (3 projects):**
4. API.sln (dotnet)
5. Services.csproj (dotnet)
6. Tests.csproj (dotnet)

Which would you like the doctor to look at (or all)?
```

**Store Selection**: Keep the **complete detection object(s)** for the selected framework(s). Each object must include: `framework`, `projectRoot`, `config`, `displayName`, and `buildType`.

**Processing Strategy:**

- **Single framework**: Continue with that framework's detection object only
- **Multiple frameworks**: Use parallel-framework optimization (see below)

**Parallel-Framework Optimization** (multiple frameworks selected):

1. Run discovery (step 3) on ALL frameworks first
2. Check build status:
   - **.NET builds successfully** (even with warnings) → Can proceed with fixing
   - **TypeScript/JavaScript builds successfully** (even with warnings) → Can proceed with fixing
   - **Framework fails to build** → Must fix critical errors first before warnings
3. **Start fixing frameworks in parallel**:
   - If .NET builds + TypeScript builds → Fix both simultaneously
   - Create separate todo groups for each framework
   - Spawn subagents for both frameworks (count toward total MAX_PARALLEL)
4. Each framework follows its own fixing workflow:
   - **.NET**: Fix all files → One final build
   - **TypeScript**: Fix file → Verify → Next
5. Final validation runs for ALL frameworks

**Example**: 16GB RAM with MAX_PARALLEL=4, .NET + TypeScript both build successfully:
- Spawn 2 .NET fix subagents (working on different files)
- Spawn 2 TypeScript fix subagents (working on different files)
- Total: 4 concurrent subagents across both frameworks

### 3. Run Build Discovery

Run build and validation for the selected framework(s):

```bash
# Pass the FULL detection object from step 1 (not just config property!)
# The detection object includes: framework, displayName, buildType, projectRoot, config
node scripts/run-build.mjs '<detection-object-json>'
```

**IMPORTANT**: The parameter must be the **complete detection object** from step 1, which includes:
- `framework`: The framework identifier (e.g., "typescript", "dotnet")
- `projectRoot`: Absolute path to the project root
- `config`: Framework-specific configuration
- `displayName`, `buildType`: Additional metadata

**Example**:
```bash
node scripts/run-build.mjs '{"framework":"typescript","displayName":"frontend (typescript)","buildType":"typescript","projectRoot":"/path/to/project","config":{"packageManager":"pnpm"}}'
```

Parse output to identify files with errors:

```bash
node scripts/parse-build-output.mjs table
```

**Output**: List of files sorted by error count (fix high-impact files first)

### 4. Calculate Parallelism

Determine optimal parallelism based on system resources and build framework:

```bash
# Auto-calculates based on:
# - TypeScript: 3GB per agent
# - .NET: 4GB per agent
node calculate-parallelism.mjs --mem-per-agent=<framework_value>
```

Uses **calculate-parallelism** skill for resource-aware execution (2-6 parallel agents).

### 5. Parallel File Fixing

**CRITICAL**: Process ALL files with errors, not just the first one!

**TodoWrite Integration**: When you receive the file list, create a todo for each file:

```
TodoWrite (add to existing list):
- Fix src/utils/helper.ts (12 errors) (pending)
- Fix src/components/Button.tsx (8 errors) (pending)
- Fix src/services/api.ts (5 errors) (pending)
... (one todo per file)
```

As you spawn subagents, mark files as `in_progress`. When verified, mark as `completed`.

**Framework-Specific Workflow:**

#### TypeScript/JavaScript: Fix → Verify → Next

For each file:
1. **Spawn Fix Subagent** → Fix the file
2. **Verify Fix** → Run `node scripts/verify-fix.mjs {file}` (checks individual file)
3. **Evaluate** → If success, mark completed and move to next file

#### .NET: Fix ALL Files → Verify Once

**IMPORTANT**: Do NOT run `dotnet build` or any verification during the fixing phase!

1. **Generate complete file list** from initial build errors
2. **Create todos for ALL files** (add to TodoWrite)
3. **Spawn fix subagents for ALL files** (respecting MAX_PARALLEL limit):
   ```
   Task: Fix all build errors in {filename}

   Context:
   - File: {path}
   - Framework: .NET
   - Issues: {compilation errors, warnings}

   Requirements:
   - Fix ALL issues in this file only
   - Do NOT modify other files
   - Do NOT run dotnet build to verify
   - Follow project standards (check CLAUDE.md)

   Success: All issues addressed in code
   ```

4. **Mark todos as completed** when subagent finishes (no verification yet)
5. **Wait for ALL files to be fixed** before verification
6. **Proceed to Step 7** (Final Validation) for single build verification

**Why this matters:**
- ✅ TypeScript: Can verify individual files (`tsc --noEmit file.ts`)
- ❌ .NET: Cannot compile individual C# files - requires full project build
- ❌ Running `dotnet build | grep` for each file wastes time and resources

### 6. Progress Verification

Verify ALL files were processed:

```bash
node scripts/verify-progress.mjs initial-files.txt fixed-files.txt
```

If files remain, spawn subagents for remaining files.

**For .NET projects**: This step confirms all files were addressed. Do NOT run builds here - verification happens in step 7.

### 7. Final Validation

Run complete validation after ALL files processed:

```bash
# Pass the same FULL detection object used in step 3
node scripts/run-final-build.mjs '<detection-object-json>'
```

**Expected**: All builds passing, zero type/lint errors.

**Framework-Specific Behavior:**

- **TypeScript/JavaScript**: This is a final comprehensive check (all files were already verified individually)
- **.NET**: This is the FIRST and ONLY build since fixing started - verifies ALL fixes together

**.NET Workflow Note**: The discovery/fixing phase builds **Debug configuration only** (where most warnings appear). Final validation then builds **both Debug and Release** to confirm all configurations are clean.

If issues remain:
- Identify which files still have errors
- Create new file-specific todos
- Spawn fix subagents for those files only
- Repeat (max 2 cycles for .NET, since verification is expensive)

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

- **TypeScript/JavaScript**: 3GB per agent (tsc + ESLint + build tools)
- **.NET**: 4GB per agent (Roslyn compiler + NuGet + build)

---

## Build Framework Detection

Auto-detection via `detect-build-environment.mjs`:

**TypeScript/JavaScript**:
- Detection: `tsconfig.json` or `typescript` in package.json
- Build Command: `npm/pnpm/yarn run build`
- Validation: prettier (optional), eslint --max-warnings=0, tsc --noEmit
- Patterns: `**/*.ts`, `**/*.tsx`, `**/*.js`, `**/*.jsx`
- Verification: Individual files (immediate)
- Warning Treatment: All warnings treated as errors

**.NET**:
- Detection: `*.sln`, `*.slnx`, or `*.csproj` files (prefer solution files)
- Build Command: `dotnet restore` + `dotnet build --configuration Debug` (during discovery only)
- Final Validation: Builds both Debug and Release configurations to verify all warnings are fixed
- Validation: `dotnet format --verify-no-changes` (only if detected in GitHub workflows)
- Patterns: `**/*.cs`, `**/*.csproj`, `**/*.sln`, `**/*.slnx`
- Verification: **Deferred to final build** - DO NOT run `dotnet build` during fixing phase
- Warning Treatment: All warnings treated as errors except NU1902 (NuGet vulnerabilities) and DX1000 (DevExpress license)

**CRITICAL .NET Rule**: After initial discovery, fix ALL files without building, then run ONE final build to verify all fixes together.

**Key .NET Behaviors:**
- If `.sln` or `.slnx` file exists, `.csproj` files are ignored (solution contains all projects)
- `dotnet format` is only run if detected in `.github/workflows/**/*.yml` files
- Individual file verification is not supported - all fixes verified in final build

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
1. Detects all build frameworks in the target directory
2. Runs build + validation - **read-only analysis**
3. Shows files that would be fixed (sorted by error count)

**Perfect for:**
- Understanding what the skill will do before running it
- Checking if your project is supported
- Seeing which files have the most issues

---

## Tool Coordination

- **TodoWrite**: Track workflow progress and file-level fixes (REQUIRED - use throughout)
- **Task**: Spawn parallel fix subagents with `subagent_type="general-purpose"`
- **Bash**: Run detection, build, verification scripts
- **Read/Grep/Glob**: Gather context before fixing

### TodoWrite Examples

**Phase 1 - Initial Planning:**
```
1. Detect build frameworks (in_progress)
2. Select framework(s) to fix (pending)
3. Run build discovery (pending)
4. Calculate parallelism (pending)
5. Fix files in parallel (pending)
6. Verify all files processed (pending)
7. Run final validation (pending)
```

**Phase 2a - During Parallel Fixing (Single Framework):**
```
1. Detect build frameworks (completed)
2. Select framework(s) to fix (completed)
3. Run build discovery (completed)
4. Calculate parallelism (completed)
5. Fix src/utils/helper.ts (12 errors) (in_progress)
6. Fix src/components/Button.tsx (8 errors) (in_progress)
7. Fix src/services/api.ts (5 errors) (pending)
8. Fix src/hooks/useAuth.ts (3 errors) (pending)
9. Verify all files processed (pending)
10. Run final validation (pending)
```

**Phase 2b - During Parallel Fixing (Multiple Frameworks, MAX_PARALLEL=4):**
```
1. Detect build frameworks (completed)
2. Select framework(s) to fix (completed)
3. Run build discovery - ALL frameworks (completed)
4. Calculate parallelism (completed)
5. [.NET] Fix Services/AuthService.cs (8 warnings) (in_progress)
6. [.NET] Fix Controllers/UserController.cs (5 warnings) (in_progress)
7. [TypeScript] Fix src/utils/helper.ts (12 errors) (in_progress)
8. [TypeScript] Fix src/components/Button.tsx (8 errors) (in_progress)
9. [.NET] Fix Models/User.cs (3 warnings) (pending)
10. [TypeScript] Fix src/services/api.ts (5 errors) (pending)
... (frameworks interleaved, 4 total subagents running)
```

**Phase 3 - Near Completion:**
```
1-8. [All file fixes] (completed)
9. Verify all files processed (in_progress)
10. Run final validation (pending)
```

---

## Supporting Scripts

All scripts are in `scripts/` directory and work cross-platform:

### Core Scripts

**`detect-build-environment.mjs`** - Auto-detect framework and config
```bash
node scripts/detect-build-environment.mjs [directory]
# Outputs JSON array (to stdout) of detection objects
# Each object has: framework, displayName, buildType, projectRoot, config
```

**`run-build.mjs`** - Run build + validation for discovery
```bash
node scripts/run-build.mjs '<detection-object-json>'
# Saves to build-output.txt and validate-output.txt
# Parameter must be the FULL detection object from detect-build-environment.mjs
```

**`parse-build-output.mjs`** - Parse and group errors by file
```bash
node scripts/parse-build-output.mjs [table|json]
# Outputs files sorted by error count
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

**`run-final-build.mjs`** - Final validation after all fixes
```bash
node scripts/run-final-build.mjs '<detection-object-json>'
# Parameter must be the same FULL detection object used throughout the workflow
# Automatically cleans up temporary files (build-output.txt, validate-output.txt)
```

---

## Subagent Requirements

Each fix subagent MUST:

1. **Read Context**: Source file, related files, project configuration
2. **Apply Standards**: Check CLAUDE.md, follow best practices
3. **Fix Systematically**: Build errors → Type errors → Lint errors
4. **Verify Locally**: Run validation before reporting completion
5. **Report Status**: Issues fixed, issues remaining, blockers

---

## Best Practices

### DO

- ✅ Calculate MAX_PARALLEL based on resources
- ✅ **Process ALL files** in error list (not just first!)
- ✅ Fix files in priority order (most issues first)
- ✅ Spawn subagents in parallel (up to MAX_PARALLEL)
- ✅ **Parallelize across frameworks** if multiple frameworks build successfully
- ✅ Verify each file individually (TypeScript only)
- ✅ Run full validation at end

### DON'T

- ❌ **Stop after fixing ONE file** (process ALL!)
- ❌ Exceed MAX_PARALLEL limit
- ❌ Skip file-level verification (TypeScript only - .NET verifies at end)
- ❌ **Run `dotnet build` during .NET fixing phase** (wait for final validation)
- ❌ Comment out code to "fix" build errors
- ❌ Modify multiple files per subagent

---

## Error Handling

- **Subagent Timeout**: Kill, log, retry once at end of queue
- **Persistent Failures**: After 3 attempts, mark for manual review
- **Regression Detected**: Spawn targeted fix subagents (max 2 cycles)
- **Memory Exhaustion**: Wait for current subagents, reduce MAX_PARALLEL

---

## Success Criteria

Skill succeeds when all checks pass (framework-specific):

**TypeScript/JavaScript**:
- `tsc --noEmit` passes with zero warnings (type checking)
- `eslint --max-warnings=0` passes (linting, zero warnings)
- `npm/pnpm/yarn run build` passes with zero warnings (build)

**.NET**:
- `dotnet build` passes with zero warnings (except excluded codes)
- `dotnet format --verify-no-changes` passes (only if used in GitHub workflows)
- Excluded warnings: NU1902 (NuGet package vulnerabilities)

---

## Dependencies

- **calculate-parallelism** - Determines optimal parallelism based on system resources

---

**Remember**: Process ALL files with errors, not just the first one! Resource-aware execution ensures optimal performance without overwhelming the system.

**Version**: 1.0.0
**License**: MIT
**Author**: Wayne Brantley
