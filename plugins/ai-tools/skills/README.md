# AI Tools Skills

This directory contains skills for the ai-tools plugin.

## Testing

All skills with non-trivial scripts must have comprehensive tests.

### Running All Tests

Before releasing or committing skill changes, run all tests:

```bash
node run-all-tests.mjs
```

This will:
- Discover all test files across all skills
- Run each test file
- Report a summary of passed/failed tests
- Exit with code 1 if any tests fail

### Test Organization

All tests should be in a separate `tests/` directory, mirroring the structure of `scripts/`:

```
my-skill/
├── scripts/
│   ├── my-script.mjs
│   └── adapters/
│       └── my-adapter.mjs
└── tests/
    ├── my-script.test.mjs
    └── adapters/
        └── my-adapter.test.mjs
```

This provides:
- Clear separation between production and test code
- Easy to find all tests in one location
- Consistent structure across all skills

### Writing Tests

Use Node.js built-in test runner:

```javascript
#!/usr/bin/env node

import { test } from 'node:test';
import assert from 'node:assert';
import { myFunction } from '../scripts/my-script.mjs';

test('myFunction does what it should', () => {
  const result = myFunction('input');
  assert.strictEqual(result, 'expected');
});

console.log('✅ All tests passed');
```

## Current Test Coverage

Run `node run-all-tests.mjs` to see current test statistics.

As of the last update:
- **calculate-parallelism**: 16 tests
- **fix-unit-tests**: 106 tests (52 core + 54 adapter tests)
- **Total**: 122 tests
