#!/bin/bash
# Chat Stop hook — forwards Claude Code Stop payload to /api/hooks/chat-stop.
# Reads JSON from stdin (Claude Code passes hook payload there) and injects
# tmux_session from $TINSU_TMUX_SESSION (set via tmux set-environment at spawn).

INPUT=$(cat)

# Resolve tmux session name. Priority:
#   1. $TINSU_TMUX_SESSION env var (set by inline prefix at claude launch)
#   2. tmux display-message -p '#S' (works because we're inside the tmux pane,
#      $TMUX is set by tmux for its child processes)
# Only accept names matching tinsu-chat-* so unrelated user tmux sessions can't
# spoof a chat session route.
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

curl -s -X POST "http://127.0.0.1:${PORT}/api/hooks/chat-stop" \
  -H "Content-Type: application/json" \
  -H "X-Tmux-Session: ${TMUX_SESSION}" \
  --connect-timeout 2 \
  --max-time 5 \
  -d "$INPUT" >/dev/null 2>&1 || true
