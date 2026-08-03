using System;
using System.Diagnostics;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Control.Args;
using ArdenfallCompendium.Control.Results;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Emit;
using ArdenfallCompendium.Entities.Item;
using ArdenfallCompendium.Entities.ItemCategory;
using ArdenfallCompendium.Entities.ItemTag;
using ArdenfallCompendium.Entities.StatType;
using ArdenfallCompendium.Entities.Spell;
using ArdenfallCompendium.Entities.StatusEffect;
using ArdenfallCompendium.Entities.Location;
using ArdenfallCompendium.Entities.Portal;
using ArdenfallCompendium.Entities.Character;
using ArdenfallCompendium.Entities.Faction;
using ArdenfallCompendium.Entities.Npc;
using ArdenfallCompendium.Extraction;
using ArdenfallCompendium.MasterTooltip;
using HotRepl.Control;
using HotRepl.Control.Artifacts;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using PreflightRunner = ArdenfallCompendium.Preflight.Preflight;

namespace ArdenfallCompendium.Control.Handlers;

public sealed class RunFinalizeCommand : IControlCommandHandler<RunIdArgs, RunFinalizeResult>
{
    private readonly CompendiumRunManager _runs;
    private readonly IItemExtractionCache _items;
    private readonly IStatTypeExtractionCache _statTypes;
    private readonly ISpellExtractionCache _spells;
    private readonly IStatusEffectExtractionCache _statusEffects;
    private readonly IItemCategoryExtractionCache _itemCategories;
    private readonly IItemTagExtractionCache _itemTags;
    private readonly ILocationExtractionCache _locations;
    private readonly IPortalExtractionCache _portals;
    private readonly ICharacterExtractionCache _characters;
    private readonly IFactionExtractionCache _factions;
    private readonly INpcExtractionCache _npcs;
    private readonly IMasterTooltipSnapshotSource _masterTooltip;
    private readonly Func<PreflightReport> _preflight;

    public RunFinalizeCommand(
        CompendiumRunManager runs,
        IItemExtractionCache items,
        ISpellExtractionCache spells,
        ICharacterExtractionCache characters,
        IStatusEffectExtractionCache statusEffects,
        IMasterTooltipSnapshotSource masterTooltip,
        IStatTypeExtractionCache statTypes,
        IItemCategoryExtractionCache itemCategories,
        IItemTagExtractionCache itemTags,
        ILocationExtractionCache locations,
        IPortalExtractionCache portals,
        IFactionExtractionCache factions,
        INpcExtractionCache npcs,
        Func<PreflightReport>? preflight = null
    )
    {
        _runs = runs;
        _items = items;
        // Every extraction source is required. A defaulted live service here would
        // let a wiring mistake compile, and would silently construct Unity sources
        // inside tests that meant to pass a fake.
        _statTypes = statTypes;
        _spells = spells;
        _characters = characters;
        _statusEffects = statusEffects;
        _itemCategories = itemCategories;
        _itemTags = itemTags;
        _locations = locations;
        _portals = portals;
        _factions = factions;
        _npcs = npcs;
        _masterTooltip = masterTooltip;
        _preflight = preflight ?? PreflightRunner.Run;
    }

    public string Name => "run.finalize";

    public int Version => 1;

    public ControlCommandKind Kind => ControlCommandKind.Sync;

    public bool MutatesState => true;

