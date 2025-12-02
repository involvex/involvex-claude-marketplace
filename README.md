# Steve's Claude Code Plugin Marketplace

A personal plugin marketplace for Claude Code development, featuring curated plugins for learning context engineering and agentic development patterns.

## Overview

This marketplace serves as both a learning environment and a toolkit for Claude Code plugin development. It follows a monorepo structure to enable rapid experimentation while maintaining clear plugin boundaries.

## Structure

```
claude-marketplace/
├── .claude-plugin/
│   └── marketplace.json     # Marketplace registry
├── plugins/                 # Individual plugins
│   └── cloudflare-expert/   # Cloudflare Developer Platform plugin
└── CLAUDE.md                # Guide for Claude Code instances
```

## Plugins

### cloudflare-expert (v0.1.0)

Comprehensive guidance for building on the Cloudflare Developer Platform.

**Features:**
- 5 auto-activating skills (Workers, Wrangler, Platform, AI, Deployment)
- 2 workflow commands (/cloudflare:dev, /cloudflare:deploy)
- 3 specialized agents (docs, workers, AI specialists)
- MCP integration with Cloudflare documentation
- Living memory system

**Installation:**
```bash
cc --plugin-dir /path/to/claude-marketplace
```

Or reference specific plugin:
```bash
cc --plugin-dir /path/to/claude-marketplace/plugins/cloudflare-expert
```

## Usage

### Testing the Marketplace
```bash
# Test all plugins in marketplace
cd /path/to/claude-marketplace
cc --plugin-dir .

# Test specific plugin
cc --plugin-dir ./plugins/cloudflare-expert
```

### Adding New Plugins

1. Create plugin directory: `plugins/your-plugin-name/`
2. Add plugin manifest: `plugins/your-plugin-name/.claude-plugin/plugin.json`
3. Develop plugin components (skills, commands, agents)
4. Register in marketplace: Edit `.claude-plugin/marketplace.json`

## Development Philosophy

This marketplace emphasizes:
- **Experimentation**: Rapid iteration on plugin patterns
- **Context Engineering**: Exploring how context flows through plugins
- **Agentic Development**: Building autonomous, specialized agents
- **Progressive Disclosure**: Layered information architecture

## Roadmap

- [x] Cloudflare Developer Platform plugin
- [ ] Hooks experimentation plugin
- [ ] Shared utilities library
- [ ] Plugin development toolkit

## References

- [Claude Code Documentation](https://code.claude.com/docs)
- [Plugin Marketplace Guide](https://code.claude.com/docs/en/plugin-marketplaces)
- [Plugin Development Guide](https://code.claude.com/docs/en/plugins)

## License

MIT
