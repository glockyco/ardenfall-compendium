[← Previous phase](01-master-tooltip.md) · [Next phase →](03-entity-scaffolding.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)

# Phase 2: Slug + ID8 routing core

**Spec coverage:** §4.6.

**Why second:** every new entity public page from Phase 4 onwards routes through `<plural>/<kebab-slug>--<id8>`. The pipeline needs deterministic slug generation, a uniqueness audit, and a route resolver before any new entity ships. We do NOT cut existing item routes over here — only build the infrastructure. The cutover for items happens in Phase 16.

**Outcome:** `entity_nodes` schema carries `short_id` and `canonical_slug` columns with the canonical shape; a pipeline helper `derive-slug.ts` produces `<kebab>--<id8>` from any `(displayName, assetGuid)` pair; a uniqueness audit fires diagnostics on collision; a SvelteKit param matcher resolves `<slug>--<id8>` segments into `(slug, id8)` pairs; `entity_redirects` carries the `legacy-id` + `name-changed` reasons.

### Task 2.1: `derive-slug.ts` helper + tests

**Files:**

- Create: `pipeline/src/slug/derive-slug.ts`
- Create: `pipeline/test/derive-slug.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// pipeline/test/derive-slug.test.ts
import { describe, expect, it } from "bun:test";
import { deriveSlug, deriveShortId, kebab } from "$pipeline/slug/derive-slug";

describe("kebab", () => {
  it("lowercases ASCII and collapses non-alphanumerics", () => {
    expect(kebab("Iron Sword")).toBe("iron-sword");
    expect(kebab("  POTION of  Lesser   Restore Health!! ")).toBe(
      "potion-of-lesser-restore-health",
    );
    expect(kebab("BASE Arrow")).toBe("base-arrow");
  });

  it("strips leading and trailing dashes", () => {
    expect(kebab("--Foo--")).toBe("foo");
  });

  it("returns an empty string when input has no alphanumerics", () => {
    expect(kebab("!!!")).toBe("");
  });
});

describe("deriveShortId", () => {
  it("takes the first 8 hex characters before any '.' suffix", () => {
    expect(deriveShortId("4ed202185a05d98439595e3fcab021c8.11400000")).toBe("4ed20218");
    expect(deriveShortId("ABCDEF0123")).toBe("abcdef01");
  });

  it("throws when the asset id has fewer than 8 hex characters", () => {
    expect(() => deriveShortId("abc")).toThrow(/short_id/);
  });
});

describe("deriveSlug", () => {
  it("composes `<kebab>--<id8>`", () => {
    expect(
      deriveSlug({
        displayName: "Iron Sword",
        assetId: "4ed202185a05d98439595e3fcab021c8.11400000",
      }),
    ).toBe("iron-sword--4ed20218");
  });

  it("falls back to `entity--<id8>` when the displayName slugs to empty", () => {
    expect(
      deriveSlug({ displayName: "???", assetId: "4ed202185a05d98439595e3fcab021c8.11400000" }),
    ).toBe("entity--4ed20218");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test pipeline/test/derive-slug.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the helper**

```ts
// pipeline/src/slug/derive-slug.ts
export function kebab(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
}

export function deriveShortId(assetId: string): string {
  const head = assetId.split(".", 1)[0] ?? "";
  if (head.length < 8 || !/^[0-9a-fA-F]+$/.test(head.slice(0, 8))) {
    throw new Error(
      `cannot derive short_id from asset id '${assetId}': need 8 hex characters before any '.' suffix`,
    );
  }
  return head.slice(0, 8).toLowerCase();
}

export interface DeriveSlugInput {
  displayName: string;
  assetId: string;
}

