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

# List of agents that support PROXY_MODE (18 total)
PROXY_ENABLED_AGENTS=(
  # agentdev plugin (3)
  "agentdev:reviewer"
  "agentdev:architect"
  "agentdev:developer"
  # frontend plugin (8)
  "frontend:plan-reviewer"
  "frontend:reviewer"
  "frontend:architect"
  "frontend:designer"
  "frontend:developer"
  "frontend:ui-developer"
  "frontend:css-developer"
  "frontend:test-architect"
  # seo plugin (5)
  "seo:editor"
  "seo:writer"
  "seo:analyst"
  "seo:researcher"
  "seo:data-analyst"
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
  echo "WARNING: PROXY_MODE Usage Error"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "You are using PROXY_MODE with agent '$AGENT_TYPE'"
  echo "but this agent does NOT support PROXY_MODE."
  echo ""
  echo "The agent will NOT delegate to the external model correctly."
  echo ""
  echo "Use one of these PROXY_MODE-enabled agents:"
  echo ""
  echo "  agentdev (3 agents):"
  echo "   - agentdev:reviewer (for quality reviews)"
  echo "   - agentdev:architect (for design reviews)"
  echo "   - agentdev:developer (for implementation)"
  echo ""
  echo "  frontend (8 agents):"
  echo "   - frontend:plan-reviewer (for architecture plans)"
  echo "   - frontend:reviewer (for code reviews)"
  echo "   - frontend:architect (for architecture design)"
  echo "   - frontend:designer (for design reviews)"
  echo "   - frontend:developer (for full-stack implementation)"
  echo "   - frontend:ui-developer (for UI implementation)"
  echo "   - frontend:css-developer (for CSS architecture)"
  echo "   - frontend:test-architect (for testing strategy)"
  echo ""
  echo "  seo (5 agents):"
  echo "   - seo:editor (for content reviews)"
  echo "   - seo:writer (for content generation)"
  echo "   - seo:analyst (for analysis tasks)"
  echo "   - seo:researcher (for research)"
  echo "   - seo:data-analyst (for data analysis)"
  echo ""
  echo "For complete reference, see: orchestration:proxy-mode-reference skill"
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # Exit with warning (non-zero) to prompt user
  exit 1
fi

exit 0
