import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";
import type { EmitAssetsOutput } from "./emit-assets.ts";

export {
  ITEM_READ_MODEL_DDL,
  emitItemReadModels,
  prepareEntityNodeWriter,
  deriveEntityNodeSlug,
  type EntityNodeInput,
  type EntityNodeWriter,
} from "../entities/item/read-models.ts";
export {
  STAT_TYPE_READ_MODEL_DDL,
  emitStatTypeReadModels,
} from "../entities/stat-type/read-models.ts";
export {
  ITEM_CATEGORY_READ_MODEL_DDL,
  emitItemCategoryReadModels,
} from "../entities/item-category/read-models.ts";
export {
  ITEM_TAG_READ_MODEL_DDL,
  emitItemTagReadModels,
} from "../entities/item-tag/read-models.ts";
export { MAP_READ_MODEL_DDL, emitMapReadModels } from "../map/read-models.ts";
export { emitPortalReadModels } from "../entities/portal/read-models.ts";
import { emitItemReadModels } from "../entities/item/read-models.ts";
import { emitStatTypeReadModels } from "../entities/stat-type/read-models.ts";
import { emitItemCategoryReadModels } from "../entities/item-category/read-models.ts";
import { emitItemTagReadModels } from "../entities/item-tag/read-models.ts";
import { emitMapReadModels } from "../map/read-models.ts";
import { emitPortalReadModels } from "../entities/portal/read-models.ts";
import {
  auditEntityGraph,
  insertPipelineDiagnostics,
} from "../relationships/relationship-graph.ts";

export function emitReadModels(
  db: Database,
  desc: LoadDescriptorsOutput,
  snapshot: LoadSnapshotOutput,
  assets?: EmitAssetsOutput,
): void {
  const itemEnvelope = snapshot.envelopes.item;
  if (!itemEnvelope) throw new Error("emit-read-models: missing item envelope");
  emitItemReadModels(
    db,
    desc,
    assets?.itemIconMetadata ?? [],
    itemEnvelope,
    snapshot.masterTooltip,
  );

  if (snapshot.envelopes["stat-type"]) {
    emitStatTypeReadModels(db, snapshot.masterTooltip, desc.entities["stat-type"]?.site?.route);
  }
  if (snapshot.envelopes["item-category"]) {
    emitItemCategoryReadModels(db, desc.entities["item-category"]?.site?.route);
  }
  if (snapshot.envelopes["item-tag"]) {
    emitItemTagReadModels(db, desc.entities["item-tag"]?.site?.route);
  }
  const mapEntityIds = Object.keys(desc.entities)
    .filter((entityId) => desc.entities[entityId]?.map && snapshot.envelopes[entityId])
    .sort();
  if (mapEntityIds.length > 0) {
    emitMapReadModels(db, mapEntityIds, "/map");
  }
  // Portal connectivity targets the nodes the map emitter publishes, so it runs
  // after it.
  const readModelDiagnostics = snapshot.envelopes.portal ? emitPortalReadModels(db) : [];

  // Audited once, after every emitter: the graph invariant is about the whole
  // graph, and an audit run mid-way silently exempts whatever is emitted later.
  const graphDiagnostics = auditEntityGraph(db);
  insertPipelineDiagnostics(
    db,
    [...readModelDiagnostics, ...graphDiagnostics],
    "entity-graph-read-model",
  );
  const fatalGraphDiagnostics = graphDiagnostics.filter(
    (diagnostic) => diagnostic.severity === "fatal",
  );
  if (fatalGraphDiagnostics.length > 0) {
    throw new Error(
      `pipeline rejected entity graph: ${fatalGraphDiagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
    );
  }
}