export function deriveSlug(input: DeriveSlugInput): string {
  const head = kebab(input.displayName) || "entity";
  return `${head}--${deriveShortId(input.assetId)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test pipeline/test/derive-slug.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add pipeline/src/slug/derive-slug.ts pipeline/test/derive-slug.test.ts
git commit -m "feat(pipeline): derive slug and short id"
```

### Task 2.2: `entity_nodes` DDL gains `short_id` column + uniqueness constraints

**Files:**

- Modify: `pipeline/src/relationships/relationship-graph.ts` (locate `entity_nodes` CREATE TABLE; extend schema; add new indexes; do NOT break existing inserts)
- Modify: `pipeline/test/relationship-graph.test.ts` (assert new columns + uniqueness)
- Modify: `pipeline/src/stages/emit-read-models.ts` (every `INSERT INTO entity_nodes` callsite must now populate `short_id`)

- [ ] **Step 1: Write the failing test**

```ts
// in pipeline/test/relationship-graph.test.ts under the existing describe
it("enforces (entity_type, canonical_slug) uniqueness on entity_nodes", () => {
  const db = new Database(":memory:");
  db.exec(buildRelationshipDDL());
  db.run(
    `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, is_public)
     VALUES ('item', 'a', 'A', '/items/a--abc12345', 'a--abc12345', 'abc12345', 1)`,
  );
  expect(() =>
    db.run(
      `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, is_public)
       VALUES ('item', 'b', 'B', '/items/a--abc12345', 'a--abc12345', 'abc12345', 1)`,
    ),
  ).toThrow(/UNIQUE/);
});

it("enforces (entity_type, short_id) uniqueness on entity_nodes", () => {
  const db = new Database(":memory:");
  db.exec(buildRelationshipDDL());
  db.run(
    `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, is_public)
     VALUES ('item', 'a', 'A', '/items/foo--abc12345', 'foo--abc12345', 'abc12345', 1)`,
  );
  expect(() =>
    db.run(
      `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, is_public)
       VALUES ('item', 'b', 'B', '/items/bar--abc12345', 'bar--abc12345', 'abc12345', 1)`,
    ),
  ).toThrow(/UNIQUE/);
});
```

Pull the relationship-graph DDL into a `buildRelationshipDDL` helper if not already exported; import where the test needs it.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test pipeline/test/relationship-graph.test.ts`
Expected: FAIL — column does not exist.

- [ ] **Step 3: Extend the DDL**

In `pipeline/src/relationships/relationship-graph.ts`, modify the `entity_nodes` CREATE TABLE statement to add `short_id TEXT NOT NULL` plus the two unique indexes:

```ts
// excerpt — replace the existing CREATE TABLE entity_nodes (...) and trailing index block
CREATE TABLE entity_nodes (
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  label           TEXT NOT NULL,
  route_path      TEXT NOT NULL,
  canonical_slug  TEXT NOT NULL,
  short_id        TEXT NOT NULL,
  is_public       INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (entity_type, entity_id)
);
CREATE UNIQUE INDEX idx_entity_nodes_slug     ON entity_nodes (entity_type, canonical_slug);
CREATE UNIQUE INDEX idx_entity_nodes_short_id ON entity_nodes (entity_type, short_id);
```

Update every `INSERT INTO entity_nodes (...)` callsite in `pipeline/src/stages/emit-read-models.ts` and any other caller to pass `short_id` derived via `deriveShortId(entity_id)` (or `deriveShortId(snapshotRow.id)` for items).

Also update the canonical_slug emission to use `deriveSlug({displayName, assetId})` instead of the current placeholder pattern (the current Slice 4 emits the raw asset id as canonical_slug for items).

- [ ] **Step 4: Update existing tests that touch entity_nodes**

Search for `INSERT INTO entity_nodes` and `entity_nodes` in `pipeline/test/`. Update fixtures + assertions so the new column populates with realistic values.

- [ ] **Step 5: Run pipeline tests**

Run: `bun test pipeline/test`
Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add pipeline/src/relationships/relationship-graph.ts pipeline/src/stages/emit-read-models.ts pipeline/test/relationship-graph.test.ts pipeline/test/read-models.test.ts
git commit -m "feat(pipeline): add short_id and slug uniqueness to entity_nodes"
```

### Task 2.3: Slug uniqueness audit (pipeline diagnostic)

**Files:**

