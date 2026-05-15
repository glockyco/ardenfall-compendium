using System;
using System.IO;
using ArdenfallCompendium.Dtos;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Emit;

public sealed class SnapshotWriter
{
    private readonly string _baseDir;

    public SnapshotWriter(string baseDir)
    {
        _baseDir = baseDir;
    }

    public string BeginStaging(string gameVersion)
    {
        Directory.CreateDirectory(_baseDir);
        var stagingDir = Path.Combine(_baseDir, $".staging-{gameVersion}-{Timestamp()}");
        Directory.CreateDirectory(stagingDir);
        return stagingDir;
    }

    public string WriteEntityFile(string stagingDir, string entityId, object envelope)
    {
        var path = Path.Combine(stagingDir, $"{entityId}s.json");
        var json = JsonConvert.SerializeObject(envelope, JsonSettings.Default);
        File.WriteAllText(path, json);
        return path;
    }

    public void WriteManifest(string stagingDir, Manifest manifest)
    {
        var json = JsonConvert.SerializeObject(manifest, JsonSettings.Default);
        File.WriteAllText(Path.Combine(stagingDir, "manifest.json"), json);
    }

    public void WriteAssetManifest(string stagingDir, AssetManifest manifest)
    {
        var json = JsonConvert.SerializeObject(manifest, JsonSettings.Default);
        File.WriteAllText(Path.Combine(stagingDir, "asset-manifest.json"), json);
    }

    public string Publish(string stagingDir, string gameVersion)
    {
        var finalDir = Path.Combine(_baseDir, $"{gameVersion}-{Timestamp()}");
        Directory.Move(stagingDir, finalDir);
        return finalDir;
    }

    public void DiscardStaging(string stagingDir)
    {
        if (Directory.Exists(stagingDir)) Directory.Delete(stagingDir, recursive: true);
    }

    private static string Timestamp() => DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmssfffffff");
}
