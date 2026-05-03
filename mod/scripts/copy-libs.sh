#!/usr/bin/env bash
# Copies game DLLs from a local Ardenfall install into mod/libs/.
# Default path is the macOS CrossOver Steam location; pass a different one as $1.
set -euo pipefail
SRC=${1:-"$HOME/Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/Ardenfall Demo/Ardenfall_Data/Managed"}
DEST="$(dirname "$0")/../libs"
mkdir -p "$DEST"
for dll in Assembly-CSharp.dll UnityEngine.dll UnityEngine.CoreModule.dll UnityEngine.IMGUIModule.dll Sirenix.OdinInspector.Attributes.dll Sirenix.Serialization.dll; do
  cp "$SRC/$dll" "$DEST/$dll"
done
echo "copied $(ls -1 "$DEST" | wc -l) dlls to $DEST"
