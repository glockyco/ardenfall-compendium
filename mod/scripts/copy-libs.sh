#!/usr/bin/env bash
# Copies game DLLs and HotRepl.Core compile reference into mod/libs/.
# Usage: copy-libs.sh [ardenfall-managed-dir] [hotrepl-core-output-dir]
set -euo pipefail
SRC=${1:-"$HOME/Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/Ardenfall Demo/Ardenfall_Data/Managed"}
HOTREPL_OUT=${2:-"$HOME/Projects/HotRepl/src/HotRepl.Core/bin/Debug/netstandard2.1"}
DEST="$(dirname "$0")/../libs"
mkdir -p "$DEST"
for dll in Assembly-CSharp.dll UnityEngine.dll UnityEngine.CoreModule.dll UnityEngine.IMGUIModule.dll UnityEngine.UIModule.dll UnityEngine.UI.dll Sirenix.OdinInspector.Attributes.dll Sirenix.Serialization.dll Sirenix.Serialization.Config.dll; do
  cp "$SRC/$dll" "$DEST/$dll"
done
if [ -f "$HOTREPL_OUT/HotRepl.Core.dll" ]; then
  cp "$HOTREPL_OUT/HotRepl.Core.dll" "$DEST/HotRepl.Core.dll"
fi
echo "copied $(find "$DEST" -maxdepth 1 -name '*.dll' | wc -l | tr -d ' ') dlls to $DEST"
