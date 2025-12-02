# Cloudflare Expert Plugin

A comprehensive Claude Code plugin that provides expert guidance for building applications on the Cloudflare Developer Platform. This plugin integrates with Cloudflare documentation, provides specialized knowledge about Workers, platform products, and Workers AI, and includes automated workflow commands for development and deployment.

## Features

### Skills (Auto-activating Expertise)

1. **workers-development** - Core Workers runtime, fetch handlers, bindings, request/response handling
2. **wrangler-workflows** - Wrangler CLI commands, configuration, secrets, local development
3. **cloudflare-platform** - Platform products (R2, D1, KV, Durable Objects, Vectorize, Queues, etc.)
4. **workers-ai** - Workers AI models, inference, embeddings, AI Gateway, RAG architectures
5. **deployment-strategies** - CI/CD, environments, versioning, rollbacks, gradual rollouts

### Commands

- `/cloudflare:dev` - Launch interactive managed local development session with validation
- `/cloudflare:deploy` - Automated deployment workflow with pre-flight checks

### Agents (Autonomous Specialists)

1. **cloudflare-docs-specialist** - Searches Cloudflare documentation, fetches markdown docs, synthesizes answers
2. **workers-specialist** - Deep Workers development expertise, performance optimization, architecture
3. **workers-ai-specialist** - Specialized in Workers AI, model selection, RAG design, embeddings

### Living Memory System

The plugin maintains a living memory file at `.claude/cloudflare-expert.local.md` that adapts to your project:
- Frequently accessed documentation topics with summaries and reference URLs
- Recent commands used in your project
- Project-specific configuration notes
- Code snippets and patterns
- Common issues and solutions

The memory updates automatically after tasks requiring remote documentation lookups, and you can manually edit it at any time.

## Installation

### Option 1: Local Development

Clone or create the plugin in your desired location:

```bash
# Use with Claude Code
cc --plugin-dir /path/to/cloudflare-expert
```

### Option 2: Project-Specific

Copy the plugin to your project's `.claude-plugin/` directory:

```bash
cp -r cloudflare-expert /path/to/your-project/.claude-plugin/
```

## Prerequisites

- **Wrangler CLI**: Install with `npm install -g wrangler`
- **Cloudflare account**: Sign up at https://dash.cloudflare.com
- **Node.js**: Version 16.13.0 or higher

## Usage

### Skills

Skills activate automatically based on your questions and tasks:

- Ask about Workers APIs, fetch handlers, or bindings → `workers-development` skill activates
- Discuss wrangler commands or configuration → `wrangler-workflows` skill activates
- Query about platform products like R2, D1, or KV → `cloudflare-platform` skill activates
- Ask about AI models, embeddings, or RAG → `workers-ai` skill activates
- Discuss deployment or CI/CD → `deployment-strategies` skill activates

### Commands

#### Development Workflow

```bash
/cloudflare:dev
```

Launches a managed local development session that:
- Validates wrangler configuration
- Checks for required dependencies
- Runs `wrangler dev` with appropriate flags
- Monitors for errors and offers fixes

Options:
- `--remote`: Use remote resources instead of local
- `--port <number>`: Specify port (default: 8787)

#### Deployment Workflow

```bash
/cloudflare:deploy
```

Automated deployment with checks:
- Validates wrangler configuration
- Verifies bindings exist
- Runs tests if available
- Confirms deployment target
- Executes deployment
- Updates living memory

Options:
- `--env <name>`: Deploy to specific environment
- `--dry-run`: Validate without deploying

### Agents

Agents work autonomously when invoked or trigger automatically based on context:

**Documentation queries**:
```
"How do I set up D1 bindings?"
"What's the latest on Durable Objects?"
```
→ `cloudflare-docs-specialist` agent searches MCP and fetches docs

**Workers development**:
```
"Review my Worker code for performance issues"
"How should I structure this multi-route Worker?"
```
→ `workers-specialist` agent provides expertise

**Workers AI tasks**:
```
"Which model should I use for code generation?"
"Help me implement a RAG system with Vectorize"
```
→ `workers-ai-specialist` agent assists

### Living Memory

The plugin creates `.claude/cloudflare-expert.local.md` in your project to store:
- Frequently accessed topics
- Project-specific configuration
- Code snippets and patterns
- Common issues and solutions

**Manual editing**: You can edit this file directly to add your own notes and snippets.

**Auto-update**: After completing tasks that involve documentation lookups, the plugin will offer to update the memory with relevant information.

## MCP Integration

This plugin integrates with the Cloudflare Documentation MCP server for real-time access to Cloudflare documentation. The MCP server is configured automatically in `.mcp.json`.

**Tools available**:
- `search_cloudflare_documentation` - Search the full Cloudflare documentation
- `migrate_pages_to_workers_guide` - Guide for migrating from Pages to Workers

## Project Structure

```
cloudflare-expert/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest
├── skills/                       # Auto-activating skills
│   ├── workers-development/
│   ├── wrangler-workflows/
│   ├── cloudflare-platform/
│   ├── workers-ai/
│   └── deployment-strategies/
├── commands/                     # Slash commands
│   ├── dev.md
│   └── deploy.md
├── agents/                       # Autonomous specialists
│   ├── cloudflare-docs-specialist.md
│   ├── workers-specialist.md
│   └── workers-ai-specialist.md
├── .mcp.json                     # MCP server configuration
└── README.md                     # This file
```

## Future Enhancements

- Pre-deployment hooks for configuration validation
- Integration with Playwright MCP for E2E testing
- Additional skills for specific products (Pages, Stream, Images)
- CI/CD template generation
- Cost estimation and optimization recommendations

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

MIT
