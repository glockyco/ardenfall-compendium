using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Ardenfall;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Entities.World;
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Map;

/// <summary>Renders a map's declared cells from an orthographic top-down camera.</summary>
public sealed class CellCapture
{
    public const float DefaultCameraHeight = 800f;
    public const float SunIntensity = 1.2f;
    public const string SunEulerText = "(50.0, 330.0, 0.0)";
    public const string AmbientText = "(0.450, 0.450, 0.500, 1.000)";

    private static readonly Vector3 SunEuler = new(50f, 330f, 0f);
    private static readonly Color AmbientColor = new(0.45f, 0.45f, 0.5f);
    private static readonly string[] ExcludedLayers =
    {
        "UI", "postProcess", "NoInteriorLight", "Item", "Damagable", "Player", "NPC",
        "WeatherCollision", "Element",
    };

    private readonly Action<IEnumerator> _startCoroutine;
    private readonly Func<string, byte[], string> _writePlate;

    public CellCapture(Action<IEnumerator> startCoroutine, Func<string, byte[], string> writePlate)
    {
        _startCoroutine = startCoroutine ?? throw new ArgumentNullException(nameof(startCoroutine));
        _writePlate = writePlate ?? throw new ArgumentNullException(nameof(writePlate));
    }

    /// <summary>The camera mask that suppresses transient content without changing any object.</summary>
    public static int CaptureCullingMask() => ~LayerMask.GetMask(ExcludedLayers);

    /// <summary>Builds the recorded inputs without reading Unity state.</summary>
    public static MapCaptureInputs Inputs(
        string mapId,
        string gameVersion,
        MapCaptureGrid grid,
        int pixelsPerCell,
        int minCellX,
        int minCellY,
        int maxCellX,
        int maxCellY,
        float cameraHeight,
        int cullingMask)
    {
        if (grid == null) throw new ArgumentNullException(nameof(grid));
        return new MapCaptureInputs
        {
            MapId = mapId,
            GameVersion = gameVersion,
            GridOffsetX = grid.OffsetX,
            GridOffsetY = grid.OffsetY,
            GridSizeX = grid.SizeX,
            GridSizeY = grid.SizeY,
            CellSize = grid.CellSize,
            PixelsPerCell = pixelsPerCell,
            PixelsPerUnit = CellCaptureGeometry.PixelsPerUnit(grid.CellSize, pixelsPerCell),
            MinCellX = minCellX,
            MinCellY = minCellY,
            MaxCellX = maxCellX,
            MaxCellY = maxCellY,
            SunIntensity = SunIntensity,
            SunEuler = SunEulerText,
            Ambient = AmbientText,
            Fog = false,
            CameraHeight = cameraHeight,
            CullingMask = cullingMask,
        };
    }

    /// <summary>Runs the frame-spanning load, render, and unload operation on Unity's main thread.</summary>
    public Task<MapCaptureSnapshot> CaptureAsync(
        MapCaptureInputs inputs,
        IReadOnlyDictionary<string, CellScene> authoredScenes,
        bool authoredOnly,
        Action<MapCaptureSnapshot> commit,
        CancellationToken cancellationToken)
    {
        if (inputs is null) throw new ArgumentNullException(nameof(inputs));
        if (authoredScenes is null) throw new ArgumentNullException(nameof(authoredScenes));
        if (commit is null) throw new ArgumentNullException(nameof(commit));

        var completion = new TaskCompletionSource<MapCaptureSnapshot>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        try
        {
            _startCoroutine(Capture(
                inputs, authoredScenes, authoredOnly, commit, completion, cancellationToken));
        }
        catch (Exception error)
        {
            completion.TrySetException(error);
        }

        return completion.Task;
    }