- Modify: `pipeline/src/relationships/relationship-graph.ts` (extend `auditEntityGraph` to detect duplicate short_ids per entity type)
- Modify: `pipeline/test/relationship-graph.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/relationship-graph.test.ts
it("emits a fatal slugCollision diagnostic when two nodes share a (entity_type, short_id)", () => {
  const db = new Database(":memory:");
  db.exec(buildRelationshipDDL());
  // We bypass the index to simulate an upstream extractor bug.
  db.exec("DROP INDEX idx_entity_nodes_short_id;");
  db.run(
    `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, is_public)
     VALUES ('item', 'a', 'A', '/items/a--abc12345', 'a--abc12345', 'abc12345', 1)`,
  );
  db.run(
    `INSERT INTO entity_nodes (entity_type, entity_id, label, route_path, canonical_slug, short_id, is_public)
     VALUES ('item', 'b', 'B', '/items/b--abc12345', 'b--abc12345', 'abc12345', 1)`,
  );
  const diagnostics = auditEntityGraph(db);
  expect(diagnostics).toContainEqual(
    expect.objectContaining({ severity: "fatal", code: "slugCollision" }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test pipeline/test/relationship-graph.test.ts`
Expected: FAIL — `auditEntityGraph` does not detect this.

- [ ] **Step 3: Extend `auditEntityGraph`**

```ts
// in pipeline/src/relationships/relationship-graph.ts auditEntityGraph()
for (const row of db
  .query<{ entity_type: string; short_id: string; cnt: number }, []>(
    `SELECT entity_type, short_id, COUNT(*) AS cnt
     FROM entity_nodes
     GROUP BY entity_type, short_id
     HAVING COUNT(*) > 1`,
  )
  .all()) {
  diagnostics.push({
    severity: "fatal",
    source: "relationship-graph",
    code: "slugCollision",
    message: `short_id '${row.short_id}' collides ${row.cnt} times within entity_type '${row.entity_type}'`,
    entityType: row.entity_type,
    entityId: null,
    field: "entity_nodes.short_id",
    evidence: { shortId: row.short_id, occurrences: row.cnt },
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test pipeline/test/relationship-graph.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add pipeline/src/relationships/relationship-graph.ts pipeline/test/relationship-graph.test.ts
git commit -m "feat(pipeline): audit slug collisions"
```

### Task 2.4: SvelteKit `<slug>--<id8>` param matcher

SvelteKit's default `[slug]` matcher accepts any non-`/` string, so routes like `/items/iron-sword--abc12345` resolve to `params.slug === "iron-sword--abc12345"`. We add a typed helper that splits the slug back into `(humanSlug, shortId)` and validates the shape, used by every detail-route loader.

**Files:**

- Create: `site/src/lib/server/route-slug.ts`
- Create: `site/src/lib/server/route-slug.test.ts`
- Modify: `site/src/lib/server/read-models.ts` (add `getEntityNodeBySlug(entityType, slug)` that consults `entity_nodes` by `canonical_slug` and `(entity_type, short_id)` fallback)

- [ ] **Step 1: Write the failing test**

```ts
// site/src/lib/server/route-slug.test.ts
import { describe, expect, it } from "bun:test";
import { parseSlugParam } from "$lib/server/route-slug";

describe("parseSlugParam", () => {
  it("splits `<kebab>--<id8>` into parts", () => {
    expect(parseSlugParam("iron-sword--4ed20218")).toEqual({
      slug: "iron-sword--4ed20218",
      humanSlug: "iron-sword",
      shortId: "4ed20218",
      hasShortId: true,
    });
  });

  it("rejects malformed slugs", () => {
    expect(parseSlugParam("iron-sword")).toEqual({
      slug: "iron-sword",
      humanSlug: "iron-sword",
      shortId: null,
      hasShortId: false,
    });
    expect(parseSlugParam("--abc12345")).toEqual({
      slug: "--abc12345",
      humanSlug: "",
      shortId: "abc12345",
      hasShortId: true,
    });
  });

  it("accepts only lowercase hex for the short id", () => {
    expect(parseSlugParam("iron-sword--ABC12345")).toEqual({
      slug: "iron-sword--ABC12345",
      humanSlug: "iron-sword--abc12345",
      shortId: null,
      hasShortId: false,
    });
  });
});
```

