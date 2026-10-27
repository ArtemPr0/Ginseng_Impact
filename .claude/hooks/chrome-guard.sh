#!/bin/bash
# PreToolUse (Bash): allow at most one headless Chrome for Testing on this Mac.
cmd=$(jq -r '.tool_input.command // ""')
echo "$cmd" | grep -qE -- '--headless|--remote-debugging-port' || exit 0

running=$(pgrep -f 'MacOS/Google Chrome for Testing --' | wc -l | tr -d ' ')
if [ "$running" -ge 1 ]; then
  echo "Blocked: a headless Chrome is already running ($running instance). Reuse it on port 9333, or close it first with: pkill -f ms-playwright/chromium. Only one headless Chrome at a time on this Mac (see the verify skill's resource budget)." >&2
  exit 2
fi
exit 0
