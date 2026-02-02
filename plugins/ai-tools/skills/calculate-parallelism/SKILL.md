---
name: wb:calculate-parallelism
description: Calculate optimal parallelism for spawning subagents based on available system resources
---

# Calculate Parallelism

Analyzes available system resources (memory, CPU, load) and calculates the optimal number of parallel subagents to spawn without overwhelming the system.

**Scope**: Generic utility skill for any workflow requiring parallel task execution.

## Purpose

Prevents resource exhaustion when spawning multiple parallel subagents by:
- Detecting available memory and CPU cores
- Checking system load
- Calculating safe parallelism limits
- Applying hard caps to prevent coordination overhead

## Usage

### Basic Usage

```bash
# Get optimal parallelism value (single number output)
MAX_PARALLEL=$(node .claude/skills/calculate-parallelism/calculate-parallelism.mjs)
echo "Will run $MAX_PARALLEL parallel tasks"

# Specify custom memory per subagent (default: 3GB)
MAX_PARALLEL=$(node .claude/skills/calculate-parallelism/calculate-parallelism.mjs --mem-per-agent=2)
echo "Will run $MAX_PARALLEL parallel tasks (using 2GB per agent)"
```

### JSON Output

```bash
# Get detailed resource analysis
node .claude/skills/calculate-parallelism/calculate-parallelism.mjs --json
```

**JSON output format:**
```json
{
  "max_parallel": 6,
  "total_memory_gb": 32,
  "available_memory_gb": 24,
  "cpu_cores": 8,
  "cpu_load": 2,
  "limiting_factor": "coordination overhead (capped at 6)"
}
```

### Human-Readable Report

```bash
# Get formatted report (default when no --json flag)
node .claude/skills/calculate-parallelism/calculate-parallelism.mjs
```

**Report output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Resource Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Memory:  24GB available / 32GB total
CPU:     8 cores, load average: 2 (normal)
Limit:   coordination overhead (capped at 6)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Running up to 6 parallel fix subagents
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6
```

## Calculation Algorithm

### 1. Memory Constraint

```
memory_limit = available_memory_gb / 3
```

- Assumes **3GB per subagent** (source files + test files + type-checking + validation)
- Uses **available** memory (not total)
- Conservative to prevent OOM

### 2. CPU Constraint

```
cpu_limit = physical_cpu_cores
```

- Test fixing is CPU-intensive (type-checking, test execution, linting)
- No benefit spawning more subagents than cores
- Prevents CPU thrashing

### 3. Load Constraint

```
if load_average >= cpu_cores:
  load_factor = 50%  # Reduce by half
else:
  load_factor = 100%
```

- Reduces parallelism if system is saturated
- Prevents adding load to already busy system

### 4. Final Calculation

```
max_parallel = min(memory_limit, cpu_limit) × load_factor
max_parallel = clamp(max_parallel, MIN=2, MAX=6)
```

- Takes whichever resource is more constrained
- Applies load reduction if needed
- Enforces hard limits:
  - **Minimum: 2** - Always use some parallelism
  - **Maximum: 6** - Coordination overhead diminishes returns

### 5. Limiting Factor

Reports which constraint determined the final value:
- `"memory"` - Available memory is the bottleneck
- `"CPU"` - CPU cores are the bottleneck
- `"coordination overhead (capped at 6)"` - Hit maximum cap
- `"minimum enforced"` - System too constrained, using minimum

## Example Calculations

| System | Memory (Avail/Total) | CPU | Load | Calculation | Result | Limiting Factor |
|--------|---------------------|-----|------|-------------|--------|-----------------|
| High-end dev | 24GB / 32GB | 8 cores | 2 | min(8, 8) × 100% → cap | **6** | Coordination cap |
| Mid-range | 12GB / 16GB | 4 cores | 1 | min(4, 4) × 100% | **4** | CPU & Memory |
| Busy system | 20GB / 32GB | 8 cores | 10 | min(6, 8) × 50% | **3** | High load |
| Low-memory | 6GB / 8GB | 4 cores | 1 | min(2, 4) × 100% | **2** | Memory |

## Platform Support

**Cross-platform**: Works on macOS, Linux, and Windows
- Uses Node.js `os` module for resource detection
- Falls back to conservative defaults if detection fails

## Skills That Use This

- **fix-unit-tests** - Parallel test file fixing
- **parallel-subagent-workflow** - Generic parallel task execution
- Any skill spawning multiple subagents concurrently

## Configuration

### Command Line Arguments

```bash
# Override memory per subagent (default: 3GB)
node calculate-parallelism.mjs --mem-per-agent=2

# Can also use space separator
node calculate-parallelism.mjs --mem-per-agent 2.5

# Combine with JSON output
node calculate-parallelism.mjs --mem-per-agent=4 --json
```

### Default Constants

Constants in `calculate-parallelism.mjs`:

```javascript
const DEFAULT_MEM_PER_SUBAGENT_GB = 3  // Default memory per subagent (overridable via CLI)
const MIN_PARALLEL = 2                 // Minimum parallelism
const MAX_PARALLEL_CAP = 6             // Maximum parallelism
const LOAD_REDUCTION_FACTOR = 50       // Load reduction %
```

## Exit Codes

- `0` - Success (always)
- Script never fails - returns conservative values if errors occur

## Output Modes

1. **Default** - Human-readable report + final value
   - Best for interactive use
   - Shows detailed resource analysis
   - Last line is the MAX_PARALLEL value (for shell capture)

2. **JSON** (`--json`) - Machine-readable format
   - Best for programmatic use
   - Structured data for parsing
   - Includes all resource metrics

## Integration Pattern

```bash
#!/bin/bash

# Calculate optimal parallelism
MAX_PARALLEL=$(node .claude/skills/calculate-parallelism/calculate-parallelism.mjs)

# Use in parallel task spawning
for ((i=0; i<$MAX_PARALLEL; i++)); do
  spawn_subagent "${files[$i]}" &
done

# Wait for batch to complete before spawning more
wait
```

## When to Use

Use this skill whenever you need to:
- ✅ Spawn multiple parallel subagents
- ✅ Process files/tasks in parallel
- ✅ Avoid overwhelming system resources
- ✅ Adapt to different system capabilities
- ✅ Prevent memory exhaustion or CPU thrashing

## Performance Benefits

- **Adaptive**: Automatically scales to system capabilities
- **Safe**: Prevents resource exhaustion
- **Efficient**: Maximizes parallelism without waste
- **Portable**: Works across different machines and environments

---

**Remember**: Resource-aware execution ensures optimal performance without overwhelming the system, whether running on a high-end workstation or a resource-constrained laptop.
