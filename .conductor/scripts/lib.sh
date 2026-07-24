# Shared helpers for the Conductor scripts in .conductor/scripts.
# This file is SOURCED by setup.sh, run.sh and archive.sh. Do not execute it.
#
# Why it exists: Conductor runs setup, run and archive scripts from the
# workspace directory in a non-interactive shell that reads no rc file. This
# repo needs bun AND node AND npx, because toolkit/scripts/build.js is a
# CommonJS Node script that shells out to "npx tsc" and "npx esbuild". The
# previous scripts only put bun on PATH, which was not enough.

# The repo root is two levels above this file (.conductor/scripts/lib.sh).
CA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"

# Every entry point in this repo is written relative to the repo root: the
# bunfig preload path, biome --config-path, tsc -p, and the node scripts under
# toolkit/scripts. Pin the working directory so the scripts behave identically
# whether Conductor launches them or a human runs them from somewhere else.
cd "$CA_ROOT" || exit 1

ca_say()  { printf '\n==> %s\n' "$*"; }
ca_warn() { printf 'warning: %s\n' "$*" >&2; }
ca_have() { command -v "$1" >/dev/null 2>&1; }

# Put a directory at the front of PATH only when it exists and is not already
# present. Callers invoke this only when a tool is actually missing, so a
# toolchain that already works (Homebrew, nvm, volta, asdf, mise) is never
# shadowed. This function does not reorder an existing PATH entry.
ca_path_prepend() {
  case ":${PATH}:" in
    *":$1:"*) return 0 ;;
  esac
  if [ -d "$1" ]; then
    PATH="$1:${PATH}"
  fi
  return 0
}

# Newest nvm managed Node that ships both node and npx. Resolved by listing the
# directory instead of sourcing nvm.sh, which is slow and trips "set -u".
ca_newest_nvm_bin() {
  local nvm_root version best
  nvm_root="${NVM_DIR:-$HOME/.nvm}/versions/node"
  [ -d "$nvm_root" ] || return 0
  best=""
  for version in $(ls -1 "$nvm_root" 2>/dev/null | sed 's/^v//' | sort -t. -k1,1n -k2,2n -k3,3n); do
    if [ -x "$nvm_root/v$version/bin/node" ] && [ -x "$nvm_root/v$version/bin/npx" ]; then
      best="$nvm_root/v$version/bin"
    fi
  done
  [ -n "$best" ] && printf '%s\n' "$best"
  return 0
}

# Fill gaps in PATH, never override. Nothing is prepended while the tool in
# question already resolves, so this is a no-op on a machine whose environment
# is already correct and a rescue on one where it is not.
ca_bootstrap_path() {
  local nvm_bin
  ca_have bun || ca_path_prepend "$HOME/.bun/bin"
  if ! ca_have node || ! ca_have npx; then
    ca_path_prepend "/usr/local/bin"
    ca_path_prepend "/opt/homebrew/bin"
  fi
  if ! ca_have node || ! ca_have npx; then
    nvm_bin="$(ca_newest_nvm_bin)"
    [ -n "$nvm_bin" ] && ca_path_prepend "$nvm_bin"
  fi
  export PATH
  return 0
}

# Fail with the missing tool and the PATH that was actually used, instead of a
# cryptic error from deep inside build.js.
ca_require_toolchain() {
  local missing=0
  ca_have bun  || { printf 'error: bun was not found on PATH. Install Bun from https://bun.sh or add its bin directory to PATH.\n' >&2; missing=1; }
  ca_have node || { printf 'error: node was not found on PATH. toolkit/scripts/build.js is a Node script.\n' >&2; missing=1; }
  ca_have npx  || { printf 'error: npx was not found on PATH. build.js runs "npx tsc" and "npx esbuild".\n' >&2; missing=1; }
  if [ "$missing" -ne 0 ]; then
    printf 'PATH used: %s\n' "$PATH" >&2
    return 1
  fi
  printf 'toolchain: bun %s, node %s (%s)\n' "$(bun --version)" "$(node --version)" "$(command -v node)"
  return 0
}

# Self-heal instead of dead-ending a run button. The previous run.sh exited 1
# when node_modules was absent, which left the only remedy in a terminal.
ca_require_deps() {
  [ -x "$CA_ROOT/node_modules/.bin/tsc" ] && return 0
  ca_say 'Dependencies are missing or incomplete, running bun install'
  bun install
}

# Run a labelled step and name it on failure.
ca_step() {
  local label="$1"
  shift
  printf '\n==> %s\n' "$label"
  if ! "$@"; then
    printf '\nFAILED: %s\n' "$label" >&2
    return 1
  fi
  return 0
}

ca_print_load_hint() {
  printf '\nUnpacked extension folder:\n  %s/dist\n' "$CA_ROOT"
  printf 'First time: chrome://extensions, Developer mode, Load unpacked, choose that folder.\n'
  printf 'After that the path never changes, just press the reload arrow on the card.\n'
}
