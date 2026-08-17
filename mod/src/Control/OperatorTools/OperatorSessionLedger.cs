using System;
using System.Collections.Generic;

namespace ArdenfallCompendium.Control.OperatorTools;

/// <summary>The values an operator session can change, named once for the ledger and the results.</summary>
public static class OperatorSessionKeys
{
    public const string Invulnerable = "invulnerable";

    public const string PhotoMode = "photoMode";

    public const string Timescale = "timescale";

    public const string DebugTools = "debugTools";
}

/// <summary>
/// Records what a session changed, and the value each changed value held first.
/// </summary>
/// <remarks>
/// The ledger lives in memory and dies with the process. It keeps the first value it saw, so a repeated
/// change cannot overwrite the session's starting point. A value set back to that first value stops
/// counting as a session change, which keeps a restored session from reporting work it has undone.
/// </remarks>
public sealed class OperatorSessionLedger
{
    private readonly Dictionary<string, bool> _originalFlags = new(StringComparer.Ordinal);
    private readonly Dictionary<string, float> _originalNumbers = new(StringComparer.Ordinal);
    private readonly HashSet<string> _changed = new(StringComparer.Ordinal);

    /// <summary>Notes a flag write, given the value before it and the value after it.</summary>
    public void NoteFlagChange(string key, bool before, bool after) =>
        Note(_originalFlags, key, before, after);

    /// <summary>Notes a number write, given the value before it and the value after it.</summary>
    public void NoteNumberChange(string key, float before, float after) =>
        Note(_originalNumbers, key, before, after);

    /// <summary>
    /// Drops a recorded flag change when the live value has returned to the value the session found,
    /// whoever returned it. The game restores some values on its own, and a stale entry would report
    /// work that no longer exists.
    /// </summary>
    public void ReconcileFlag(string key, bool live) => NoteFlagChange(key, live, live);

    /// <summary>Drops a recorded number change when the live value has returned to the recorded one.</summary>
    public void ReconcileNumber(string key, float live) => NoteNumberChange(key, live, live);

    /// <summary>
    /// Takes back the value a flag held before the session changed it, and forgets the change. Returns
    /// false when the session never changed that flag.
    /// </summary>
    public bool TryTakeFlag(string key, out bool original)
    {
        if (!_originalFlags.TryGetValue(key, out original)) return false;
        _originalFlags.Remove(key);
        _changed.Remove(key);
        return true;
    }

    public void MarkChanged(string key) => _changed.Add(key);

    public void ForgetChange(string key) => _changed.Remove(key);

    public bool HasChanged(string key) => _changed.Contains(key);

    /// <summary>Every value the session changed and has not restored, in a stable order.</summary>
    public IReadOnlyList<string> ChangedKeys
    {
        get
        {
            var keys = new List<string>(_changed);
            keys.Sort(StringComparer.Ordinal);
            return keys;
        }
    }

    private void Note<T>(IDictionary<string, T> originals, string key, T before, T after)
        where T : struct, IEquatable<T>
    {
        if (originals.TryGetValue(key, out var original))
        {
            if (!after.Equals(original)) return;
            originals.Remove(key);
            _changed.Remove(key);
            return;
        }

        if (after.Equals(before)) return;
        originals.Add(key, before);
        _changed.Add(key);
    }
}
