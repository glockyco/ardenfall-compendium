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

    /// <summary>Rows per entity id across every cell in the batch, in cell order.</summary>
    public Dictionary<string, List<SceneRow>> RowsByEntity()
    {
        var byEntity = new Dictionary<string, List<SceneRow>>(StringComparer.Ordinal);
        foreach (var cell in Cells)
        {
            foreach (var pair in cell.Rows)
            {
                if (!byEntity.TryGetValue(pair.Key, out var rows))
                {
                    rows = new List<SceneRow>();
                    byEntity[pair.Key] = rows;
                }

                rows.AddRange(pair.Value);
            }
        }

        return byEntity;
    }
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
    private readonly IReadOnlyList<ISceneFamily> _families;

    public CellWalk(
        Action<IEnumerator> startCoroutine,
        IRecordCensus census,
        IReadOnlyList<ISceneFamily> families)
    {
        _startCoroutine = startCoroutine ?? throw new ArgumentNullException(nameof(startCoroutine));
        _census = census ?? throw new ArgumentNullException(nameof(census));
        _families = families ?? throw new ArgumentNullException(nameof(families));
    }

    /// <summary>Entity ids this walk publishes, in registration order.</summary>
    public IReadOnlyList<string> EntityIds =>
        _families.Select(family => family.EntityId).ToList();

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

    private void Harvest(CellWalkBatch batch, CellScene cell)
    {
        var harvest = new CellHarvest(cell.Name);
        var map = CellMapIndex.MapOfCellScene(cell.Name);
        foreach (var family in _families) family.Harvest(cell, map, harvest);
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
    private IEnumerable<KeyValuePair<string, int>> UnmodelledTypes(CellScene cell)
    {
        var modelled = _families.SelectMany(family => family.ComponentTypes).ToList();
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        foreach (var behaviour in
            UnityEngine.Object.FindObjectsOfType<MonoBehaviour>(includeInactive: true))
        {
            if (behaviour == null) continue;
            if (behaviour.gameObject.scene.buildIndex != cell.BuildIndex) continue;
            if (behaviour is not IInteractable) continue;
            var type = behaviour.GetType();
            if (modelled.Any(modelledType => modelledType.IsInstanceOfType(behaviour))) continue;
            var name = type.FullName ?? type.Name;
            counts.TryGetValue(name, out var seen);
            counts[name] = seen + 1;
        }

        return counts;
    }
}
