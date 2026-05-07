using System;
using System.Linq;
using Ardenfall;
using ArdenfallArchives.Dtos;

namespace ArdenfallArchives.Preflight;

/// <summary>
/// Fail-fast preflight executed immediately before every snapshot write.
/// Cached readiness is not an authorization token; this runs every time.
/// </summary>
public static class Preflight
{
    public static PreflightReport Run()
    {
        var report = new PreflightReport { CompletedAt = DateTimeOffset.UtcNow.ToString("O") };

        Check(report, "builtLookupTable", () =>
        {
            var t = BuiltLookupTable.Instance;
            return (t != null, t == null ? "BuiltLookupTable.Instance is null" : null);
        });
        Check(report, "builtLookupTableNonEmpty", () =>
        {
            // GetAssetsOfType<T>() is a static method on BuiltLookupTable that returns List<T>.
            var ok = BuiltLookupTable.Instance != null
                && BuiltLookupTable.GetAssetsOfType<Ardenfall.Item.ItemData>().Any();
            return (ok, ok ? null : "BuiltLookupTable produced no ItemData assets");
        });
        Check(report, "ardenfallGame", () =>
        {
            var ok = ArdenfallGame.instance != null;
            return (ok, ok ? null : "ArdenfallGame.instance is null");
        });
        Check(report, "worldData", () =>
        {
            var w = ArdenfallGame.instance?.worldData;
            return (w != null, w == null ? "ArdenfallGame.instance.worldData is null" : null);
        });
        Check(report, "masterRecordTable", () =>
        {
            // MasterRecordTable exposes a public `tables` Dictionary; the live DLL has no
            // GetTables() method despite the plan literal suggesting one.
            var m = ArdenfallGame.instance?.worldData?.masterRecordTable;
            var nonEmpty = m != null && m.tables != null && m.tables.Count > 0;
            return (nonEmpty, nonEmpty ? null : "masterRecordTable.tables empty");
        });

        report.Passed = report.Checks.All(c => c.Ok);
        return report;
    }

    private static void Check(PreflightReport report, string name, Func<(bool, string?)> probe)
    {
        try
        {
            var (ok, reason) = probe();
            report.Checks.Add(new PreflightCheck { Name = name, Ok = ok, Reason = reason });
        }
        catch (Exception ex)
        {
            report.Checks.Add(new PreflightCheck { Name = name, Ok = false, Reason = ex.Message });
        }
    }
}
