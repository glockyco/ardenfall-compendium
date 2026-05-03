using System.Collections.Generic;
using ArdenfallArchives.Dtos;
using UnityEngine;

namespace ArdenfallArchives.Walker;

/// <summary>Base for per-entity walkers. Provides cycle detection scaffolding and shared helpers.</summary>
public abstract class WalkerBase<TSnapshot>
{
    private readonly HashSet<int> _visitedInstanceIds = new();
    public RefResolver Refs { get; } = new();
    public List<Diagnostic> Diagnostics { get; } = new();

    /// <summary>Track an object so cyclic references are detected.</summary>
    protected bool MarkVisited(Object obj)
    {
        if (obj == null) return false;
        return _visitedInstanceIds.Add(obj.GetInstanceID());
    }

    /// <summary>Walk all roots and emit per-row snapshots.</summary>
    public abstract IEnumerable<TSnapshot> Walk();
}
