using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Ardenfall;
using ArdenfallCompendium.Dtos;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace ArdenfallCompendium.Entities.World;

/// <summary>Everything one batch of cells produced.</summary>
public sealed class CellWalkBatch
{
    public List<CellHarvest> Cells { get; } = new();

    /// <summary>Component types the walk saw in a cell but does not model, with instance counts.</summary>
    public Dictionary<string, int> UnmodelledTypes { get; } = new(StringComparer.Ordinal);

    public List<Diagnostic> Diagnostics { get; } = new();
}

/// <summary>
/// Loads cell scenes, harvests them and unloads them, across frames.
/// </summary>
/// <remarks>
/// An additive load finishes at the end of a frame, so the walk cannot run inside one control
/// command call. It runs as a coroutine and the command awaits the plain data it produces. Every
/// engine call stays inside the coroutine, because the await continues on a pool thread.
/// </remarks>
public sealed class CellWalk
{
    private readonly Action<IEnumerator> _startCoroutine;
    private readonly IRecordCensus _census;

    public CellWalk(Action<IEnumerator> startCoroutine, IRecordCensus census)
    {
        _startCoroutine = startCoroutine ?? throw new ArgumentNullException(nameof(startCoroutine));
        _census = census ?? throw new ArgumentNullException(nameof(census));
    }

    /// <summary>
    /// Walks <paramref name="cells"/> and hands the result to <paramref name="commit"/> before the
    /// task completes.
    /// </summary>
    /// <remarks>
    /// The commit runs inside the coroutine, on the main thread. The await that follows continues
    /// on a pool thread, where a Unity call or a file write through the game's runtime is not the
    /// caller's to make.
    /// </remarks>
    public Task<CellWalkBatch> WalkAsync(
        IReadOnlyList<CellScene> cells,
        Action<CellWalkBatch> commit,
        CancellationToken cancellationToken)
    {
        if (commit is null) throw new ArgumentNullException(nameof(commit));
        var completion = new TaskCompletionSource<CellWalkBatch>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        try
        {
            _startCoroutine(Walk(cells, commit, completion, cancellationToken));
        }
        catch (Exception ex)
        {
            completion.TrySetException(ex);
        }

        return completion.Task;
    }

    private IEnumerator Walk(
        IReadOnlyList<CellScene> cells,
        Action<CellWalkBatch> commit,
        TaskCompletionSource<CellWalkBatch> completion,
        CancellationToken cancellationToken)
    {
        var batch = new CellWalkBatch();
        // Which map owns a cell is authored on MapData, so the index is built from the world once
        // per batch rather than parsed out of a scene name.
        CellMapIndex.BuildFromWorld();
        var priority = Application.backgroundLoadingPriority;
        var before = _census.Count();
        var loaded = new List<int>();
        Exception? failure = null;

        Application.backgroundLoadingPriority = UnityEngine.ThreadPriority.High;
        foreach (var cell in cells)
        {
            if (cancellationToken.IsCancellationRequested) break;
            if (SceneManager.GetSceneByBuildIndex(cell.BuildIndex).isLoaded)
            {
                // The cell around the player is already loaded. Harvest it where it is rather than
                // reloading it, and leave it loaded.
                Harvest(batch, cell);
                continue;
            }

            var load = SceneManager.LoadSceneAsync(cell.BuildIndex, LoadSceneMode.Additive);
            if (load == null)
            {
                batch.Diagnostics.Add(new Diagnostic
                {
                    Code = "cellSceneLoadRefused",
                    Severity = "diagnostic",
                    Message = $"The engine refused to load cell scene '{cell.Name}'.",
                });
                continue;
            }

            while (!load.isDone) yield return null;
            loaded.Add(cell.BuildIndex);

            Exception? harvestFailure = null;
            try
            {
                Harvest(batch, cell);
            }
            catch (Exception ex)
            {
                harvestFailure = ex;
            }

            var unload = SceneManager.UnloadSceneAsync(cell.BuildIndex);
            if (unload != null)
            {
                while (!unload.isDone) yield return null;
            }

            loaded.Remove(cell.BuildIndex);
            if (harvestFailure != null)
            {
                failure = harvestFailure;
                break;
            }
        }

        // Restore before reporting, including on the failure path: the walk owns this flag only
        // for its own duration.
        Application.backgroundLoadingPriority = priority;
        foreach (var buildIndex in loaded.ToList())
        {
            var unload = SceneManager.UnloadSceneAsync(buildIndex);
            if (unload != null)
            {
                while (!unload.isDone) yield return null;
            }
        }

        if (failure != null)
        {
            completion.TrySetException(failure);
            yield break;
        }

        var created = RecordCensusDiff.Describe(before, _census.Count());
        if (created.Count > 0)
        {
            completion.TrySetException(new InvalidOperationException(
                "The walk changed the record tables, so its snapshot would carry state it created: "
                    + string.Join("; ", created)));
            yield break;
        }

        try
        {
            commit(batch);
        }
        catch (Exception ex)
        {
            completion.TrySetException(ex);
            yield break;
        }

        completion.TrySetResult(batch);
    }

