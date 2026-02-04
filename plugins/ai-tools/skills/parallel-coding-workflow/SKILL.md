---
description: Execute complex multi-task workflows using parallel subagent coordination with automatic resource optimization
---

# Parallel Coding Workflow

Execute complex tasks in parallel using multiple general-purpose subagents with intelligent resource-based coordination and iterative error resolution.

**Scope**: Generic orchestration skill for complex multi-task workflows requiring parallel execution.

---

## Quick Start

**Simple usage:**
```bash
/parallel-coding-workflow Implement user authentication across frontend and backend
```

**With custom parallelism:**
```bash
/parallel-coding-workflow --parallelism=6 Fix null reference errors across 12 files
```

**That's it!** The skill handles:
- ✅ Task decomposition into parallelizable work items
- ✅ Parallel execution coordination (2-6 agents)
- ✅ Consolidated testing after all coding completes
- ✅ Iterative error resolution until 100% success
- ✅ Automatic resource management

---

## When to Use This Skill

Use `/parallel-coding-workflow` when:
- ✅ Task requires multiple independent operations (3+ work items)
- ✅ Work can be parallelized (e.g., multiple files, features, or components)
- ✅ Complex refactoring across many files
- ✅ Multi-component feature implementation
- ✅ Batch operations (migrations, updates, fixes)

Do NOT use when:
- ❌ Single file or simple task
- ❌ Work is inherently sequential
- ❌ Task requires deep exploration first

---

## How It Works

### Workflow Phases

**IMPORTANT**: Use the **TodoWrite** tool throughout this workflow to track progress and ensure ALL work items are completed.

1. **Calculate Resources**: Determine optimal parallelism (auto-detected or user-specified)
2. **Decompose Tasks**: Break down work into independent, parallelizable items
3. **Create Todo List**: Add all work items to TodoWrite for tracking
4. **Phase 1 - Parallel Coding**: Launch up to MAX_PARALLEL subagents for implementation
5. **Phase 2 - Testing**: Single test agent validates all changes
6. **Phase 3 - Fix Iteration**: If tests fail, spawn fix agents (respecting parallelism)
7. **Repeat**: Continue fix-test cycles until zero errors remain

### Initial Task Planning

Before starting parallel execution, create a comprehensive todo list:

```
TodoWrite:
1. Calculate optimal parallelism (pending)
2. Decompose task into work items (pending)
3. Implement work item: [Feature A] (pending)
4. Implement work item: [Feature B] (pending)
5. Implement work item: [Feature C] (pending)
... (one todo per work item)
N. Run consolidated testing (pending)
N+1. Fix any test failures (pending)
```

Mark each todo as `in_progress` when spawning its subagent, and `completed` when the subagent finishes successfully.

### Resource Management

**Automatic (Recommended)**: Install the `calculate-parallelism` skill for:
- Auto-detection of system memory and CPU
- Load-aware parallelism adjustment
- Prevention of resource exhaustion

**Manual (Default)**: Uses conservative default of 4 parallel agents

**Resource Strategy:**
- 3GB per subagent (conservative estimate)
- Minimum 2, maximum 6 parallel agents
- Auto-reduces by 50% if system is saturated (with calculate-parallelism)

### Subagent Lifecycle

- **Do NOT use `run_in_background: true`** when spawning subagents. Always use foreground Task calls so you know exactly when each agent completes.
- **Wait for ALL subagents in a phase to complete** before proceeding to the next phase.
- **Track active agents**: When spawning parallel agents, send all Task calls in a single message. The response will contain all results, confirming they are complete.
- **No orphaned agents**: Never move between phases while subagents are still running.

### Phase Rules

**Phase 1: Parallel Coding**
- Launch up to MAX_PARALLEL subagents concurrently
- Each subagent focuses on coding only (NO testing)
- Wait for ALL coding subagents to complete before moving to Phase 2

**Phase 2: Consolidated Testing**
- Single test subagent validates all changes (do NOT spawn multiple test agents)
- Collects comprehensive failure reports

**Phase 3: Iterative Fixes**
- Spawn individual fix subagents for failures (respect MAX_PARALLEL)
- Fix agents code only (NO testing)
- Wait for ALL fix subagents to complete, then return to Phase 2

---

## Configuration

### Basic Usage
```bash
/parallel-coding-workflow <task description>
```

### Advanced Options
```bash
# Custom parallelism (2-6 recommended)
/parallel-coding-workflow --parallelism=6 <task>

# Light workloads (more parallelism)
/parallel-coding-workflow --parallelism=6 --mem-per-agent=2 <task>

# Heavy workloads (less parallelism)
/parallel-coding-workflow --parallelism=3 --mem-per-agent=4 <task>
```

