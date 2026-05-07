# Ardenfall HotRepl Export Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use skill://superpowers:subagent-driven-development (recommended) or skill://superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the F8-only export path with typed HotRepl control-plane commands plus an external controller that deploys, launches, exports, validates, and runs the pipeline.

**Architecture:** HotRepl stays game-agnostic and exposes a process-wide command registry for loaded game mods. Ardenfall Archives registers compiled command handlers that call shared extraction/run services. A Bun controller drives the HotRepl protocol, owns workflow sequencing, and validates artifacts before invoking the pipeline.

**Tech Stack:** HotRepl C# `netstandard2.1` control registry; Ardenfall BepInEx 5 mod on `net472`; Newtonsoft.Json/JObject control payloads; Bun/TypeScript controller; existing pipeline validators and SQLite pipeline.

---

## Repositories and dependency order

1. `/Users/joaichberger/Projects/HotRepl` — add the game-agnostic global command registry hook required for separate BepInEx mods to register commands.
2. `/Users/joaichberger/Projects/ardenfall-archives/.worktrees/slice-1-item-walking-skeleton` — compile against HotRepl.Core from `mod/libs/HotRepl.Core.dll`, register Ardenfall commands, add controller, and deploy runtime DLLs into the game's `BepInEx/plugins/` directory.

Do not implement Ardenfall commands until Task 1 passes in HotRepl, the CrossOver Ardenfall bottle has a working BepInEx 5 install, and `HotRepl.Core.dll` is present in Ardenfall `mod/libs/` for compile-time reference.

## Command contract

All command names use version `1`.

| Command              | Kind | Mutates | Args                               | Result                                                                       |
| -------------------- | ---- | ------: | ---------------------------------- | ---------------------------------------------------------------------------- |
| `archive.info`       | sync |      no | `{}`                               | `{ apiVersion, extractorVersion, gameVersion, supportedEntities }`           |
| `archive.preflight`  | sync |      no | `{}`                               | `PreflightReport` plus `ready`                                               |
| `run.begin`          | sync |     yes | `{ gameVersion?, outputBaseDir? }` | `{ runId, workspaceDir }`                                                    |
| `run.status`         | sync |      no | `{ runId }`                        | `{ runId, state, counts, finalized, workspaceDir, publishedDir? }`           |
| `entity.plan`        | sync |      no | `{ runId, entity }`                | `{ entity, total, batchSize, batches }`                                      |
| `entity.exportBatch` | job  |     yes | `{ runId, entity, offset, limit }` | `{ entity, offset, limit, written, total }` plus chunk artifact              |
| `run.finalize`       | sync |     yes | `{ runId }`                        | `{ runId, publishedDir, manifestPath }` plus `manifest` and entity artifacts |
| `run.discard`        | sync |     yes | `{ runId }`                        | `{ runId, discarded: true }`                                                 |
| `game.quit`          | sync |     yes | `{}`                               | `{ quitting: true }`                                                         |

Errors use HotRepl control error kinds: `validation_failed`, `precondition_failed`, `conflict`, `busy`, `artifact_missing`, `internal`.

---

## Phase 0 — HotRepl registration hook

### Task 1: Add a global command registry for host plugins

**Files in `/Users/joaichberger/Projects/HotRepl`:**

- Create: `src/HotRepl.Core/Control/GlobalControlCommandRegistry.cs`
- Modify: `src/HotRepl.BepInEx/BepInExHost.cs`
- Modify: `src/HotRepl.Host.MelonLoader/MelonLoaderHost.cs`
- Test: `tests/HotRepl.Tests/Unit/GlobalControlCommandRegistryTests.cs`
- Docs: `docs/control-plane-protocol.md`, `AGENTS.md`

- [ ] **Step 1: Write failing registry tests**

