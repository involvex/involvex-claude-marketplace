---
name: dev
description: Launch interactive managed local development session with wrangler dev, including configuration validation, dependency checks, and error monitoring
argument-hint: "[--remote] [--port <number>]"
allowed-tools: ["Read", "Grep", "Bash", "Write", "Edit"]
---

# Cloudflare Local Development Workflow

Launch an interactive managed `wrangler dev` session with automatic validation and monitoring.

## What This Command Does

1. **Validates configuration**: Checks wrangler.jsonc/wrangler.toml exists and is valid
2. **Checks dependencies**: Verifies wrangler is installed and package.json is configured
3. **Offers fixes**: Automatically fixes common configuration issues
4. **Runs wrangler dev**: Starts local development server with appropriate flags
5. **Monitors for errors**: Watches output and offers solutions to common problems

## Process

### Step 1: Locate and Validate Configuration

Check for wrangler configuration file:
- Look for `wrangler.jsonc` (preferred) or `wrangler.toml`
- If not found, ask user if they want to create one
- Read configuration and validate:
  - Has `name` field
  - Has `main` entry point
  - Has `compatibility_date`
  - Entry point file exists

### Step 2: Check Dependencies

Verify development environment:
- Check if `wrangler` is in package.json devDependencies
- If not, offer to add it: `npm install -D wrangler`
- Check if entry point file exists (src/index.ts, src/index.js, etc.)
- Verify any referenced bindings are configured

### Step 3: Determine Development Mode

Based on configuration and user arguments:
- Check if project uses bindings that require `--remote` (Vectorize, Workflows, AI in some cases)
- If `--remote` flag provided in arguments, use remote mode
- If bindings require remote, inform user and use `--remote`
- Otherwise, use local mode (default)

### Step 4: Run wrangler dev

Execute wrangler dev with appropriate flags:
```bash
wrangler dev [--remote] [--port PORT] [--live-reload]
```

Show user:
- Local URL (usually http://localhost:8787)
- Which mode (local vs remote)
- Any warnings about bindings

### Step 5: Monitor and Assist

- Display output verbosely so user sees what's happening
- If errors occur, identify common issues and offer solutions:
  - "Binding not found" → Check wrangler.jsonc bindings section
  - "Module not found" → Run `npm install`
  - "Port already in use" → Suggest different port with `--port`
  - "Vectorize not supported locally" → Suggest `--remote` flag

## Common Issues and Solutions

### Issue: wrangler not found
**Solution**: Install wrangler
```bash
npm install -D wrangler
```

### Issue: Binding not found in local mode
**Solution**: Check if binding requires remote mode
- Vectorize: Always requires `--remote`
- D1: Works locally with local SQLite
- KV: Works locally with simulated storage
- AI: May require `--remote` depending on usage

Suggest: `wrangler dev --remote`

### Issue: Port 8787 already in use
**Solution**: Use different port
```bash
wrangler dev --port 3000
```

### Issue: TypeScript errors
**Solution**: Check tsconfig.json and install types
```bash
npm install -D @cloudflare/workers-types
```

## Usage Examples

**Start local development**:
```
/cloudflare:dev
```

**Start with remote resources**:
```
/cloudflare:dev --remote
```

**Custom port**:
```
/cloudflare:dev --port 3000
```

**Remote with custom port**:
```
/cloudflare:dev --remote --port 3000
```

## Important Notes

- Always show verbose output so user sees what's happening
- Don't just run the command silently - validate first, explain what you're doing
- If configuration needs fixes, offer to fix them before running
- If bindings are misconfigured, explain the issue clearly
- After starting dev server, remind user they can use `/cloudflare:deploy` when ready

## References

- Use `wrangler-workflows` skill for wrangler command details
- Use `workers-development` skill for Workers runtime questions
- Use `cloudflare-platform` skill for binding configuration questions

Auto-activate relevant skills as needed during the workflow.
