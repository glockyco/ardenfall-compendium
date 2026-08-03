import { describe, expect, it } from "bun:test";
import { locationField } from "$pipeline/entities/location/canonicaliser";
import { portalField } from "$pipeline/entities/portal/canonicaliser";
import { loadDescriptors } from "$pipeline/stages/load-descriptors";
import { locationFieldNames, portalFieldNames } from "../dist/entity-fields.mjs";
import type { LocationSnapshotFields, PortalSnapshotFields } from "$pipeline/types";

const context = {
  workspaceRoot: ".",
  snapshotDir: "",
  outDir: "",
  log: () => undefined,
};

describe("canonicaliser field contracts", () => {
  it("keeps the generated location field names in exact descriptor sync", async () => {
    const { entities } = await loadDescriptors.run({}, context);
    if (!entities.location) throw new Error("location descriptor not loaded");
    expect(entities.location.fields.map((field) => field.name)).toEqual([...locationFieldNames]);
  });

  it("keeps the generated portal field names in exact descriptor sync", async () => {
    const { entities } = await loadDescriptors.run({}, context);
    if (!entities.portal) throw new Error("portal descriptor not loaded");
    expect(entities.portal.fields.map((field) => field.name)).toEqual([...portalFieldNames]);
  });

  it("reads fields through the descriptor-constrained accessors", () => {
    const locationFields = { mapPosition: { x: 1, y: 2, z: 3 } } as LocationSnapshotFields;
    const portalFields = {
      recordRef: { kind: "missing", reason: "fixture", source: "fixture" },
    } as PortalSnapshotFields;
    expect(locationField(locationFields, "mapPosition")).toEqual({ x: 1, y: 2, z: 3 });
    expect(portalField(portalFields, "recordRef")).toEqual({
      kind: "missing",
      reason: "fixture",
      source: "fixture",
    });
  });
});