Create `tests/HotRepl.Tests/Unit/GlobalControlCommandRegistryTests.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json.Linq;
using Xunit;

namespace HotRepl.Tests.Unit;

public class GlobalControlCommandRegistryTests
{
    [Fact]
    public void Describe_ReturnsRegisteredCommandsInNameOrder()
    {
        var registry = new GlobalControlCommandRegistry();
        using var b = registry.Register(new Handler("z.command"));
        using var a = registry.Register(new Handler("a.command"));

        var names = registry.Describe().ConvertAll(d => d.Name);

        Assert.Equal(new[] { "a.command", "z.command" }, names);
    }

    [Fact]
    public void DisposeRegistration_RemovesHandler()
    {
        var registry = new GlobalControlCommandRegistry();
        var registration = registry.Register(new Handler("archive.info"));
        registration.Dispose();

        Assert.False(registry.TryGet("archive.info", out _));
    }

    [Fact]
    public void Register_DuplicateNameThrows()
    {
        var registry = new GlobalControlCommandRegistry();
        using var first = registry.Register(new Handler("archive.info"));

        Assert.Throws<InvalidOperationException>(() => registry.Register(new Handler("archive.info")));
    }

    private sealed class Handler : IControlCommandHandler
    {
        public Handler(string name)
        {
            Descriptor = new ControlCommandDescriptor(
                name,
                1,
                ControlCommandKind.Synchronous,
                mutatesState: false,
                argsSchema: JObject.Parse("{\"type\":\"object\"}"),
                resultSchema: JObject.Parse("{\"type\":\"object\"}"));
        }

        public ControlCommandDescriptor Descriptor { get; }

        public ValueTask<ControlCommandResult> ExecuteAsync(
            ControlCommandContext context,
            JObject args,
            CancellationToken cancellationToken) => ValueTask.FromResult(ControlCommandResult.Empty);
    }
}
```

Run:

```bash
dotnet test tests/HotRepl.Tests/ --nologo -v q --filter GlobalControlCommandRegistryTests
```

Expected: fails because `GlobalControlCommandRegistry` does not exist.

- [ ] **Step 2: Implement the registry**

Create `src/HotRepl.Core/Control/GlobalControlCommandRegistry.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.Linq;

namespace HotRepl.Control;

/// <summary>Process-wide registry used by loaded host/game plugins to expose control commands.</summary>
public sealed class GlobalControlCommandRegistry : IControlCommandRegistry
{
    private readonly object _sync = new();
    private readonly Dictionary<string, IControlCommandHandler> _handlers = new(StringComparer.Ordinal);

    public static GlobalControlCommandRegistry Instance { get; } = new();

    public IDisposable Register(IControlCommandHandler handler)
    {
        if (handler == null)
            throw new ArgumentNullException(nameof(handler));

        var name = handler.Descriptor.Name;
        lock (_sync)
        {
            if (_handlers.ContainsKey(name))
                throw new InvalidOperationException($"Control command '{name}' is already registered.");
            _handlers.Add(name, handler);
        }

        return new Registration(this, name, handler);
    }

    public IReadOnlyList<ControlCommandDescriptor> Describe()
    {
        lock (_sync)
            return _handlers.Values.Select(h => h.Descriptor).OrderBy(d => d.Name, StringComparer.Ordinal).ToArray();
    }

    public bool TryGet(string name, out IControlCommandHandler handler)
    {
        lock (_sync)
            return _handlers.TryGetValue(name, out handler!);
    }

    private void Unregister(string name, IControlCommandHandler handler)
    {
        lock (_sync)
        {
            if (_handlers.TryGetValue(name, out var current) && ReferenceEquals(current, handler))
                _handlers.Remove(name);
        }
    }

    private sealed class Registration : IDisposable
    {
        private readonly GlobalControlCommandRegistry _owner;
        private readonly string _name;
        private readonly IControlCommandHandler _handler;
        private bool _disposed;

        public Registration(GlobalControlCommandRegistry owner, string name, IControlCommandHandler handler)
        {
            _owner = owner;
            _name = name;
            _handler = handler;
        }

        public void Dispose()
        {
            if (_disposed)
                return;
            _disposed = true;
            _owner.Unregister(_name, _handler);
        }
    }
}
```

- [ ] **Step 3: Wire host adapters**

In `src/HotRepl.BepInEx/BepInExHost.cs`, replace:

```csharp
public IControlCommandRegistry ControlCommands => EmptyControlCommandRegistry.Instance;
```

with:

```csharp
public IControlCommandRegistry ControlCommands => GlobalControlCommandRegistry.Instance;
```

Make the same replacement in `src/HotRepl.Host.MelonLoader/MelonLoaderHost.cs`.

- [ ] **Step 4: Update HotRepl docs**

In `docs/control-plane-protocol.md`, under command registry, add:

```markdown
BepInEx and MelonLoader host adapters expose `GlobalControlCommandRegistry.Instance`. Game-specific plugins register handlers with that registry during plugin initialization and dispose their registrations during plugin shutdown.
```

In `AGENTS.md`, add an invariant:

