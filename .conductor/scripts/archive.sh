#!/usr/bin/env bash
# Conductor archive hook. Runs from the workspace directory just before the
# workspace is archived, and only reports: it deletes nothing.
#
# This project creates no state outside its workspace (no server, port,
# container or database), and Conductor removes the workspace directory itself
# on archive, so there is nothing left for a cleanup step to reclaim.
#
# No "set -e" and always exits 0: a hiccup here must never block an archive.
set -uo pipefail

if ! . "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib.sh"; then
  echo 'Could not initialize the archive hook. Removing nothing.'
  exit 0
fi

ca_say "Clean-Autofill archive hook: $CA_ROOT"

# Guard 1: git-dir and git-common-dir are equal in the root checkout and differ
# in a linked worktree, so cleaning the root checkout is impossible by
# construction. Depends on no Conductor variable, so it holds for manual runs.
CA_GIT_DIR="$(git rev-parse --git-dir 2>/dev/null || echo '')"
CA_GIT_COMMON="$(git rev-parse --git-common-dir 2>/dev/null || echo '')"
if [ -z "$CA_GIT_DIR" ] || [ "$CA_GIT_DIR" = "$CA_GIT_COMMON" ]; then
  echo 'This is not a linked git worktree, so it may be the root checkout. Removing nothing.'
  exit 0
fi

# Guard 2: when Conductor says where the workspace is, it has to be here.
if [ -n "${CONDUCTOR_WORKSPACE_PATH:-}" ]; then
  CA_WS="$(cd "$CONDUCTOR_WORKSPACE_PATH" 2>/dev/null && pwd -P || echo '')"
  if [ "$CA_WS" != "$CA_ROOT" ]; then
    echo 'CONDUCTOR_WORKSPACE_PATH does not point at this directory. Removing nothing.'
    exit 0
  fi
fi

# Guard 3: and it has to be this project.
if ! grep -q '"name": "clean-autofill"' "$CA_ROOT/package.json" 2>/dev/null; then
  echo 'This is not a Clean-Autofill checkout. Removing nothing.'
  exit 0
fi

# The branch itself survives archiving, this is only a reminder.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo ''
  echo 'Heads up, this workspace still has uncommitted changes:'
  git status --short 2>/dev/null | head -20
fi
CA_BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
if git rev-parse --abbrev-ref '@{u}' >/dev/null 2>&1; then
  CA_UNPUSHED="$(git rev-list --count '@{u}..HEAD' 2>/dev/null || echo 0)"
  if [ "${CA_UNPUSHED:-0}" != "0" ]; then
    echo "Heads up, $CA_UNPUSHED commit(s) on $CA_BRANCH are not pushed."
  fi
else
  echo "Heads up, branch $CA_BRANCH has no upstream, so nothing on it has been pushed."
fi

echo ''
echo 'This hook only reports, it deletes nothing. Conductor removes the workspace'
echo 'directory itself when it archives, so node_modules/ and dist/ go with it.'
echo 'Chrome keeps its own record of a loaded unpacked extension, so if this'
echo 'workspace was loaded there, remove the card at chrome://extensions.'
exit 0
