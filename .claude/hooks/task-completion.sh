#!/bin/bash
# TinSu Hook Script: task-completion.sh
#
# Stop hook handler for Claude Code.
# Sends session completion events to TinSu's HookListenerService.
#
# @see TES-2.4: Claude Code Hook Scripts
# @see TES-2.3: Hook Listener HTTP Server

# Read JSON from stdin
INPUT=$(cat)

# Get TinSu hook port from temp file, fallback to default 3847
TINSU_PORT=$(cat /tmp/tinsu-hook-port 2>/dev/null || echo "3847")

# Send to TinSu's hook listener (silent failure if not running)
# Use --connect-timeout and --max-time to prevent hanging
curl -s -X POST "http://localhost:${TINSU_PORT}/api/hooks/stop" \
  -H "Content-Type: application/json" \
  --connect-timeout 2 \
  --max-time 5 \
  -d "$INPUT" || true