    private IEnumerator Capture(
        MapCaptureInputs inputs,
        IReadOnlyDictionary<string, CellScene> authoredScenes,
        bool authoredOnly,
        Action<MapCaptureSnapshot> commit,
        TaskCompletionSource<MapCaptureSnapshot> completion,
        CancellationToken cancellationToken)
    {
        var snapshot = new MapCaptureSnapshot { Inputs = inputs };
        var fog = RenderSettings.fog;
        var ambientMode = RenderSettings.ambientMode;
        var ambient = RenderSettings.ambientLight;
        var priority = Application.backgroundLoadingPriority;
        var loadedByCapture = new List<int>();
        GameObject? sunObject = null;
        GameObject? cameraObject = null;
        Exception? failure = null;

        Application.backgroundLoadingPriority = UnityEngine.ThreadPriority.High;
        RenderSettings.fog = false;
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = AmbientColor;

        sunObject = new GameObject("compendium_capture_sun");
        var sun = sunObject.AddComponent<Light>();
        sun.type = LightType.Directional;
        sun.intensity = SunIntensity;
        sun.shadows = LightShadows.None;
        sun.cullingMask = inputs.CullingMask;
        sunObject.transform.rotation = Quaternion.Euler(SunEuler);

        cameraObject = new GameObject("compendium_capture_camera");
        var camera = cameraObject.AddComponent<Camera>();
        camera.orthographic = true;
        camera.clearFlags = CameraClearFlags.SolidColor;
        camera.backgroundColor = new Color(0f, 0f, 0f, 0f);
        camera.nearClipPlane = 1f;
        camera.farClipPlane = inputs.CameraHeight * 4f;
        camera.cullingMask = inputs.CullingMask;
        camera.enabled = false;

        foreach (var frame in CellCaptureGeometry.Frames(
                     inputs.MinCellX,
                     inputs.MinCellY,
                     inputs.MaxCellX,
                     inputs.MaxCellY,
                     inputs.CellSize,
                     inputs.PixelsPerCell))
        {
            if (cancellationToken.IsCancellationRequested) break;
            var sceneName = $"cell_{inputs.MapId}_{frame.CellX}.{frame.CellY}";
            authoredScenes.TryGetValue(sceneName, out var authoredScene);
            if (authoredOnly && authoredScene == null) continue;

            var loadedHere = false;
            if (authoredScene != null
                && !SceneManager.GetSceneByBuildIndex(authoredScene.BuildIndex).isLoaded)
            {
                var load = SceneManager.LoadSceneAsync(authoredScene.BuildIndex, LoadSceneMode.Additive);
                if (load == null)
                {
                    snapshot.Diagnostics.Add(new Diagnostic
                    {
                        Severity = "fatal",
                        Code = "mapCellLoadRefused",
                        Field = "loadedCells",
                        Message = $"The engine refused to load cell scene '{sceneName}'.",
                    });
                    continue;
                }

                while (!load.isDone) yield return null;
                loadedByCapture.Add(authoredScene.BuildIndex);
                loadedHere = true;
            }

            if (authoredScene != null) snapshot.LoadedCells.Add(sceneName);
            try
            {
                snapshot.Tiles.Add(CaptureFrame(
                    inputs.MapId, camera, frame, inputs.CameraHeight, authoredScene != null));
            }
            catch (Exception error)
            {
                failure = error;
            }

            if (loadedHere)
            {
                var unload = SceneManager.UnloadSceneAsync(authoredScene!.BuildIndex);
                if (unload != null)
                {
                    while (!unload.isDone) yield return null;
                }
                loadedByCapture.Remove(authoredScene.BuildIndex);
            }

            if (failure != null) break;
        }
        foreach (var buildIndex in loadedByCapture.ToList())
        {
            var unload = SceneManager.UnloadSceneAsync(buildIndex);
            if (unload != null)
            {
                while (!unload.isDone) yield return null;
            }
            loadedByCapture.Remove(buildIndex);
        }

        if (cameraObject != null) UnityObject.DestroyImmediate(cameraObject);
        if (sunObject != null) UnityObject.DestroyImmediate(sunObject);
        RenderSettings.fog = fog;
        RenderSettings.ambientMode = ambientMode;
        RenderSettings.ambientLight = ambient;
        Application.backgroundLoadingPriority = priority;

        snapshot.Restored = loadedByCapture.Count == 0
            && RenderSettings.fog == fog
            && RenderSettings.ambientMode == ambientMode
            && RenderSettings.ambientLight == ambient;
        if (failure != null)
        {
            snapshot.Diagnostics.Add(new Diagnostic
            {
                Severity = "fatal",
                Code = "mapCaptureFailed",
                Field = "tiles",
                Message = $"Capture of map '{inputs.MapId}' failed: {failure.Message}",
            });
        }
        if (cancellationToken.IsCancellationRequested)
        {
            snapshot.Diagnostics.Add(new Diagnostic
            {
                Severity = "fatal",
                Code = "mapCaptureCancelled",
                Field = "tiles",
                Message = $"Capture of map '{inputs.MapId}' was cancelled.",
            });
        }

        try
        {
            commit(snapshot);
            completion.TrySetResult(snapshot);
        }
        catch (Exception error)
        {
            completion.TrySetException(error);
        }
    }

