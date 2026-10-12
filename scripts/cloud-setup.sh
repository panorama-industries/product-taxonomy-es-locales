#!/bin/bash
# SessionStart hook: installs deps and downloads the pinned Shopify release in Claude cloud sessions. No-op locally.
if [ "$CLAUDE_CODE_REMOTE" != "true" ]; then
  exit 0
fi
cd "$CLAUDE_PROJECT_DIR" || exit 1
pnpm install --frozen-lockfile
pnpm --silent sync
exit 0
