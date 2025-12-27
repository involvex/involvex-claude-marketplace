# PROXY_MODE Analysis: What Went Wrong and How to Fix It

**Date:** December 2025
**Context:** During `/develop` execution for claudemem improvements
**Issue:** Launched external model reviews using wrong pattern

---

## Executive Summary

When launching multi-model plan reviews, I used the **WRONG** pattern:
```
Task → general-purpose agent → agent parses instructions → agent runs claudish
```

The **CORRECT** pattern is:
```
Task → PROXY_MODE-enabled agent → agent detects PROXY_MODE → agent runs claudish
```

---

## Root Cause Analysis

### What I Did (WRONG)

```typescript
Task({
  subagent_type: "general-purpose",  // ❌ Wrong agent
  description: "MiniMax M2.1 plan review",
  prompt: `
    **Model to use:** minimax/minimax-m2.1 via Claudish

    Run your review using claudish:
    npx claudish --model minimax/minimax-m2.1 ...
  `  // ❌ Telling agent to run claudish
})
```

**Problems:**
1. `general-purpose` agent doesn't have PROXY_MODE support
2. Agent has to parse and interpret the claudish instructions
3. Creates nested execution: Claude → Claude → Claudish → External Model
4. Wastes tokens explaining how to use claudish

### What I Should Have Done (CORRECT)

```typescript
Task({
  subagent_type: "agentdev:reviewer",  // ✅ PROXY_MODE-enabled agent
  description: "MiniMax M2.1 plan review",
  prompt: `PROXY_MODE: minimax/minimax-m2.1

Review the design plan at ai-docs/claudemem-improvements-design.md

Focus on:
1. Completeness of Index Freshness Check
2. Result Quality Validation robustness
3. Fallback Protocol completeness
4. AskUserQuestion templates
5. Gaps and improvements needed
  `  // ✅ Agent handles claudish automatically
})
```

**How it works:**
1. `agentdev:reviewer` has `<proxy_mode_support>` in its definition
2. Agent checks if prompt starts with `PROXY_MODE:`
3. If yes: Extract model, delegate to claudish, return result
4. Direct execution: Claude → Claudish → External Model

---

## The PROXY_MODE Pattern (Documented)

### Agents with PROXY_MODE Support

From the codebase analysis, these agents support PROXY_MODE:

| Plugin | Agent | Use Case |
|--------|-------|----------|
| `agentdev` | `agentdev:architect` | Design plan reviews |
| `agentdev` | `agentdev:reviewer` | Implementation reviews |
| `agentdev` | `agentdev:developer` | Implementation tasks |
| `frontend` | `frontend:plan-reviewer` | Architecture plan reviews |
| `frontend` | `frontend:reviewer` | Code reviews |
| `frontend` | `frontend:architect` | Architecture design |
| `frontend` | `frontend:designer` | Design reviews |
| `seo` | `seo:editor` | SEO content reviews |
| `seo` | `seo:writer` | Content generation |
| `seo` | `seo:analyst` | Analysis tasks |

### How PROXY_MODE Works (Agent-Side)

Every PROXY_MODE-enabled agent has this in its definition:

```xml
<proxy_mode_support>
  **FIRST STEP: Check for Proxy Mode Directive**

  If prompt starts with `PROXY_MODE: {model_name}`:
  1. Extract model name and actual task
  2. Delegate via Claudish:
     `printf '%s' "$PROMPT" | npx claudish --stdin --model {model_name} --quiet --auto-approve`
  3. Return attributed response and STOP

  **If NO PROXY_MODE**: Proceed with normal workflow
</proxy_mode_support>
```

### Correct Orchestration Pattern

```typescript
// Message 2: Parallel Execution (ONLY Task calls)
// Each Task uses a PROXY_MODE-enabled agent

Task({
  subagent_type: "agentdev:reviewer",
  description: "Grok plan review",
  run_in_background: true,
  prompt: `PROXY_MODE: x-ai/grok-code-fast-1

[actual task here]`
})

Task({
  subagent_type: "agentdev:reviewer",
  description: "Gemini plan review",
  run_in_background: true,
  prompt: `PROXY_MODE: google/gemini-2.5-flash

[actual task here]`
})

// Both run in parallel, each agent handles claudish internally
```

---

## Why The Instructions Didn't Prevent This

### Issue 1: `/develop` Command Doesn't Specify Agent Type

The `/develop` command says:
```markdown
**Run Reviews IN PARALLEL** (single message, multiple Task calls):
For each model, launch `agentdev:architect` with:

PROXY_MODE: {model_id}
```

But it doesn't emphasize that:
- The agent MUST have PROXY_MODE support
- `general-purpose` won't work
- The prompt format is critical

### Issue 2: No List of PROXY_MODE-Enabled Agents

Nowhere in the instructions is there a clear list of which agents support PROXY_MODE.

### Issue 3: No Error Detection

