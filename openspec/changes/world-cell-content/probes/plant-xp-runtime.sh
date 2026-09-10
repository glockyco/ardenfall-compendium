#!/usr/bin/env bash
# Runtime read of PickablePlant.giveXP per cell scene, from the live game.
# Loads each cell scene additively from the main menu, reads the engine-deserialised
# fields, then unloads. Read-only: touches no save file.
#
# Usage: HOTREPL_URL=ws://127.0.0.1:18591 spikes/plant-xp-runtime.sh <buildIndex> [...]
set -uo pipefail
CLI="${HOTREPL_CLI:-/Users/glockyco/src/github.com/glockyco/HotRepl/packages/cli/dist/bin.js}"
URL="${HOTREPL_URL:-ws://127.0.0.1:18591}"

# Never truncate: an earlier version piped this through `tail -40`, which capped the row dump
# of cell 24 at 40 of its 47 plants and looked exactly like a game-side readiness problem.
ev() { bun "$CLI" --url "$URL" eval "$1" 2>&1; }

product=$(ev 'UnityEngine.Application.productName')
if [ "$product" != "Ardenfall Demo 2025" ]; then
  echo "Wrong backend on $URL: $product" >&2
  exit 1
fi

for i in "$@"; do
  ev "UnityEngine.SceneManagement.SceneManager.LoadSceneAsync($i, UnityEngine.SceneManagement.LoadSceneMode.Additive) != null" >/dev/null
  state=false
  for _ in $(seq 1 60); do
    state=$(ev "UnityEngine.SceneManagement.SceneManager.GetSceneByBuildIndex($i).isLoaded")
    [ "$state" = "true" ] && break
    sleep 1
  done
  if [ "$state" != "true" ]; then
    echo "SCENE $i LOAD_FAILED"
    continue
  fi

  expected=$(ev "System.Linq.Enumerable.Count(UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.PickablePlant>(), p => p.gameObject.scene.buildIndex == $i)")
  echo "SCENE $i $(ev "UnityEngine.SceneManagement.SceneManager.GetSceneByBuildIndex($i).name") expected=$expected"
  rows=$(ev "string.Join(\"\n\", System.Linq.Enumerable.Select(System.Linq.Enumerable.Where(UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.PickablePlant>(), p => p.gameObject.scene.buildIndex == $i), p => \"ROW\t$i\t\" + p.gameObject.name + \"\t\" + (p.item == null ? \"null\" : p.item.name) + \"\t\" + p.itemCount + \"\t\" + p.regrowDays + \"\t\" + p.giveXP + \"\t\" + p.pickupText))")
  [ -n "$rows" ] && printf '%s\n' "$rows"

  # A count the rows disagree with means the dump lost data, not that the game holds less.
  printed=$(printf '%s\n' "$rows" | grep -c '^ROW' || true)
  if [ "$printed" != "$expected" ]; then
    echo "SCENE $i ROW_COUNT_MISMATCH expected=$expected printed=$printed" >&2
  fi

  ev "UnityEngine.SceneManagement.SceneManager.UnloadSceneAsync($i) != null" >/dev/null
  sleep 1
done
