using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Ardenfall;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Entities.Map;
using ArdenfallCompendium.Entities.World;
using HotRepl.Control;
using Newtonsoft.Json;
using UnityEngine;

namespace ArdenfallCompendium.Control.Handlers;

/// <summary>Captures a declared map-cell range as content-hashed plates.</summary>
public sealed class MapCaptureCommand : IControlCommandHandler<MapCaptureArgs, MapCaptureResult>
{
    private readonly CompendiumRunManager _runs;
    private readonly ISceneTable _scenes;
    private readonly Action<System.Collections.IEnumerator> _startCoroutine;
    private readonly Func<string, MapCaptureGrid?> _gridOf;

    public MapCaptureCommand(
        CompendiumRunManager runs,
        ISceneTable scenes,
        Action<System.Collections.IEnumerator> startCoroutine,
        Func<string, MapCaptureGrid?>? gridOf = null)
    {
        _runs = runs ?? throw new ArgumentNullException(nameof(runs));
        _scenes = scenes ?? throw new ArgumentNullException(nameof(scenes));
        _startCoroutine = startCoroutine ?? throw new ArgumentNullException(nameof(startCoroutine));
        _gridOf = gridOf ?? DeclaredGrid;
    }

    public string Name => "map.capture";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Job;

    public bool MutatesState => true;

    public async ValueTask<ControlCommandResult<MapCaptureResult>> ExecuteAsync(
        ControlCommandContext<MapCaptureResult> context,
        MapCaptureArgs args,
        CancellationToken cancellationToken)
    {
        var runIdValidation = CompendiumCommandResults.RequiredString(context, args.RunId, "runId");
        if (runIdValidation != null) return runIdValidation;
        var mapValidation = CompendiumCommandResults.RequiredString(context, args.MapId, "mapId");
        if (mapValidation != null) return mapValidation;
        if (!_runs.TryGet(args.RunId, out var run))
            return CompendiumCommandResults.Validation(
                context, "unknownRun", $"Run '{args.RunId}' is not open.");
        if (args.PixelsPerUnit <= 0 || float.IsNaN(args.PixelsPerUnit) || float.IsInfinity(args.PixelsPerUnit))
            return CompendiumCommandResults.Validation(
                context, "invalidPixels", "pixelsPerUnit must be finite and positive.");

        var grid = _gridOf(args.MapId);
        if (grid == null)
            return CompendiumCommandResults.Precondition(
                context,
                "mapSettingsMissing",
                $"No map declaration provides a grid and cell size for '{args.MapId}'.");
        if (args.MinCellX < grid.OffsetX || args.MaxCellX >= grid.OffsetX + grid.SizeX
            || args.MinCellY < grid.OffsetY || args.MaxCellY >= grid.OffsetY + grid.SizeY
            || args.MaxCellX < args.MinCellX || args.MaxCellY < args.MinCellY)
            return CompendiumCommandResults.Validation(
                context,
                "invalidCellRange",
                $"Cell range [{args.MinCellX},{args.MinCellY}]..[{args.MaxCellX},{args.MaxCellY}] is outside the declared grid.");

        var pixelsPerCell = (int)Math.Round(
            args.PixelsPerUnit * grid.CellSize,
            MidpointRounding.AwayFromZero);
        if (pixelsPerCell <= 0 || pixelsPerCell > 4096)
            return CompendiumCommandResults.Validation(
                context,
                "invalidPixels",
                $"pixelsPerUnit produces unsupported {pixelsPerCell} pixel cell plates.");

        var authored = CellSceneInventory.Plan(_scenes).Cells
            .Where(cell => cell.Name.StartsWith($"cell_{args.MapId}_", StringComparison.Ordinal))
            .ToDictionary(cell => cell.Name, StringComparer.Ordinal);
        var captureDir = Path.Combine(run.WorkspaceDir, "capture");
        Directory.CreateDirectory(captureDir);
        var inputs = CellCapture.Inputs(
            args.MapId,
            run.GameVersion,
            grid,
            pixelsPerCell,
            args.MinCellX,
            args.MinCellY,
            args.MaxCellX,
            args.MaxCellY,
            CellCapture.DefaultCameraHeight,
            CellCapture.CaptureCullingMask());

        var capture = new CellCapture(_startCoroutine, CellCapture.FileWriter(captureDir));
        var snapshot = await capture.CaptureAsync(
            inputs,
            authored,
            args.AuthoredOnly,
            result =>
            {
                var path = Path.Combine(
                    captureDir,
                    $"map-capture-{args.MapId}-{pixelsPerCell}-{args.MinCellX}.{args.MinCellY}-{args.MaxCellX}.{args.MaxCellY}.json");
                File.WriteAllText(path, JsonConvert.SerializeObject(result, Formatting.Indented));
            },
            cancellationToken).ConfigureAwait(false);

        return ControlCommandResult.Ok(new MapCaptureResult
        {
            MapId = args.MapId,
            Tiles = snapshot.Tiles.Count,
            RequestedCells = (args.MaxCellX - args.MinCellX + 1) * (args.MaxCellY - args.MinCellY + 1),
            CapturedCells = snapshot.Tiles.Count,
            AuthoredTiles = snapshot.Tiles.Count(tile => tile.Authored),
            Bytes = snapshot.Tiles.Sum(tile => (long)tile.Bytes),
            PixelsPerUnit = snapshot.Inputs.PixelsPerUnit,
            Restored = snapshot.Restored,
            StagingDir = captureDir,
        });
    }

    private static MapCaptureGrid? DeclaredGrid(string mapId)
    {
        var maps = ArdenfallGame.instance?.worldData?.maps;
        if (maps == null) return null;
        foreach (var map in maps)
        {
            if (map == null || !string.Equals(map.id, mapId, StringComparison.Ordinal)) continue;
            if (map.mapSettings == null) return null;
            return new MapCaptureGrid(
                map.gridOffset.x,
                map.gridOffset.y,
                map.gridSize.x,
                map.gridSize.y,
                map.mapSettings.cellSize);
        }

        return null;
    }
}
