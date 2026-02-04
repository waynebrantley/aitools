# Calculate Parallelism

Analyzes available system resources and calculates optimal parallelism for test fixing operations.

## Usage

```bash
# Basic usage - displays formatted report (reserves 10% memory by default)
node calculate-parallelism.mjs

# JSON output for programmatic use
node calculate-parallelism.mjs --json

# Custom memory per subagent (default: 3GB)
node calculate-parallelism.mjs --mem-per-agent=4
node calculate-parallelism.mjs --mem-per-agent 5

# Custom memory reserve (default: 10% of total)
node calculate-parallelism.mjs --mem-reserve=20%
node calculate-parallelism.mjs --mem-reserve=2GB
node calculate-parallelism.mjs --mem-reserve=512MB
```

## How It Works

The script analyzes:
- **Available Memory**: Free system memory in GB
- **CPU Cores**: Total number of CPU cores
- **CPU Load**: Current system load average

It calculates optimal parallelism by:
1. Subtracting reserved memory from available (default: 10% of total)
2. Computing memory-based limit: `(availableMemory - reserved) / memoryPerSubagent`
3. Computing CPU-based limit: `cpuCores`
4. Taking the minimum of the two
5. Reducing by 50% if system is saturated (load ≥ cores)
6. Applying hard caps: minimum 2, maximum 6

## Testing

Run the comprehensive test suite:

```bash
node calculate-parallelism.test.mjs
```

The test suite covers:
- Memory-constrained scenarios
- CPU-constrained scenarios
- System saturation handling
- Hard limit enforcement (min/max)
- Custom memory per subagent
- Edge cases and integration scenarios

All 16 tests should pass.

## Cross-Platform

Written in Node.js (ESM) for cross-platform compatibility on Windows, macOS, and Linux.
