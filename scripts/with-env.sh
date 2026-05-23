#!/usr/bin/env bash
# Source the repo-root .env (if present), then exec the remaining arguments.
#
# Why this exists:
#   `bun run <script>` does not auto-load .env files before invoking the script
#   body (oven-sh/bun#23962). package.json scripts in this repo that need
#   ARDENFALL_MANAGED_DIR, HOTREPL_REPO, etc. would otherwise fail with
#     bash: line 1: HOTREPL_REPO: set HOTREPL_REPO
#   even with a populated .env in the repo root.
#
#   Bun does inject .env into `process.env` for `bun -e ...` and `bun file.ts`,
#   so this helper exists purely for `bun run` shell-style scripts.
#
# Usage:
#   scripts/with-env.sh <command> [args...]
#
# Behaviour:
#   - Resolves the repo root from the script's own location so it works
#     regardless of cwd.
#   - If $REPO_ROOT/.env exists, sources it with auto-export (`set -a`) so
#     every assignment is exported to the child process. Quoted values and
#     comments are handled by bash's standard source.
#   - If .env is missing, exec the command anyway. Variables already in the
#     environment (e.g. CI secrets) still flow through.
#   - exec replaces this shell with the target, so signals (SIGINT, SIGTERM)
#     reach the command directly and the exit code is preserved.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.env"
  set +a
fi

exec "$@"