```markdown
- **Global control registry stays game-agnostic**: the registry stores `IControlCommandHandler` instances only. Do not add game-specific types, command names, or export policy to HotRepl.
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
dotnet test tests/HotRepl.Tests/ --nologo -v q --filter GlobalControlCommandRegistryTests
dotnet build src/HotRepl.BepInEx/ --nologo -v q
dotnet build src/HotRepl.Host.MelonLoader/ --nologo -v q
dotnet format src/HotRepl.Core/ --verify-no-changes
```

Expected: all exit 0.

Commit:

```bash
git add src/HotRepl.Core/Control/GlobalControlCommandRegistry.cs src/HotRepl.BepInEx/BepInExHost.cs src/HotRepl.Host.MelonLoader/MelonLoaderHost.cs tests/HotRepl.Tests/Unit/GlobalControlCommandRegistryTests.cs docs/control-plane-protocol.md AGENTS.md
git commit -m "feat(control): expose global command registry"
```

---

## Phase 1 — Ardenfall shared extraction service and HotRepl references

### Task 2: Verify one-time BepInEx setup in the CrossOver Steam bottle

**Files:** none unless documenting a local path change in `docs/superpowers/progress/2026-05-03-slice1.md`.

- [ ] **Step 1: Verify the game root**

Use this game root unless the local Steam library moved:

```text
/Users/joaichberger/Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/Ardenfall Demo/
```

Confirm these paths exist:

```text
Ardenfall.exe
Ardenfall_Data/Managed/Assembly-CSharp.dll
```

- [ ] **Step 2: Install BepInEx 5 into the game root**

Use the BepInEx 5 x64 Mono package. The game root must contain:

```text
winhttp.dll
doorstop_config.ini
BepInEx/core/BepInEx.dll
BepInEx/plugins/
BepInEx/config/
```

This is a one-time local setup, not a repo script.

- [ ] **Step 3: Launch once and verify BepInEx bootstraps**

Launch Ardenfall Demo through the CrossOver Steam bottle. Verify `BepInEx/LogOutput.log` exists and contains a BepInEx chainloader startup line. If the log is absent, fix the BepInEx install before continuing.

- [ ] **Step 4: Record local setup result**

If this task is executed during implementation, append the observed game root and BepInEx log result to `docs/superpowers/progress/2026-05-03-slice1.md` and commit:

```bash
git add docs/superpowers/progress/2026-05-03-slice1.md
git commit -m "docs(progress): record local bepinex setup"
```

### Task 3: Reference HotRepl.Core from the Ardenfall mod

**Files in Ardenfall worktree:**

- Modify: `mod/ArdenfallArchives.csproj`
- Modify: `mod/scripts/copy-libs.sh`
- Modify: `mod/AGENTS.md`

- [ ] **Step 1: Update `mod/scripts/copy-libs.sh`**

Add optional HotRepl.Core compile-reference copy support. This populates `mod/libs/` for `dotnet build`; runtime deployment still goes to the game's `BepInEx/plugins/` directory. Replace the file with:

```bash
#!/usr/bin/env bash
# Copies game DLLs and HotRepl.Core compile reference into mod/libs/.
# Usage: copy-libs.sh [ardenfall-managed-dir] [hotrepl-core-output-dir]
set -euo pipefail
SRC=${1:-"$HOME/Library/Application Support/CrossOver/Bottles/Steam/drive_c/Program Files (x86)/Steam/steamapps/common/Ardenfall Demo/Ardenfall_Data/Managed"}
HOTREPL_OUT=${2:-"$HOME/Projects/HotRepl/src/HotRepl.Core/bin/Debug/netstandard2.1"}
DEST="$(dirname "$0")/../libs"
mkdir -p "$DEST"
for dll in Assembly-CSharp.dll UnityEngine.dll UnityEngine.CoreModule.dll UnityEngine.IMGUIModule.dll Sirenix.OdinInspector.Attributes.dll Sirenix.Serialization.dll; do
  cp "$SRC/$dll" "$DEST/$dll"
done
if [ -f "$HOTREPL_OUT/HotRepl.Core.dll" ]; then
  cp "$HOTREPL_OUT/HotRepl.Core.dll" "$DEST/HotRepl.Core.dll"
fi
echo "copied $(find "$DEST" -maxdepth 1 -name '*.dll' | wc -l | tr -d ' ') dlls to $DEST"
```

- [ ] **Step 2: Add the csproj reference**

Add this reference inside the existing reference `ItemGroup` in `mod/ArdenfallArchives.csproj`:

```xml
<Reference Include="HotRepl.Core">              <HintPath>libs\HotRepl.Core.dll</HintPath>              <Private>false</Private> </Reference>
```