Note the last case: uppercase hex is rejected because canonical slugs are always lowercase. The route handler in Phase 4+ will 301 such requests to the lowercase canonical.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun --cwd site test src/lib/server/route-slug.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// site/src/lib/server/route-slug.ts
export interface ParsedSlug {
  slug: string;
  humanSlug: string;
  shortId: string | null;
  hasShortId: boolean;
}

const SLUG_RE = /^([a-z0-9-]*)--([0-9a-f]{8})$/;

export function parseSlugParam(slug: string): ParsedSlug {
  const match = SLUG_RE.exec(slug);
  if (!match) {
    return {
      slug,
      humanSlug: slug.toLowerCase().replaceAll(/[^a-z0-9-]+/g, "-"),
      shortId: null,
      hasShortId: false,
    };
  }
  return {
    slug,
    humanSlug: match[1] ?? "",
    shortId: match[2] ?? null,
    hasShortId: true,
  };
}
```

- [ ] **Step 4: Add `getEntityNodeBySlug` to read-models**

In `site/src/lib/server/read-models.ts`, add:

```ts
export interface EntityNodeRow {
  entityType: string;
  entityId: string;
  label: string;
  routePath: string;
  canonicalSlug: string;
  shortId: string;
  isPublic: boolean;
}

export const getEntityNodeBySlug = (
  entityType: string,
  canonicalSlug: string,
): EntityNodeRow | undefined =>
  get<EntityNodeRow>(
    `SELECT entity_type AS entityType, entity_id AS entityId, label, route_path AS routePath,
            canonical_slug AS canonicalSlug, short_id AS shortId, is_public AS isPublic
     FROM entity_nodes
     WHERE entity_type = ? AND canonical_slug = ? AND is_public = 1`,
    [entityType, canonicalSlug],
  );

export const getEntityNodeByShortId = (
  entityType: string,
  shortId: string,
): EntityNodeRow | undefined =>
  get<EntityNodeRow>(
    `SELECT entity_type AS entityType, entity_id AS entityId, label, route_path AS routePath,
            canonical_slug AS canonicalSlug, short_id AS shortId, is_public AS isPublic
     FROM entity_nodes
     WHERE entity_type = ? AND short_id = ? AND is_public = 1`,
    [entityType, shortId],
  );
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun --cwd site test src/lib/server/route-slug.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add site/src/lib/server/route-slug.ts site/src/lib/server/route-slug.test.ts site/src/lib/server/read-models.ts
git commit -m "feat(site): parse canonical slug parameter"
```

### Task 2.5: `entity_redirects` reasons + Cloudflare `_redirects` emitter

**Files:**

- Modify: `pipeline/src/relationships/relationship-graph.ts` (extend the existing `entity_redirects` schema with a `reason` enum constraint; existing schema already has `reason TEXT NOT NULL` per Slice 4 — confirm and enforce values `legacy-id|name-changed|merged`)
- Create: `pipeline/src/stages/emit-redirects.ts` (new pipeline stage that reads `entity_redirects` and writes a Cloudflare `_redirects` file to the artifact directory)
- Create: `pipeline/test/emit-redirects.test.ts`
- Modify: `pipeline/src/cli.ts` (register the new stage in the orchestrator, ordered after `emit-sqlite`)
- Modify: `pipeline/src/artifacts/manifest.ts` (artifact manifest includes a `redirectsCount` count)

- [ ] **Step 1: Write the failing test**

```ts
// pipeline/test/emit-redirects.test.ts
import { describe, expect, it } from "bun:test";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { emitRedirects } from "$pipeline/stages/emit-redirects";
import { buildRelationshipDDL } from "$pipeline/relationships/relationship-graph";