    private static void Harvest(CellWalkBatch batch, CellScene cell)
    {
        var plants = UnityEngine.Object.FindObjectsOfType<PickablePlant>(includeInactive: true)
            .Where(plant => plant.gameObject.scene.buildIndex == cell.BuildIndex)
            .ToList();

        var harvest = new CellHarvest(cell.Name, plants.Count);
        var map = CellMapIndex.MapOfCellScene(cell.Name);
        PickablePlantHarvester.Harvest(harvest, plants.Select(plant => ToSource(plant, map)));
        batch.Cells.Add(harvest);

        foreach (var pair in UnmodelledTypes(cell))
        {
            batch.UnmodelledTypes.TryGetValue(pair.Key, out var seen);
            batch.UnmodelledTypes[pair.Key] = seen + pair.Value;
        }
    }

    /// <summary>
    /// Types this walk sees in a cell and does not publish yet, so the next build's new
    /// interactable appears as a number rather than as silence.
    /// </summary>
    private static IEnumerable<KeyValuePair<string, int>> UnmodelledTypes(CellScene cell)
    {
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var interactable in UnityEngine.Object.FindObjectsOfType<MonoBehaviour>(includeInactive: true))
        {
            if (interactable == null) continue;
            if (interactable.gameObject.scene.buildIndex != cell.BuildIndex) continue;
            if (interactable is not IInteractable) continue;
            if (interactable is PickablePlant) continue;
            var name = interactable.GetType().FullName ?? interactable.GetType().Name;
            counts.TryGetValue(name, out var seen);
            counts[name] = seen + 1;
        }

        return counts;
    }

    private static PickablePlantSource ToSource(PickablePlant plant, string? map)
    {
        var guid = plant.GetComponent<GuidComponent>();
        var position = plant.transform.position;
        return new PickablePlantSource
        {
            Guid = guid == null ? null : guid.GuidString,
            Position = new ScenePosition(position.x, position.y, position.z),
            Map = map,
            ItemRef = ItemRef(plant),
            ItemCount = plant.itemCount,
            RegrowDays = plant.regrowDays,
            HarvestXp = plant.giveXP,
            InteractionText = plant.pickupText ?? "",
        };
    }

    private static SnapshotRef? ItemRef(PickablePlant plant)
    {
        if (plant.item == null) return null;
        var guid = BuiltLookupTable.Instance?.GetGuid(plant.item);
        return string.IsNullOrWhiteSpace(guid)
            ? SnapshotRef.Missing("lookupAssetGuidMissing", "PickablePlant.item")
            : SnapshotRef.LookupAsset(guid!, plant.item.GetType().FullName, plant.item.name);
    }
}
