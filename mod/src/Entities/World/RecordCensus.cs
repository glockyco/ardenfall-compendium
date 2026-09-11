using System;
using System.Collections.Generic;
using System.Linq;

namespace ArdenfallCompendium.Entities.World;

/// <summary>Record counts per table, taken before and after a walk.</summary>
public interface IRecordCensus
{
    IReadOnlyDictionary<string, int> Count();
}

/// <summary>
/// Difference between two censuses, so a walk can prove it created no records.
/// </summary>
/// <remarks>
/// Loading a scene runs `Awake` and `OnEnable` on everything in it. A spawner that creates a record
/// on enable would otherwise reach the published snapshot as authored content.
/// </remarks>
public static class RecordCensusDiff
{
    public static IReadOnlyList<string> Describe(
        IReadOnlyDictionary<string, int> before,
        IReadOnlyDictionary<string, int> after)
    {
        if (before is null) throw new ArgumentNullException(nameof(before));
        if (after is null) throw new ArgumentNullException(nameof(after));

        var differences = new List<string>();
        foreach (var table in before.Keys.Concat(after.Keys).Distinct().OrderBy(key => key, StringComparer.Ordinal))
        {
            var start = before.TryGetValue(table, out var b) ? b : 0;
            var end = after.TryGetValue(table, out var a) ? a : 0;
            if (start != end) differences.Add($"{table}: {start} -> {end}");
        }

        return differences;
    }
}

/// <summary>Counts the game's records per table.</summary>
public sealed class MasterRecordTableCensus : IRecordCensus
{
    public IReadOnlyDictionary<string, int> Count()
    {
        var counts = new Dictionary<string, int>(StringComparer.Ordinal);
        var records = Ardenfall.ArdenfallGame.instance?.worldData?.masterRecordTable?.GetRecords();
        if (records == null) return counts;
        foreach (var record in records)
        {
            var key = record?.GetType().FullName ?? "<null>";
            counts[key] = counts.TryGetValue(key, out var count) ? count + 1 : 1;
        }

        return counts;
    }
}
