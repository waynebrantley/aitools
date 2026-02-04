---
version: 1.0.0
description: Calculate optimal parallelism for parallel subagent execution based on system resources
author: Wayne Brantley
category: Utility
tags: [parallelism, resources, optimization, performance]
---

# Calculate Parallelism

Analyzes system resources (memory, CPU, load) and calculates the optimal number of parallel subagents to spawn without overwhelming the system.

**Scope**: Generic utility for any workflow requiring parallel task execution.

---

## Purpose

Prevents resource exhaustion by:
- Detecting available memory and CPU cores
- Checking system load
- Calculating safe parallelism limits
- Applying coordination caps

---

## Usage

### Basic Usage

```bash
# Default: uses 3GB per subagent, reserves 10% of total memory
node calculate-parallelism.mjs

# Custom memory per subagent
node calculate-parallelism.mjs --mem-per-agent=2

# Custom memory reserve (percentage or absolute)
node calculate-parallelism.mjs --mem-reserve=20%
node calculate-parallelism.mjs --mem-reserve=2GB
node calculate-parallelism.mjs --mem-reserve=512MB

# JSON output for programmatic use
node calculate-parallelism.mjs --json
```

### Output Formats

**Default (Human-readable):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Resource Analysis
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Memory:  24GB available / 32GB total
CPU:     8 cores, load average: 2 (normal)
Limit:   coordination overhead (capped at 6)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Running up to 6 parallel subagents
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6
```

**JSON:**
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

---

## How It Works

### Calculation Algorithm

1. **Memory Reserve**: Subtract reserved memory from available (default: 10% of total)
2. **Memory Constraint**: `(available_memory_gb - reserved) / mem_per_agent` (default: 3GB/agent)
3. **CPU Constraint**: `physical_cpu_cores`
4. **Load Adjustment**: Reduce by 50% if `load_average >= cpu_cores`
5. **Apply Limits**: `clamp(min(memory, cpu) × load_factor, MIN=2, MAX=6)`

**Limiting Factors:**
- `"memory"` - Available memory is bottleneck
- `"CPU"` - CPU cores are bottleneck
- `"coordination overhead (capped at 6)"` - Hit maximum cap
- `"minimum enforced"` - System constrained, using minimum

### Example Calculations

| System | Memory | CPU | Load | Result | Limiting Factor |
|--------|--------|-----|------|--------|-----------------|
| High-end | 24/32GB | 8 cores | 2 | **6** | Coordination cap |
| Mid-range | 12/16GB | 4 cores | 1 | **4** | CPU & Memory |
| Busy | 20/32GB | 8 cores | 10 | **3** | High load (50% reduction) |
| Low-memory | 6/8GB | 4 cores | 1 | **2** | Memory |

---

## Configuration

### Command Line Arguments

```bash
# Override memory per subagent (default: 3GB)
--mem-per-agent=<number>

# Memory to keep free (default: 10%)
# Accepts: percentage (10%), megabytes (512MB), gigabytes (2GB), or plain number (GB)
--mem-reserve=<value>

# JSON output
--json
```

### Constants

```javascript
DEFAULT_MEM_PER_SUBAGENT_GB = 3   // Memory per subagent
DEFAULT_MEM_RESERVE_PERCENT = 10  // % of total memory to keep free
MIN_PARALLEL = 2                  // Minimum parallelism
MAX_PARALLEL_CAP = 6              // Maximum parallelism
LOAD_REDUCTION_FACTOR = 50        // Reduction % when saturated
```

---

## Used By

- **fix-unit-tests** - Parallel test file fixing
- **parallel-coding-workflow** - Generic parallel execution
- Any skill spawning multiple concurrent subagents

---

## Platform Support

**Cross-platform**: Works on macOS, Linux, and Windows
- Uses Node.js `os` module for resource detection
- Falls back to conservative defaults if detection fails

---

## When to Use

Use when you need to:
- ✅ Spawn multiple parallel subagents
- ✅ Process files/tasks in parallel
- ✅ Avoid system resource exhaustion
- ✅ Adapt to different system capabilities

---

**Remember**: Resource-aware execution ensures optimal performance without overwhelming the system, whether running on a high-end workstation or a resource-constrained laptop.

**Version**: 1.0.0
**License**: MIT
**Author**: Wayne Brantley
