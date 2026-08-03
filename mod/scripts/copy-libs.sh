#!/usr/bin/env bash
# Copies game DLLs and the HotRepl.Core compile reference into mod/libs/.
# Usage: copy-libs.sh [ardenfall-managed-dir] [hotrepl-core-output-dir]
set -euo pipefail

SRC=${1:-"$HOME/Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/Ardenfall Demo/Ardenfall_Data/Managed"}
HOTREPL_OUT=${2:-"$HOME/Projects/HotRepl/src/HotRepl.Core/bin/Debug/netstandard2.1"}
DEST="$(dirname "$0")/../libs"

required_managed_dlls=(
  Assembly-CSharp.dll
  UnityEngine.dll
  UnityEngine.CoreModule.dll
  UnityEngine.IMGUIModule.dll
  UnityEngine.UIModule.dll
  UnityEngine.UI.dll
  Sirenix.OdinInspector.Attributes.dll
  Sirenix.Serialization.dll
  Sirenix.Serialization.Config.dll
  FlowCanvas.dll
  NodeCanvas.dll
  ParadoxNotion.dll
)

missing=0
for dll in "${required_managed_dlls[@]}"; do
  if [[ ! -f "$SRC/$dll" ]]; then
    printf 'missing Ardenfall managed DLL: %s\n' "$SRC/$dll" >&2
    missing=1
  fi
done

if [[ ! -f "$HOTREPL_OUT/HotRepl.Core.dll" ]]; then
  printf 'missing HotRepl.Core.dll: %s\n' "$HOTREPL_OUT/HotRepl.Core.dll" >&2
  missing=1
fi


if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

mkdir -p "$DEST"
for dll in "${required_managed_dlls[@]}"; do
  cp "$SRC/$dll" "$DEST/$dll"
done
cp "$HOTREPL_OUT/HotRepl.Core.dll" "$DEST/HotRepl.Core.dll"

copied=0
for dll in "$DEST"/*.dll; do
  [[ -e "$dll" ]] || continue
  copied=$((copied + 1))
done
printf 'copied %s dlls to %s\n' "$copied" "$DEST"
