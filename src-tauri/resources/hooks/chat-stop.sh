#!/bin/bash
# Chat Stop hook — POSTs to /api/hooks/chat-stop when Claude finishes a response.
# Reads port from /tmp/tinsu-hook-port; reads tmux session name from $TMUX env var.

PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")
TMUX_SESSION="${TMUX_SESSION:-$(tmux display-message -p '#S' 2>/dev/null || echo "")}"

curl -s -X POST "http://127.0.0.1:${PORT}/api/hooks/chat-stop" \
  -H "Content-Type: application/json" \
  -d "{\"tmux_session\": \"${TMUX_SESSION}\", \"session_id\": \"${CLAUDE_SESSION_ID:-}\"}" \
  2>/dev/null || true
