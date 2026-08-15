#!/usr/bin/env bash
# Runs a hook job inside the dev shell, from any environment that can run git.
#
# GUI clients (Fork, Tower, editors) spawn hooks from a minimal PATH that has no
# `nix`, so a job calling `nix develop` directly exits 127 and the push fails
# with `sh: nix: command not found`.
#
# The fix is to ask the user's own shell where nix is, rather than to list
# install locations here: the nix installer registers itself in the login
# profile, so a login shell resolves it on a single-user install, a multi-user
# install, NixOS and nix-darwin alike. Naming those paths in the repository would
# be the machine-specific hardcoding this repo already removed once.
#
# A missing nix is a hard failure. Skipping would report a passing hook for a
# check that never ran.
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: scripts/hook.sh <command> [args...]" >&2
  exit 2
fi

if ! command -v nix >/dev/null 2>&1 && [ -z "${ARDENFALL_HOOK_LOGIN_SHELL:-}" ]; then
  # Re-exec once under a login shell, which sources the profile that the nix
  # installer patched. The guard variable stops a shell without nix from looping.
  export ARDENFALL_HOOK_LOGIN_SHELL=1
  exec bash -lc 'exec "$@"' bash "$0" "$@"
fi

if ! command -v nix >/dev/null 2>&1; then
  echo "git hooks need nix on PATH, and a login shell did not provide it." >&2
  echo "Install nix, or run the client from a shell where \`nix --version\` works." >&2
  exit 1
fi

exec nix develop --command "$@"