    public ValueTask<ControlCommandResult<RunFinalizeResult>> ExecuteAsync(
        ControlCommandContext<RunFinalizeResult> context,
        RunIdArgs args,
        CancellationToken cancellationToken
    )
    {
        var runIdValidation = CompendiumCommandResults.RequiredString(
            context,
            args.RunId,
            "runId"
        );
        if (runIdValidation != null) return new(runIdValidation);
        if (!_runs.TryGet(args.RunId, out var run))
            return new(
                CompendiumCommandResults.Validation(
                    context,
                    "unknownRun",
                    $"Unknown run '{args.RunId}'."
                )
            );
        if (run.Finalized)
            return new(
                CompendiumCommandResults.Precondition(
                    context,
                    "runFinalized",
                    $"Run '{args.RunId}' is already finalized."
                )
            );

        var timings = new List<RunFinalizeTiming>();
        var totalStopwatch = Stopwatch.StartNew();
        var phaseStopwatch = Stopwatch.StartNew();
        var preflight = _preflight();
        RecordTiming(timings, "preflight", phaseStopwatch, totalStopwatch);
        if (!preflight.Passed)
            return new(
                CompendiumCommandResults.Precondition(
                    context,
                    "preflightFailed",
                    "Preflight failed; no snapshot was written.",
                    JObject.FromObject(preflight)
                )
            );

        phaseStopwatch.Restart();
        var chunksDir = Path.Combine(run.WorkspaceDir, "entities", "item", "chunks");
        var chunkValidation = ReadPlannedItemChunks(
            context,
            run,
            chunksDir,
            out var rows,
            out var diagnosticTotals,
            out var diagnostics
        );
        RecordTiming(timings, "chunks.read", phaseStopwatch, totalStopwatch);
        if (chunkValidation != null) return new(chunkValidation);

        var snapshotsRoot = Path.Combine(run.OutputBaseDir, "snapshots");
        var publishedDir = Path.Combine(snapshotsRoot, $"{run.GameVersion}-{run.RunId}");
        if (Directory.Exists(publishedDir))
            return new(
                CompendiumCommandResults.Precondition(
                    context,
                    "snapshotExists",
                    $"Snapshot directory already exists: {publishedDir}"
                )
            );

        Directory.CreateDirectory(snapshotsRoot);
        var stagingDir = Path.Combine(snapshotsRoot, $".staging-{run.GameVersion}-{run.RunId}");
        if (Directory.Exists(stagingDir)) Directory.Delete(stagingDir, recursive: true);
        Directory.CreateDirectory(stagingDir);

        try
        {
            var hashes = new Dictionary<string, string>();

            phaseStopwatch.Restart();
            var itemEnvelope = new ItemSnapshotEnvelope { Rows = rows };
            WriteJson(stagingDir, "items.json", itemEnvelope, hashes);
            RecordTiming(timings, "items.write", phaseStopwatch, totalStopwatch);

            phaseStopwatch.Restart();
            var statTypeRows = _statTypes.GetOrExtract(run).ToList();
            var statTypeAssetPlan = _statTypes.GetAssetPlan(run);
            var spellRows = _spells.GetOrExtract(run).ToList();
            var spellAssetPlan = _spells.GetAssetPlan(run);
            var characterRows = _characters.GetOrExtract(run).ToList();
            var statusEffectRows = _statusEffects.GetOrExtract(run).ToList();
            var statusEffectAssetPlan = _statusEffects.GetAssetPlan(run);
            var itemCategoryRows = _itemCategories.GetOrExtract(run).ToList();
            var itemCategoryAssetPlan = _itemCategories.GetAssetPlan(run);
            var itemTagRows = _itemTags.GetOrExtract(run).ToList();
            var locationRows = _locations.GetOrExtract(run).ToList();
            var portalRows = _portals.GetOrExtract(run).ToList();
            var factionRows = _factions.GetOrExtract(run).ToList();
            var factionAssetPlan = _factions.GetAssetPlan(run);
            var npcRows = _npcs.GetOrExtract(run).ToList();
            RecordTiming(timings, "related.extract", phaseStopwatch, totalStopwatch);

            phaseStopwatch.Restart();
            var assetPlan = _items.GetAssetPlan(run);
            var assetWriter = new IconAssetManifestWriter(new SpriteAssetExporter());
            assetWriter.WriteSlots(stagingDir, assetPlan);
            assetWriter.WriteSlots(stagingDir, statTypeAssetPlan);
            assetWriter.WriteSlots(stagingDir, spellAssetPlan);
            assetWriter.WriteSlots(stagingDir, statusEffectAssetPlan);
            assetWriter.WriteSlots(stagingDir, factionAssetPlan);
            assetWriter.WriteSlots(stagingDir, itemCategoryAssetPlan);
            assetPlan.Manifest.Assets.AddRange(statTypeAssetPlan.Manifest.Assets);
            assetPlan.Manifest.ItemIconMetadata.AddRange(statTypeAssetPlan.Manifest.ItemIconMetadata);
            assetPlan.Manifest.Assets.AddRange(spellAssetPlan.Manifest.Assets);
            assetPlan.Manifest.ItemIconMetadata.AddRange(spellAssetPlan.Manifest.ItemIconMetadata);
            assetPlan.Manifest.Assets.AddRange(statusEffectAssetPlan.Manifest.Assets);
            assetPlan.Manifest.ItemIconMetadata.AddRange(statusEffectAssetPlan.Manifest.ItemIconMetadata);
            assetPlan.Manifest.Assets.AddRange(factionAssetPlan.Manifest.Assets);
            assetPlan.Manifest.ItemIconMetadata.AddRange(factionAssetPlan.Manifest.ItemIconMetadata);
            assetPlan.Manifest.Assets.AddRange(itemCategoryAssetPlan.Manifest.Assets);
            assetPlan.Manifest.ItemIconMetadata.AddRange(itemCategoryAssetPlan.Manifest.ItemIconMetadata);
            WriteJson(stagingDir, "asset-manifest.json", assetPlan.Manifest, hashes);
            RecordTiming(timings, "assets.write", phaseStopwatch, totalStopwatch);

            phaseStopwatch.Restart();
            var masterTooltip = _masterTooltip.BuildSnapshot();
            WriteJson(stagingDir, "master-tooltip.json", masterTooltip, hashes);

            var statTypeEnvelope = new StatTypeSnapshotEnvelope { Rows = statTypeRows };
            WriteJson(stagingDir, "stat-types.json", statTypeEnvelope, hashes);
            var spellEnvelope = new SpellSnapshotEnvelope { Rows = spellRows };
            WriteJson(stagingDir, "spells.json", spellEnvelope, hashes);
            var characterEnvelope = new CharacterSnapshotEnvelope { Rows = characterRows };
            WriteJson(stagingDir, "characters.json", characterEnvelope, hashes);
            var statusEffectEnvelope = new StatusEffectSnapshotEnvelope { Rows = statusEffectRows };
            WriteJson(stagingDir, "status-effects.json", statusEffectEnvelope, hashes);
            var itemCategoryEnvelope = new ItemCategorySnapshotEnvelope { Rows = itemCategoryRows };
            WriteJson(stagingDir, "item-categories.json", itemCategoryEnvelope, hashes);
            var itemTagEnvelope = new ItemTagSnapshotEnvelope { Rows = itemTagRows };
            WriteJson(stagingDir, "item-tags.json", itemTagEnvelope, hashes);
            var locationEnvelope = new LocationSnapshotEnvelope { Rows = locationRows };
            WriteJson(stagingDir, "locations.json", locationEnvelope, hashes);
            var portalEnvelope = new PortalSnapshotEnvelope { Rows = portalRows };
            WriteJson(stagingDir, "portals.json", portalEnvelope, hashes);
            var factionEnvelope = new FactionSnapshotEnvelope { Rows = factionRows };
            WriteJson(stagingDir, "factions.json", factionEnvelope, hashes);
            var npcEnvelope = new NpcSnapshotEnvelope { Rows = npcRows };
            WriteJson(stagingDir, "npcs.json", npcEnvelope, hashes);
            RecordTiming(timings, "metadata.write", phaseStopwatch, totalStopwatch);

            phaseStopwatch.Restart();
            foreach (var diagnostic in _items.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in assetPlan.Diagnostics)
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _statTypes.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in statTypeAssetPlan.Diagnostics)
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _spells.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in spellAssetPlan.Diagnostics)
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _characters.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _statusEffects.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in statusEffectAssetPlan.Diagnostics)
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _itemCategories.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in itemCategoryAssetPlan.Diagnostics)
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _itemTags.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _locations.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _portals.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _factions.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in factionAssetPlan.Diagnostics)
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var diagnostic in _npcs.GetWalkerDiagnostics(run))
            {
                AddDiagnostic(diagnosticTotals, diagnostics, rowId: null, diagnostic);
            }
            foreach (var row in statTypeRows)
            {
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
            foreach (var row in spellRows)
            {
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
            foreach (var row in characterRows)
            {
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
            foreach (var row in statusEffectRows)
            {
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
            foreach (var row in itemCategoryRows)
            {
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
            foreach (var row in itemTagRows)
            {
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
            foreach (var row in locationRows)
            {
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
            foreach (var row in portalRows)
            {
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
            foreach (var row in factionRows)
            {
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
            foreach (var row in npcRows)
            {
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }

            if (diagnostics.Count > 0)
            {
                WriteJson(stagingDir, "diagnostics.json", diagnostics, hashes);
            }
            RecordTiming(timings, "diagnostics.collect", phaseStopwatch, totalStopwatch);
            WriteJson(stagingDir, "finalize-timings.json", timings, hashes);

            var counts = new Dictionary<string, int>
            {
                ["item"] = rows.Count,
                ["stat-type"] = statTypeRows.Count,
                ["spell"] = spellRows.Count,
                ["character"] = characterRows.Count,
                ["status-effect"] = statusEffectRows.Count,
                ["item-category"] = itemCategoryRows.Count,
                ["item-tag"] = itemTagRows.Count,
                ["location"] = locationRows.Count,
                ["portal"] = portalRows.Count,
                ["faction"] = factionRows.Count,
                ["npc"] = npcRows.Count,
            };
            var manifest = ManifestBuilder.Build(
                preflight,
                counts: counts,
                diagnostics: diagnosticTotals,
                contentHashes: hashes,
                extractorVersion: Plugin.Version,
                gameVersion: run.GameVersion,
                buildIdentifier: run.RunId
            );
            phaseStopwatch.Restart();
            var manifestJson = JsonConvert.SerializeObject(manifest, JsonSettings.Default);
            AtomicFile.WriteAllText(Path.Combine(stagingDir, "manifest.json"), manifestJson);
            var manifestHash = ManifestBuilder.Sha256Hex(manifestJson);
            RecordTiming(timings, "manifest.write", phaseStopwatch, totalStopwatch);

            phaseStopwatch.Restart();
            Directory.Move(stagingDir, publishedDir);
            RecordTiming(timings, "publish", phaseStopwatch, totalStopwatch);

            run.PublishedDir = publishedDir;
            run.State = "finalized";
            run.Counts["item"] = rows.Count;
            run.Counts["stat-type"] = statTypeRows.Count;
            run.Counts["spell"] = spellRows.Count;
            run.Counts["character"] = characterRows.Count;
            run.Counts["status-effect"] = statusEffectRows.Count;
            run.Counts["item-category"] = itemCategoryRows.Count;
            run.Counts["item-tag"] = itemTagRows.Count;
            run.Counts["location"] = locationRows.Count;
            run.Counts["portal"] = portalRows.Count;
            run.Counts["faction"] = factionRows.Count;
            phaseStopwatch.Restart();
            _runs.Save(run);
            _runs.ReleaseFinalized(run.RunId);
            _items.Evict(run);
            _statTypes.Evict(run);
            _spells.Evict(run);
            _characters.Evict(run);
            _statusEffects.Evict(run);
            _itemCategories.Evict(run);
            _itemTags.Evict(run);
            _locations.Evict(run);
            _portals.Evict(run);
            _factions.Evict(run);
            RecordTiming(timings, "run.save", phaseStopwatch, totalStopwatch);

            var manifestPath = Path.Combine(publishedDir, "manifest.json");
            var result = new RunFinalizeResult
            {
                RunId = run.RunId,
                PublishedDir = publishedDir,
                ManifestPath = manifestPath,
                Timings = timings,
            };
            var artifacts = new Dictionary<string, ArtifactRef>(StringComparer.Ordinal)
            {
                ["manifest"] = CompendiumCommandResults.FileArtifact("manifest", manifestPath, "application/json", manifestHash),
                ["items"] = CompendiumCommandResults.FileArtifact("items", Path.Combine(publishedDir, "items.json"), "application/json", hashes["items.json"]),
                ["asset-manifest"] = CompendiumCommandResults.FileArtifact("asset-manifest", Path.Combine(publishedDir, "asset-manifest.json"), "application/json", hashes["asset-manifest.json"]),
                ["master-tooltip"] = CompendiumCommandResults.FileArtifact("master-tooltip", Path.Combine(publishedDir, "master-tooltip.json"), "application/json", hashes["master-tooltip.json"]),
                ["stat-types"] = CompendiumCommandResults.FileArtifact("stat-types", Path.Combine(publishedDir, "stat-types.json"), "application/json", hashes["stat-types.json"]),
                ["spells"] = CompendiumCommandResults.FileArtifact("spells", Path.Combine(publishedDir, "spells.json"), "application/json", hashes["spells.json"]),
                ["status-effects"] = CompendiumCommandResults.FileArtifact("status-effects", Path.Combine(publishedDir, "status-effects.json"), "application/json", hashes["status-effects.json"]),
                ["item-categories"] = CompendiumCommandResults.FileArtifact("item-categories", Path.Combine(publishedDir, "item-categories.json"), "application/json", hashes["item-categories.json"]),
                ["item-tags"] = CompendiumCommandResults.FileArtifact("item-tags", Path.Combine(publishedDir, "item-tags.json"), "application/json", hashes["item-tags.json"]),
                ["locations"] = CompendiumCommandResults.FileArtifact("locations", Path.Combine(publishedDir, "locations.json"), "application/json", hashes["locations.json"]),
                ["portals"] = CompendiumCommandResults.FileArtifact("portals", Path.Combine(publishedDir, "portals.json"), "application/json", hashes["portals.json"]),
                ["factions"] = CompendiumCommandResults.FileArtifact("factions", Path.Combine(publishedDir, "factions.json"), "application/json", hashes["factions.json"]),
                ["finalize-timings"] = CompendiumCommandResults.FileArtifact("finalize-timings", Path.Combine(publishedDir, "finalize-timings.json"), "application/json", hashes["finalize-timings.json"]),
            };
            if (hashes.TryGetValue("diagnostics.json", out var diagnosticsHash))
            {
                artifacts["diagnostics"] = CompendiumCommandResults.FileArtifact(
                    "diagnostics",
                    Path.Combine(publishedDir, "diagnostics.json"),
                    "application/json",
                    diagnosticsHash
                );
            }

            return new(ControlCommandResult.Ok(result, artifacts));
        }
        catch
        {
            if (Directory.Exists(stagingDir)) Directory.Delete(stagingDir, recursive: true);
            throw;
        }
    }

    private static ControlCommandResult<RunFinalizeResult>? ReadPlannedItemChunks(
        ControlCommandContext<RunFinalizeResult> context,
        CompendiumRun run,
        string chunksDir,
        out List<ItemSnapshotRow> rows,
        out DiagnosticTotals diagnosticTotals,
        out List<JObject> diagnostics
    )
    {
        rows = new List<ItemSnapshotRow>();
        diagnosticTotals = new DiagnosticTotals();
        diagnostics = new List<JObject>();

        if (!run.TryGetEntityPlan("item", out var plan))
            return CompendiumCommandResults.Precondition(
                context,
                "planMissing",
                $"Run '{run.RunId}' does not have an item plan."
            );
        if (plan.BatchSize <= 0)
            return CompendiumCommandResults.Precondition(
                context,
                "planInvalid",
                "Item plan batchSize must be greater than zero."
            );
        if (!Directory.Exists(chunksDir))
            return CompendiumCommandResults.Precondition(
                context,
                "chunksMissing",
                "No item chunks were exported."
            );

        var expectedOffsets = plan.ExpectedOffsets().ToList();
        var missingOffsets = expectedOffsets
            .Where(offset => !plan.IsComplete(offset) || !File.Exists(ChunkPath(chunksDir, offset)))
            .ToList();
        if (missingOffsets.Count > 0)
            return CompendiumCommandResults.Precondition(
                context,
                "chunksIncomplete",
                $"Missing item chunks at offsets: {string.Join(", ", missingOffsets)}.",
                new JObject { ["missingOffsets"] = JArray.FromObject(missingOffsets) }
            );

        foreach (var offset in expectedOffsets)
        {
            var chunkPath = ChunkPath(chunksDir, offset);
            var json = File.ReadAllText(chunkPath);
            var envelope = JsonConvert.DeserializeObject<ItemSnapshotEnvelope>(json, JsonSettings.Default);
            if (envelope?.Rows == null)
                return CompendiumCommandResults.Precondition(
                    context,
                    "chunkInvalid",
                    $"Item chunk is invalid: {chunkPath}"
                );

            var expectedWritten = Math.Min(plan.BatchSize, plan.Total - offset);
            if (envelope.Rows.Count != expectedWritten)
                return CompendiumCommandResults.Precondition(
                    context,
                    "chunkRowCountMismatch",
                    $"Item chunk at offset {offset} contains {envelope.Rows.Count} rows; expected {expectedWritten}."
                );

            foreach (var row in envelope.Rows)
            {
                rows.Add(row);
                foreach (var diagnostic in row.Diagnostics)
                {
                    AddDiagnostic(diagnosticTotals, diagnostics, row.Id, diagnostic);
                }
            }
        }

        if (rows.Count != plan.Total)
            return CompendiumCommandResults.Precondition(
                context,
                "chunkRowCountMismatch",
                $"Item chunks contain {rows.Count} rows; expected {plan.Total}."
            );

        return null;
    }

    private static string ChunkPath(string chunksDir, int offset) =>
        Path.Combine(chunksDir, $"{offset:D6}.json");

    private static void WriteJson(string dir, string fileName, object value, IDictionary<string, string> hashes)
    {
        var json = JsonConvert.SerializeObject(value, JsonSettings.Default);
        AtomicFile.WriteAllText(Path.Combine(dir, fileName), json);
        hashes[fileName] = ManifestBuilder.Sha256Hex(json);
    }

    private static void RecordTiming(
        ICollection<RunFinalizeTiming> timings,
        string phase,
        Stopwatch phaseStopwatch,
        Stopwatch totalStopwatch
    )
    {
        phaseStopwatch.Stop();
        timings.Add(new RunFinalizeTiming
        {
            Phase = phase,
            ElapsedMs = phaseStopwatch.ElapsedMilliseconds,
            TotalElapsedMs = totalStopwatch.ElapsedMilliseconds,
        });
    }

    private static void AddDiagnostic(
        DiagnosticTotals totals,
        List<JObject> sink,
        string? rowId,
        Diagnostic diagnostic
    )
    {
        if (string.Equals(diagnostic.Severity, "fatal", StringComparison.Ordinal)) totals.Fatal++;
        else totals.Diagnostic++;

        sink.Add(
            new JObject
            {
                ["rowId"] = rowId is null ? JValue.CreateNull() : rowId,
                ["severity"] = diagnostic.Severity,
                ["code"] = diagnostic.Code,
                ["field"] = diagnostic.Field,
                ["message"] = diagnostic.Message,
            }
        );
    }
}
