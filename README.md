# AI Tools Plugin

Productivity skills and utilities for Claude Code.

## Features

- Custom skills for enhanced workflows
- Ready for marketplace distribution

## Installation

### From GitHub

In Claude Code, run:
```
/plugin marketplace add waynebrantley/aitools
/plugin install ai-tools@waynebrantley-aitools
```

### Local Testing

```bash
claude --plugin-dir /path/to/aitools/plugins/ai-tools
```

## Usage

Once installed, the plugin's skills will be available in Claude Code. Skills are triggered automatically when relevant to user queries.

## Skills

### wb:calculate-parallelism

Calculates optimal parallelism for spawning subagents based on available system resources (memory, CPU, load). Prevents resource exhaustion by adapting to system capabilities.

**Usage**: Automatically invoked when skills need to determine safe parallel execution limits.

### wb:fix-unit-tests

Systematically fixes frontend unit test failures using resource-aware parallel subagents with file-level isolation and iterative verification. Designed for JavaScript/TypeScript frontend tests (Vitest, Jest, etc.).

**Usage**: Invoke with `/wb:fix-unit-tests` or ask "fix my unit tests"

## Development

### Adding Your Own Skills

1. Create a new directory in `plugins/ai-tools/skills/` (e.g., `plugins/ai-tools/skills/my-skill/`)
2. Add a `SKILL.md` file with YAML frontmatter:
   ```yaml
   ---
   name: wb:my-skill
   description: Use this skill when...
   ---
   ```
3. Include supporting resources as needed (references/, examples/, scripts/)

### Testing

Test the plugin locally:

```bash
claude --plugin-dir /path/to/aitools/plugins/ai-tools
```

## Repository

- GitHub: [https://github.com/waynebrantley/aitools](https://github.com/waynebrantley/aitools)
- Issues: [https://github.com/waynebrantley/aitools/issues](https://github.com/waynebrantley/aitools/issues)

## Marketplace

This plugin is ready for marketplace distribution.

## License

MIT
