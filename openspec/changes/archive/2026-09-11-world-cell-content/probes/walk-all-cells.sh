#!/usr/bin/env bash
# Drive a full cell walk against the running game: load the world, open a run, plan, then walk
# every batch. Prints each batch's per-cell report.
set -euo pipefail
CLI="${HOTREPL_CLI:-/Users/glockyco/src/github.com/glockyco/HotRepl/packages/cli/dist/bin.js}"
URL="${HOTREPL_URL:-ws://127.0.0.1:18591}"
# Doubled separators: this string goes into JSON, where a lone backslash escapes the next character.
OUT='Z:\\Users\\glockyco\\src\\github.com\\glockyco\\ardenfall-compendium\\snapshots'

run() { bun "$CLI" --url "$URL" --json run "$1" "$2"; }

# Already in the world when a previous run left it loaded; the menu click then has no button.
if [ "$(bun "$CLI" --url "$URL" eval 'Ardenfall.ArdenfallGame.instance != null' | tail -1)" != "true" ]; then
  bun "$CLI" --url "$URL" --json run compendium.continueFromMenu '{}' >/dev/null
fi
for _ in $(seq 1 30); do
  ready=$(bun "$CLI" --url "$URL" eval 'Ardenfall.ArdenfallGame.instance != null' | tail -1)
  [ "$ready" = "true" ] && break
  sleep 5
done

RUN=$(run run.begin "{\"outputBaseDir\":\"$OUT\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["output"]["runId"])')
echo "run $RUN"

PLAN=$(run world.plan "{\"runId\":\"$RUN\"}")
TOTAL=$(printf '%s' "$PLAN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["output"]["total"])')
BATCH=$(printf '%s' "$PLAN" | python3 -c 'import json,sys; print(json.load(sys.stdin)["output"]["batchSize"])')
echo "cells $TOTAL, batch $BATCH"

offset=0
while [ "$offset" -lt "$TOTAL" ]; do
  run world.walkBatch "{\"runId\":\"$RUN\",\"offset\":$offset,\"limit\":$BATCH}" |
    python3 -c '
import json, sys
result = json.load(sys.stdin)["output"]
for cell in result["cells"]:
    print("  %-28s seen=%-4d harvested=%-4d diagnostics=%d" % (
        cell["cell"], cell["objectsSeen"], cell["harvested"], cell["diagnostics"]))
print("  pending %d" % result["pending"])
if result["unmodelledTypes"]:
    print("  unmodelled", result["unmodelledTypes"])
'
  offset=$((offset + BATCH))
done
echo "$RUN"
