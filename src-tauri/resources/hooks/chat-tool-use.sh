#!/bin/bash
# Chat PostToolUse hook — forwards Claude Code PostToolUse payload.
# Reads JSON from stdin and injects tmux_session from $TINSU_TMUX_SESSION.

INPUT=$(cat)

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

curl -s -X POST "http://127.0.0.1:${PORT}/api/hooks/chat-tool-use" \
  -H "Content-Type: application/json" \
  -H "X-Tmux-Session: ${TMUX_SESSION}" \
  --connect-timeout 2 \
  --max-time 5 \
  -d "$INPUT" >/dev/null 2>&1 || true
