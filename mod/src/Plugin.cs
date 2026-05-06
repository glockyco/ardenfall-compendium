using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using ArdenfallArchives.Dtos;
using ArdenfallArchives.Emit;
using ArdenfallArchives.Entities.Item;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using UnityEngine;
using PreflightRunner = ArdenfallArchives.Preflight.Preflight;

namespace ArdenfallArchives;

[BepInPlugin(Guid, Name, Version)]
public sealed class Plugin : BaseUnityPlugin
{
    public const string Guid = "com.ardenfall-archives.extractor";
    public const string Name = "Ardenfall Archives Extractor";
    public const string Version = "0.1.0";

    private ConfigEntry<KeyboardShortcut> _hotkey = null!;
    private ConfigEntry<string> _outputDir = null!;
    private Triggers.ReadinessMonitor _readiness = null!;

    private void Awake()
    {
        _hotkey = Config.Bind("Triggers", "Hotkey", new KeyboardShortcut(KeyCode.F8), "Trigger snapshot extraction");
        _outputDir = Config.Bind("Output", "BaseDir", Path.Combine(Paths.PluginPath, "ArdenfallArchives", "snapshots"), "Where to write snapshots");
        _readiness = new Triggers.ReadinessMonitor(Logger);
        Triggers.ConsoleCommand.TryRegister(Logger, this);
        Logger.LogInfo($"{Name} {Version} loaded; hotkey {_hotkey.Value} will extract.");
    }

    private void Update()
    {
        if (_hotkey.Value.IsDown()) Triggers.Hotkey.Run(_outputDir.Value, this);
    }

    private void OnDestroy()
    {
        _readiness.Dispose();
    }

    public void RunExtractionFromAnyTrigger()
    {
        var preflight = PreflightRunner.Run();
        if (!preflight.Passed)
        {
            Logger.LogWarning("preflight failed; no snapshot written");
            foreach (var check in preflight.Checks)
            {
                if (!check.Ok) Logger.LogWarning($"  - {check.Name}: {check.Reason}");
            }
            return;
        }

        var writer = new SnapshotWriter(_outputDir.Value);
        var staging = writer.BeginStaging("Demo2025");
        try
        {
            var extractor = new ItemExtractor();
            var rows = extractor.Walk().ToList();
            var envelope = new ItemSnapshotEnvelope { Rows = rows };
            var path = writer.WriteEntityFile(staging, "item", envelope);
            var json = File.ReadAllText(path);

            var totals = new DiagnosticTotals();
            foreach (var diagnostic in extractor.Diagnostics)
            {
                if (diagnostic.Severity == "fatal") totals.Fatal++;
                else totals.Diagnostic++;
            }

            var manifest = ManifestBuilder.Build(
                preflight,
                counts: new Dictionary<string, int> { ["item"] = rows.Count },
                diagnostics: totals,
                contentHashes: new Dictionary<string, string> { ["items.json"] = ManifestBuilder.Sha256Hex(json) },
                extractorVersion: Version,
                gameVersion: "Demo2025");
            writer.WriteManifest(staging, manifest);

            var final = writer.Publish(staging, "Demo2025");
            Logger.LogInfo($"snapshot published: {final} ({rows.Count} items, {extractor.Diagnostics.Count} diagnostics)");
        }
        catch (Exception ex)
        {
            writer.DiscardStaging(staging);
            Logger.LogError($"extraction failed: {ex}");
        }
    }
}