- [ ] **Step 3: Document the dependency**

Add to `mod/AGENTS.md`:

```markdown
## HotRepl dependency

The Ardenfall mod references `mod/libs/HotRepl.Core.dll` at compile time. Runtime DLLs belong in the game's `BepInEx/plugins/` directory, not `mod/libs/`. Build HotRepl first, run `mod/scripts/copy-libs.sh <Ardenfall Managed dir> <HotRepl.Core output dir>` before `dotnet build mod/ArdenfallArchives.csproj`, and deploy the matching HotRepl and Ardenfall DLLs to `BepInEx/plugins/`.
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
```

Expected: exits 0 after `HotRepl.Core.dll` is present in `mod/libs/` as a compile-time reference.

Commit:

```bash
git add mod/ArdenfallArchives.csproj mod/scripts/copy-libs.sh mod/AGENTS.md
git commit -m "chore(mod): reference hotrepl control contracts"
```

### Task 4: Extract the F8 monolith into `ExtractionService`

**Files:**

- Create: `mod/src/Game/GameInfo.cs`
- Create: `mod/src/Extraction/ExtractionRequest.cs`
- Create: `mod/src/Extraction/ExtractionResult.cs`
- Create: `mod/src/Extraction/ExtractionService.cs`
- Modify: `mod/src/Plugin.cs`

- [ ] **Step 1: Create game version helper and request/result DTOs**

Create `mod/src/Game/GameInfo.cs`:

```csharp
using System.IO;
using System.Linq;
using UnityEngine;

namespace ArdenfallArchives.Game;

public static class GameInfo
{
    public static string Version
    {
        get
        {
            var version = Application.version;
            return string.IsNullOrWhiteSpace(version) ? "unknown" : version;
        }
    }

    public static string SnapshotVersionSegment
    {
        get
        {
            var invalid = Path.GetInvalidFileNameChars();
            var chars = Version.Select(c => invalid.Contains(c) ? '_' : c).ToArray();
            return new string(chars);
        }
    }
}
```

Create `mod/src/Extraction/ExtractionRequest.cs`:

```csharp
namespace ArdenfallArchives.Extraction;

public sealed class ExtractionRequest
{
    public string OutputBaseDir { get; set; } = "";
    public string GameVersion { get; set; } = ArdenfallArchives.Game.GameInfo.SnapshotVersionSegment;
}
```

Create `mod/src/Extraction/ExtractionResult.cs`:

```csharp
using System.Collections.Generic;
using ArdenfallArchives.Dtos;

namespace ArdenfallArchives.Extraction;

public sealed class ExtractionResult
{
    public bool Success { get; set; }
    public string? PublishedDir { get; set; }
    public int ItemCount { get; set; }
    public int DiagnosticCount { get; set; }
    public PreflightReport Preflight { get; set; } = new();
    public List<Diagnostic> Diagnostics { get; } = new();
}
```

- [ ] **Step 2: Move extraction logic into service**

Create `mod/src/Extraction/ExtractionService.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using ArdenfallArchives.Dtos;
using ArdenfallArchives.Emit;
using ArdenfallArchives.Entities.Item;
using PreflightRunner = ArdenfallArchives.Preflight.Preflight;

namespace ArdenfallArchives.Extraction;

public sealed class ExtractionService
{
    public ExtractionResult ExtractAll(ExtractionRequest request)
    {
        var preflight = PreflightRunner.Run();
        var result = new ExtractionResult { Preflight = preflight };
        if (!preflight.Passed)
            return result;

        var writer = new SnapshotWriter(request.OutputBaseDir);
        var staging = writer.BeginStaging(request.GameVersion);
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
                result.Diagnostics.Add(diagnostic);
            }

            var manifest = ManifestBuilder.Build(
                preflight,
                counts: new Dictionary<string, int> { ["item"] = rows.Count },
                diagnostics: totals,
                contentHashes: new Dictionary<string, string> { ["items.json"] = ManifestBuilder.Sha256Hex(json) },
                extractorVersion: Plugin.Version,
                gameVersion: request.GameVersion);
            writer.WriteManifest(staging, manifest);

            result.PublishedDir = writer.Publish(staging, request.GameVersion);
            result.ItemCount = rows.Count;
            result.DiagnosticCount = extractor.Diagnostics.Count;
            result.Success = true;
            return result;
        }
        catch (Exception ex)
        {
            writer.DiscardStaging(staging);
            result.Diagnostics.Add(new Diagnostic
            {
                Severity = "fatal",
                Code = "extractionFailed",
                Field = "snapshot",
                Message = ex.Message,
            });
            return result;
        }
    }
}
```

