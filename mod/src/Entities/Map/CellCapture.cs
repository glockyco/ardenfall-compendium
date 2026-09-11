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
using UnityEngine;
using UnityEngine.SceneManagement;
using UnityObject = UnityEngine.Object;

namespace ArdenfallCompendium.Entities.Map;

/// <summary>
/// Renders a map's declared cells from an orthographic top-down camera.
/// </summary>
/// <remarks>
/// The game already knows how to put a fully lit, water-filled world around one point: that is
/// what <see cref="WorldStreamer"/> does for the player. The capture moves the streamer's focus to
/// each cell centre, waits for its queue to drain, and renders one frame from the game's own state.
/// It loads no scene of its own and disables no renderer, so the cell the player stands in is one
/// more focus position rather than a special case. When it is done it hands the focus back to the
/// camera and lets the streamer put the player's world back.
///
/// What the capture does own is lighting and time: a plate depends on the sun and the clock only
/// through the values it records, never through where the player happened to be.
/// </remarks>
public sealed class CellCapture
{
    public const float DefaultCameraHeight = 800f;
    public const float SunIntensity = 1.2f;
    public const string SunEulerText = "(50.0, 330.0, 0.0)";
    public const string AmbientText = "(1.200, 1.200, 1.250, 1.000)";

    /// <summary>Frames the renderer gets after the streamer drains, so terrain and foliage settle.</summary>
    private const int SettleFrames = 3;

    /// <summary>How long one cell may stream before the capture gives up on the map.</summary>
    private static readonly TimeSpan StreamTimeout = TimeSpan.FromSeconds(120);

    private static readonly Vector3 SunEuler = new(50f, 330f, 0f);
    private static readonly Color AmbientColor = new(1.2f, 1.2f, 1.25f);
    /// <summary>
    /// Layers a map plate leaves out: what the reader gets as a marker instead, what only the
    /// first-person view should draw, and what is no geometry at all.
    /// </summary>
    /// <remarks>
    /// The ground and the water share the <c>NoInteriorLight</c> layer, so a plate must keep it.
    /// </remarks>
    private static readonly string[] ExcludedLayers =
    {
        "UI", "Post Process Volumes", "FirstPersonRender", "SkyboxRender", "EDITOR", "Navmesh",
        "Player", "NPC", "Ragdoll", "Items", "Damagable", "Elements", "Projectile",
    };

    private readonly Action<IEnumerator> _startCoroutine;
    private readonly Func<string, byte[], string> _writePlate;

    public CellCapture(Action<IEnumerator> startCoroutine, Func<string, byte[], string> writePlate)
    {
        _startCoroutine = startCoroutine ?? throw new ArgumentNullException(nameof(startCoroutine));
        _writePlate = writePlate ?? throw new ArgumentNullException(nameof(writePlate));
    }

    /// <summary>The camera mask that suppresses transient content without changing any object.</summary>
    /// <exception cref="InvalidOperationException">
    /// A named layer is not in this build. <c>LayerMask.GetMask</c> would count it as nothing and
    /// the plate would silently carry what the name meant to leave out.
    /// </exception>
    public static int CaptureCullingMask()
    {
        var missing = ExcludedLayers.Where(name => LayerMask.NameToLayer(name) < 0).ToList();
        if (missing.Count > 0)
            throw new InvalidOperationException(
                $"This build has no layer named {string.Join(", ", missing)}; the capture mask must name its layers.");
        return ~LayerMask.GetMask(ExcludedLayers);
    }

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

    /// <summary>Runs the frame-spanning stream-and-render operation on Unity's main thread.</summary>
    public Task<MapCaptureSnapshot> CaptureAsync(
        MapCaptureInputs inputs,
        Action<MapCaptureSnapshot> commit,
        CancellationToken cancellationToken)
    {
        if (inputs is null) throw new ArgumentNullException(nameof(inputs));
        if (commit is null) throw new ArgumentNullException(nameof(commit));

        var completion = new TaskCompletionSource<MapCaptureSnapshot>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        try
        {
            _startCoroutine(Capture(inputs, commit, completion, cancellationToken));
        }
        catch (Exception error)
        {
            completion.TrySetException(error);
        }

        return completion.Task;
    }

