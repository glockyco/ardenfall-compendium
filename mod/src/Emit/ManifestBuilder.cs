using System;
using System.Collections.Generic;
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
        string? gameVersion = null,
        string? buildIdentifier = null) => new()
        {
            SchemaVersion = 1,
            ExtractorVersion = extractorVersion,
            GameVersion = gameVersion,
            BuildIdentifier = buildIdentifier,
            ExtractedAt = DateTimeOffset.UtcNow.ToString("O"),
            Preflight = preflight,
            Counts = new Dictionary<string, int>(counts),
            Diagnostics = diagnostics,
            Hashes = new Dictionary<string, string>(contentHashes),
        };

    public static string Sha256Hex(string content)
    {
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(content));
        var sb = new StringBuilder(bytes.Length * 2);
        foreach (var b in bytes) sb.Append(b.ToString("x2"));
        return sb.ToString();
    }
}