- [ ] **Step 3: Simplify `Plugin.RunExtractionFromAnyTrigger`**

Replace the body of `RunExtractionFromAnyTrigger()` in `mod/src/Plugin.cs` with:

```csharp
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
```

Remove unused `using System.*`, `using ArdenfallArchives.*`, and `using PreflightRunner = ...` imports that no longer compile as used.

- [ ] **Step 4: Verify and commit**

Run:

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
dotnet format mod/ArdenfallArchives.csproj --verify-no-changes
```

Expected: both exit 0.

Commit:

```bash
git add mod/src/Extraction mod/src/Plugin.cs
git commit -m "refactor(mod): extract shared snapshot service"
```

---

## Phase 2 — In-game control commands

### Task 5: Add run workspace manager

**Files:**

- Create: `mod/src/Control/ArchiveRun.cs`
- Create: `mod/src/Control/ArchiveRunManager.cs`
- Create: `mod/src/Control/ArchiveCommandSchemas.cs`

- [ ] **Step 1: Add run model**

Create `mod/src/Control/ArchiveRun.cs`:

```csharp
using System.Collections.Generic;

namespace ArdenfallArchives.Control;

public sealed class ArchiveRun
{
    public string RunId { get; set; } = "";
    public string GameVersion { get; set; } = ArdenfallArchives.Game.GameInfo.SnapshotVersionSegment;
    public string WorkspaceDir { get; set; } = "";
    public string? PublishedDir { get; set; }
    public string State { get; set; } = "open";
    public Dictionary<string, int> Counts { get; } = new();
    public bool Finalized => State == "finalized";
}
```

- [ ] **Step 2: Add manager**

Create `mod/src/Control/ArchiveRunManager.cs`:

```csharp
using System;
using System.Collections.Generic;
using System.IO;

namespace ArdenfallArchives.Control;

public sealed class ArchiveRunManager
{
    private readonly object _sync = new();
    private readonly Dictionary<string, ArchiveRun> _runs = new();

    public ArchiveRun Begin(string baseDir, string gameVersion)
    {
        var runId = DateTimeOffset.UtcNow.ToString("yyyyMMdd-HHmmssfffffff");
        var workspace = Path.Combine(baseDir, "runs", runId);
        Directory.CreateDirectory(Path.Combine(workspace, "control"));
        Directory.CreateDirectory(Path.Combine(workspace, "entities", "item", "chunks"));
        var run = new ArchiveRun { RunId = runId, GameVersion = gameVersion, WorkspaceDir = workspace };
        lock (_sync) _runs.Add(runId, run);
        return run;
    }

