#!/usr/bin/env bash
# Runtime read of SimpleDialogInteractable graphs per cell scene, from the live game.
#
# The walk published 14 of 19 scene speakers with no line. That is either the truth about the
# authored data or a misread of the graphs, and only the running game can say which, so this
# prints the graph count and the node types each graph holds rather than the lines alone.
#
# Loads each cell scene additively from the main menu, reads the engine-deserialised fields, then
# unloads. Read-only: touches no save file.
#
# Usage: HOTREPL_URL=ws://127.0.0.1:18591 openspec/changes/world-cell-content/probes/scene-dialogue-runtime.sh <buildIndex> [...]
set -uo pipefail
CLI="${HOTREPL_CLI:-/Users/glockyco/src/github.com/glockyco/HotRepl/packages/cli/dist/bin.js}"
URL="${HOTREPL_URL:-ws://127.0.0.1:18591}"

# Never truncate the row dump: a capped dump looks exactly like a game-side readiness problem.
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

  expected=$(ev "System.Linq.Enumerable.Count(UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.SimpleDialogInteractable>(), d => d.gameObject.scene.buildIndex == $i)")
  echo "SCENE $i $(ev "UnityEngine.SceneManagement.SceneManager.GetSceneByBuildIndex($i).name") expected=$expected"

  # Per speaker: its authored name, how many graphs it holds, and for each graph how many nodes
  # it deserialised and which node types they are. A speaker with graphs but no greeting or topic
  # node is a different fact from a speaker with no graph at all.
  rows=$(ev "string.Join(\"\n\", System.Linq.Enumerable.Select(System.Linq.Enumerable.Where(UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.SimpleDialogInteractable>(), d => d.gameObject.scene.buildIndex == $i), d => \"ROW\t$i\t\" + d.gameObject.name + \"\t\" + (string.IsNullOrEmpty(d.dialogName) ? \"<no-name>\" : d.dialogName) + \"\tgraphs=\" + (d.dialogs == null ? -1 : d.dialogs.Count) + \"\t\" + (d.dialogs == null ? \"null\" : string.Join(\" | \", System.Linq.Enumerable.Select(d.dialogs, g => g == null ? \"<null-graph>\" : g.name + \":\" + (g.allNodes == null ? -1 : g.allNodes.Count) + \":\" + string.Join(\",\", System.Linq.Enumerable.Select(System.Linq.Enumerable.GroupBy(g.allNodes, n => n.GetType().Name), grp => grp.Key + \"x\" + System.Linq.Enumerable.Count(grp))))))))")
  [ -n "$rows" ] && printf '%s\n' "$rows"

  printed=$(printf '%s\n' "$rows" | grep -c '^ROW' || true)
  if [ "$printed" != "$expected" ]; then
    echo "SCENE $i ROW_COUNT_MISMATCH expected=$expected printed=$printed" >&2
  fi

  ev "UnityEngine.SceneManagement.SceneManager.UnloadSceneAsync($i) != null" >/dev/null
  sleep 1
done
