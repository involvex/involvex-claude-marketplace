
## Code Search: CLAUDEMEM ENFORCED

> Added by `code-analysis` plugin v2.3.0

### Automatic Interception

The code-analysis plugin automatically intercepts search tools:

| Tool | Behavior |
|------|----------|
| **Grep** | BLOCKED → Replaced with `claudemem search` |
| **Bash grep/rg/find** | BLOCKED → Replaced with `claudemem search` |
| **Glob (broad patterns)** | WARNING → Suggests `claudemem search` |
| **Read (bulk 3+ files)** | WARNING → Suggests `claudemem search` |

### Why

- **Semantic search** - Finds code by meaning, not just text patterns
- **Pre-indexed** - Instant results from vector database
- **Ranked results** - Most relevant code chunks first
- **No noise** - Excludes generated types, fixtures, node_modules

### Manual Commands

```bash
claudemem search "authentication flow"  # Semantic search
claudemem status                         # Check index
claudemem index                          # Re-index project
```

### How It Works

1. You call `Grep({ pattern: "auth" })`
2. PreToolUse hook intercepts the call
3. Hook runs `claudemem search "auth"` instead
4. Results returned to Claude as context
5. Original Grep is blocked

This is transparent - you get semantic results without changing your workflow.
