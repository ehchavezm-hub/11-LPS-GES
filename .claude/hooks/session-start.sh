#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code cloud sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Install Node.js dependencies for smoke tests (pruebas/)
npm install --prefix pruebas

# Set PW_CHROMIUM so Playwright uses the pre-installed browser
echo 'export PW_CHROMIUM="/opt/pw-browsers/chromium"' >> "$CLAUDE_ENV_FILE"
