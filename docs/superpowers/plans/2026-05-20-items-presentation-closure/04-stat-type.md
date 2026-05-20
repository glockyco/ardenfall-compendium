[← Previous phase](03-entity-scaffolding.md) · [Next phase →](05-item-category.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 4: `stat-type` entity

**Spec coverage:** §3.2, §6.1, §6.3, §6.4.

**Why fourth:** `StatType` is the smallest of the new entities, has zero outbound deps, and is referenced by items / spells / enchantments / status-effects. Landing it first proves the new-entity assembly line end-to-end (mod → snapshot → canonical → read-model → site) and gives every later phase a real `stat-type` to link to. This phase is the **canonical "small-entity template"**: Phases 5, 6, and 13 instantiate the same shape with different inputs.

**Outcome:** every `StatType` asset in the live snapshot is exported with `id`, `isAttribute`, `statName`, `iconRef`, `iconColor`, `statDescription`, `longStatDescription`, `affects`, `skillAffects`; the pipeline canonicalises into `stat_types` + read-model + `entity_nodes`; static `/stats` overview and `/stats/<slug>--<id8>` detail pages render; the grouping (`attribute` / `skill` / `trait`) is derived from `ArdenfallMasterData.allAttributes / allSkills / allTraits`.

## The small-entity template

The seven new entities (`stat-type`, `item-category`, `item-tag`, `status-effect`, `spell`, `enchantment`, `potion-recipe`) all follow this assembly line. Phases 4, 5, 6, 13 use this template verbatim. Phases 10, 11, 12 extend it with composer-port work (see Phase 10's "composer-entity template").

The template has eight task slots:

1. **Mod DTO** — `<Entity>Snapshot.cs` record with all asset fields the pipeline will receive.
2. **Mod extractor** — `<Entity>Extractor.cs` walks `BuiltLookupTable.GetAssetsOfType<TAsset>()`, emits rows.
3. **Mod walker registration** — register the extractor in the snapshot-emission orchestrator so the entity ships with every extraction run.
4. **Pipeline descriptor + snapshot schema** — `entities/<entity>/entity.json` + envelope validation.
5. **Pipeline canonicaliser** — `canonicalise-<entity>s.ts` stage writes the canonical table.
6. **Pipeline read-model** — `emit-read-models.ts` extension writes overview + presentation rows; populates `entity_nodes` with slug + short_id.
7. **Fixture rows** — `fixtures/synthetic/snapshot/<entity>s.json` (+ hash refresh in fixture manifest).
8. **Site overview + detail pages** — `/<plural>` + `/<plural>/[slug]` SvelteKit routes.

Each task in this phase corresponds to one slot.

## Phase 4 inputs

| Template parameter          | Phase 4 value                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------ |
| Entity id                   | `stat-type`                                                                                      |
| Plural id                   | `stat-types`                                                                                     |
| Asset C# type               | `Ardenfall.StatType`                                                                             |
| Asset GUID source           | `BuiltLookupTable.GetGuid(asset)`                                                                |
| Mod namespace               | `ArdenfallCompendium.Entities.StatType`                                                          |
| Adapter file                | `mod/src/Entities/StatType/StatTypeExtractor.cs`                                                 |
| Snapshot DTO file           | `mod/src/Entities/StatType/StatTypeSnapshot.cs`                                                  |
| Snapshot envelope           | `fixtures/synthetic/snapshot/stat-types.json`                                                    |
| Pipeline canonical table    | `stat_types`                                                                                     |
| Pipeline overview table     | `stat_type_overview_rows`                                                                        |
| Pipeline presentation table | `stat_type_presentation_rows`                                                                    |
| Render context              | `stat-type-presentation-v1`                                                                      |
| Site overview route         | `/stats`                                                                                         |
| Site detail route           | `/stats/[slug]`                                                                                  |
| Plural breadcrumb           | `Stats`                                                                                          |
| Singular breadcrumb         | `Stat`                                                                                           |
| Slug source                 | `statName`                                                                                       |
| Grouping rule               | `attribute` if `isAttribute` else (`skill` if id ∈ `ArdenfallMasterData.allSkills` else `trait`) |

## Tasks

### Task 4.1: Mod DTO — `StatTypeSnapshot`

**Files:**

- Create: `mod/src/Entities/StatType/StatTypeSnapshot.cs`
- Test: `mod-tests/StatTypeSnapshotTests.cs`

- [ ] **Step 1: Write the failing test**

```cs
// mod-tests/StatTypeSnapshotTests.cs
using ArdenfallCompendium.Entities.StatType;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class StatTypeSnapshotTests
{
    [Fact]
    public void RecordCarriesAllAssetFields()
    {
        var snapshot = new StatTypeSnapshot(
            Id: "stat-strength",
            IsAttribute: true,
            StatName: "Strength",
            IconRef: null,
            IconColor: null,
            StatDescription: "Raw physical power.",
            LongStatDescription: "Raw physical power. Affects melee damage and carry weight.",
            Affects: new() { "melee-damage" },
            SkillAffects: new() { "heavy-armor", "blade" });

        Assert.Equal("stat-strength", snapshot.Id);
        Assert.True(snapshot.IsAttribute);
        Assert.Equal("Strength", snapshot.StatName);
        Assert.Contains("melee-damage", snapshot.Affects);
    }
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter StatTypeSnapshotTests`
Expected: FAIL — `StatTypeSnapshot` does not exist.

- [ ] **Step 3: Implement the DTO**

```cs
// mod/src/Entities/StatType/StatTypeSnapshot.cs
using System.Collections.Generic;
using ArdenfallCompendium.Assets;
using Newtonsoft.Json;

namespace ArdenfallCompendium.Entities.StatType;

public sealed record StatTypeSnapshot(
    [property: JsonProperty("id")] string Id,
    [property: JsonProperty("isAttribute")] bool IsAttribute,
    [property: JsonProperty("statName")] string StatName,
    [property: JsonProperty("iconRef")] object? IconRef,
    [property: JsonProperty("iconColor")] AssetColorSnapshot? IconColor,
    [property: JsonProperty("statDescription")] string? StatDescription,
    [property: JsonProperty("longStatDescription")] string? LongStatDescription,
    [property: JsonProperty("affects")] List<string> Affects,
    [property: JsonProperty("skillAffects")] List<string> SkillAffects);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter StatTypeSnapshotTests`
Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add mod/src/Entities/StatType/StatTypeSnapshot.cs mod-tests/StatTypeSnapshotTests.cs
git commit -m "feat(mod): add stat-type snapshot DTO"
```

### Task 4.2: Mod extractor — `StatTypeExtractor`

**Files:**

- Create: `mod/src/Entities/StatType/StatTypeExtractor.cs`
- Test: `mod-tests/StatTypeExtractorTests.cs`

- [ ] **Step 1: Write the failing test**

```cs
// mod-tests/StatTypeExtractorTests.cs
using System.Collections.Generic;
using System.Linq;
using ArdenfallCompendium.Entities.StatType;
using Xunit;

namespace ArdenfallCompendium.Tests;

public sealed class StatTypeExtractorTests
{
    [Fact]
    public void ExtractsEveryStatTypeWithGuidAndName()
    {
        var source = new FakeStatTypeAssetSource(new[]
        {
            FakeStatTypeAssetSource.Build("stat-strength", "Strength", isAttribute: true, "Raw power.", "Raw power. ..."),
            FakeStatTypeAssetSource.Build("skill-blade", "Blade", isAttribute: false, "Blade skill.", "Blade skill. ..."),
        });
        var extractor = new StatTypeExtractor(source);
        var rows = extractor.Walk().ToList();
        Assert.Equal(2, rows.Count);
        Assert.Equal("stat-strength", rows[0].Id);
        Assert.Equal("Strength", rows[0].StatName);
        Assert.True(rows[0].IsAttribute);
        Assert.False(rows[1].IsAttribute);
    }

    [Fact]
    public void DiagnosesAssetMissingGuid()
    {
        var source = new FakeStatTypeAssetSource(new[]
        {
            FakeStatTypeAssetSource.BuildWithoutGuid("Floating Stat"),
        });
        var extractor = new StatTypeExtractor(source);
        var rows = extractor.Walk().ToList();
        Assert.Empty(rows);
        Assert.Contains(extractor.Diagnostics,
            d => d.Code == "lookupAssetGuidMissing" && d.Field == "id");
    }
}
```

Implement `FakeStatTypeAssetSource` next to the tests with the same interface shape as `IItemAssetSource` (a small abstraction that the extractor consumes). The fake must return either real `StatType` instances or stand-ins with the necessary properties.

- [ ] **Step 2: Run the test to verify it fails**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter StatTypeExtractorTests`
Expected: FAIL — types do not exist.

- [ ] **Step 3: Implement the asset-source abstraction**

```cs
// mod/src/Entities/StatType/IStatTypeAssetSource.cs
using System.Collections.Generic;
using Ardenfall;

namespace ArdenfallCompendium.Entities.StatType;

public interface IStatTypeAssetSource
{
    IEnumerable<StatType> EnumerateStatTypes();
}

public sealed class BuiltLookupTableStatTypeAssetSource : IStatTypeAssetSource
{
    public IEnumerable<StatType> EnumerateStatTypes()
    {
        var lookup = BuiltLookupTable.Instance;
        if (lookup == null) yield break;
        foreach (var asset in lookup.GetAssetsOfType<StatType>())
        {
            if (asset != null) yield return asset;
        }
    }
}
```

- [ ] **Step 4: Implement the extractor**

```cs
// mod/src/Entities/StatType/StatTypeExtractor.cs
using System.Collections.Generic;
using System.Linq;
using Ardenfall;
using ArdenfallCompendium.Assets;
using ArdenfallCompendium.Dtos;
using ArdenfallCompendium.Walker;

namespace ArdenfallCompendium.Entities.StatType;

public sealed class StatTypeExtractor : WalkerBase<StatTypeSnapshot>
{
    private readonly IStatTypeAssetSource _source;

    public StatTypeExtractor() : this(new BuiltLookupTableStatTypeAssetSource()) { }

    public StatTypeExtractor(IStatTypeAssetSource source)
    {
        _source = source;
    }

    public override IEnumerable<StatTypeSnapshot> Walk()
    {
        var lookup = BuiltLookupTable.Instance;
        foreach (var asset in _source.EnumerateStatTypes())
        {
            if (!MarkVisited(asset)) continue;
            if (lookup == null) yield break;
            var guid = lookup.GetGuid(asset);
            if (guid is null || guid.Length == 0)
            {
                Diagnostics.Add(new Diagnostic
                {
                    Severity = "fatal",
                    Code = "lookupAssetGuidMissing",
                    Field = "id",
                    Message = $"StatType asset '{asset.name}' has no GUID in BuiltLookupTable",
                });
                continue;
            }
            yield return new StatTypeSnapshot(
                Id: guid,
                IsAttribute: asset.isAttribute,
                StatName: asset.statName ?? asset.name ?? guid,
                IconRef: Refs.ResolveAsset(asset.icon, "iconRef", guid, MissingPolicy.Diagnostic, "StatType.icon"),
                IconColor: AssetColorSnapshot.FromColor(asset.iconColor),
                StatDescription: NullIfEmpty(asset.statDescription),
                LongStatDescription: NullIfEmpty(asset.longStatDescription),
                Affects: asset.affects?.ToList() ?? new List<string>(),
                SkillAffects: asset.skillAffects?.ToList() ?? new List<string>());
        }

        Diagnostics.AddRange(Refs.Diagnostics);
        Refs.Diagnostics.Clear();
    }

    private static string? NullIfEmpty(string? s) =>
        string.IsNullOrWhiteSpace(s) ? null : s;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj --filter StatTypeExtractorTests`
Expected: PASS (both cases).

- [ ] **Step 6: Commit**

```sh
git add mod/src/Entities/StatType/IStatTypeAssetSource.cs mod/src/Entities/StatType/StatTypeExtractor.cs mod-tests/StatTypeExtractorTests.cs mod-tests/FakeStatTypeAssetSource.cs
git commit -m "feat(mod): extract stat-type snapshots"
```

### Task 4.3: Mod walker registration

**Files:**

- Modify: `mod/src/Entities/Snapshot/SnapshotEmitter.cs` (or wherever entity walkers are orchestrated — search for `ItemExtractor` callsites in the mod and find the registration point; likely `ExtractionService.cs` or similar)
- Modify: `mod-tests/ExtractionServiceTests.cs` (or wherever extraction-orchestration tests live)

- [ ] **Step 1: Locate the orchestrator**

Run: `bun run search -- 'new ItemExtractor()' mod/src/`
Identify the file that constructs entity extractors. Read it; find the pattern.

- [ ] **Step 2: Write the failing test**

Extend the existing extraction-service test (or create a new one alongside) asserting that `Run()` produces a `stat-types.json` artifact alongside `items.json` and `master-tooltip.json`.

```cs
[Fact]
public void EmitsStatTypeArtifact()
{
    var service = new ItemExtractionService(/* dependencies */);
    var output = service.Run(/* synthetic asset graph */);
    Assert.Contains("stat-types", output.Artifacts.Select(a => a.EntityId));
}
```

- [ ] **Step 3: Register the extractor**

Add a `StatTypeExtractor` to the walker collection, with `entityId = "stat-types"` so the artifact file lands as `stat-types.json`.

- [ ] **Step 4: Run the tests**

Run: `dotnet test mod-tests/ArdenfallCompendium.Tests.csproj`
Expected: PASS, including the new stat-type emission case.

- [ ] **Step 5: Commit**

```sh
git add mod/src/Entities/Snapshot/SnapshotEmitter.cs mod-tests/ExtractionServiceTests.cs
git commit -m "feat(mod): emit stat-type artifact alongside items"
```

### Task 4.4: Pipeline descriptor

**Files:**

- Create: `entities/stat-type/entity.json`

- [ ] **Step 1: Write the descriptor**

```json
{
  "$schema": "../../schemas/entity.schema.json",
  "id": "stat-type",
  "singularLabel": "Stat",
  "pluralLabel": "Stats",
  "routePath": "/stats",
  "canonicalTable": "stat_types",
  "presentationContext": { "renderContext": "stat-type-presentation-v1" },
  "fields": [
    { "name": "id", "type": "string", "from": "id", "missingPolicy": "fatal" },
    { "name": "isAttribute", "type": "bool", "from": "isAttribute", "missingPolicy": "fatal" },
    { "name": "statName", "type": "string", "from": "statName", "missingPolicy": "fatal" },
    { "name": "iconRef", "type": "ref:asset", "from": "iconRef", "missingPolicy": "diagnostic" },
    { "name": "iconColor", "type": "json", "from": "iconColor", "missingPolicy": "diagnostic" },
    {
      "name": "statDescription",
      "type": "string",
      "from": "statDescription",
      "missingPolicy": "diagnostic"
    },
    {
      "name": "longStatDescription",
      "type": "string",
      "from": "longStatDescription",
      "missingPolicy": "diagnostic"
    },
    { "name": "affects", "type": "json", "from": "affects", "missingPolicy": "optional-empty" },
    {
      "name": "skillAffects",
      "type": "json",
      "from": "skillAffects",
      "missingPolicy": "optional-empty"
    }
  ]
}
```

- [ ] **Step 2: Run the descriptor loader test**

Run: `bun test pipeline/test/load-descriptors.test.ts`
Expected: PASS — the new descriptor is picked up.

- [ ] **Step 3: Commit**

```sh
git add entities/stat-type/entity.json
git commit -m "feat(pipeline): add stat-type entity descriptor"
```

### Task 4.5: Pipeline canonicaliser

**Files:**

- Create: `pipeline/src/entities/stat-type/canonicaliser.ts`
- Create: `pipeline/test/stat-type-canonicaliser.test.ts`
- Modify: `pipeline/src/sql/ddl.ts` to add `stat_types` table DDL emission
- Modify: `pipeline/src/stages/emit-sqlite.ts` to invoke the new canonicaliser

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/stat-type-canonicaliser.test.ts
import { describe, expect, it } from "bun:test";
import { Database } from "bun:sqlite";
import { canonicaliseStatTypes } from "$pipeline/entities/stat-type/canonicaliser";
import { STAT_TYPE_DDL } from "$pipeline/sql/stat-type-ddl";

describe("canonicaliseStatTypes", () => {
  it("inserts one row per snapshot row", () => {
    const db = new Database(":memory:");
    db.exec(STAT_TYPE_DDL);
    canonicaliseStatTypes(db, {
      entityId: "stat-type",
      schemaVersion: 1,
      rows: [
        {
          id: "stat-strength",
          isAttribute: true,
          statName: "Strength",
          iconRef: null,
          iconColor: { r: 1, g: 0.6, b: 0.2, a: 1 },
          statDescription: "Raw power.",
          longStatDescription: "Raw power. Affects melee damage and carry weight.",
          affects: ["melee-damage"],
          skillAffects: ["heavy-armor", "blade"],
        },
      ],
      diagnostics: [],
    });
    const row = db
      .query<
        { id: string; is_attribute: number; stat_name: string },
        []
      >("SELECT id, is_attribute, stat_name FROM stat_types")
      .get();
    expect(row?.id).toBe("stat-strength");
    expect(row?.is_attribute).toBe(1);
    expect(row?.stat_name).toBe("Strength");
  });
});
```

- [ ] **Step 2: Implement the DDL module**

```ts
// pipeline/src/sql/stat-type-ddl.ts
export const STAT_TYPE_DDL = `
CREATE TABLE stat_types (
  id                    TEXT PRIMARY KEY,
  is_attribute          INTEGER NOT NULL,
  stat_name             TEXT NOT NULL,
  icon_hash             TEXT,
  icon_color_json       TEXT,
  stat_description      TEXT,
  long_stat_description TEXT,
  affects_json          TEXT NOT NULL DEFAULT '[]',
  skill_affects_json    TEXT NOT NULL DEFAULT '[]'
);
`;
```

- [ ] **Step 3: Implement the canonicaliser**

```ts
// pipeline/src/entities/stat-type/canonicaliser.ts
import type { Database } from "bun:sqlite";
import type { SnapshotEnvelope } from "../../types.ts";

interface StatTypeRow {
  id: string;
  isAttribute: boolean;
  statName: string;
  iconRef: { hash?: string } | null;
  iconColor: { r: number; g: number; b: number; a: number } | null;
  statDescription: string | null;
  longStatDescription: string | null;
  affects: string[];
  skillAffects: string[];
}

export function canonicaliseStatTypes(db: Database, envelope: SnapshotEnvelope): void {
  const insert = db.prepare(
    `INSERT INTO stat_types (
       id, is_attribute, stat_name, icon_hash, icon_color_json,
       stat_description, long_stat_description, affects_json, skill_affects_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const tx = db.transaction(() => {
    for (const row of envelope.rows as StatTypeRow[]) {
      const iconHash =
        row.iconRef && typeof row.iconRef === "object" ? (row.iconRef.hash ?? null) : null;
      insert.run(
        row.id,
        row.isAttribute ? 1 : 0,
        row.statName,
        iconHash,
        row.iconColor ? JSON.stringify(row.iconColor) : null,
        row.statDescription,
        row.longStatDescription,
        JSON.stringify(row.affects ?? []),
        JSON.stringify(row.skillAffects ?? []),
      );
    }
  });
  tx();
}
```

- [ ] **Step 4: Wire into `emit-sqlite.ts`**

Inside the existing `emitSqlite` stage, after `canonicaliseItems`, add:

```ts
const statTypeEnvelope = inputs["load-snapshot"].envelopes["stat-type"];
if (statTypeEnvelope) {
  db.exec(STAT_TYPE_DDL);
  canonicaliseStatTypes(db, statTypeEnvelope);
}
```

Import the new module and the DDL constant. The conditional is intentional — early-phase fixtures may not carry the envelope yet, but Phase 4 ships the fixture, so the import is permanent.

- [ ] **Step 5: Run the tests**

Run: `bun test pipeline/test/stat-type-canonicaliser.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add pipeline/src/sql/stat-type-ddl.ts pipeline/src/entities/stat-type/canonicaliser.ts pipeline/src/stages/emit-sqlite.ts pipeline/test/stat-type-canonicaliser.test.ts
git commit -m "feat(pipeline): canonicalise stat-type snapshots"
```

### Task 4.6: Pipeline read-model + `entity_nodes` population

**Files:**

- Modify: `pipeline/src/stages/emit-read-models.ts` (extend with `emitStatTypeReadModels` + `entity_nodes` rows + edges to terms if any)
- Modify: `pipeline/test/read-models.test.ts` (assert the new rows)
- Modify: `pipeline/src/artifacts/manifest.ts` (count `stat_type_overview_rows`)

- [ ] **Step 1: Write the failing test**

In `pipeline/test/read-models.test.ts`, append:

```ts
it("emits stat_type_overview_rows + stat_type_presentation_rows + entity_nodes for stat-types", async () => {
  // Set up the DB the same way the existing test does (loadDescriptors + canonicaliseItems + canonicaliseStatTypes + emitSiteMetadata + emitItemReadModels + emitStatTypeReadModels).
  // Assert:
  //   - stat_type_overview_rows has exactly N rows (matching the fixture).
  //   - stat_type_presentation_rows has exactly N rows with render_context = 'stat-type-presentation-v1'.
  //   - entity_nodes has one row per stat-type with the canonical slug and short_id.
  //   - The canonical_slug shape is `<kebab-statName>--<id8>`.
});
```

(Fill in the concrete fixture-row count after Task 4.7 adds the fixture.)

- [ ] **Step 2: Implement `emitStatTypeReadModels`**

```ts
// pipeline/src/stages/emit-read-models.ts (append)
import { deriveSlug, deriveShortId } from "../slug/derive-slug.ts";

export const STAT_TYPE_READ_MODEL_DDL = `
CREATE TABLE stat_type_overview_rows (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  grouping      TEXT NOT NULL,
  icon_hash     TEXT,
  icon_color    TEXT
);
CREATE TABLE stat_type_presentation_rows (
  id                          TEXT PRIMARY KEY,
  name                        TEXT NOT NULL,
  grouping                    TEXT NOT NULL,
  render_context              TEXT NOT NULL,
  icon_hash                   TEXT,
  icon_color                  TEXT,
  description                 TEXT,
  long_description            TEXT,
  affects_json                TEXT NOT NULL DEFAULT '[]',
  skill_affects_json          TEXT NOT NULL DEFAULT '[]'
);
`;

export function emitStatTypeReadModels(
  db: Database,
  vocabularyAllAttributes: string[],
  vocabularyAllSkills: string[],
): void {
  db.exec(STAT_TYPE_READ_MODEL_DDL);
  const overviewInsert = db.prepare(
    `INSERT INTO stat_type_overview_rows (id, name, grouping, icon_hash, icon_color) VALUES (?, ?, ?, ?, ?)`,
  );
  const presInsert = db.prepare(
    `INSERT INTO stat_type_presentation_rows (
      id, name, grouping, render_context, icon_hash, icon_color,
      description, long_description, affects_json, skill_affects_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const nodeInsert = db.prepare(
    `INSERT OR IGNORE INTO entity_nodes
       (entity_type, entity_id, label, route_path, canonical_slug, short_id, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  const grouping = (row: { id: string; is_attribute: number }) =>
    row.is_attribute === 1
      ? "attribute"
      : vocabularyAllSkills.includes(row.id)
        ? "skill"
        : vocabularyAllAttributes.includes(row.id)
          ? "attribute"
          : "trait";

  const tx = db.transaction(() => {
    const rows = db
      .query<
        {
          id: string;
          is_attribute: number;
          stat_name: string;
          icon_hash: string | null;
          icon_color_json: string | null;
          stat_description: string | null;
          long_stat_description: string | null;
          affects_json: string;
          skill_affects_json: string;
        },
        []
      >("SELECT * FROM stat_types ORDER BY stat_name")
      .all();
    for (const row of rows) {
      const group = grouping(row);
      overviewInsert.run(row.id, row.stat_name, group, row.icon_hash, row.icon_color_json);
      presInsert.run(
        row.id,
        row.stat_name,
        group,
        "stat-type-presentation-v1",
        row.icon_hash,
        row.icon_color_json,
        row.stat_description,
        row.long_stat_description,
        row.affects_json,
        row.skill_affects_json,
      );
      const slug = deriveSlug({ displayName: row.stat_name, assetId: row.id });
      const shortId = deriveShortId(row.id);
      nodeInsert.run("stat-type", row.id, row.stat_name, `/stats/${slug}`, slug, shortId, 1);
    }
  });
  tx();
}
```

- [ ] **Step 3: Wire `emitStatTypeReadModels` into `emit-sqlite.ts`**

After `emitItemReadModels`, invoke the new function with the master-tooltip vocabulary's `allAttributes` / `allSkills` lists (loaded in Phase 1).

(If the Phase 1 `MasterTooltipVocabulary` does NOT yet carry `allAttributes` / `allSkills`, extend the snapshot DTO + schema + extractor here — these two arrays were not in the Phase 1 scope. Add them as additional fields under §4.2 of the spec; the schema admits `allAttributes: string[]`, `allSkills: string[]`. The mod populates them from `ArdenfallMasterData.allAttributes.Select(s => guid(s)).ToList()` and `allSkills` likewise.)

- [ ] **Step 4: Manifest counts**

Extend `pipeline/src/artifacts/manifest.ts` `counts` block with `statTypeOverviewRows: countRows(sqlitePath, 'stat_type_overview_rows')` and `statTypePresentationRows`. Update the artifact-manifest schema if it constrains keys; if it's `additionalProperties: { type: integer }` no change is needed.

- [ ] **Step 5: Run the tests**

Run: `bun test pipeline/test/read-models.test.ts pipeline/test/artifact-manifest.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add pipeline/src/stages/emit-read-models.ts pipeline/src/stages/emit-sqlite.ts pipeline/src/artifacts/manifest.ts pipeline/test/read-models.test.ts pipeline/test/artifact-manifest.test.ts
git commit -m "feat(pipeline): emit stat-type read models"
```

### Task 4.7: Fixture rows

**Files:**

- Create: `fixtures/synthetic/snapshot/stat-types.json`
- Modify: `fixtures/synthetic/snapshot/manifest.json` (hash entry)
- Modify: `fixtures/synthetic/manifest.json` (fixture-pack hash entry)

- [ ] **Step 1: Write the fixture**

```json
{
  "entityId": "stat-type",
  "schemaVersion": 1,
  "rows": [
    {
      "id": "fixture-strength",
      "isAttribute": true,
      "statName": "Strength",
      "iconRef": null,
      "iconColor": { "r": 0.95, "g": 0.45, "b": 0.2, "a": 1 },
      "statDescription": "Raw physical power.",
      "longStatDescription": "Raw physical power. Affects melee damage and carry weight.",
      "affects": ["melee-damage", "carry-weight"],
      "skillAffects": ["fixture-heavy-armor"]
    },
    {
      "id": "fixture-heavy-armor",
      "isAttribute": false,
      "statName": "Heavy Armor",
      "iconRef": null,
      "iconColor": { "r": 0.6, "g": 0.6, "b": 0.65, "a": 1 },
      "statDescription": "Tolerance for wearing heavy armor.",
      "longStatDescription": "Tolerance for wearing heavy armor.",
      "affects": ["damage-threshold"],
      "skillAffects": []
    }
  ],
  "diagnostics": []
}
```

- [ ] **Step 2: Refresh fixture hashes**

```py
# inline pipeline/scripts/refresh-fixture-hashes.ts can do this; or run the snippet:
import json, hashlib, pathlib
root = pathlib.Path("fixtures/synthetic/snapshot")
snap = json.loads((root / "manifest.json").read_text())
for rel in ("items.json", "asset-manifest.json", "master-tooltip.json", "stat-types.json"):
    p = root / rel
    if p.exists():
        snap.setdefault("hashes", {})[rel] = hashlib.sha256(p.read_bytes()).hexdigest()
(root / "manifest.json").write_text(json.dumps(snap, indent=2) + "\n")
# repeat for fixtures/synthetic/manifest.json with relative paths
```

Or, if the project has a CLI helper for this (search for `refresh-fixture-hashes`), use it.

- [ ] **Step 3: Run check:fixtures**

Run: `bun run check:fixtures`
Expected: PASS.

- [ ] **Step 4: Commit**

```sh
git add fixtures/synthetic/snapshot/stat-types.json fixtures/synthetic/snapshot/manifest.json fixtures/synthetic/manifest.json
git commit -m "test(pipeline): add stat-type fixture rows"
```

### Task 4.8: Site overview + detail routes

**Files:**

- Create: `site/src/routes/stats/+page.server.ts`
- Create: `site/src/routes/stats/+page.svelte`
- Create: `site/src/routes/stats/[slug]/+page.server.ts`
- Create: `site/src/routes/stats/[slug]/+page.svelte`
- Modify: `site/src/lib/server/read-models.ts` (add `listStatTypes()`, `getStatTypeBySlug(slug)`)
- Create: `site/src/lib/components/stats/StatTypeOverview.svelte`
- Create: `site/src/lib/components/stats/StatTypeDetail.svelte`

- [ ] **Step 1: Add read-model accessors**

```ts
// site/src/lib/server/read-models.ts (append)
export interface StatTypeOverviewRow {
  id: string;
  name: string;
  grouping: "attribute" | "skill" | "trait";
  iconSrc: string | null;
  iconColor: string | null;
  routePath: string;
}

export interface StatTypePresentationRow {
  id: string;
  name: string;
  grouping: "attribute" | "skill" | "trait";
  renderContext: "stat-type-presentation-v1";
  iconSrc: string | null;
  iconColor: string | null;
  description: string | null;
  longDescription: string | null;
  affects: string[];
  skillAffects: string[];
}

export const listStatTypes = (): StatTypeOverviewRow[] =>
  all<{
    id: string;
    name: string;
    grouping: "attribute" | "skill" | "trait";
    icon_hash: string | null;
    icon_color: string | null;
  }>(
    `SELECT o.id, o.name, o.grouping, o.icon_hash, o.icon_color
     FROM stat_type_overview_rows o ORDER BY o.grouping, o.name`,
  ).map((row) => {
    const node = getEntityNodeBySlugFallback("stat-type", row.id);
    return {
      id: row.id,
      name: row.name,
      grouping: row.grouping,
      iconSrc: assetSrc(row.icon_hash),
      iconColor: row.icon_color,
      routePath: node?.routePath ?? `/stats/${row.id}`,
    };
  });

export const getStatTypePresentation = (slug: string): StatTypePresentationRow | undefined => {
  const node = getEntityNodeBySlug("stat-type", slug);
  if (!node) return undefined;
  const row = get<{
    id: string;
    name: string;
    grouping: "attribute" | "skill" | "trait";
    render_context: "stat-type-presentation-v1";
    icon_hash: string | null;
    icon_color: string | null;
    description: string | null;
    long_description: string | null;
    affects_json: string;
    skill_affects_json: string;
  }>(`SELECT * FROM stat_type_presentation_rows WHERE id = ?`, [node.entityId]);
  if (!row) return undefined;
  return {
    id: row.id,
    name: row.name,
    grouping: row.grouping,
    renderContext: row.render_context,
    iconSrc: assetSrc(row.icon_hash),
    iconColor: row.icon_color,
    description: row.description,
    longDescription: row.long_description,
    affects: JSON.parse(row.affects_json) as string[],
    skillAffects: JSON.parse(row.skill_affects_json) as string[],
  };
};
```

Implement `getEntityNodeBySlugFallback` as a helper that first tries `getEntityNodeBySlug` and falls back to "no node yet" during initial fixture builds — items + stat-types come in different phases, so the fallback keeps test cycles fast.

- [ ] **Step 2: Implement the overview page**

```svelte
<!-- site/src/routes/stats/+page.server.ts -->
import { listStatTypes } from "$lib/server/read-models";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = () => ({
  stats: listStatTypes(),
});
```

```svelte
<!-- site/src/routes/stats/+page.svelte -->
<script lang="ts">
  import StatTypeOverview from "$lib/components/stats/StatTypeOverview.svelte";
  import type { PageProps } from "./$types";
  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>Stats | Ardenfall Compendium</title>
</svelte:head>

<h1 class="text-2xl font-bold">Stats</h1>
<StatTypeOverview rows={data.stats} />
```

```svelte
<!-- site/src/lib/components/stats/StatTypeOverview.svelte -->
<script lang="ts">
  import type { StatTypeOverviewRow } from "$lib/server/read-models";
  let { rows }: { rows: StatTypeOverviewRow[] } = $props();
  const groups = ["attribute", "skill", "trait"] as const;
</script>

{#each groups as group}
  {@const items = rows.filter((r) => r.grouping === group)}
  {#if items.length > 0}
    <section class="mt-6">
      <h2 class="text-xl font-semibold capitalize">{group}s</h2>
      <ul class="mt-2 grid gap-2 sm:grid-cols-2 md:grid-cols-3">
        {#each items as row (row.id)}
          <li class="border-border bg-card rounded-md border p-3">
            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- generated stat routes -->
            <a class="font-medium underline" href={row.routePath}>{row.name}</a>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
{/each}
```

- [ ] **Step 3: Implement the detail page**

```svelte
<!-- site/src/routes/stats/[slug]/+page.server.ts -->
import { error } from "@sveltejs/kit";
import { getStatTypePresentation, listStatTypes } from "$lib/server/read-models";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;
export const entries: EntryGenerator = () => listStatTypes().map((row) => ({
  slug: row.routePath.replace("/stats/", ""),
}));

export const load: PageServerLoad = ({ params }) => {
  const presentation = getStatTypePresentation(params.slug);
  if (!presentation) throw error(404, "Stat not found");
  return { presentation };
};
```

```svelte
<!-- site/src/routes/stats/[slug]/+page.svelte -->
<script lang="ts">
  import { resolve } from "$app/paths";
  import StatTypeDetail from "$lib/components/stats/StatTypeDetail.svelte";
  import type { PageProps } from "./$types";
  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{data.presentation.name} | Stats | Ardenfall Compendium</title>
</svelte:head>

<a class="text-sm underline" href={resolve("/stats")}>← back to stats</a>
<h1 class="mt-2 text-2xl font-bold">{data.presentation.name}</h1>
<StatTypeDetail presentation={data.presentation} />
```

```svelte
<!-- site/src/lib/components/stats/StatTypeDetail.svelte -->
<script lang="ts">
  import type { StatTypePresentationRow } from "$lib/server/read-models";
  let { presentation }: { presentation: StatTypePresentationRow } = $props();
</script>

<p class="text-muted-foreground mt-2 capitalize">{presentation.grouping}</p>

{#if presentation.description}
  <p class="mt-4">{presentation.description}</p>
{/if}

{#if presentation.longDescription && presentation.longDescription !== presentation.description}
  <p class="mt-4">{presentation.longDescription}</p>
{/if}

{#if presentation.affects.length > 0}
  <section class="mt-6">
    <h2 class="text-lg font-semibold">Affects</h2>
    <ul class="mt-2 list-disc pl-6">
      {#each presentation.affects as id}
        <li>{id}</li>
      {/each}
    </ul>
  </section>
{/if}

{#if presentation.skillAffects.length > 0}
  <section class="mt-6">
    <h2 class="text-lg font-semibold">Skill affects</h2>
    <ul class="mt-2 list-disc pl-6">
      {#each presentation.skillAffects as id}
        <li>{id}</li>
      {/each}
    </ul>
  </section>
{/if}
```

The `affects` / `skillAffects` lists today render raw ids; Phase 15 (graph rebuild) replaces them with proper entity links.

- [ ] **Step 4: Register components in the catalog**

Append the new components to `site/src/lib/components/COMPONENTS.json`:

```json
{ "id": "stats.StatTypeOverview", "path": "stats/StatTypeOverview.svelte", "layer": "stats" },
{ "id": "stats.StatTypeDetail", "path": "stats/StatTypeDetail.svelte", "layer": "stats" }
```

- [ ] **Step 5: Run site check**

Run: `bun run --cwd site check`
Expected: PASS (0 errors, 0 warnings).

- [ ] **Step 6: Build the fixture site**

Run: `bun run artifact:fixture synthetic fixtures/synthetic/snapshot && NODE_OPTIONS=--max-old-space-size=8192 bun run --cwd site build:fixture && bun run --cwd site smoke:prerender`
Expected: PASS. Confirm `.svelte-kit/cloudflare/stats/index.html` exists and contains "Strength".

- [ ] **Step 7: Commit**

```sh
git add site/src/routes/stats/ site/src/lib/components/stats/ site/src/lib/components/COMPONENTS.json site/src/lib/server/read-models.ts
git commit -m "feat(site): render stat-type pages"
```

### Task 4.9: Phase 4 verification gate

- [ ] Run the full phase gate (see "Verification gates" in the coordinator).
- [ ] Visit `/stats` and `/stats/strength--<id8>` in the built fixture artifact (`.svelte-kit/cloudflare/`) and confirm the content matches the fixture.
- [ ] Confirm `git status --short` clean.
- [ ] Update the coordinator's phase index row 4 status to ✅.

---

[← Previous phase](03-entity-scaffolding.md) · [Next phase →](05-item-category.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
