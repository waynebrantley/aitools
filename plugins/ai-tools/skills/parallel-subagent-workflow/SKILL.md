---
name: parallel-subagent-workflow
version: 1.0.0
description: Execute complex multi-task workflows using parallel subagent coordination with automatic resource optimization
author: Wayne Brantley
category: Workflow Orchestration
tags: [parallel, orchestration, workflow, coordination, performance, automation]
recommended_skills:
  - calculate-parallelism  # For automatic resource optimization
---

# Parallel Subagent Workflow

Execute complex tasks in parallel using multiple general-purpose subagents with intelligent resource-based coordination and iterative error resolution.

**Scope**: Generic orchestration skill for complex multi-task workflows requiring parallel execution.

---

## Quick Start

**Simple usage:**
```bash
/parallel-subagent-workflow Implement user authentication across frontend and backend
```

**With custom parallelism:**
```bash
/parallel-subagent-workflow --parallelism=6 Fix null reference errors across 12 files
```

**That's it!** The skill handles:
- ✅ Task decomposition into parallelizable work items
- ✅ Parallel execution coordination (2-6 agents)
- ✅ Consolidated testing after all coding completes
- ✅ Iterative error resolution until 100% success
- ✅ Automatic resource management

---

## When to Use This Skill

Use `/parallel-subagent-workflow` when:
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

1. **Calculate Resources**: Determine optimal parallelism (auto-detected or user-specified)
2. **Decompose Tasks**: Break down work into independent, parallelizable items
3. **Phase 1 - Parallel Coding**: Launch up to MAX_PARALLEL subagents for implementation
4. **Phase 2 - Testing**: Single test agent validates all changes
5. **Phase 3 - Fix Iteration**: If tests fail, spawn fix agents (respecting parallelism)
6. **Repeat**: Continue fix-test cycles until zero errors remain

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

### Phase Rules

**Phase 1: Parallel Coding**
- Launch up to MAX_PARALLEL subagents concurrently
- Each subagent focuses on coding only (NO testing)
- Wait for ALL coding to complete before testing

**Phase 2: Consolidated Testing**
- Single test subagent validates all changes
- Collects comprehensive failure reports

**Phase 3: Iterative Fixes**
- Spawn individual fix subagents for failures (respect MAX_PARALLEL)
- Fix agents code only (NO testing)
- Return to Phase 2 and repeat until zero errors

---

## Configuration

### Basic Usage
```bash
/parallel-subagent-workflow <task description>
```

### Advanced Options
```bash
# Custom parallelism (2-6 recommended)
/parallel-subagent-workflow --parallelism=6 <task>

# Light workloads (more parallelism)
/parallel-subagent-workflow --parallelism=6 --mem-per-agent=2 <task>

# Heavy workloads (less parallelism)
/parallel-subagent-workflow --parallelism=3 --mem-per-agent=4 <task>
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
/parallel-subagent-workflow Implement user authentication with login, logout, and session management across frontend and backend
```

**Execution**: Decomposes into [Frontend login UI, Backend auth API, Session store, Logout handler, Auth middleware, Frontend state], spawns 6 parallel coding agents, tests all changes, iteratively fixes failures.

### Example 2: Multi-File Bug Fix
```bash
/parallel-subagent-workflow Fix null reference errors in order processing workflow (affects 12 files)
```

**Execution**: Batches 12 file fixes across 3 rounds of 4 parallel agents, tests all changes, fixes regressions iteratively.

### Example 3: Complex Refactoring
```bash
/parallel-subagent-workflow Refactor legacy payment processing to use new payment gateway API
```

**Execution**: Decomposes into [Update models, Migrate client, Refactor checkout, Update admin UI, Migrations, Update tests], executes in parallel batches, tests thoroughly, fixes issues until complete.

---

## Tool Coordination

- **Bash**: Run calculate-parallelism (if installed) to determine MAX_PARALLEL
- **Task**: Spawn general-purpose subagents with `subagent_type="general-purpose"`
- **TodoWrite**: Track workflow progress (optional)
- **Read/Grep/Glob**: Gather context before decomposition

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