If you use PROXY_MODE with an agent that doesn't support it, nothing warns you. The agent just treats it as part of the prompt.

---

## Recommended Improvements

### 1. Update Orchestration Skills with Agent List

**File:** `plugins/orchestration/skills/multi-model-validation/SKILL.md`

Add a section:

```markdown
## PROXY_MODE-Enabled Agents

**CRITICAL**: Only these agents support PROXY_MODE. Using other agents will NOT work.

| Agent | Plugin | Best For |
|-------|--------|----------|
| `agentdev:reviewer` | agentdev | Quality reviews, implementation validation |
| `agentdev:architect` | agentdev | Design reviews, architecture validation |
| `frontend:plan-reviewer` | frontend | Architecture plan reviews |
| `frontend:reviewer` | frontend | Code reviews |

**WRONG**:
- `general-purpose` - No PROXY_MODE support
- `Explore` - No PROXY_MODE support
- Any agent without `<proxy_mode_support>` in definition
```

### 2. Update `/develop` Command with Explicit Examples

**File:** `plugins/agentdev/commands/develop.md`

Change:
```markdown
For each model, launch `agentdev:architect` with:
PROXY_MODE: {model_id}
```

To:
```markdown
For each model, launch `agentdev:reviewer` (for reviews) with PROXY_MODE:

```typescript
// ✅ CORRECT - Use PROXY_MODE-enabled agent
Task({
  subagent_type: "agentdev:reviewer",  // NOT general-purpose!
  description: "Grok review",
  prompt: `PROXY_MODE: x-ai/grok-code-fast-1

[actual review task]`
})
```

**COMMON MISTAKE** (do NOT do this):
```typescript
// ❌ WRONG - general-purpose doesn't support PROXY_MODE
Task({
  subagent_type: "general-purpose",
  prompt: `Run claudish with minimax/minimax-m2.1...`
})
```
```

### 3. Add Pre-Launch Validation Hook

**File:** `plugins/orchestration/hooks/validate-proxy-mode.sh`

```bash
#!/bin/bash
# Pre-launch hook to validate PROXY_MODE usage

PROMPT="$1"
AGENT_TYPE="$2"

# Check if prompt contains PROXY_MODE
if echo "$PROMPT" | grep -q "^PROXY_MODE:"; then
  # List of agents that support PROXY_MODE
  PROXY_AGENTS="agentdev:reviewer agentdev:architect agentdev:developer frontend:plan-reviewer frontend:reviewer"

  if ! echo "$PROXY_AGENTS" | grep -q "$AGENT_TYPE"; then
    echo "WARNING: Agent '$AGENT_TYPE' does not support PROXY_MODE."
    echo "Use one of: $PROXY_AGENTS"
    exit 1
  fi
fi
```

### 4. Update CLAUDE.md with PROXY_MODE Summary

Add to project CLAUDE.md:

```markdown
## PROXY_MODE Quick Reference

**Pattern:**
```
Task: {proxy-enabled-agent}
Prompt: "PROXY_MODE: {model_id}\n\n[actual task]"
```

**Supported Agents:**
- `agentdev:reviewer` - Quality reviews
- `agentdev:architect` - Design reviews
- `frontend:plan-reviewer` - Plan reviews

**NOT Supported:**
- `general-purpose` - Will not work!
- `Explore` - Will not work!
```

### 5. Create New Skill: PROXY_MODE Reference

**File:** `plugins/orchestration/skills/proxy-mode-reference/SKILL.md`

Dedicated skill that documents:
- What PROXY_MODE is
- Which agents support it
- Correct usage patterns
- Common mistakes
- Troubleshooting

---

## Action Items

| Priority | Item | Target File |
|----------|------|-------------|
| HIGH | Add PROXY_MODE agent list to multi-model-validation skill | `orchestration/skills/multi-model-validation/SKILL.md` |
| HIGH | Update /develop with explicit correct/wrong examples | `agentdev/commands/develop.md` |
| MEDIUM | Add pre-launch validation hook | `orchestration/hooks/validate-proxy-mode.sh` |
| MEDIUM | Create proxy-mode-reference skill | `orchestration/skills/proxy-mode-reference/SKILL.md` |
| LOW | Update CLAUDE.md quick reference | `CLAUDE.md` |

---

## Immediate Fix for Current Session

To properly run the plan reviews NOW:

```typescript
// Cancel the running general-purpose agents (they won't produce correct results)

// Relaunch with correct pattern:
Task({
  subagent_type: "agentdev:reviewer",
  description: "MiniMax review",
  prompt: `PROXY_MODE: minimax/minimax-m2.1

Review the design at ai-docs/claudemem-improvements-design.md for:
1. Index Freshness Check completeness
2. Result Quality Validation robustness
3. Fallback Protocol - never silent
4. AskUserQuestion templates
5. Implementation gaps`
})
// Repeat for each model
```

---

**Analysis by:** Claude Opus 4.5
**Date:** December 27, 2025
