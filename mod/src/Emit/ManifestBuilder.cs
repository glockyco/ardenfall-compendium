using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Cryptography;
using System.Text;
using ArdenfallCompendium.Dtos;

namespace ArdenfallCompendium.Emit;

public static class ManifestBuilder
{
    public static Manifest Build(
        PreflightReport preflight,
        IDictionary<string, int> counts,
        DiagnosticTotals diagnostics,
        IDictionary<string, string> contentHashes,
        string extractorVersion,
        string productName,
        string buildProfile,
        string? gameVersion = null,
        string? buildIdentifier = null,
        IDictionary<string, IDictionary<string, int>>? availability = null,
        int filteredRuntimeCreatedCount = 0) => new()
        {
            SchemaVersion = 1,
            ExtractorVersion = extractorVersion,
            GameVersion = gameVersion,
            BuildIdentifier = buildIdentifier,
            ProductName = RequireIdentity(productName, "Unity product name"),
            BuildProfile = RequireIdentity(buildProfile, "Unity build profile"),
            ExtractedAt = DateTimeOffset.UtcNow.ToString("O"),
            Source = new SnapshotSource { Kind = "live-game-export" },
            Preflight = preflight,
            Counts = new Dictionary<string, int>(counts),
            Availability = availability?.ToDictionary(
                pair => pair.Key,
                pair => new Dictionary<string, int>(pair.Value)
            ) ?? new Dictionary<string, Dictionary<string, int>>(),
            FilteredRuntimeCreatedCount = filteredRuntimeCreatedCount,
            Diagnostics = diagnostics,
            Hashes = new Dictionary<string, string>(contentHashes),
        };

    private static string RequireIdentity(string value, string label) =>
        string.IsNullOrWhiteSpace(value)
            ? throw new InvalidOperationException($"{label} is unavailable from the running game")
            : value;

    public static string Sha256Hex(string content)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(content));
        var sb = new StringBuilder(bytes.Length * 2);
        foreach (var b in bytes) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }
}
