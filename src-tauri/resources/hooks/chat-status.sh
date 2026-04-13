#!/bin/bash
# Chat StatusLine hook — forwards Claude Code StatusLine payload to /api/hooks/chat-status.
# Reads JSON from stdin (Claude Code passes hook payload there) and injects
# tmux_session from $TINSU_TMUX_SESSION (set via tmux set-environment at spawn).
# Payload contains context_window and rate_limits data for the usage bar.

INPUT=$(cat)

# Resolve tmux session name (same logic as other chat hooks).
TMUX_SESSION="${TINSU_TMUX_SESSION:-}"
if [ -z "$TMUX_SESSION" ] && [ -n "$TMUX" ]; then
  CANDIDATE=$(tmux display-message -p '#S' 2>/dev/null || echo "")
  case "$CANDIDATE" in
    tinsu-chat-*) TMUX_SESSION="$CANDIDATE" ;;
  esac
fi

if [ -n "$TMUX_SESSION" ] && command -v jq >/dev/null 2>&1; then
  INPUT=$(echo "$INPUT" | jq --arg ts "$TMUX_SESSION" '. + {tmux_session: $ts}')
fi

PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")

curl -s -o /dev/null -X POST "http://127.0.0.1:${PORT}/api/hooks/chat-status" \
  -H "Content-Type: application/json" \
  -H "X-Tmux-Session: ${TMUX_SESSION}" \
  --connect-timeout 1 \
  --max-time 2 \
  -d "$INPUT" || true
