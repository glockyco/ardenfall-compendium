#!/usr/bin/env bash
# Shape of the authored dialogue graphs, read from the live game.
#
# The data model rests on these numbers: the role histogram decides the vocabulary, the joins and
# jumps decide graph rather than tree, and the node counts decide script rather than diagram.
#
# Read-only: loads nothing and writes nothing.
#
# Usage: HOTREPL_URL=ws://127.0.0.1:18591 openspec/changes/dialogue-flow/probes/graph-shape.sh
set -uo pipefail
CLI="${HOTREPL_CLI:-/Users/glockyco/src/github.com/glockyco/HotRepl/packages/cli/dist/bin.js}"
URL="${HOTREPL_URL:-ws://127.0.0.1:18591}"

ev() { bun "$CLI" --url "$URL" eval "$1" 2>&1; }

product=$(ev 'UnityEngine.Application.productName')
if [ "$product" != "Ardenfall Demo 2025" ]; then
  echo "Wrong backend on $URL: $product" >&2
  exit 1
fi

echo "graphs+nodes+edges: $(ev 'var gs = UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.Dialog.DialogFlowGraph>(); "graphs=" + gs.Length + " nodes=" + System.Linq.Enumerable.Sum(gs, g => g.allNodes == null ? 0 : g.allNodes.Count) + " edges=" + System.Linq.Enumerable.Sum(gs, g => g.allNodes == null ? 0 : System.Linq.Enumerable.Sum(g.allNodes, n => n.outConnections.Count))')"

echo "joins: $(ev 'System.Linq.Enumerable.Sum(UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.Dialog.DialogFlowGraph>(), g => g.allNodes == null ? 0 : System.Linq.Enumerable.Count(g.allNodes, n => n.inConnections.Count > 1))')"
echo "branching: $(ev 'System.Linq.Enumerable.Sum(UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.Dialog.DialogFlowGraph>(), g => g.allNodes == null ? 0 : System.Linq.Enumerable.Count(g.allNodes, n => n.outConnections.Count > 1))')"
echo "jumps: $(ev 'System.Linq.Enumerable.Sum(UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.Dialog.DialogFlowGraph>(), g => g.allNodes == null ? 0 : System.Linq.Enumerable.Count(g.allNodes, n => n.GetType().Name.StartsWith("GoTo")))')"
echo "multi-screen speech: $(ev 'System.Linq.Enumerable.Sum(UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.Dialog.DialogFlowGraph>(), g => g.allNodes == null ? 0 : System.Linq.Enumerable.Count(g.allNodes, n => n is Ardenfall.Dialog.Nodes.SpeakFlowNode s && s.otherStatements.Count > 0))')"

# The population the extraction publishes, against the copies a loaded world makes.
echo "authored graph assets: $(ev 'System.Linq.Enumerable.Count(UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.Dialog.DialogFlowGraph>(), g => !g.name.Contains("(Clone)"))')"
echo "registered character definitions holding a dialogue graph: $(ev 'System.Linq.Enumerable.Sum(Ardenfall.BuiltLookupTable.GetAssetsOfType<Ardenfall.CharacterData>(), c => c.characterGraphs == null || c.characterGraphs.Get() == null ? 0 : System.Linq.Enumerable.Count(c.characterGraphs.Get(), g => g != null && g.graph is Ardenfall.Dialog.DialogFlowGraph))')"

echo "node types:"
ev 'string.Join("\n", System.Linq.Enumerable.Select(System.Linq.Enumerable.OrderByDescending(System.Linq.Enumerable.GroupBy(System.Linq.Enumerable.SelectMany(UnityEngine.Resources.FindObjectsOfTypeAll<Ardenfall.Dialog.DialogFlowGraph>(), g => g.allNodes ?? new System.Collections.Generic.List<NodeCanvas.Framework.Node>()), n => n.GetType().Name), grp => System.Linq.Enumerable.Count(grp)), grp => System.Linq.Enumerable.Count(grp) + "\t" + grp.Key))'
