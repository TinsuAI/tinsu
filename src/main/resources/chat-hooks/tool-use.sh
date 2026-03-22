#!/bin/bash
# TinSu Chat Hook Script: tool-use.sh
#
# PostToolUse hook handler for Claude Code chat sessions.
# Sends tool usage events to TinSu's HookListenerService
# at the CHAT-SPECIFIC endpoint (/api/hooks/chat-tool-use).
#
# IMPORTANT: This script POSTs to /api/hooks/chat-tool-use (NOT /api/hooks/tool-use)
# to prevent chat events from triggering task automation.
#
# @see Story 10.3: Claude Code CLI Chat Session Spawning (AC: 3)

# Read JSON from stdin
INPUT=$(cat)

# Get TinSu hook port from temp file, fallback to default 3847
TINSU_PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")

# Send to TinSu's chat-specific hook listener (silent failure if not running)
# Use --connect-timeout and --max-time to prevent hanging
curl -s -X POST "http://localhost:${TINSU_PORT}/api/hooks/chat-tool-use" \
  -H "Content-Type: application/json" \
  --connect-timeout 2 \
  --max-time 5 \
  -d "$INPUT" || true
