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
    public const string AmbientText = "(1.200, 1.200, 1.250, 1.000)";

    private static readonly Vector3 SunEuler = new(50f, 330f, 0f);
    private static readonly Color AmbientColor = new(1.2f, 1.2f, 1.25f);
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
            PinnedTime = "13:00",
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
        var timeManager = UnityObject.FindObjectOfType<TimeManager>();
        WorldTime? originalTime = timeManager?.GetWorldTime();
        var originalTimeMultiplier = timeManager?.timeMultiplier ?? 0f;
        var sky = Ardenfall.Sky.ArdenfallSkybox.instance;
        var originalSkyEnabled = sky != null && sky.enabled;
        var loadedByCapture = new List<Scene>();
        var suppressedRenderers = new List<Renderer>();
        var frames = CellCaptureGeometry.Frames(
            inputs.MinCellX,
            inputs.MinCellY,
            inputs.MaxCellX,
            inputs.MaxCellY,
            inputs.CellSize,
            inputs.PixelsPerCell);
        var distantCells = authoredOnly
            ? new Dictionary<string, GameObject>(StringComparer.Ordinal)
            : InstantiateDistantCells(inputs.MapId, frames);
        GameObject? sunObject = null;
        GameObject? cameraObject = null;
        Exception? failure = null;

        Application.backgroundLoadingPriority = UnityEngine.ThreadPriority.High;
        RenderSettings.fog = false;
        RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Flat;
        RenderSettings.ambientLight = AmbientColor;
        if (timeManager != null)
        {
            timeManager.timeMultiplier = 0f;
            timeManager.SetTime(13L * 60L * 60L);
        }
        if (sky != null)
        {
            sky.enabled = true;
            sky.ForceUpdate();
            sky.enabled = false;
        }

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

        foreach (var frame in frames)
        {
            var sceneName = $"cell_{inputs.MapId}_{frame.CellX}.{frame.CellY}";
            if (!authoredScenes.TryGetValue(sceneName, out var authoredScene)) continue;
            snapshot.LoadedCells.Add(sceneName);

            var existingHandles = new HashSet<int>();
            for (var index = 0; index < SceneManager.sceneCount; index++)
            {
                var existingScene = SceneManager.GetSceneAt(index);
                existingHandles.Add(existingScene.handle);
                if (existingScene.buildIndex != authoredScene.BuildIndex) continue;
                foreach (var renderer in existingScene.GetRootGameObjects()
                    .SelectMany(root => root.GetComponentsInChildren<Renderer>(true)))
                {
                    if (!renderer.enabled) continue;
                    renderer.enabled = false;
                    suppressedRenderers.Add(renderer);
                }
            }

            var load = SceneManager.LoadSceneAsync(authoredScene.BuildIndex, LoadSceneMode.Additive);
            if (load == null)
            {
                failure = new InvalidOperationException(
                    $"The engine refused to load cell scene '{sceneName}'.");
                break;
            }
            while (!load.isDone) yield return null;

            Scene? loadedScene = null;
            for (var index = 0; index < SceneManager.sceneCount; index++)
            {
                var candidate = SceneManager.GetSceneAt(index);
                if (candidate.buildIndex == authoredScene.BuildIndex
                    && !existingHandles.Contains(candidate.handle)) loadedScene = candidate;
            }
            if (loadedScene == null)
            {
                failure = new InvalidOperationException(
                    $"The engine did not expose the isolated copy of cell scene '{sceneName}'.");
                break;
            }
            loadedByCapture.Add(loadedScene.Value);
        }
        foreach (var particleRenderer in UnityObject.FindObjectsOfType<ParticleSystemRenderer>())
        {
            var isCloud = particleRenderer.name.IndexOf("cloud", StringComparison.OrdinalIgnoreCase) >= 0
                || particleRenderer.sharedMaterials.Any(material => material != null
                    && material.name.IndexOf("cloud", StringComparison.OrdinalIgnoreCase) >= 0);
            if (!isCloud || !particleRenderer.enabled) continue;
            particleRenderer.enabled = false;
            suppressedRenderers.Add(particleRenderer);
        }

        if (failure == null)
        {
            foreach (var frame in frames)
            {
                if (cancellationToken.IsCancellationRequested) break;
                var sceneName = $"cell_{inputs.MapId}_{frame.CellX}.{frame.CellY}";
                authoredScenes.TryGetValue(sceneName, out var authoredScene);
                if (authoredOnly && authoredScene == null)
                {
                    // The record names every position of the range, so the pipeline can tell a
                    // cell this run chose not to render from one it lost.
                    snapshot.Tiles.Add(new MapCaptureTileSnapshot
                    {
                        CellX = frame.CellX,
                        CellY = frame.CellY,
                        Authored = false,
                        Renderers = 0,
                        Empty = true,
                    });
                    continue;
                }
                try
                {
                    distantCells.TryGetValue(sceneName, out var distantCell);
                    snapshot.Tiles.Add(CaptureFrame(
                        inputs.MapId,
                        camera,
                        frame,
                        inputs.CameraHeight,
                        authoredScene != null,
                        distantCell,
                        distantCells.Count > 0));
                }
                catch (Exception error)
                {
                    failure = error;
                    break;
                }
            }
        }
        foreach (var renderer in suppressedRenderers)
        {
            if (renderer != null) renderer.enabled = true;
        }
        suppressedRenderers.Clear();

        foreach (var loadedScene in loadedByCapture.ToList())
        {
            var unload = SceneManager.UnloadSceneAsync(loadedScene);
            if (unload != null)
            {
                while (!unload.isDone) yield return null;
            }
            loadedByCapture.Remove(loadedScene);
        }

        foreach (var distantCell in distantCells.Values)
        {
            if (distantCell != null) UnityObject.DestroyImmediate(distantCell);
        }
        distantCells.Clear();

        if (cameraObject != null) UnityObject.DestroyImmediate(cameraObject);
        if (sunObject != null) UnityObject.DestroyImmediate(sunObject);
        RenderSettings.fog = fog;
        RenderSettings.ambientMode = ambientMode;
        RenderSettings.ambientLight = ambient;
        Application.backgroundLoadingPriority = priority;
        if (timeManager != null)
        {
            timeManager.SetTime(originalTime!.Value.Seconds);
            timeManager.timeMultiplier = originalTimeMultiplier;
        }
        if (sky != null)
        {
            sky.enabled = originalSkyEnabled;
            sky.ForceUpdate();
        }

        snapshot.Restored = loadedByCapture.Count == 0
            && suppressedRenderers.Count == 0
            && distantCells.Count == 0
            && RenderSettings.fog == fog
            && RenderSettings.ambientMode == ambientMode
            && RenderSettings.ambientLight == ambient
            && (timeManager == null || (timeManager.GetWorldTime().Seconds == originalTime!.Value.Seconds
                && timeManager.timeMultiplier == originalTimeMultiplier))
            && (sky == null || sky.enabled == originalSkyEnabled);
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
        bool authored,
        GameObject? ownDistantCell,
        bool hasDistantWorld)
    {
        camera.orthographicSize = frame.OrthographicSize;
        camera.transform.position = new Vector3(frame.CenterX, cameraHeight, frame.CenterZ);
        camera.transform.rotation = Quaternion.Euler(90f, 0f, 0f);

        var renderers = authored
            ? CountSceneRenderers($"cell_{mapId}_{frame.CellX}.{frame.CellY}")
            : ownDistantCell == null ? 0 : ownDistantCell.GetComponentsInChildren<Renderer>(true).Length;
        if (renderers == 0 && !hasDistantWorld)
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

    private static int CountSceneRenderers(string sceneName)
    {
        var scene = SceneManager.GetSceneByName(sceneName);
        if (!scene.IsValid() || !scene.isLoaded) return 0;
        return scene.GetRootGameObjects()
            .Sum(root => root.GetComponentsInChildren<Renderer>(true).Length);
    }

    private static Dictionary<string, GameObject> InstantiateDistantCells(
        string mapId,
        IReadOnlyList<CellCaptureFrame> frames)
    {
        var requested = frames.ToDictionary(
            frame => $"celldistant_{mapId}_{frame.CellX}.{frame.CellY}",
            frame => $"cell_{mapId}_{frame.CellX}.{frame.CellY}",
            StringComparer.Ordinal);
        var map = Resources.FindObjectsOfTypeAll<WorldData>()
            .SelectMany(world => world.maps)
            .FirstOrDefault(candidate => candidate.id == mapId);
        var prefabs = map?.GeneratedAssetReferences?.distantCellPrefabs
            ?? new List<GameObject>();
        var result = new Dictionary<string, GameObject>(StringComparer.Ordinal);
        foreach (var prefab in prefabs)
        {
            if (prefab == null || !requested.TryGetValue(prefab.name, out var sceneName)) continue;
            var instance = UnityObject.Instantiate(prefab);
            instance.name = $"compendium_capture_distant_{sceneName}";
            result.Add(sceneName, instance);
        }
        return result;
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
            return ImageConversion.EncodeToPNG(plate);
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
