---
name: setup
description: Add claudemem enforcement rules to project CLAUDE.md and verify setup
allowed-tools: Read, Write, Edit, Bash, AskUserQuestion
---

# Setup Claudemem Enforcement

This command sets up claudemem semantic search enforcement for this project.

## Steps

### 1. Check claudemem installation

```bash
which claudemem && claudemem --version
```

If not installed, guide user:
```bash
npm install -g claude-codemem
claudemem init
```

### 2. Check index status

```bash
claudemem status
```

If not indexed:
```bash
claudemem index
```

### 3. Check CLAUDE.md for existing rules

Read the project's CLAUDE.md and look for the marker:
`## Code Search: CLAUDEMEM ENFORCED`

### 4. If rules not present, ask user

```typescript
AskUserQuestion({
  questions: [{
    question: "Add claudemem enforcement rules to CLAUDE.md?",
    header: "Setup",
    multiSelect: false,
    options: [
      { label: "Yes, add rules (Recommended)", description: "Adds documentation about Grep/Glob interception" },
      { label: "No, skip", description: "Hooks will still work, just no documentation in CLAUDE.md" }
    ]
  }]
})
```

### 5. Inject rules if user agrees

Append the following to CLAUDE.md:

```markdown

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
```

### 6. Confirm setup

Report status:
- claudemem installed: Yes/No
- claudemem indexed: Yes/No (X chunks)
- CLAUDE.md rules: Added/Already present/Skipped
- Hooks active: Yes (via plugin.json)

## Success Message

```
✅ Claudemem enforcement setup complete!

- Grep/rg/find will be automatically replaced with semantic search
- Broad Glob patterns will show suggestions
- Bulk file reads will show warnings

Test it by running any Grep command - it should be intercepted.
```
