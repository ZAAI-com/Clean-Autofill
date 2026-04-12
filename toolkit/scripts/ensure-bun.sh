#!/bin/sh

# Resolve Bun for stripped non-interactive environments like Git GUIs and Conductor.
if command -v bun >/dev/null 2>&1; then
  BUN="${BUN:-$(command -v bun)}"
  export BUN
  return 0 2>/dev/null || exit 0
fi

for bun_dir in \
  "${BUN_INSTALL:-$HOME/.bun}/bin" \
  "$HOME/.bun/bin" \
  "/opt/homebrew/bin" \
  "/usr/local/bin"
do
  if [ -x "$bun_dir/bun" ]; then
    PATH="$bun_dir:$PATH"
    export PATH
    BUN="$bun_dir/bun"
    export BUN
    return 0 2>/dev/null || exit 0
  fi
done

echo "❌ Bun is required but was not found in PATH." >&2
echo "Install Bun or expose it to non-interactive shells: https://bun.sh" >&2
return 1 2>/dev/null || exit 1