describe("emit-redirects stage", () => {
  it("writes a Cloudflare _redirects file from entity_redirects", () => {
    const root = mkdtempSync(join(tmpdir(), "ardenfall-redirects-"));
    try {
      const dbPath = join(root, "data.sqlite");
      const db = new Database(dbPath);
      db.exec(buildRelationshipDDL());
      db.run(
        `INSERT INTO entity_redirects (source_type, source_id, target_type, target_id, reason)
         VALUES ('item-route', '/items/4ed202185a05d98439595e3fcab021c8.11400000', 'item', 'iron-sword--4ed20218', 'legacy-id')`,
      );
      db.run(
        `INSERT INTO entity_redirects (source_type, source_id, target_type, target_id, reason)
         VALUES ('item-route', '/items/old-name--4ed20218', 'item', 'new-name--4ed20218', 'name-changed')`,
      );
      db.close();

      mkdirSync(join(root, "static"), { recursive: true });
      const out = emitRedirects({ sqlitePath: dbPath, outputDir: join(root, "static") });

      expect(out.count).toBe(2);
      const body = readFileSync(join(root, "static", "_redirects"), "utf8");
      expect(body).toContain(
        "/items/4ed202185a05d98439595e3fcab021c8.11400000 /items/iron-sword--4ed20218 301",
      );
      expect(body).toContain("/items/old-name--4ed20218 /items/new-name--4ed20218 301");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test pipeline/test/emit-redirects.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the stage**

```ts
// pipeline/src/stages/emit-redirects.ts
import { Database } from "bun:sqlite";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Stage } from "../types.ts";

export interface EmitRedirectsInput {
  sqlitePath: string;
  outputDir: string;
}

export interface EmitRedirectsOutput {
  count: number;
  filePath: string;
}

interface RedirectRow {
  source_id: string;
  target_id: string;
  reason: string;
}

export function emitRedirects(input: EmitRedirectsInput): EmitRedirectsOutput {
  const db = new Database(input.sqlitePath, { readonly: true });
  let rows: RedirectRow[] = [];
  try {
    rows = db
      .query<RedirectRow, []>(
        `SELECT source_id, target_id, reason
         FROM entity_redirects
         WHERE source_type = 'item-route'
         ORDER BY source_id`,
      )
      .all();
  } finally {
    db.close();
  }
  const lines = rows.map((row) => `${row.source_id} ${this.routeFor(row.target_id)} 301`);
  // The redirect target_id is an entity_id, not a route. The site builds routes from
  // canonical_slug. We resolve here by querying entity_nodes.
  // (See implementation below — using a single DB pass is fine.)
  const filePath = join(input.outputDir, "_redirects");
  writeFileSync(filePath, lines.join("\n") + "\n");
  return { count: rows.length, filePath };
}
```

Resolve the redirect target into a real route by joining `entity_redirects` with `entity_nodes` in a single query. Replace the placeholder above with the real implementation:

```ts
rows = db
  .query<{ source: string; route: string }, []>(
    `SELECT r.source_id AS source, n.route_path AS route
     FROM entity_redirects r
     JOIN entity_nodes n
       ON n.entity_type = r.target_type AND n.entity_id = r.target_id
     WHERE r.source_type = 'item-route' AND n.is_public = 1
     ORDER BY r.source_id`,
  )
  .all();

const lines = rows.map((row) => `${row.source} ${row.route} 301`);
```

- [ ] **Step 4: Register the stage in the CLI orchestrator**

In `pipeline/src/cli.ts`, after the existing `emitSqlite` invocation, invoke `emitRedirects({ sqlitePath: e.outputPath, outputDir: <artifactRoot> })`. Add `redirectsCount: out.count` to the artifact manifest counts.

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test pipeline/test/emit-redirects.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```sh
git add pipeline/src/stages/emit-redirects.ts pipeline/test/emit-redirects.test.ts pipeline/src/cli.ts pipeline/src/artifacts/manifest.ts
git commit -m "feat(pipeline): emit cloudflare redirects"
```

### Task 2.6: Phase 2 verification gate

- [ ] Run the standard phase gate.
- [ ] Run `bun run artifact:fixture synthetic fixtures/synthetic/snapshot` and confirm the fixture release artifact contains `static/_redirects` (currently empty — no redirects until Phase 16, but the file must exist with a header comment).
- [ ] `git status --short` clean.

---

[← Previous phase](01-master-tooltip.md) · [Next phase →](03-entity-scaffolding.md) · [Coordinator](../2026-05-20-items-presentation-closure.md)
