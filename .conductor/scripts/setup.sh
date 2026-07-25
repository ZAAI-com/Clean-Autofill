#!/usr/bin/env bash
# Conductor setup: prepare a fresh Clean-Autofill workspace.
# Runs once when the workspace is created. Non-interactive and idempotent.
set -euo pipefail

. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

ca_say 'Clean-Autofill workspace setup'
ca_bootstrap_path
ca_require_toolchain

# Plain "bun install", not --frozen-lockfile, so a branch that changes
# package.json can still be set up. Also runs husky via the prepare script.
ca_step 'Installing dependencies (bun install)' bun install

if ! git diff --quiet -- bun.lock 2>/dev/null; then
  ca_warn 'bun install changed bun.lock. Review the diff and commit it if that is intended.'
fi

# Warn rather than exit: a non-zero exit marks workspace creation as FAILED, and
# a branch that does not compile yet is usually why the workspace exists.
CA_BUILD_OK=1
if bun run build; then
  ca_say 'Build succeeded'
else
  CA_BUILD_OK=0
  ca_warn 'the first build failed. Dependencies are installed, so fix the source and press the "build" run script.'
fi

cat <<EOF

Workspace ready.
  Workspace: ${CONDUCTOR_WORKSPACE_NAME:-local}
  Branch:    $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)
  Hooks:     $(git config --get core.hooksPath 2>/dev/null || echo 'not set') (husky pre-commit runs typecheck, check, test)

Run scripts:
  build       rebuild dist/chromium/unpacked/ for chrome://extensions
  verify      mirror the W1-Test CI gate before opening a PR
  test-watch  bun test in watch mode
  pack        build plus zip for the Chrome Web Store
EOF

# build.js wipes dist/chromium/unpacked/ before compiling and tsconfig sets no
# noEmitOnError, so a failed build leaves the unpacked folder half written with
# no manifest.json. Chrome cannot load that, so do not point at it as ready.
if [ "$CA_BUILD_OK" = "1" ]; then
  ca_print_load_hint
else
  printf '\ndist/chromium/unpacked/ is incomplete after the failed build and Chrome cannot load it yet.\n'
  printf 'Fix the source, press the "build" run script, then load it.\n'
fi
