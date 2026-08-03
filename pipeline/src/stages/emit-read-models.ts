import type { Database } from "bun:sqlite";
import type { LoadDescriptorsOutput } from "./load-descriptors.ts";
import type { LoadSnapshotOutput } from "./load-snapshot.ts";
import type { EmitAssetsOutput } from "./emit-assets.ts";
import type { PipelineDiagnostic } from "../relationships/relationship-graph.ts";

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
export { emitRelationshipSections } from "../relationships/relationship-sections.ts";
export { emitPortalReadModels } from "../entities/portal/read-models.ts";
import { entityRegistry } from "../entities/registry";
import { emitMapReadModels } from "../map/read-models.ts";
import {
  auditEntityGraph,
  insertPipelineDiagnostics,
} from "../relationships/relationship-graph.ts";
import { emitRelationshipSections } from "../relationships/relationship-sections.ts";

export function emitReadModels(
  db: Database,
  desc: LoadDescriptorsOutput,
  snapshot: LoadSnapshotOutput,
  assets?: EmitAssetsOutput,
): void {
  const requiredEntry = Object.entries(entityRegistry).find(
    ([, module]) => module.requiredSnapshot,
  );
  if (!requiredEntry || !snapshot.envelopes[requiredEntry[0]]) {
    throw new Error(
      requiredEntry?.[1].requiredSnapshot?.readModelError ??
        "emit-read-models: missing required entity envelope",
    );
  }

  const readModelDiagnostics: PipelineDiagnostic[] = [];
  // Item read models run first. The remaining per-entity emitters follow the
  // registry order before map read models are emitted.
  for (const [entityId, module] of Object.entries(entityRegistry)) {
    if (!module.readModel || module.readModelPhase === "after-map") continue;
    const entity = desc.entities[entityId];
    const envelope = snapshot.envelopes[entityId];
    if (!entity || !envelope) continue;
    readModelDiagnostics.push(
      ...(module.readModel({
        db,
        desc,
        snapshot,
        ...(assets === undefined ? {} : { assets }),
        entity,
        variants: desc.variants[entityId] ?? [],
        envelope,
      }) ?? []),
    );
  }

  const mapEntityIds = Object.keys(desc.entities)
    .filter((entityId) => desc.entities[entityId]?.map && snapshot.envelopes[entityId])
    .sort();
  if (mapEntityIds.length > 0) {
    emitMapReadModels(db, mapEntityIds, "/map");
  }
  // Portal connectivity targets the nodes the map emitter publishes, so it runs
  // after map read models. The graph audit below runs last over everything.
  for (const [entityId, module] of Object.entries(entityRegistry)) {
    if (module.readModelPhase !== "after-map" || !module.readModel) continue;
    const entity = desc.entities[entityId];
    const envelope = snapshot.envelopes[entityId];
    if (!entity || !envelope) continue;
    readModelDiagnostics.push(
      ...(module.readModel({
        db,
        desc,
        snapshot,
        ...(assets === undefined ? {} : { assets }),
        entity,
        variants: desc.variants[entityId] ?? [],
        envelope,
      }) ?? []),
    );
  }

  emitRelationshipSections(db);
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
