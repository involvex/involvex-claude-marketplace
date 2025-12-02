# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a **Claude Code Plugin Marketplace** - a repository for developing, testing, and managing Claude Code plugins. The repository follows the Claude Code plugin architecture with modular components.

## Repository Structure

```
claude-marketplace/
├── .claude-plugin/          # Marketplace metadata
│   └── marketplace.json     # Plugin registry/marketplace config
└── plugins/                 # Individual plugin projects
    └── cloudflare-expert/   # Cloudflare Developer Platform plugin
        ├── .claude-plugin/
        │   └── plugin.json  # Plugin manifest
        ├── skills/          # Auto-activating expertise modules
        ├── commands/        # Slash commands
        ├── agents/          # Autonomous specialist agents
        └── .mcp.json        # MCP server configuration
```

## Plugin Architecture Components

### Skills (Auto-Activating Expertise)
Skills are expertise modules that activate automatically based on conversation context. Located in `plugins/{name}/skills/`.

**Structure**:
- `SKILL.md` - Main skill content with YAML frontmatter
- `references/` - Detailed reference documentation
- `examples/` - Working code examples

**Frontmatter**:
```yaml
---
name: Skill Name
description: When this skill should activate (trigger keywords)
version: 0.1.0
---
```

### Commands (Slash Commands)
Interactive workflow commands that users invoke with `/plugin-name:command`. Located in `plugins/{name}/commands/`.

**Structure**: Markdown files with YAML frontmatter
```yaml
---
name: command-name
description: What this command does
argument-hint: "[optional-args]"
allowed-tools: ["Read", "Bash", "Write"]
---
```

### Agents (Autonomous Specialists)
Self-contained agents that work autonomously on specific tasks. Located in `plugins/{name}/agents/`.

**Frontmatter**:
```yaml
---
description: When to invoke this agent (trigger conditions)
model: sonnet|opus|haiku
color: blue|green|purple
allowed-tools: ["Read", "WebFetch", "Grep"]
---
```

### MCP Integration
Plugins can integrate MCP servers via `.mcp.json` for external tools and resources.

```json
{
  "mcpServers": {
    "server-name": {
      "url": "https://mcp.example.com/endpoint"
    }
  }
}
```

## Development Workflow

### Testing a Plugin Locally
```bash
# Test plugin in current directory
cc --plugin-dir /path/to/plugin-directory

# Test plugin from marketplace
cd /path/to/claude-marketplace
cc --plugin-dir plugins/cloudflare-expert
```

### Plugin Development Commands

**No build/compile step** - Plugins are markdown-based and load directly. Changes to plugin files are reflected when starting a new Claude Code session.

**Testing workflow**:
1. Edit plugin files (skills, commands, agents)
2. Start new `cc` session with `--plugin-dir`
3. Test functionality
4. Iterate

### File Organization Best Practices

**Skills**:
- Keep main SKILL.md focused and concise
- Move detailed documentation to `references/`
- Place working examples in `examples/`
- Use progressive disclosure (overview → detailed docs → examples)

**Commands**:
- Include clear step-by-step workflow
- Document expected arguments
- Specify allowed tools explicitly
- Provide troubleshooting guidance

**Agents**:
- Define clear trigger conditions in description
- Specify minimal necessary tools
- Choose appropriate model (haiku for simple tasks, sonnet for complex)
- Make agents fully autonomous

## Key Development Patterns

### Plugin Manifest (plugin.json)
Every plugin requires `.claude-plugin/plugin.json`:

```json
{
  "name": "plugin-name",
  "version": "0.1.0",
  "description": "Plugin description",
  "author": {
    "name": "Author Name",
    "email": "email@example.com"
  },
  "keywords": ["keyword1", "keyword2"],
  "license": "MIT"
}
```

### Skill Progressive Disclosure
Structure skills with layered information:
1. **Main SKILL.md**: Overview, common patterns, quick reference
2. **references/**: Deep-dive documentation
3. **examples/**: Working code samples

### Command Workflow Pattern
Commands should follow a validation → execution → monitoring pattern:
1. Validate configuration/environment
2. Offer fixes for issues
3. Execute command with appropriate flags
4. Monitor output and assist with errors

### Agent Autonomy
Agents should be self-contained:
- Clear trigger conditions
- Specific tool allowlist
- Complete instructions for autonomous operation
- Return synthesis, not raw data

## Important Constraints

### What NOT to Include
- Build/compile commands (plugins are markdown-based)
- Package.json or npm dependencies (plugins don't have Node dependencies)
- Testing frameworks (testing is manual via `cc` sessions)
- Deployment pipelines (plugins are distributed as directories)

### File Naming Conventions
- Skills: `SKILL.md` (uppercase)
- Commands: `{command-name}.md` (kebab-case)
- Agents: `{agent-name}.md` (kebab-case)
- Plugin manifest: `plugin.json` (always in `.claude-plugin/`)

### YAML Frontmatter Requirements
- Always include `---` delimiters
- Required fields vary by component type
- Use consistent indentation (2 spaces)
- Quote strings with special characters

## Common Development Tasks

### Adding a New Skill
1. Create `plugins/{plugin}/skills/{skill-name}/SKILL.md`
2. Add YAML frontmatter with name, description, version
3. Write skill content with overview and patterns
4. Create `references/` directory for detailed docs
5. Add `examples/` directory for code samples

### Adding a New Command
1. Create `plugins/{plugin}/commands/{command-name}.md`
2. Add YAML frontmatter with name, description, arguments, tools
3. Document step-by-step workflow
4. Include common issues and solutions
5. Provide usage examples

### Adding a New Agent
1. Create `plugins/{plugin}/agents/{agent-name}.md`
2. Add YAML frontmatter with description, model, color, tools
3. Define agent capabilities and process
4. Make instructions autonomous and complete
5. Specify when agent should return to user

### Integrating an MCP Server
1. Create or edit `plugins/{plugin}/.mcp.json`
2. Add server configuration with URL
3. Reference MCP tools in agent/command `allowed-tools`
4. Document MCP tools in relevant skills
5. Update plugin README with MCP integration details

## Repository-Specific Notes

### Cloudflare Expert Plugin
The `cloudflare-expert` plugin is a comprehensive example demonstrating:
- Multiple coordinated skills (workers, wrangler, platform, AI)
- Interactive commands (dev, deploy)
- Specialized agents (docs, workers, AI specialists)
- MCP integration (Cloudflare documentation)
- Living memory system (`.claude/cloudflare-expert.local.md`)

This serves as a reference implementation for well-structured plugins.

## Documentation Philosophy

Claude Code plugins emphasize **progressive disclosure**:
- Skills provide quick reference for common tasks
- References contain deep technical documentation
- Examples show working implementations
- Commands guide through workflows step-by-step
- Agents operate autonomously with complete context

Keep main files focused; defer details to reference files.