### Defaults
- **Parallelism**: 4 agents (or auto-calculated)
- **Memory per agent**: 3GB
- **Agent range**: 2-6 agents
- **Load reduction**: 50% if system saturated (requires calculate-parallelism)

---

## Usage Examples

### Example 1: Multi-Component Feature
```bash
/parallel-coding-workflow Implement user authentication with login, logout, and session management across frontend and backend
```

**Execution**: Decomposes into [Frontend login UI, Backend auth API, Session store, Logout handler, Auth middleware, Frontend state], spawns 6 parallel coding agents, tests all changes, iteratively fixes failures.

### Example 2: Multi-File Bug Fix
```bash
/parallel-coding-workflow Fix null reference errors in order processing workflow (affects 12 files)
```

**Execution**: Batches 12 file fixes across 3 rounds of 4 parallel agents, tests all changes, fixes regressions iteratively.

### Example 3: Complex Refactoring
```bash
/parallel-coding-workflow Refactor legacy payment processing to use new payment gateway API
```

**Execution**: Decomposes into [Update models, Migrate client, Refactor checkout, Update admin UI, Migrations, Update tests], executes in parallel batches, tests thoroughly, fixes issues until complete.

---

## Tool Coordination

- **TodoWrite**: Track workflow progress and work item status (REQUIRED - use throughout)
- **Bash**: Run calculate-parallelism (if installed) to determine MAX_PARALLEL
- **Task**: Spawn general-purpose subagents with `subagent_type="general-purpose"`
- **Read/Grep/Glob**: Gather context before decomposition

### TodoWrite Examples

**Phase 1 - Initial Planning:**
```
1. Calculate optimal parallelism (in_progress)
2. Decompose task into work items (pending)
3. Implement frontend login UI (pending)
4. Implement backend auth API (pending)
5. Implement session storage (pending)
6. Implement auth middleware (pending)
7. Run consolidated testing (pending)
```

**Phase 2 - Parallel Coding (MAX_PARALLEL=4):**
```
1. Calculate optimal parallelism (completed)
2. Decompose task into work items (completed)
3. Implement frontend login UI (in_progress)
4. Implement backend auth API (in_progress)
5. Implement session storage (in_progress)
6. Implement auth middleware (in_progress)
7. Run consolidated testing (pending)
```

**Phase 3 - Testing:**
```
1-6. [All coding tasks] (completed)
7. Run consolidated testing (in_progress)
```

**Phase 4 - Fix Iteration (if needed):**
```
1-6. [All coding tasks] (completed)
7. Run consolidated testing (completed)
8. Fix auth API test failures (in_progress)
9. Fix session storage race condition (in_progress)
10. Re-run testing (pending)
```

**Phase 5 - Complete:**
```
1-9. [All tasks] (completed)
10. Re-run testing (completed)
```

---

## Error Handling

- **Subagent Timeout**: Retry with adjusted scope
- **Memory Exhaustion**: Reduce parallelism or install calculate-parallelism
- **Persistent Failures**: After 3 fix-test cycles, escalate to user
- **Coordination Failures**: Log state and resume from last phase

---

## Boundaries

### Will Do
- Calculate parallelism automatically or use safe defaults
- Spawn multiple general-purpose subagents for independent tasks
- Maintain strict separation between coding and testing phases
- Iterate on failures until completion
- Respect MAX_PARALLEL limits always

### Will Not Do
- Exceed MAX_PARALLEL concurrent subagents
- Mix coding and testing in same subagent
- Run tests before all coding completes
- Proceed with errors remaining
- Use specialized subagents (only general-purpose)
- Cause system resource exhaustion

---

## FAQ

**Q: Do I need the calculate-parallelism skill?**
A: No, but recommended. Without it, defaults to 4 parallel agents. With it, automatically optimizes based on your system.

**Q: What parallelism should I use manually?**
A: 8GB RAM → `--parallelism=2`, 16GB RAM → `--parallelism=4`, 32GB+ RAM → `--parallelism=6`

**Q: What if tasks keep failing?**
A: After 3 fix-test cycles, the skill escalates to user for guidance.

**Q: Can I interrupt mid-execution?**
A: Yes, subagents terminate but completed work remains in codebase.

---

## Troubleshooting

### "calculate-parallelism not found"
Skill uses default parallelism=4. For resource-aware execution, install calculate-parallelism from marketplace.

### "Subagents exhausting memory"
Reduce with `--parallelism=2` or install calculate-parallelism for automatic management.

### "Tests keep failing after cycles"
After 3 cycles, review failures manually or adjust task description to be more specific.

---

**Remember**: Designed for complex workflows where parallelism provides time savings. For simple tasks (1-2 files), direct implementation is more efficient.

**Version**: 1.0.0
**License**: MIT
**Author**: Wayne Brantley
