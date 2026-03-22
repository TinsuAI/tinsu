#!/bin/bash
# TinSu Chat Hook Script: notification.sh
#
# Notification hook handler for Claude Code chat sessions.
# Sends notification events (e.g., permission prompts) to TinSu's
# HookListenerService at the CHAT-SPECIFIC endpoint (/api/hooks/chat-notification).
#
# IMPORTANT: This script POSTs to /api/hooks/chat-notification (NOT /api/hooks/stop)
# to prevent chat events from triggering task automation.
#
# @see Story 10.5: Tool Activity & Working Indicators (AC: 5)

# Read JSON from stdin
INPUT=$(cat)

# Get TinSu hook port from temp file, fallback to default 3847
TINSU_PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")

# Send to TinSu's chat-specific hook listener (silent failure if not running)
# Use --connect-timeout and --max-time to prevent hanging
curl -s -X POST "http://localhost:${TINSU_PORT}/api/hooks/chat-notification" \
  -H "Content-Type: application/json" \
  --connect-timeout 2 \
  --max-time 5 \
  -d "$INPUT" || true
