#!/bin/bash
# TinSu Chat Hook Script: pre-tool-use.sh
#
# PreToolUse hook handler for Claude Code chat sessions.
# Sends pre-tool-use events to TinSu's HookListenerService
# at the CHAT-SPECIFIC endpoint (/api/hooks/chat-pre-tool-use).
#
# IMPORTANT: This script POSTs to /api/hooks/chat-pre-tool-use (NOT /api/hooks/tool-use)
# to prevent chat events from triggering task automation.
#
# @see Story 10.5: Tool Activity & Working Indicators (AC: 1)

# Read JSON from stdin
INPUT=$(cat)

# Get TinSu hook port from temp file, fallback to default 3847
TINSU_PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")

# Send to TinSu's chat-specific hook listener (silent failure if not running)
# Use --connect-timeout and --max-time to prevent hanging
# max-time 300 (5 min): For auto-approve sessions the response is instant.
# For manual-approval sessions, the server holds the response until the user
# clicks Approve/Deny in the chat UI (up to 4 min server-side timeout).
curl -s -X POST "http://localhost:${TINSU_PORT}/api/hooks/chat-pre-tool-use" \
  -H "Content-Type: application/json" \
  --connect-timeout 2 \
  --max-time 300 \
  -d "$INPUT" || true
