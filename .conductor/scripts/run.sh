#!/usr/bin/env bash
# Conductor run scripts.
#   usage: bash .conductor/scripts/run.sh <build|verify|watch|pack>
#
# One dispatcher rather than four near-identical files, because every task needs
# the same PATH bootstrap and the same toolchain preflight.
set -euo pipefail

. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

TASK="${1:-build}"

ca_bootstrap_path
ca_require_toolchain

case "$TASK" in
  build)
    # The everyday loop. build.js wipes dist/ and rebuilds it, then verifies all
    # 20 outputs and the manifest fields itself, so "bun run validate" is not
    # chained here. Use the "verify" task for the full gate.
    ca_require_deps
    ca_step 'Building the extension (bun run build)' bun run build
    ca_print_load_hint
    ;;

  verify)
    # Same steps in the same order as .github/workflows/W1-Test.yml:
    #   install, typecheck, check, test, build, validate.
    # One deliberate difference: --frozen-lockfile. CI installs into an empty
    # checkout, so a lockfile that has drifted from package.json is silently
    # regenerated there. Locally that drift should be a loud failure before the
    # PR is opened. If it fails, run "bun install" once and try again.
    ca_step 'W1 1/6 install        (bun install --frozen-lockfile)' bun install --frozen-lockfile
    ca_step 'W1 2/6 typecheck      (bun run typecheck)' bun run typecheck
    ca_step 'W1 3/6 lint + format  (bun run check)' bun run check
    ca_step 'W1 4/6 tests          (bun run test)' bun run test
    ca_step 'W1 5/6 build          (bun run build)' bun run build
    ca_step 'W1 6/6 validate       (bun run validate)' bun run validate
    printf '\nAll six W1-Test steps passed. Warnings from validate are informational, only errors fail it.\n'
    ca_print_load_hint
    ;;

  watch)
    # The only long lived command in this repo. exec replaces this shell so the
    # watcher is the process Conductor manages directly. "bun run" still starts
    # the test process as its child and forwards signals to it; never background
    # anything with "&" in a Conductor run script.
    ca_require_deps
    ca_say 'Watching src/ with bun test. Stop this run script to exit.'
    exec bun run test:watch
    ;;

  pack)
    # toolkit/scripts/pack.js runs the build itself and then shells out to the
    # system "zip" binary, so check zip up front rather than surfacing a
    # swallowed Node error.
    ca_require_deps
    if ! ca_have zip; then
      printf 'error: toolkit/scripts/pack.js needs the system "zip" binary (macOS ships it at /usr/bin/zip).\n' >&2
      exit 1
    fi
    ca_step 'Packaging the extension (bun run pack)' bun run pack
    printf '\nArtifact: %s/dist/Clean-Autofill.zip\n' "$CA_ROOT"
    ;;

  *)
    printf 'error: unknown task "%s". Valid tasks: build, verify, watch, pack.\n' "$TASK" >&2
    exit 2
    ;;
esac
