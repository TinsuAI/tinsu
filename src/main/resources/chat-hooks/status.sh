#!/bin/bash
# TinSu Chat Hook Script: status.sh
#
# StatusLine handler for Claude Code chat sessions.
# Receives status JSON on stdin (context window, rate limits)
# and POSTs it to TinSu's HookListenerService with the session UUID.
#
# The session UUID is passed via TINSU_SESSION_UUID env var
# set when the PTY process is spawned.

# Read JSON from stdin
INPUT=$(cat)

# Get TinSu hook port from temp file, fallback to default 3847
TINSU_PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")

# Get session UUID from environment (set by ChatCliService)
SESSION_UUID="${TINSU_SESSION_UUID:-}"

# CTM-1.2: Get tmux session name from environment (set via tmux set-environment in CTM-1.1)
TMUX_SESSION="${TINSU_TMUX_SESSION:-}"

# Build payload: wrap status JSON with session_id and optional tmux_session
if [ -n "$TMUX_SESSION" ]; then
  PAYLOAD=$(printf '{"session_id":"%s","tmux_session":"%s","status":%s}' "$SESSION_UUID" "$TMUX_SESSION" "$INPUT")
else
  PAYLOAD=$(printf '{"session_id":"%s","status":%s}' "$SESSION_UUID" "$INPUT")
fi

# Send to TinSu's chat-status endpoint (silent failure if not running)
curl -s -o /dev/null -X POST "http://localhost:${TINSU_PORT}/api/hooks/chat-status" \
  -H "Content-Type: application/json" \
  --connect-timeout 1 \
  --max-time 2 \
  -d "$PAYLOAD" || true
