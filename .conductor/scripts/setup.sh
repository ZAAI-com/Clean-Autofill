#!/usr/bin/env bash
# Conductor setup: prepare a fresh Clean-Autofill workspace.
# Runs once when the workspace is created. Non-interactive and idempotent.
set -euo pipefail

. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

ca_say 'Clean-Autofill workspace setup'
ca_bootstrap_path
ca_require_toolchain

# Fetch only, so the NEXT workspace branches off current code. A bare fetch
# moves origin/* refs and never touches a working tree, GIT_TERMINAL_PROMPT=0
# stops a credential prompt from hanging setup, and failure here is not fatal.
if [ -n "${CONDUCTOR_ROOT_PATH:-}" ] && [ -e "$CONDUCTOR_ROOT_PATH/.git" ]; then
  ca_say "Fetching origin in the shared root checkout: $CONDUCTOR_ROOT_PATH"
  GIT_TERMINAL_PROMPT=0 git -C "$CONDUCTOR_ROOT_PATH" fetch --prune origin \
    || ca_warn 'could not fetch origin, continuing with what is already on disk'
fi

# Plain "bun install", not --frozen-lockfile, so a branch that changes
# package.json can still be set up. Also runs husky via the prepare script.
ca_step 'Installing dependencies (bun install)' bun install

if ! git diff --quiet -- bun.lock 2>/dev/null; then
  ca_warn 'bun install changed bun.lock. Review the diff and commit it if that is intended.'
fi

# Warn rather than exit: a non-zero exit marks workspace creation as FAILED, and
# a branch that does not compile yet is usually why the workspace exists.
if bun run build; then
  ca_say 'Build succeeded'
else
  ca_warn 'the first build failed. Dependencies are installed, so fix the source and press the "build" run script.'
fi

cat <<EOF

Workspace ready.
  Workspace: ${CONDUCTOR_WORKSPACE_NAME:-local}
  Branch:    $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
  Hooks:     $(git config --get core.hooksPath 2>/dev/null || echo 'not set') (husky pre-commit runs typecheck, check, test)

Run scripts:
  build       rebuild dist/ for chrome://extensions
  verify      mirror the W1-Test CI gate before opening a PR
  test-watch  bun test in watch mode
  pack        build plus zip for the Chrome Web Store
EOF
ca_print_load_hint