    private IEnumerator Capture(
        MapCaptureInputs inputs,
        Action<MapCaptureSnapshot> commit,
        TaskCompletionSource<MapCaptureSnapshot> completion,
        CancellationToken cancellationToken)
    {
        var snapshot = new MapCaptureSnapshot { Inputs = inputs };
        var streamer = WorldStreamer.instance;
        var world = WorldManager.instance;
        var map = world?.loadedMap;
        if (streamer == null || world == null || map == null || map.id != inputs.MapId)
        {
            snapshot.Diagnostics.Add(new Diagnostic
            {
                Severity = "fatal",
                Code = "mapCaptureMapNotLoaded",
                Field = "tiles",
                Message = $"The game is not streaming map '{inputs.MapId}'; it holds '{map?.id ?? "none"}'.",
            });
            Finish(snapshot, commit, completion);
            yield break;
        }

        var fog = RenderSettings.fog;
        var ambientMode = RenderSettings.ambientMode;
        var ambient = RenderSettings.ambientLight;
        var priority = Application.backgroundLoadingPriority;
        var timeManager = UnityObject.FindObjectOfType<TimeManager>();
        WorldTime? originalTime = timeManager?.GetWorldTime();
        var originalTimeMultiplier = timeManager?.timeMultiplier ?? 0f;
        var sky = Ardenfall.Sky.ArdenfallSkybox.instance;
        var originalSkyEnabled = sky != null && sky.enabled;
        var suppressedClouds = new List<Renderer>();
        var frames = CellCaptureGeometry.Frames(
            inputs.MinCellX,
            inputs.MinCellY,
            inputs.MaxCellX,
            inputs.MaxCellY,
            inputs.CellSize,
            inputs.PixelsPerCell);
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

        // Clouds are particles above the terrain on a layer the terrain shares, so a culling mask
        // cannot leave them out. Their renderers are the one thing the capture switches off.
        foreach (var particleRenderer in UnityObject.FindObjectsOfType<ParticleSystemRenderer>())
        {
            var isCloud = particleRenderer.name.IndexOf("cloud", StringComparison.OrdinalIgnoreCase) >= 0
                || particleRenderer.sharedMaterials.Any(material => material != null
                    && material.name.IndexOf("cloud", StringComparison.OrdinalIgnoreCase) >= 0);
            if (!isCloud || !particleRenderer.enabled) continue;
            particleRenderer.enabled = false;
            suppressedClouds.Add(particleRenderer);
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
            if (cancellationToken.IsCancellationRequested) break;
            var focus = new Vector3(frame.CenterX, 0f, frame.CenterZ);
            streamer.OverrideUpdateStreamer(focus, null);
            var started = DateTime.UtcNow;
            while (streamer.streamQueue.HasTasks())
            {
                if (DateTime.UtcNow - started > StreamTimeout)
                {
                    failure = new TimeoutException(
                        $"The streamer did not settle around cell {frame.CellX}.{frame.CellY} within {StreamTimeout.TotalSeconds:0}s.");
                    break;
                }
                yield return null;
            }
            if (failure != null) break;
            for (var settle = 0; settle < SettleFrames; settle++) yield return null;

            try
            {
                snapshot.Tiles.Add(CaptureFrame(inputs, camera, frame));
            }
            catch (Exception error)
            {
                failure = error;
                break;
            }
        }

        // Hand the focus back to the camera and let the streamer restore the player's world, so
        // the session that follows sees the cells the player had, not the last cell captured.
        streamer.ClearOverrideUpdate();
        streamer.UpdateStreamer(force: true);
        var restoreStarted = DateTime.UtcNow;
        while (streamer.streamQueue.HasTasks() && DateTime.UtcNow - restoreStarted < StreamTimeout)
        {
            yield return null;
        }

        foreach (var renderer in suppressedClouds)
        {
            if (renderer != null) renderer.enabled = true;
        }
        suppressedClouds.Clear();

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

        snapshot.Restored = !streamer.streamQueue.HasTasks()
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

        Finish(snapshot, commit, completion);
    }

    private static void Finish(
        MapCaptureSnapshot snapshot,
        Action<MapCaptureSnapshot> commit,
        TaskCompletionSource<MapCaptureSnapshot> completion)
    {
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
        MapCaptureInputs inputs,
        Camera camera,
        CellCaptureFrame frame)
    {
        camera.orthographicSize = frame.OrthographicSize;
        camera.transform.position = new Vector3(frame.CenterX, inputs.CameraHeight, frame.CenterZ);
        camera.transform.rotation = Quaternion.Euler(90f, 0f, 0f);

        var scene = SceneManager.GetSceneByName($"cell_{inputs.MapId}_{frame.CellX}.{frame.CellY}");
        var authored = scene.IsValid() && scene.isLoaded;
        var renderers = authored
            ? scene.GetRootGameObjects().Sum(root => root.GetComponentsInChildren<Renderer>(true).Length)
            : 0;

        var png = Render(camera, frame.Pixels);
        var hash = SpriteAssetExporter.Sha256Hex(png);
        var path = _writePlate($"assets/map/{inputs.MapId}/{hash}.png", png);
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
