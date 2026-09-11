#!/usr/bin/env bash
# Capture one overworld cell from an orthographic top-down camera.
#
# Spike for `tile-capture-basemap` tasks 1.2 to 1.4. It loads a cell additively, establishes its own
# lighting, renders the cell's declared grid rectangle, and restores what it changed. The plate goes
# into the game's drive, because the game process cannot see this checkout; copy it out afterwards.
#
# The game must be in the world, not at the main menu. Click Continue first: at the menu the cell
# loads but nothing renders but flat ambient grey.
#
# Usage: spikes/basemap-capture.sh <cellX> <cellY> <pixels>
#   e.g. spikes/basemap-capture.sh -2 -8 1024
set -uo pipefail

CX="${1:?cell x}"
CY="${2:?cell y}"
PIXELS="${3:?pixels per cell}"
CLI="${HOTREPL_CLI:-$HOME/src/github.com/glockyco/HotRepl/packages/cli/dist/bin.js}"
URL="${HOTREPL_URL:-ws://127.0.0.1:18591}"
SCENE="cell_overworld_${CX}.${CY}"

ev() { bun "$CLI" --url "$URL" eval "$1" 2>&1 | tail -2; }

echo "== load $SCENE"
ev "UnityEngine.SceneManagement.SceneManager.LoadSceneAsync(\"$SCENE\", UnityEngine.SceneManagement.LoadSceneMode.Additive) != null"
sleep 10

echo "== capture ${PIXELS}px over the declared 150-unit cell"
# Bounds come from the declared grid: cell (x,y) spans x*150 to (x+1)*150 on both axes, with no
# offset. They must not come from the scene's renderers: cell -2.-8 reports renderer bounds of
# 1,339 by 504 units, because a cell scene parents distant geometry far outside its own rectangle.
ev "$(cat <<EOF
((System.Func<string>)(() => {
  float size = 150f;
  float cx = ($CX + 0.5f) * size;
  float cz = ($CY + 0.5f) * size;
  var sunGo = new UnityEngine.GameObject("compendium_capture_sun");
  var sun = sunGo.AddComponent<UnityEngine.Light>();
  sun.type = UnityEngine.LightType.Directional;
  sun.intensity = 1.2f;
  sun.shadows = UnityEngine.LightShadows.None;
  sunGo.transform.rotation = UnityEngine.Quaternion.Euler(50f, 330f, 0f);
  bool fog = UnityEngine.RenderSettings.fog;
  UnityEngine.RenderSettings.fog = false;
  var go = new UnityEngine.GameObject("compendium_capture");
  var cam = go.AddComponent<UnityEngine.Camera>();
  cam.orthographic = true;
  cam.orthographicSize = size / 2f;
  cam.transform.position = new UnityEngine.Vector3(cx, 800f, cz);
  cam.transform.rotation = UnityEngine.Quaternion.Euler(90f, 0f, 0f);
  cam.nearClipPlane = 1f;
  cam.farClipPlane = 3000f;
  cam.clearFlags = UnityEngine.CameraClearFlags.SolidColor;
  cam.backgroundColor = new UnityEngine.Color(0f, 0f, 0f, 0f);
  var rt = new UnityEngine.RenderTexture($PIXELS, $PIXELS, 24, UnityEngine.RenderTextureFormat.ARGB32);
  cam.targetTexture = rt;
  cam.Render();
  var prev = UnityEngine.RenderTexture.active;
  UnityEngine.RenderTexture.active = rt;
  var tex = new UnityEngine.Texture2D($PIXELS, $PIXELS, UnityEngine.TextureFormat.RGBA32, false);
  tex.ReadPixels(new UnityEngine.Rect(0, 0, $PIXELS, $PIXELS), 0, 0);
  tex.Apply();
  UnityEngine.RenderTexture.active = prev;
  var bytes = UnityEngine.ImageConversion.EncodeToPNG(tex);
  var path = "C:/grid_${CX}_${CY}_${PIXELS}.png";
  System.IO.File.WriteAllBytes(path, bytes);
  cam.targetTexture = null;
  UnityEngine.RenderSettings.fog = fog;
  UnityEngine.Object.DestroyImmediate(go);
  UnityEngine.Object.DestroyImmediate(sunGo);
  UnityEngine.Object.DestroyImmediate(rt);
  UnityEngine.Object.DestroyImmediate(tex);
  return "wrote " + path + " bytes=" + bytes.Length + " center=(" + cx + "," + cz + ")";
}))()
EOF
)"

echo "== unload $SCENE"
ev "UnityEngine.SceneManagement.SceneManager.UnloadSceneAsync(\"$SCENE\") != null"
