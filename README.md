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

### ai-tools:calculate-parallelism

Calculates optimal parallelism for spawning subagents based on available system resources (memory, CPU, load). Prevents resource exhaustion by adapting to system capabilities.

**Usage**: Automatically invoked when other skills need to determine safe parallel execution limits.

### ai-tools:test-doctor

Systematically fixes test failures (unit, E2E, server-side) using resource-aware parallel subagents with file-level isolation and iterative verification.

**Usage**: Invoke with `/ai-tools:test-doctor` or ask "fix my tests"

### ai-tools:build-doctor

Fixes build errors and warnings across TypeScript and .NET projects. Runs builds, parses errors, and systematically fixes issues.

**Usage**: Invoke with `/ai-tools:build-doctor` or ask "fix my build"

### ai-tools:github-workflow-doctor

Fixes failing GitHub Actions workflows by analyzing logs and fixing issues.

**Usage**: Invoke with `/ai-tools:github-workflow-doctor` or ask "fix my GitHub workflow"

### ai-tools:parallel-coding-workflow

Orchestrates parallel development workflows using multiple subagents for large tasks.

**Usage**: Automatically invoked for complex multi-file tasks

## Development

### Adding Your Own Skills

1. Create a new directory in `plugins/ai-tools/skills/` (e.g., `plugins/ai-tools/skills/my-skill/`)
2. Add a `SKILL.md` file with YAML frontmatter:
   ```yaml
   ---
   name: my-skill
   description: Use this skill when...
   ---
   ```
   (The skill will be invoked as `/ai-tools:my-skill`)
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
