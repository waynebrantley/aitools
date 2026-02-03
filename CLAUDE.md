# Repository Guidelines

## Scripting

Always write scripts in Node.js using the `.mjs` extension for cross-platform compatibility. Avoid platform-specific shell scripts (bash, PowerShell, etc.) unless absolutely necessary.

### Script Creation

When creating scripts:
- Use `.mjs` files with ES module syntax (`import`/`export`)
- Leverage Node.js built-in modules for file system operations, process management, etc.
- Ensure scripts work on Windows, macOS, and Linux
- Use `node script.mjs` as the execution method
- Include shebang: `#!/usr/bin/env node`
- Add JSDoc headers with description, usage, and exit codes

### Script Organization

For skills in `ai-tools/skills/`:
- Keep scripts in a `scripts/` subdirectory within each skill
- Use descriptive, kebab-case names (e.g., `detect-frontend-dir.mjs`)
- Keep SKILL.md focused on workflow; scripts handle implementation

Example structure:
```
skills/
  my-skill/
    SKILL.md          # Instructions and workflow
    scripts/          # Supporting scripts
      detect-env.mjs
      run-checks.mjs
```

### Script Implementation

**Execute commands directly** - Don't output command strings:
```javascript
// ✅ DO: Execute directly (cross-platform)
import { execSync } from 'child_process';
execSync('pnpm exec eslint src', { stdio: 'inherit' });

// ❌ DON'T: Output commands requiring shell eval
console.log('pnpm exec eslint src');  // Requires bash to eval
```

**Error handling**:
```javascript
try {
  execSync('some-command', { encoding: 'utf-8' });
} catch (error) {
  console.error('❌ Command failed:', error.message);
  process.exit(1);
}
```

**Output separation**:
- `stdout` for data (JSON, parseable output)
- `stderr` for diagnostics (user messages, progress)

**Exit codes**:
- `0` - Success
- `1` - General failure
- `2` - Invalid usage/arguments

### Testing Scripts

Always write tests for non-trivial scripts:
- Use Node.js built-in test runner (node:test)
- Place all tests in a `tests/` directory (separate from `scripts/`)
- Mirror the scripts structure: `scripts/adapters/foo.mjs` → `tests/adapters/foo.test.mjs`
- Export functions from scripts for testing
- Run tests with: `node script.test.mjs`

**Pre-release testing:**
- Run all skill tests before releasing: `node plugins/ai-tools/skills/run-all-tests.mjs`
- All tests must pass before committing skill changes
- This ensures cross-platform compatibility and prevents runtime errors

**Directory structure:**
```
my-skill/
  scripts/          # Production code only
    foo.mjs
    adapters/
      bar.mjs
  tests/            # All tests
    foo.test.mjs
    adapters/
      bar.test.mjs
```
