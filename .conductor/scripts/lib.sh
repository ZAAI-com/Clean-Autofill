# Shared helpers for the Conductor scripts.
# Sourced by setup.sh, run.sh and archive.sh. Do not execute it.

CA_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"

# Every entry point in this repo is root-relative (bunfig preload, biome
# --config-path, tsc -p), so pin cwd instead of trusting the caller.
cd "$CA_ROOT" || exit 1

ca_say()  { printf '\n==> %s\n' "$*"; }
ca_warn() { printf 'warning: %s\n' "$*" >&2; }
ca_have() { command -v "$1" >/dev/null 2>&1; }

ca_path_prepend() {
  case ":${PATH}:" in
    *":$1:"*) return 0 ;;
  esac
  if [ -d "$1" ]; then
    PATH="$1:${PATH}"
  fi
  return 0
}

# The Node version this repo pins, or empty when .nvmrc is missing.
ca_pinned_node() {
  [ -r "$CA_ROOT/.nvmrc" ] || return 0
  tr -d ' \t\r\n' < "$CA_ROOT/.nvmrc" | sed 's/^v//'
  return 0
}

# The nvm managed Node to use: the .nvmrc pin when it is installed, otherwise
# the newest one shipping both node and npx. Found by listing the directory
# rather than sourcing nvm.sh, which is slow and trips "set -u".
ca_newest_nvm_bin() {
  local nvm_root version best pinned
  nvm_root="${NVM_DIR:-$HOME/.nvm}/versions/node"
  [ -d "$nvm_root" ] || return 0
  pinned="$(ca_pinned_node)"
  if [ -n "$pinned" ] && [ -x "$nvm_root/v$pinned/bin/node" ] && [ -x "$nvm_root/v$pinned/bin/npx" ]; then
    printf '%s\n' "$nvm_root/v$pinned/bin"
    return 0
  fi
  best=""
  for version in $(ls -1 "$nvm_root" 2>/dev/null | sed 's/^v//' | sort -t. -k1,1n -k2,2n -k3,3n); do
    if [ -x "$nvm_root/v$version/bin/node" ] && [ -x "$nvm_root/v$version/bin/npx" ]; then
      best="$nvm_root/v$version/bin"
    fi
  done
  [ -n "$best" ] && printf '%s\n' "$best"
  return 0
}

# Fill gaps in PATH, never override, so a working toolchain (Homebrew, nvm,
# volta, asdf, mise) is never shadowed or reordered.
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

# Name the missing tool and the PATH actually used, instead of surfacing a
# cryptic error from deep inside build.js.
ca_require_toolchain() {
  local missing=0
  ca_have bun  || { printf 'error: bun was not found on PATH. Install Bun from https://bun.sh or add its bin directory to PATH.\n' >&2; missing=1; }
  ca_have node || { printf 'error: node was not found on PATH. toolkit/build/build.js is a Node script.\n' >&2; missing=1; }
  ca_have npx  || { printf 'error: npx was not found on PATH. build.js runs "npx tsc" and "npx esbuild".\n' >&2; missing=1; }
  if [ "$missing" -ne 0 ]; then
    printf 'PATH used: %s\n' "$PATH" >&2
    return 1
  fi
  printf 'toolchain: bun %s, node %s (%s)\n' "$(bun --version)" "$(node --version)" "$(command -v node)"
  ca_check_node_pin
  return 0
}

# Surface drift from .nvmrc without failing, so a mismatch is visible in the
# run output but never blocks workspace creation.
ca_check_node_pin() {
  local pinned actual
  pinned="$(ca_pinned_node)"
  [ -n "$pinned" ] || return 0
  actual="$(node --version 2>/dev/null | sed 's/^v//')"
  if [ "$actual" != "$pinned" ]; then
    ca_warn "node $actual does not match the .nvmrc pin $pinned. Run 'nvm use' (or install $pinned) if something behaves oddly."
  fi
  return 0
}

# Self-heal instead of dead-ending a run button.
ca_require_deps() {
  [ -x "$CA_ROOT/node_modules/.bin/tsc" ] && return 0
  ca_say 'Dependencies are missing or incomplete, running bun install'
  bun install
}

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
  printf '\nUnpacked extension folder:\n  %s/dist/chromium/unpacked\n' "$CA_ROOT"
  printf 'First time: chrome://extensions, Developer mode, Load unpacked, choose that folder.\n'
  printf 'After that the path never changes, just press the reload arrow on the card.\n'
}
