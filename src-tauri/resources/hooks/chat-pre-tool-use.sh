#!/bin/bash
# Chat PreToolUse hook — POSTs to /api/hooks/chat-pre-tool-use before a tool is used.
# Reads port from /tmp/tinsu-hook-port; reads tmux session name from $TMUX env var.

PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")
TMUX_SESSION="${TMUX_SESSION:-$(tmux display-message -p '#S' 2>/dev/null || echo "")}"
TOOL_NAME="${CLAUDE_TOOL_NAME:-}"
TOOL_INPUT="${CLAUDE_TOOL_INPUT:-{}}"

curl -s -X POST "http://127.0.0.1:${PORT}/api/hooks/chat-pre-tool-use" \
  -H "Content-Type: application/json" \
  -d "{\"tmux_session\": \"${TMUX_SESSION}\", \"session_id\": \"${CLAUDE_SESSION_ID:-}\", \"tool_name\": \"${TOOL_NAME}\", \"tool_input\": ${TOOL_INPUT}}" \
  2>/dev/null || true
