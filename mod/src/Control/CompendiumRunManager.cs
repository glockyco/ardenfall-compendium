using System;
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Control;

public sealed class CompendiumRunManager
{
    private readonly object _sync = new();
    private readonly Dictionary<string, CompendiumRun> _runs = new();

    public CompendiumRun Begin(string baseDir, string gameVersion)
    {
        var runId = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmssfffffff");
        var workspace = Path.Combine(baseDir, "runs", runId);
        Directory.CreateDirectory(Path.Combine(workspace, "control"));
        Directory.CreateDirectory(Path.Combine(workspace, "entities", "item", "chunks"));
        var run = new CompendiumRun { RunId = runId, GameVersion = gameVersion, OutputBaseDir = baseDir, WorkspaceDir = workspace };
        lock (_sync) _runs.Add(runId, run);
        Save(run);
        return run;
    }

    public bool TryGet(string runId, out CompendiumRun run)
    {
        lock (_sync) return _runs.TryGetValue(runId, out run!);
    }

    public void Save(CompendiumRun run)
    {
        var controlDir = Path.Combine(run.WorkspaceDir, "control");
        Directory.CreateDirectory(controlDir);
        var path = Path.Combine(controlDir, "run.json");
        var tempPath = path + ".tmp";
        var json = JsonConvert.SerializeObject(run, Formatting.Indented);
        File.WriteAllText(tempPath, json);
        if (File.Exists(path)) File.Delete(path);
        File.Move(tempPath, path);
    }

    public void Discard(string runId)
    {
        lock (_sync)
        {
            if (!_runs.TryGetValue(runId, out var run)) return;
            if (Directory.Exists(run.WorkspaceDir)) Directory.Delete(run.WorkspaceDir, recursive: true);
            run.State = "discarded";
            _runs.Remove(runId);
        }
    }
}
