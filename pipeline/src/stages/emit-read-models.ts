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
export {
  LOCATION_READ_MODEL_DDL,
  emitLocationReadModels,
} from "../entities/location/read-models.ts";

import { emitItemReadModels } from "../entities/item/read-models.ts";
import { emitStatTypeReadModels } from "../entities/stat-type/read-models.ts";
import { emitItemCategoryReadModels } from "../entities/item-category/read-models.ts";
import { emitItemTagReadModels } from "../entities/item-tag/read-models.ts";
import { emitLocationReadModels } from "../entities/location/read-models.ts";

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
  if (snapshot.envelopes.location) {
    emitLocationReadModels(db);
  }
}