    public bool TryGet(string runId, out ArchiveRun run)
    {
        lock (_sync) return _runs.TryGetValue(runId, out run!);
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
```

- [ ] **Step 3: Add JSON schemas helper**

Create `mod/src/Control/ArchiveCommandSchemas.cs`:

```csharp
using Newtonsoft.Json.Linq;

namespace ArdenfallArchives.Control;

public static class ArchiveCommandSchemas
{
    public static JObject EmptyObject { get; } = JObject.Parse("{\"type\":\"object\",\"additionalProperties\":false}");
    public static JObject AnyObject { get; } = JObject.Parse("{\"type\":\"object\"}");
}
```

- [ ] **Step 4: Verify and commit**

Run:

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
```

Commit:

```bash
git add mod/src/Control/ArchiveRun.cs mod/src/Control/ArchiveRunManager.cs mod/src/Control/ArchiveCommandSchemas.cs
git commit -m "feat(mod): add archive run workspace manager"
```

### Task 6: Register archive.info and archive.preflight

**Files:**

- Create: `mod/src/Control/ArchiveCommandRegistry.cs`
- Create: `mod/src/Control/Handlers/ArchiveInfoCommand.cs`
- Create: `mod/src/Control/Handlers/ArchivePreflightCommand.cs`
- Modify: `mod/src/Plugin.cs`

- [ ] **Step 1: Add registry wrapper**

Create `mod/src/Control/ArchiveCommandRegistry.cs`:

```csharp
using System;
using System.Collections.Generic;
using HotRepl.Control;

namespace ArdenfallArchives.Control;

public sealed class ArchiveCommandRegistry : IDisposable
{
    private readonly List<IDisposable> _registrations = new();

    public ArchiveCommandRegistry(ArchiveRunManager runs, string outputBaseDir)
    {
        Register(new Handlers.ArchiveInfoCommand());
        Register(new Handlers.ArchivePreflightCommand());
    }

    private void Register(IControlCommandHandler handler)
    {
        _registrations.Add(GlobalControlCommandRegistry.Instance.Register(handler));
    }

    public void Dispose()
    {
        foreach (var registration in _registrations) registration.Dispose();
        _registrations.Clear();
    }
}
```

- [ ] **Step 2: Add `archive.info` handler**

Create `mod/src/Control/Handlers/ArchiveInfoCommand.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json.Linq;

namespace ArdenfallArchives.Control.Handlers;

public sealed class ArchiveInfoCommand : IControlCommandHandler
{
    public ControlCommandDescriptor Descriptor { get; } = new(
        "archive.info",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: false,
        argsSchema: ArchiveCommandSchemas.EmptyObject,
        resultSchema: ArchiveCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var result = new JObject
        {
            ["apiVersion"] = 1,
            ["extractorVersion"] = Plugin.Version,
            ["gameVersion"] = ArdenfallArchives.Game.GameInfo.Version,
            ["supportedEntities"] = new JArray("item"),
        };
        return new ValueTask<ControlCommandResult>(new ControlCommandResult(result, Array.Empty<HotRepl.Control.Artifacts.ArtifactRef>(), Array.Empty<ControlCommandError>()));
    }
}
```

- [ ] **Step 3: Add `archive.preflight` handler**

Create `mod/src/Control/Handlers/ArchivePreflightCommand.cs`:

```csharp
using System;
using System.Threading;
using System.Threading.Tasks;
using HotRepl.Control;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PreflightRunner = ArdenfallArchives.Preflight.Preflight;

namespace ArdenfallArchives.Control.Handlers;

public sealed class ArchivePreflightCommand : IControlCommandHandler
{
    public ControlCommandDescriptor Descriptor { get; } = new(
        "archive.preflight",
        1,
        ControlCommandKind.Synchronous,
        mutatesState: false,
        argsSchema: ArchiveCommandSchemas.EmptyObject,
        resultSchema: ArchiveCommandSchemas.AnyObject);

    public ValueTask<ControlCommandResult> ExecuteAsync(ControlCommandContext context, JObject args, CancellationToken cancellationToken)
    {
        var report = PreflightRunner.Run();
        var result = JObject.FromObject(report, JsonSerializer.Create(Emit.JsonSettings.Default));
        result["ready"] = report.Passed;
        return new ValueTask<ControlCommandResult>(new ControlCommandResult(result, Array.Empty<HotRepl.Control.Artifacts.ArtifactRef>(), Array.Empty<ControlCommandError>()));
    }
}
```

- [ ] **Step 4: Register from plugin lifecycle**

In `mod/src/Plugin.cs`, add fields:

```csharp
private Control.ArchiveRunManager _runs = null!;
private Control.ArchiveCommandRegistry _commands = null!;
```

In `Awake()`, after `_outputDir` is bound:

```csharp
_runs = new Control.ArchiveRunManager();
_commands = new Control.ArchiveCommandRegistry(_runs, _outputDir.Value);
```

In `OnDestroy()`, before `_readiness.Dispose();`:

```csharp
_commands?.Dispose();
```

- [ ] **Step 5: Verify and commit**

Run:

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
```

Commit:

```bash
git add mod/src/Control mod/src/Plugin.cs
git commit -m "feat(mod): register archive info and preflight commands"
```

### Task 7: Add run lifecycle commands

**Files:**

- Create: `mod/src/Control/Handlers/RunBeginCommand.cs`
- Create: `mod/src/Control/Handlers/RunStatusCommand.cs`
- Create: `mod/src/Control/Handlers/RunDiscardCommand.cs`
- Modify: `mod/src/Control/ArchiveCommandRegistry.cs`

- [ ] **Step 1: Add handlers and register them**

Implement handlers that parse `runId`, `gameVersion`, and `outputBaseDir` from `JObject` args, return `validation_failed` diagnostics for missing `runId`, and use `ArchiveRunManager` for state. Register them in `ArchiveCommandRegistry`:

```csharp
Register(new Handlers.RunBeginCommand(runs, outputBaseDir));
Register(new Handlers.RunStatusCommand(runs));
Register(new Handlers.RunDiscardCommand(runs));
```

Each descriptor uses `ControlCommandKind.Synchronous`; `run.begin` and `run.discard` set `mutatesState: true`, `run.status` sets `mutatesState: false`.

- [ ] **Step 2: Verify and commit**

Run:

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
```

Commit:

```bash
git add mod/src/Control/Handlers/RunBeginCommand.cs mod/src/Control/Handlers/RunStatusCommand.cs mod/src/Control/Handlers/RunDiscardCommand.cs mod/src/Control/ArchiveCommandRegistry.cs
git commit -m "feat(mod): add archive run lifecycle commands"
```

### Task 8: Add entity plan, batch export, finalize, and quit commands

**Files:**

- Create: `mod/src/Control/Handlers/EntityPlanCommand.cs`
- Create: `mod/src/Control/Handlers/EntityExportBatchCommand.cs`
- Create: `mod/src/Control/Handlers/RunFinalizeCommand.cs`
- Create: `mod/src/Control/Handlers/GameQuitCommand.cs`
- Modify: `mod/src/Control/ArchiveCommandRegistry.cs`

- [ ] **Step 1: Implement entity plan**

`entity.plan` supports only `{ "entity": "item" }`. It calls `BuiltLookupTable.GetAssetsOfType<ItemData>()`, counts non-null assets, and returns:

```json
{ "entity": "item", "total": 123, "batchSize": 100, "batches": 2 }
```

Unknown entity returns `validation_failed` with code `unsupportedEntity`.

- [ ] **Step 2: Implement batch export job**

`entity.exportBatch` is a `ControlCommandKind.Job` mutating handler. It validates `runId`, `entity`, `offset`, and `limit`; extracts the requested item slice; writes:

```text
<workspace>/entities/item/chunks/<offset-padded-6>.json
```

It returns a `ControlCommandResult` with:

```json
{ "entity": "item", "offset": 0, "limit": 100, "written": 100, "total": 123 }
```

and an `ArtifactRef` for the chunk with `logicalName: "item.chunk.000000"`, `contentType: "application/json"`, `byteSize`, `sha256`, `finalized: true`.

- [ ] **Step 3: Implement finalize**

`run.finalize` merges item chunk envelopes in offset order into `items.json`, builds `manifest.json` using `ManifestBuilder`, publishes to:

```text
<base>/snapshots/<gameVersion>-<runId>/
```

It returns artifact refs for `manifest` and `items`.

- [ ] **Step 4: Implement quit**

`game.quit` calls `UnityEngine.Application.Quit()` and returns `{ "quitting": true }`.

- [ ] **Step 5: Verify and commit**

Run:

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
dotnet format mod/ArdenfallArchives.csproj --verify-no-changes
```

Commit:

```bash
git add mod/src/Control/Handlers mod/src/Control/ArchiveCommandRegistry.cs
git commit -m "feat(mod): add entity export control commands"
```

---

## Phase 3 — External controller

### Task 9: Add controller workspace and HotRepl protocol client

**Files:**

- Modify: `package.json`
- Create: `controller/package.json`
- Create: `controller/tsconfig.json`
- Create: `controller/src/hotrepl-client.ts`
- Test: `controller/test/hotrepl-client.test.ts`

- [ ] **Step 1: Add workspace**

Add `"controller"` to root `package.json` `workspaces` and add scripts:

```json
"controller:export": "bun run controller/src/cli.ts export",
"controller:test": "bun test controller/test"
```

Create `controller/package.json`:

```json
{
  "name": "@ardenfall/controller",
  "private": true,
  "version": "0.0.0",
  "type": "module"
}
```

Create `controller/tsconfig.json` extending `../tsconfig.base.json` with `include: ["src", "test"]`.

- [ ] **Step 2: Implement HotRepl client**

`controller/src/hotrepl-client.ts` exports `HotReplClient` with methods `connect`, `authenticate`, `acquireLease`, `describeCommands`, `call`, `startJob`, `jobStatus`, `jobResult`, `cancelJob`, and `close`. Use Bun's global `WebSocket`. Each request has an id and rejects on `command_error` with a typed `ControlCommandError`.

- [ ] **Step 3: Test with fake WebSocket server**

`controller/test/hotrepl-client.test.ts` starts a Bun server with WebSocket upgrade, sends a handshake, records request payloads, and asserts `describeCommands()` sends `command_describe` and `call()` sends `command_call` with args.

- [ ] **Step 4: Verify and commit**

Run:

```bash
bun test controller/test/hotrepl-client.test.ts
bun run typecheck
```

Commit:

```bash
git add package.json controller
git commit -m "feat(controller): add hotrepl protocol client"
```

### Task 10: Add export orchestrator CLI

**Files:**

- Create: `controller/src/cli.ts`
- Create: `controller/src/export-orchestrator.ts`
- Create: `controller/src/validate-snapshot.ts`
- Test: `controller/test/export-orchestrator.test.ts`

- [ ] **Step 1: Implement orchestration flow**

`export-orchestrator.ts` performs:

```text
connect -> authenticate -> acquireLease -> describeCommands -> archive.preflight -> run.begin -> entity.plan -> entity.exportBatch jobs -> run.finalize -> validate artifacts -> pipeline:run
```

It refuses to continue when any required command is missing or has a version other than `1`.

- [ ] **Step 2: Implement artifact validation**

`validate-snapshot.ts` verifies `manifest.json` and `items.json` exist, SHA-256 hashes match manifest entries, manifest counts match `items.json.rows.length`, and no fatal diagnostics exist.

- [ ] **Step 3: Implement CLI**

`controller/src/cli.ts` supports:

```bash
bun run controller:export -- --url ws://127.0.0.1:18590 --output ./snapshots --pipeline-out ./pipeline/dist
```

It prints JSON event lines to stdout with `phase`, `status`, and relevant paths. It exits non-zero on validation failure.

- [ ] **Step 4: Verify and commit**

Run:

```bash
bun test controller/test/export-orchestrator.test.ts
bun run typecheck
```

Commit:

```bash
git add controller/src controller/test package.json
git commit -m "feat(controller): orchestrate ardenfall exports"
```

---

## Phase 4 — Deployment and end-to-end gates

### Task 11: Add deploy helper and manual smoke recipe

**Files:**

- Create: `controller/src/deploy.ts`
- Modify: `README.md`
- Modify: `docs/superpowers/progress/2026-05-03-slice1.md`

- [ ] **Step 1: Implement deploy helper**

`deploy.ts` copies HotRepl BepInEx output, `mcs.dll`, and `ArdenfallArchives.dll` into a supplied BepInEx plugins directory. It refuses to copy when any source DLL is missing.

- [ ] **Step 2: Document the smoke**

Add README commands:

```bash
dotnet build /Users/joaichberger/Projects/HotRepl/src/HotRepl.BepInEx/ --nologo -v q
dotnet build mod/ArdenfallArchives.csproj -c Debug
bun run controller:export -- --url ws://127.0.0.1:18590 --output ./snapshots --pipeline-out ./pipeline/dist
```

- [ ] **Step 3: Verify and commit**

Run:

```bash
bun run format:check
bun run typecheck
```

Commit:

```bash
git add controller/src/deploy.ts README.md docs/superpowers/progress/2026-05-03-slice1.md
git commit -m "docs(controller): add hotrepl export smoke workflow"
```

### Task 12: Final verification

**Files:** all touched files.

- [ ] **Step 1: Run static gates**

```bash
dotnet build mod/ArdenfallArchives.csproj -c Debug
dotnet format mod/ArdenfallArchives.csproj --verify-no-changes
bun run format:check
bun run lint
bun run typecheck
bun test pipeline/test
bun test controller/test
```

Expected: all exit 0.

- [ ] **Step 2: Run live smoke when game is available**

With Ardenfall Demo and BepInEx installed:

```bash
bun run controller:export -- --url ws://127.0.0.1:18590 --output ./snapshots --pipeline-out ./pipeline/dist
```

Expected: command registry contains all nine commands, export completes, manifest and items artifacts validate, and `pipeline:run` emits SQLite output.

- [ ] **Step 3: Commit verification notes**

Update `docs/superpowers/progress/2026-05-03-slice1.md` with the exact commands and observed outcomes. Commit only if the file changed:

```bash
git add docs/superpowers/progress/2026-05-03-slice1.md
git commit -m "docs(progress): record hotrepl export automation verification"
```

---

## Self-review

- Spec coverage: all nine commands, shared extraction service, HotRepl registration, external controller, artifact validation, and pipeline handoff are covered.
- Consistency: command names match `docs/superpowers/specs/2026-05-06-hotrepl-export-workflow-design.md` and HotRepl protocol docs.
- Scope: site phases H-I remain separate Slice 1 work; this plan only replaces manual export automation.
- Risk surfaced: HotRepl needs the global registry hook before Ardenfall can register commands from a separate BepInEx plugin.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-06-ardenfall-hotrepl-export-automation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.