    private MapCaptureTileSnapshot CaptureFrame(
        string mapId,
        Camera camera,
        CellCaptureFrame frame,
        float cameraHeight,
        bool authored)
    {
        GameObject? distant = null;
        if (!authored) distant = InstantiateDistantCell(mapId, frame);

        try
        {
            camera.orthographicSize = frame.OrthographicSize;
            camera.transform.position = new Vector3(frame.CenterX, cameraHeight, frame.CenterZ);
            camera.transform.rotation = Quaternion.Euler(90f, 0f, 0f);

            var renderers = authored
                ? CountSceneRenderers($"cell_{mapId}_{frame.CellX}.{frame.CellY}")
                : distant == null ? 0 : distant.GetComponentsInChildren<Renderer>(true).Length;
            if (renderers == 0)
            {
                return new MapCaptureTileSnapshot
                {
                    CellX = frame.CellX,
                    CellY = frame.CellY,
                    Authored = authored,
                    Renderers = 0,
                    Empty = true,
                };
            }

            var png = Render(camera, frame.Pixels);
            var hash = SpriteAssetExporter.Sha256Hex(png);
            var path = _writePlate($"assets/map/{mapId}/{hash}.png", png);
            return new MapCaptureTileSnapshot
            {
                CellX = frame.CellX,
                CellY = frame.CellY,
                Hash = hash,
                Path = path,
                Bytes = png.Length,
                Authored = authored,
                Renderers = renderers,
            };
        }
        finally
        {
            if (distant != null) UnityObject.DestroyImmediate(distant);
        }
    }

    private static int CountSceneRenderers(string sceneName)
    {
        var scene = SceneManager.GetSceneByName(sceneName);
        if (!scene.IsValid() || !scene.isLoaded) return 0;
        return scene.GetRootGameObjects()
            .Sum(root => root.GetComponentsInChildren<Renderer>(true).Length);
    }

    private static GameObject? InstantiateDistantCell(string mapId, CellCaptureFrame frame)
    {
        var prefabName = $"celldistant_{mapId}_{frame.CellX}.{frame.CellY}";
        foreach (var candidate in Resources.FindObjectsOfTypeAll<GameObject>())
        {
            if (candidate == null || candidate.name != prefabName) continue;
            var instance = UnityObject.Instantiate(candidate);
            instance.name = "compendium_capture_distant";
            return instance;
        }

        return null;
    }

    private static byte[] Render(Camera camera, int pixels)
    {
        var target = new RenderTexture(pixels, pixels, 24, RenderTextureFormat.ARGB32);
        var previous = RenderTexture.active;
        Texture2D? plate = null;
        try
        {
            camera.targetTexture = target;
            camera.Render();
            RenderTexture.active = target;
            plate = new Texture2D(pixels, pixels, TextureFormat.RGBA32, false);
            plate.ReadPixels(new Rect(0, 0, pixels, pixels), 0, 0);
            plate.Apply();
            return SpriteAssetExporter.EncodeRgbaPng(plate.GetRawTextureData(), pixels, pixels);
        }
        finally
        {
            camera.targetTexture = null;
            RenderTexture.active = previous;
            if (plate != null) UnityObject.DestroyImmediate(plate);
            UnityObject.DestroyImmediate(target);
        }
    }

    /// <summary>Writes a plate under a capture workspace in the standard snapshot asset layout.</summary>
    public static Func<string, byte[], string> FileWriter(string captureDir) =>
        (relativePath, bytes) =>
        {
            var fullPath = Path.Combine(captureDir, relativePath.Replace('/', Path.DirectorySeparatorChar));
            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            if (!File.Exists(fullPath)) File.WriteAllBytes(fullPath, bytes);
            return relativePath;
        };
}
