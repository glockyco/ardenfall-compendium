using System.IO;
using BepInEx;
using BepInEx.Configuration;
using BepInEx.Logging;
using UnityEngine;

namespace ArdenfallCompendium;

[BepInPlugin(Guid, Name, Version)]
public sealed class Plugin : BaseUnityPlugin
{
    public const string Guid = "ardenfall-compendium.extractor";
    public const string Name = "Ardenfall Compendium Extractor";
    public const string Version = "0.1.0";

    private ConfigEntry<KeyboardShortcut> _hotkey = null!;
    private ConfigEntry<string> _outputDir = null!;
    private Triggers.ReadinessMonitor _readiness = null!;
    private Control.CompendiumRunManager _runs = null!;
    private Control.CompendiumCommandRegistry _commands = null!;

    private void Awake()
    {
        _hotkey = Config.Bind("Triggers", "Hotkey", new KeyboardShortcut(KeyCode.F8), "Trigger snapshot extraction");
        _outputDir = Config.Bind("Output", "BaseDir", Path.Combine(Paths.PluginPath, "ArdenfallCompendium", "snapshots"), "Where to write snapshots");
        _runs = new Control.CompendiumRunManager();
        _commands = new Control.CompendiumCommandRegistry(_runs, _outputDir.Value);
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
        _commands?.Dispose();
        _readiness.Dispose();
    }

    public void RunExtractionFromAnyTrigger()
    {
        var result = new Extraction.ExtractionService().ExtractAll(new Extraction.ExtractionRequest
        {
            OutputBaseDir = _outputDir.Value,
            GameVersion = Game.GameInfo.SnapshotVersionSegment,
        });

        if (!result.Preflight.Passed)
        {
            Logger.LogWarning("preflight failed; no snapshot written");
            foreach (var check in result.Preflight.Checks)
            {
                if (!check.Ok) Logger.LogWarning($"  - {check.Name}: {check.Reason}");
            }
            return;
        }

        if (!result.Success)
        {
            Logger.LogError("extraction failed; no snapshot written");
            foreach (var diagnostic in result.Diagnostics) Logger.LogError($"  - {diagnostic.Code}: {diagnostic.Message}");
            return;
        }

        Logger.LogInfo($"snapshot published: {result.PublishedDir} ({result.ItemCount} items, {result.DiagnosticCount} diagnostics)");
    }
}
