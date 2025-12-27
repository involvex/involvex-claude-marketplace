# PROXY_MODE Implementation Guide

**Purpose:** Fix the gap where orchestrators use wrong agents for external model reviews
**Priority:** HIGH - Prevents wasted time and incorrect multi-model execution

---

## Overview

The problem: When running multi-model reviews via Claudish, orchestrators often use `general-purpose` agents instead of PROXY_MODE-enabled agents.

The solution: Update documentation, add validation, and create clear reference materials.

---

## Implementation Tasks

### Task 1: Update Multi-Model Validation Skill (HIGH PRIORITY)

**File:** `plugins/orchestration/skills/multi-model-validation/SKILL.md`

**Location:** Add after the "Pattern 3: Proxy Mode Implementation" section (around line 527)

**Add this section:**

```markdown
### PROXY_MODE-Enabled Agents Reference

**CRITICAL**: Only these agents support PROXY_MODE. Using other agents (like `general-purpose`) will NOT work correctly.

#### Supported Agents by Plugin

| Agent | Plugin | subagent_type | Best For |
|-------|--------|---------------|----------|
| `reviewer` | agentdev | `agentdev:reviewer` | Implementation quality reviews |
| `architect` | agentdev | `agentdev:architect` | Design plan reviews |
| `developer` | agentdev | `agentdev:developer` | Implementation with external models |
| `plan-reviewer` | frontend | `frontend:plan-reviewer` | Architecture plan validation |
| `reviewer` | frontend | `frontend:reviewer` | Code reviews |
| `architect` | frontend | `frontend:architect` | Architecture design |
| `designer` | frontend | `frontend:designer` | Design reviews |
| `ui-developer` | frontend | `frontend:ui-developer` | UI implementation reviews |
| `editor` | seo | `seo:editor` | SEO content reviews |
| `writer` | seo | `seo:writer` | Content generation |
| `analyst` | seo | `seo:analyst` | Analysis tasks |

#### How to Check if an Agent Supports PROXY_MODE

Look for `<proxy_mode_support>` in the agent's definition file:

```bash
grep -l "proxy_mode_support" plugins/*/agents/*.md
```

#### Common Mistakes

| ❌ WRONG | ✅ CORRECT | Why |
|----------|-----------|-----|
| `subagent_type: "general-purpose"` | `subagent_type: "agentdev:reviewer"` | general-purpose has no PROXY_MODE |
| `subagent_type: "Explore"` | `subagent_type: "agentdev:architect"` | Explore is for exploration, not reviews |
| Prompt: "Run claudish with model X" | Prompt: "PROXY_MODE: model-x\n\n[task]" | Don't tell agent to run claudish, use directive |

#### Correct Pattern Example

```typescript
// ✅ CORRECT: Use PROXY_MODE-enabled agent with directive
Task({
  subagent_type: "agentdev:reviewer",
  description: "Grok design review",
  run_in_background: true,
  prompt: `PROXY_MODE: x-ai/grok-code-fast-1

Review the design plan at ai-docs/feature-design.md

Focus on:
1. Completeness
2. Missing considerations
3. Potential issues
4. Implementation risks`
})

// ❌ WRONG: Using general-purpose and instructing to run claudish
Task({
  subagent_type: "general-purpose",
  description: "Grok design review",
  prompt: `Review using Grok via claudish:
  npx claudish --model x-ai/grok-code-fast-1 ...`
})
```
```

---

### Task 2: Update /develop Command (HIGH PRIORITY)

**File:** `plugins/agentdev/commands/develop.md`

**Location:** Find the PHASE 1.5 section (around line 80-100)

**Update the "Run Reviews IN PARALLEL" step to:**

```markdown
<step>
  **Run Reviews IN PARALLEL** (single message, multiple Task calls):

  **CRITICAL**: Use PROXY_MODE-enabled agents, NOT general-purpose!

  **Correct Pattern:**
  ```typescript
  // Launch all reviews in a SINGLE message with multiple Task calls

  Task({
    subagent_type: "agentdev:reviewer",  // ✅ Has PROXY_MODE support
    description: "Grok plan review",
    run_in_background: true,
    prompt: `PROXY_MODE: x-ai/grok-code-fast-1

Review the design plan at ai-docs/agent-design-{name}.md

Evaluate:
1. Design completeness
2. XML/YAML structure validity
3. TodoWrite integration
4. Proxy mode support
5. Example quality

Save findings to: ai-docs/plan-review-grok.md`
  })

  Task({
    subagent_type: "agentdev:reviewer",
    description: "Gemini plan review",
    run_in_background: true,
    prompt: `PROXY_MODE: google/gemini-2.5-flash

[same review task]`
  })
  ```

  **DO NOT** use general-purpose agents:
  ```typescript
  // ❌ WRONG - This will NOT work correctly
  Task({
    subagent_type: "general-purpose",
    prompt: "Review using claudish with model X..."
  })
  ```
</step>
```

---

### Task 3: Create Pre-Launch Validation Hook (MEDIUM PRIORITY)

**File:** `plugins/orchestration/hooks/validate-proxy-mode.sh`

**Create new file:**

```bash
#!/bin/bash
# validate-proxy-mode.sh
# Pre-launch hook to detect incorrect PROXY_MODE usage
#
# This hook runs before Task tool execution and warns if:
# - Prompt contains PROXY_MODE directive
# - Agent type doesn't support PROXY_MODE

set -e

# Arguments passed by Claude Code
HOOK_EVENT="$1"
AGENT_TYPE="$2"
PROMPT="$3"

# Skip if not a Task launch
if [ "$HOOK_EVENT" != "pre_task_launch" ]; then
  exit 0
fi

# Check if prompt contains PROXY_MODE directive
if ! echo "$PROMPT" | head -1 | grep -q "^PROXY_MODE:"; then
  exit 0  # No PROXY_MODE, nothing to validate
fi

# List of agents that support PROXY_MODE
PROXY_ENABLED_AGENTS=(
  "agentdev:reviewer"
  "agentdev:architect"
  "agentdev:developer"
  "frontend:plan-reviewer"
  "frontend:reviewer"
  "frontend:architect"
  "frontend:designer"
  "frontend:developer"
  "frontend:ui-developer"
  "frontend:css-developer"
  "frontend:test-architect"
  "seo:editor"
  "seo:writer"
  "seo:analyst"
  "seo:researcher"
)

# Check if agent type is in the list
AGENT_SUPPORTED=false
for agent in "${PROXY_ENABLED_AGENTS[@]}"; do
  if [ "$AGENT_TYPE" = "$agent" ]; then
    AGENT_SUPPORTED=true
    break
  fi
done

if [ "$AGENT_SUPPORTED" = false ]; then
  echo ""
  echo "⚠️  WARNING: PROXY_MODE Usage Error"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "You are using PROXY_MODE with agent '$AGENT_TYPE'"
  echo "but this agent does NOT support PROXY_MODE."
  echo ""
  echo "The agent will NOT delegate to the external model correctly."
  echo ""
  echo "✅ Use one of these PROXY_MODE-enabled agents:"
  echo "   - agentdev:reviewer (for quality reviews)"
  echo "   - agentdev:architect (for design reviews)"
  echo "   - frontend:plan-reviewer (for architecture plans)"
  echo "   - frontend:reviewer (for code reviews)"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Exit with warning (non-zero) to prompt user
  # Change to 'exit 0' if you want just a warning without blocking
  exit 1
fi

exit 0
```

**Register in plugin.json:**

In `plugins/orchestration/plugin.json`, add to hooks:

```json
{
  "hooks": [
    {
      "event": "PreToolUse",
      "tool": "Task",
      "script": "${CLAUDE_PLUGIN_ROOT}/hooks/validate-proxy-mode.sh"
    }
  ]
}
```

---

### Task 4: Create Proxy Mode Reference Skill (MEDIUM PRIORITY)

**File:** `plugins/orchestration/skills/proxy-mode-reference/SKILL.md`

**Create new file:**

```markdown
---
name: proxy-mode-reference
description: Reference guide for using PROXY_MODE with external AI models. Use when running multi-model reviews, understanding which agents support PROXY_MODE, or debugging external model integration issues.
---

# PROXY_MODE Reference Guide

## What is PROXY_MODE?

PROXY_MODE is a directive that tells an agent to delegate its task to an external AI model via Claudish.

## How It Works

1. **Orchestrator** launches Task with PROXY_MODE-enabled agent
2. **Agent** detects `PROXY_MODE: {model}` at start of prompt
3. **Agent** extracts model ID and actual task
4. **Agent** runs `claudish --model {model}` with the task
5. **Agent** returns external model's response

## The PROXY_MODE Directive

Format:
```
PROXY_MODE: {model_id}

{actual task}
```

Example:
```
PROXY_MODE: x-ai/grok-code-fast-1

Review the architecture plan at ai-docs/plan.md
```

## Supported Agents

### agentdev plugin
| Agent | subagent_type | Best For |
|-------|---------------|----------|
| reviewer | `agentdev:reviewer` | Implementation reviews |
| architect | `agentdev:architect` | Design plan reviews |
| developer | `agentdev:developer` | Implementation tasks |

### frontend plugin
| Agent | subagent_type | Best For |
|-------|---------------|----------|
| plan-reviewer | `frontend:plan-reviewer` | Architecture validation |
| reviewer | `frontend:reviewer` | Code reviews |
| architect | `frontend:architect` | Architecture design |
| designer | `frontend:designer` | Design reviews |

### seo plugin
| Agent | subagent_type | Best For |
|-------|---------------|----------|
| editor | `seo:editor` | Content reviews |
| writer | `seo:writer` | Content generation |
| analyst | `seo:analyst` | Analysis tasks |

## Common Mistakes

### Mistake 1: Using general-purpose

```typescript
// ❌ WRONG
Task({
  subagent_type: "general-purpose",
  prompt: "PROXY_MODE: grok..."
})
```

`general-purpose` doesn't have `<proxy_mode_support>` so it won't recognize the directive.

### Mistake 2: Instructing agent to run claudish

```typescript
// ❌ WRONG
Task({
  subagent_type: "general-purpose",
  prompt: "Run claudish with model X to review..."
})
```

The agent doesn't know the claudish pattern. Use PROXY_MODE instead.

### Mistake 3: Wrong prompt format

```typescript
// ❌ WRONG - PROXY_MODE must be first line
Task({
  subagent_type: "agentdev:reviewer",
  prompt: "Please review this plan.
PROXY_MODE: grok..."
})
```

The directive must be at the START of the prompt.

## Correct Usage Pattern

```typescript
// ✅ CORRECT
Task({
  subagent_type: "agentdev:reviewer",
  description: "Grok review",
  run_in_background: true,
  prompt: `PROXY_MODE: x-ai/grok-code-fast-1

Review the implementation at path/to/file.ts

Focus on:
1. Code quality
2. Error handling
3. Performance
4. Security`
})
```

## Checking Agent Support

To verify if an agent supports PROXY_MODE:

```bash
# Find agents with PROXY_MODE support
grep -l "proxy_mode_support" plugins/*/agents/*.md

# Check specific agent
grep "proxy_mode_support" plugins/agentdev/agents/reviewer.md
```

## Troubleshooting

### "Agent didn't use external model"

**Cause:** Agent doesn't support PROXY_MODE
**Fix:** Use a PROXY_MODE-enabled agent (see table above)

### "Got Claude response instead of Grok response"

**Cause:** `general-purpose` or other non-PROXY_MODE agent was used
**Fix:** Switch to `agentdev:reviewer` or similar

### "PROXY_MODE directive in output"

**Cause:** Agent treated directive as content, not instruction
**Fix:** Use correct agent; ensure directive is first line
```

**Register in plugin.json:**

In `plugins/orchestration/plugin.json`, add to skills:

```json
{
  "skills": [
    {
      "path": "skills/proxy-mode-reference"
    }
  ]
}
```

---

### Task 5: Update CLAUDE.md Quick Reference (LOW PRIORITY)

**File:** `CLAUDE.md` (project root)

**Location:** Add to "Quick Reference" section

**Add:**

```markdown
### PROXY_MODE Quick Reference

**For multi-model reviews, use PROXY_MODE-enabled agents:**

| Use Case | Agent | Example |
|----------|-------|---------|
| Design review | `agentdev:reviewer` | Plan validation |
| Code review | `frontend:reviewer` | Implementation review |
| Architecture | `frontend:plan-reviewer` | Architecture validation |

**Pattern:**
```typescript
Task({
  subagent_type: "agentdev:reviewer",  // MUST support PROXY_MODE
  prompt: `PROXY_MODE: x-ai/grok-code-fast-1

[actual task]`
})
```

**NOT:** `general-purpose` - it doesn't support PROXY_MODE!
```

---

## Verification Steps

After implementing all tasks:

1. **Test PROXY_MODE validation hook:**
   ```bash
   # This should show warning
   /Task general-purpose "PROXY_MODE: grok\n\nTest"

   # This should work
   /Task agentdev:reviewer "PROXY_MODE: grok\n\nTest"
   ```

2. **Check skill loads correctly:**
   ```
   /skills  # Should show proxy-mode-reference
   ```

3. **Verify documentation:**
   ```bash
   grep -l "PROXY_MODE-Enabled Agents" plugins/orchestration/skills/*.md
   ```

---

## Summary

| Task | File | Priority | Effort |
|------|------|----------|--------|
| Update multi-model-validation skill | `orchestration/skills/multi-model-validation/SKILL.md` | HIGH | 15 min |
| Update /develop command | `agentdev/commands/develop.md` | HIGH | 10 min |
| Create validation hook | `orchestration/hooks/validate-proxy-mode.sh` | MEDIUM | 20 min |
| Create reference skill | `orchestration/skills/proxy-mode-reference/SKILL.md` | MEDIUM | 25 min |
| Update CLAUDE.md | `CLAUDE.md` | LOW | 5 min |

**Total Estimated Time:** ~75 minutes

---

**Created:** December 27, 2025
**For:** Preventing PROXY_MODE usage errors in multi-model orchestration
